// Coming back from a replay starts the attack warning afresh (defect register
// 2026-09-24).
//
// THE DEFECT, found by reading and then reproduced on `aoe2-prototype` through
// the real menus: save at tick 100, take the raid (announced at hit tick
// 1444), load the tick-100 save, open the closed session in the replay viewer
// and watch it to tick 1780, exit. The same raid then took villager 2205 from
// 25 to 13 hit points in the live match with no mark on the minimap and no
// words, sampled every 10 ticks from 1410 to 1760. The audio controller only
// ever moves its last-seen attack tick forward, and it forgot the old world
// only on a load. Leaving the replay put the live world back behind the same
// controller, still holding the replayed world's ticks, so every live blow up
// to the replay's last tick read as already seen.
//
// THE CLASS this gates: a switch between the live match and a recording is a
// switch of world, so the warning starts afresh, as it does on a load. The
// other half of the rule, that a replay STEP keeps the controller's memory, is
// `attack-warning-replay.spec.ts`, which fails on 37 toasts over 40 steps
// when a step resets.
//
// HOW: `raid-warning-fixture` gives the human a lone House and owner 2 two
// Militia beside it with the AI off. The match is saved at boot through the
// real menu, the Militia raid the House for 260 recorded ticks, and the boot
// save is loaded through the real menu, which closes that session into a
// prior one. The replay viewer opens it (menu, Prior session tab), the
// timeline is dragged to tick 230 and stepped 15 ticks with its step button,
// with frames rendered between, so the audio mount polls replayed blows far
// past the live match's tick. Exit leaves the replay. Then the live raid is
// ordered again and run in 10-tick steps, with frames rendered between.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - One fixture, one recording, one exit, by the Exit button. A load while
//    replaying leaves the replay through the same `exitReplay` and then resets
//    again on the load; it is not driven here.
//  - Entering the replay viewer resets too, by the same subscription. That
//    direction, and a step or a scrub not resetting, are
//    `tests/ui/gameAudioMount.test.ts` over a fake mode source; that the
//    replay controller announces entering and leaving and nothing else is
//    `tests/replay/replayModeChanges.test.ts`.
//  - Instrument checks fail by name rather than pass: the recording must hold
//    a raid, the load must go back to the boot save, the replay must announce
//    a replayed blow at a tick later than every live tick this spec looks at
//    (that is what leaves the old world's memory ahead of the live match),
//    the minimap must be quiet before the live raid, and the live raid must
//    cost the House health.
//  - The words and the mark are checked, not the horn: the horn is audio, and
//    it comes from the same decision as the words in `gameAudioController`.
//    Space's jump target comes from that decision too and is not driven here.
import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
import { ALERT_SCREEN_PIXEL_FLOOR, countAlertScreenPixels } from './helpers/attackWarningPixels';

const RECORDED_RAID_TICKS = 260;
const REPLAY_SCRUB_TICK = 230;
const REPLAY_STEPS = 15;
const LIVE_RAID_TICKS = 120;
const WORDS = 'You are under attack!';

interface RaisedAlert {
  mode: string;
  text: string;
  hitTick: number;
  shownAtTick: number;
}

declare global {
  interface Window {
    __aoe2RaisedAlerts?: RaisedAlert[];
  }
}

async function settleFrames(page: import('@playwright/test').Page): Promise<void> {
  // Three frames: the audio mount's rAF polls the attack feed and raises the
  // mark, the HUD's rAF sees the changed minimap signature, and the repaint
  // lands on the canvas.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
}

async function raisedAlerts(page: import('@playwright/test').Page): Promise<RaisedAlert[]> {
  return page.evaluate(() => [...window.__aoe2RaisedAlerts!]);
}

async function houseHp(page: import('@playwright/test').Page): Promise<number | null> {
  return page.evaluate(() => {
    const api = window.__AOE2_TEST__!;
    const house = api.getRenderState().entities.find((entity) => entity.owner === 1 && entity.entityType === 'house');
    return house?.currentHp ?? null;
  });
}

