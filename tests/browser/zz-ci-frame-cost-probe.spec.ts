import { expect, test, type Page } from '@playwright/test';


// THROWAWAY CI PROBE (never merged): the frame-cost verdict on CI hardware, three times in the detected tier and once with the blend forced.
test.use({ launchOptions: { args: ['--use-angle=swiftshader'] } });

const ROUNDS = 5;
const FRAMES = 8;
const WARM = 2;

type Style = 'moebius' | 'de';
const MENU_LABEL: Record<Style, string> = { moebius: 'Art style: Moebius', de: 'Art style: Natural' };

interface FrameCostProbe {
  measuring: boolean;
  costs: number[];
}

/** Wraps every animation-frame callback, before the game boots, so a world frame is timed on its own. */
async function installFrameCostProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: FrameCostProbe = { measuring: false, costs: [] };
    (window as unknown as { __frameCostProbe: FrameCostProbe }).__frameCostProbe = probe;
    const request = window.requestAnimationFrame.bind(window);
    const pixel = new Uint8Array(4);
    window.requestAnimationFrame = (callback) => request((time) => {
      const canvas = probe.measuring ? document.querySelector<HTMLCanvasElement>('.voxel-world-canvas') : null;
      const gl = canvas?.getContext('webgl2');
      const api = window.__AOE2_TEST__;
      if (!gl || !api) {
        callback(time);
        return;
      }
      const drawnBefore = api.getWorldRendererState().framesDrawn;
      // The world canvas's own framebuffer is bound between frames, so neither read disturbs what Three binds.
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const start = performance.now();
      callback(time);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const cost = performance.now() - start;
      if (api.getWorldRendererState().framesDrawn !== drawnBefore) probe.costs.push(cost);
    });
  });
}

/** The next `count` world frames' costs, in milliseconds. */
async function frameCosts(page: Page, count: number): Promise<number[]> {
  return page.evaluate(async (wanted) => {
    const probe = (window as unknown as { __frameCostProbe: FrameCostProbe }).__frameCostProbe;
    probe.costs = [];
    probe.measuring = true;
    const deadline = performance.now() + 60_000;
    while (probe.costs.length < wanted && performance.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 20); });
    }
    probe.measuring = false;
    return probe.costs.slice(0, wanted);
  }, count);
}

/** Switches the style through the game menu's own art-style row. Its click handler is called directly rather than
 *  through a pointer: art-style-setting.spec.ts drives the real click, and here every Playwright action waits two
 *  frames for the page to settle, which on SwiftShader is seconds per switch. */
async function drawStyle(page: Page, style: Style): Promise<void> {
  const drawn = await page.evaluate((label) => {
    const row = document.querySelector<HTMLButtonElement>('[data-hud="menu-art-style-cycle"]')!;
    for (let clicks = 0; clicks < 2 && row.getAttribute('aria-label') !== label; clicks += 1) row.click();
    return { label: row.getAttribute('aria-label'), style: window.__AOE2_TEST__!.getWorldRendererState().artStyle };
  }, MENU_LABEL[style]);
  expect(drawn, `the menu row asked for ${style}`).toEqual({ label: MENU_LABEL[style], style });
}

function lowerQuartile(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 4)]!;
}

async function verdict(page: Page, label: string, forceBlend: boolean): Promise<void> {
  const started = Date.now();
  await installFrameCostProbe(page);
  if (forceBlend) await page.addInitScript(() => { window.localStorage.setItem('aoe2:de-ground-tier', 'blend'); });
  // A paused boot, as waitForPausedBootWithSeed does it, but confirming the seed with one light read rather than
  // polling full snapshots for five seconds, which a frame as slow as the regression this gate exists for outlasts.
  await page.addInitScript(() => {
    const timer = window.setInterval(() => {
      if (!window.__AOE2_TEST__) return;
      window.__AOE2_TEST__.setPaused(true);
      window.clearInterval(timer);
    }, 0);
  });
  await page.goto('/?seed=aoe2-prototype');
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__AOE2_TEST__!.getHudState().seed)).toBe('aoe2-prototype');
  await page.addStyleTag({ content: '* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }' });
  const renderer = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().rasteriser);
  expect(renderer, 'the renderer the game canvas\'s WebGL context names').toMatch(/SwiftShader/);

  for (const style of ['de', 'moebius'] as const) {
    await drawStyle(page, style);
    expect((await frameCosts(page, 2)).length, `world frames drawn in ${style} before timing`).toBe(2);
  }
  const rounds: Array<{ moebius: number; de: number }> = [];
  let deTier = '';
  for (let round = 0; round < ROUNDS; round += 1) {
    const cost = { moebius: 0, de: 0 };
    for (const style of ['moebius', 'de'] as const) {
      await drawStyle(page, style);
      if (style === 'de') deTier = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().groundTier);
      await frameCosts(page, WARM);
      const costs = await frameCosts(page, FRAMES);
      expect(costs.length, `world frames timed in ${style}`).toBe(FRAMES);
      cost[style] = lowerQuartile(costs);
    }
    rounds.push(cost);
  }
  const ratios = rounds.map((round) => round.de / round.moebius).sort((a, b) => a - b);
  const verdict = ratios[Math.floor(ratios.length / 2)]!;
  const seen = rounds.map((round) => `${round.moebius.toFixed(1)}/${round.de.toFixed(1)}`).join(', ');
  console.log(`[frame cost] Natural over Moebius ${verdict.toFixed(3)} (Moebius/Natural lower-quartile ms per round: ${seen}; Natural ground tier ${deTier}; ${renderer})`);
  console.log('[ci probe]', label, 'wall ms', Date.now() - started);
}

test('ci probe: frame cost verdicts', async ({ browser, baseURL }) => {
  test.setTimeout(900_000);
  for (const [label, blend] of [['auto 1', false], ['auto 2', false], ['auto 3', false], ['forced blend', true]] as const) {
    const context = await browser.newContext({ baseURL, viewport: { width: 800, height: 600 } });
    await verdict(await context.newPage(), label, blend);
    await context.close();
  }
});
