// A raid that keeps hitting keeps the warning up, and a pause does not take it
// down (v0.3.229, defect register 2026-09-24).
//
// THE DEFECT: the minimap mark lived 8 s of WALL CLOCK, while the throttle
// that re-raises it counts 200 SIMULATION ticks — 13.3 s at normal speed. So
// during a sustained raid the minimap was dark for about 40% of the time, and
// in a paused game the mark was gone 8 s after the last horn.
//
// THE CLASS this gates: while an enemy is still hitting the human's economy,
// or while the game is paused mid-raid, the mark is on the minimap above the
// visibility floor on EVERY rendered frame, and the words come with each
// horn. Frames, not a wall-clock window: the page samples its own canvas on
// every animation frame, so a slow host renders fewer frames but never makes
// a dark one look lit.
//
// HOW: `raid-warning-fixture` gives the human a lone House far from its Town
// Center and puts two of owner 2's Militia beside it with the AI off. The
// spec orders them onto the House through the command pipeline, runs the
// match in real time at `?speed=normal` (1.5x), then pauses it with F3, the
// real DE pause key.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - One fixture, one target (a House), one speed (normal). The speed's
//    arithmetic at every preset is `tests/ui/raidWarning.test.ts`.
//  - The run must span BOTH the old 8 s flash on the wall clock and the
//    200-tick throttle, with hits on both sides; the instrument checks below
//    fail by name if the host did not get that far, rather than passing.
//  - The mark is read one frame late: the sampler's frame callback can run
//    before the HUD's repaint in the same frame. That shifts every sample by
//    one frame and cannot turn a dark frame lit.
//  - Ticks per wall second must beat 10 (the fastest `slow` can go) to show
//    `?speed=normal` took effect. A host under 4 frames a second cannot
//    reach it and fails that check by name.
import { expect, test } from '@playwright/test';
import { ALERT_SCREEN_PIXEL_FLOOR, WHITE_ENOUGH, countOnCanvas } from './helpers/attackWarningPixels';

const HOUSE_DAMAGE_WINDOW_TICKS = 280;
const OLD_FLASH_MS = 8_000;

interface Sample {
  tick: number;
  ms: number;
  lit: number;
  houseHp: number | null;
}

declare global {
  interface Window {
    __aoe2CountAlert?: (canvas: HTMLCanvasElement, floor: number) => number;
    __aoe2AlertToasts?: Array<{ text: string; tick: number }>;
  }
}