/** Owner 2's Militia onto the human's House, through the command pipeline. */
async function orderRaid(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const economy = api.getEconomyState();
    const house = economy.buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
    if (!house) throw new Error('raid-warning-fixture must give the human a House to raid.');
    const militia = economy.units.filter((unit) => unit.owner === 2 && unit.unitType === 'militia');
    if (militia.length === 0) throw new Error('raid-warning-fixture must give owner 2 Militia to raid with.');
    for (const unit of militia) {
      const result = await api.agent.dispatchAgentCommand(
        { type: 'unit.attack', data: { unitId: unit.id, targetEntityId: house.id, targetEntityKind: 'building' } },
        { expectedOwner: 2 },
      );
      if (!result.accepted) throw new Error(`owner 2's militia ${unit.id} refused the attack order: ${JSON.stringify(result)}`);
    }
  });
}

async function openMenu(page: import('@playwright/test').Page): Promise<void> {
  // The menu stays open after a save or a load, and its button toggles it.
  if (!(await page.locator('[data-hud="game-menu"]').isVisible())) {
    await page.locator('[data-hud="menu-button"]').click();
  }
  await expect(page.locator('[data-hud="game-menu"]')).toBeVisible();
}

test('the first raid after coming back from a replay watched past the live tick is announced and marked', async ({ page }) => {
  test.slow();
  await game.waitForPausedBootWithSeed(page, 'raid-warning-fixture');
  // Every alert toast the page raises, with the mode it was raised in, the
  // blow it names and the tick the page had reached when it drew it.
  await page.evaluate(() => {
    window.localStorage.removeItem('aoe2-save-v1');
    const api = window.__AOE2_TEST__!;
    window.__aoe2RaisedAlerts = [];
    const container = document.querySelector('[data-hud="toast-container"]')!;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.dataset.hudToastKind === 'alert') {
            window.__aoe2RaisedAlerts!.push({
              mode: api.replay.getReplayMode(),
              text: node.textContent ?? '',
              hitTick: Number(node.dataset.hudToastHitTick),
              shownAtTick: api.getHudState().tick,
            });
          }
        }
      }
    }).observe(container, { childList: true });
  });

  // Save at boot, through the real menu.
  const savedTick = await page.evaluate(() => window.__AOE2_TEST__!.getHudState().tick);
  await openMenu(page);
  await page.locator('[data-hud="save-button"]').click();
  await page.locator('[data-hud="menu-resume"]').click();
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));

  // The recorded raid.
  const hpBeforeRecorded = await houseHp(page);
  await orderRaid(page);
  await page.evaluate((ticks) => { window.__AOE2_TEST__!.advanceTicks(ticks, 100); }, RECORDED_RAID_TICKS);
  const hpAfterRecorded = await houseHp(page);
  expect(hpAfterRecorded !== null && hpBeforeRecorded !== null && hpAfterRecorded < hpBeforeRecorded,
    `the recorded session holds no raid: the House went ${hpBeforeRecorded} -> ${hpAfterRecorded}`).toBe(true);

  // Load the boot save through the real menu: the raid's session closes into
  // a prior one, and the live match goes back to the start.
  await openMenu(page);
  await page.locator('[data-hud="load-button"]').click();
  await page.locator('[data-hud="load-source-localstorage"]').check();
  await page.locator('[data-hud="load-confirm"]').click();
  await expect(page.locator('[data-hud="load-panel"]')).toBeHidden();
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
  const loadedTick = await page.evaluate(() => window.__AOE2_TEST__!.getHudState().tick);
  expect(loadedTick - savedTick, `the load went to tick ${loadedTick}, not back to the boot save at ${savedTick}`).toBeLessThan(50);

  // Watch the recorded raid in the replay viewer, well past the live tick.
  await openMenu(page);
  await page.locator('[data-hud="replay-load-button"]').click();
  await page.locator('[data-testid="replay-load-tab-prior"]').click();
  await page.locator('[data-testid="replay-load-prior-row"]').first().click();
  await expect.poll(
    () => page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayMode()),
    { timeout: 5000 },
  ).toBe('replay');
  await page.locator('[data-testid="timeline-range"]').fill(String(REPLAY_SCRUB_TICK));
  await game.waitForRenderedFrames(page, 2);
  const step = page.locator('[data-testid="timeline-step-forward"]');
  for (let i = 0; i < REPLAY_STEPS; i += 1) {
    await step.click();
    await game.waitForRenderedFrames(page, 2);
  }
  const replayTick = await page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayCurrentTick());
  expect(replayTick, 'the timeline did not take the replay past its raid').toBe(REPLAY_SCRUB_TICK + REPLAY_STEPS);
  const replayed = (await raisedAlerts(page)).filter((alert) => alert.mode === 'replay');
  const replayedBlowTick = Math.max(...replayed.map((alert) => alert.hitTick));

  // Leave the replay by its Exit button.
  await page.locator('[data-testid="timeline-exit"]').click();
  await expect.poll(
    () => page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayMode()),
    { timeout: 5000 },
  ).toBe('live');
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
  const exitTick = await page.evaluate(() => window.__AOE2_TEST__!.getHudState().tick);
  // Instrument check: the replay announced a blow later than every live tick
  // looked at below, so the replayed world's memory is ahead of the whole live
  // window. Without it, a silent live raid would prove nothing.
  expect(replayed.length, 'the replay announced no replayed blow, so its memory never got ahead of the live match').toBeGreaterThan(0);
  expect(replayedBlowTick, `the replay's announced blow at tick ${replayedBlowTick} is not past the live window `
    + `${exitTick}-${exitTick + LIVE_RAID_TICKS}`).toBeGreaterThan(exitTick + LIVE_RAID_TICKS);
  await settleFrames(page);
  expect(await countAlertScreenPixels(page), 'the minimap carries a mark before the live raid began').toBe(0);
  const liveBefore = (await raisedAlerts(page)).filter((alert) => alert.mode === 'live').length;

  // The live raid, in 10-tick steps with frames between, looked at on every step.
  const hpBeforeLive = await houseHp(page);
  await orderRaid(page);
  let marked = 0;
  let markedAtTick: number | null = null;
  for (let ticks = 0; ticks < LIVE_RAID_TICKS; ticks += 10) {
    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(10, 100); });
    await settleFrames(page);
    const lit = await countAlertScreenPixels(page);
    if (lit > marked) {
      marked = lit;
      markedAtTick = await page.evaluate(() => window.__AOE2_TEST__!.getHudState().tick);
    }
  }
  const endTick = await page.evaluate(() => window.__AOE2_TEST__!.getHudState().tick);
  const hpAfterLive = await houseHp(page);
  expect(hpAfterLive !== null && hpBeforeLive !== null && hpAfterLive < hpBeforeLive,
    `the live raid never hit the House between ticks ${exitTick} and ${endTick}: ${hpBeforeLive} -> ${hpAfterLive}`).toBe(true);

  const live = (await raisedAlerts(page)).filter((alert) => alert.mode === 'live').slice(liveBefore);
  test.info().annotations.push({
    type: 'measured',
    description: `replay announced blow ${replayedBlowTick} at replay tick ${replayTick}; live ticks ${exitTick}-${endTick}; `
      + `House ${hpBeforeLive} -> ${hpAfterLive}; live words for blows ${live.map((alert) => alert.hitTick).join(', ') || 'none'}; `
      + `brightest mark ${marked.toFixed(0)} px at tick ${String(markedAtTick)}`,
  });
  // Soft, so a red run names both symptoms rather than the first.
  expect.soft(marked, `the live raid between ticks ${exitTick} and ${endTick} left ${marked.toFixed(0)} screen pixels of mark `
    + `on the minimap, under the ${ALERT_SCREEN_PIXEL_FLOOR}-pixel floor`).toBeGreaterThanOrEqual(ALERT_SCREEN_PIXEL_FLOOR);
  expect.soft(live.map((alert) => alert.text), `the live raid between ticks ${exitTick} and ${endTick}, after a replay `
    + `watched to its blow at tick ${replayedBlowTick}, came with no words`).toEqual([WORDS]);
  if (live.length === 0) return;
  expect(live[0]!.hitTick, 'the words name a blow before the live raid began').toBeGreaterThan(exitTick);
  expect(live[0]!.hitTick, 'the words name a blow the live match had not reached').toBeLessThanOrEqual(endTick);
});