/** Sample every frame until the stop condition holds or the budget runs out. */
async function sampleFrames(
  page: import('@playwright/test').Page,
  houseId: number,
  stop: { ticksPast: number; msPast: number },
): Promise<{ samples: Sample[]; timedOut: boolean }> {
  return page.evaluate(({ id, ticksPast, msPast, floor }) => new Promise((resolve) => {
    const api = window.__AOE2_TEST__!;
    const canvas = document.querySelector<HTMLCanvasElement>('[data-hud="minimap"]')!;
    const samples: Sample[] = [];
    const startTick = api.getHudState().tick;
    const startMs = performance.now();
    let settled = false;
    const finish = (timedOut: boolean): void => {
      if (settled) return;
      settled = true;
      resolve({ samples, timedOut });
    };
    window.setTimeout(() => finish(true), 60_000);
    const step = (): void => {
      if (settled) return;
      const tick = api.getHudState().tick;
      const ms = performance.now();
      const house = api.getRenderState().entities.find((entity) => entity.id === id);
      samples.push({ tick, ms, lit: window.__aoe2CountAlert!(canvas, floor), houseHp: house?.currentHp ?? null });
      if (tick - startTick >= ticksPast && ms - startMs >= msPast) finish(false);
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { id: houseId, ticksPast: stop.ticksPast, msPast: stop.msPast, floor: WHITE_ENOUGH });
}

test('a raid that keeps hitting keeps the warning up, and a pause does not take it down', async ({ page }) => {
  test.slow();
  const warnings: string[] = [];
  page.on('console', (message) => {
    if (message.text().includes('?speed=')) warnings.push(message.text());
  });
  await page.addInitScript(() => {
    const timer = window.setInterval(() => {
      if (!window.__AOE2_TEST__) return;
      window.__AOE2_TEST__.setPaused(true);
      window.clearInterval(timer);
    }, 0);
  });
  await page.goto('/?seed=raid-warning-fixture&speed=normal');
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
  expect(warnings, '?speed=normal must be accepted, or this is not the named speed').toEqual([]);
  await page.evaluate(`window.__aoe2CountAlert = ${countOnCanvas.toString()}`);
  // Every alert toast the page raises, with the tick it appeared at.
  await page.evaluate(() => {
    const api = window.__AOE2_TEST__!;
    window.__aoe2AlertToasts = [];
    const container = document.querySelector('[data-hud="toast-container"]')!;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.dataset.hudToastKind === 'alert') {
            window.__aoe2AlertToasts!.push({ text: node.textContent ?? '', tick: api.getHudState().tick });
          }
        }
      }
    }).observe(container, { childList: true });
  });

  const houseId = await page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const economy = api.getEconomyState();
    const house = economy.buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
    if (!house) throw new Error('raid-warning-fixture must give the human a House to raid.');
    for (const militia of economy.units.filter((unit) => unit.owner === 2 && unit.unitType === 'militia')) {
      const result = await api.agent.dispatchAgentCommand(
        { type: 'unit.attack', data: { unitId: militia.id, targetEntityId: house.id, targetEntityKind: 'building' } },
        { expectedOwner: 2 },
      );
      if (!result.accepted) throw new Error(`owner 2's militia ${militia.id} refused the attack order: ${JSON.stringify(result)}`);
    }
    return house.id;
  });

  // Run it: real time, at the named speed, sampled every frame.
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(false));
  const running = await sampleFrames(page, houseId, { ticksPast: HOUSE_DAMAGE_WINDOW_TICKS, msPast: OLD_FLASH_MS + 1_500 });
  expect(running.timedOut, 'the match did not cover the raid window inside 60 s of frames').toBe(false);
  const samples = running.samples;
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;

  // Instrument checks: the named speed took effect, and the run spanned both
  // the old flash and the throttle with the raid still landing blows.
  const ticksPerSecond = ((last.tick - first.tick) * 1000) / (last.ms - first.ms);
  expect(ticksPerSecond, `ran at ${ticksPerSecond.toFixed(1)} ticks a second, no faster than slow speed`).toBeGreaterThan(10.5);
  const hitTicks = samples.filter((sample, index) => index > 0
    && sample.houseHp !== null && samples[index - 1]!.houseHp !== null
    && sample.houseHp < samples[index - 1]!.houseHp!).map((sample) => sample.tick);
  expect(hitTicks.length, 'the House was never hit, so nothing was tested').toBeGreaterThan(0);
  const litFrom = samples.findIndex((sample) => sample.lit >= ALERT_SCREEN_PIXEL_FLOOR);
  expect(litFrom, 'the House was hit and the mark never reached the visibility floor').toBeGreaterThanOrEqual(0);
  // A quiet frame before the first blow, or the lit frames prove nothing: the
  // mark could have been up before the raid began.
  expect(litFrom, 'the mark was up on the first frame, before any blow landed').toBeGreaterThan(0);
  expect(first.lit, 'the first frame, before any blow, must be quiet').toBe(0);
  const lit = samples[litFrom]!;
  expect(last.ms - lit.ms, 'the raid did not outlast the old 8 s flash').toBeGreaterThan(OLD_FLASH_MS);
  expect(last.tick - lit.tick, 'the raid did not outlast the 200-tick throttle').toBeGreaterThan(200);
  expect(Math.max(...hitTicks), 'the raid stopped hitting before the window closed').toBeGreaterThan(last.tick - 40);

  test.info().annotations.push({
    type: 'measured',
    description: `${ticksPerSecond.toFixed(1)} ticks/s over ${samples.length} frames; lit at tick ${lit.tick}, `
      + `${hitTicks.length} hits seen; dimmest lit frame ${Math.min(...samples.slice(litFrom).map((sample) => sample.lit)).toFixed(0)} px`,
  });
  // The claim: from the first lit frame on, no frame is dark.
  const dark = samples.slice(litFrom).filter((sample) => sample.lit < ALERT_SCREEN_PIXEL_FLOOR);
  expect(
    dark.map((sample) => `tick ${sample.tick} (+${((sample.ms - lit.ms) / 1000).toFixed(1)} s): ${sample.lit.toFixed(0)} px`),
    `frames with the raid in progress and the mark under the ${ALERT_SCREEN_PIXEL_FLOOR}-pixel floor`,
  ).toEqual([]);

  // The words: one per horn, a throttle window apart, and exactly these.
  const toasts = await page.evaluate(() => window.__aoe2AlertToasts!);
  expect(toasts.map((toast) => toast.text)).toEqual(Array(toasts.length).fill('You are under attack!'));
  expect(toasts.length, 'a raid spanning the throttle must be announced twice').toBeGreaterThanOrEqual(2);
  for (let i = 1; i < toasts.length; i += 1) {
    expect(toasts[i]!.tick - toasts[i - 1]!.tick, 'the words came faster than the horn is throttled').toBeGreaterThanOrEqual(200);
  }

  // Pause with the real key, and hold the pause past the old flash.
  await page.keyboard.press('F3');
  const paused = await sampleFrames(page, houseId, { ticksPast: 0, msPast: OLD_FLASH_MS + 1_500 });
  expect(paused.timedOut).toBe(false);
  const pausedTicks = new Set(paused.samples.slice(1).map((sample) => sample.tick));
  expect(pausedTicks.size, 'F3 did not pause: the tick moved while frames rendered').toBe(1);
  const pausedDark = paused.samples.filter((sample) => sample.lit < ALERT_SCREEN_PIXEL_FLOOR);
  expect(
    pausedDark.map((sample) => `+${((sample.ms - paused.samples[0]!.ms) / 1000).toFixed(1)} s: ${sample.lit.toFixed(0)} px`),
    'paused frames with the mark under the floor — the mark expired on the wall clock',
  ).toEqual([]);
});
