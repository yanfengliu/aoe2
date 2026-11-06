// A player under attack finds out (v0.3.217).
//
// THE DEFECT, found by playing and reproduced here on the real match at the
// real tick: at tick 3084 of `aoe2-prototype` an enemy militia walks into the
// human's base and hits villager #2205 twice, 25 -> 21 -> 17 HP. Before this
// change there was no banner, no toast, no minimap mark, no selection change
// and no message of any kind. The horn did sound — and a horn is the one cue
// a muted tab or a noisy room takes away, so the screen said nothing.
//
// THE CLASS this gates: an enemy damaging the human's economy must produce
// something the player can SEE, at the place it happened, and SAY so in
// words. The assertion is pixels on the minimap canvas, not a flag on an
// object, because a field can be correct and rendered by nothing.
//
// v0.3.229 (defect register 2026-09-24): this asserted `marked > 0`, which
// was green on exactly the frames a player called a failure — 16 alert pixels
// out of 1.44 million in the real play screenshots. It now asserts a
// VISIBILITY FLOOR in screen pixels (`attackWarningPixels.ts`) and the
// toast's words. The sustained raid and the pause are
// `attack-warning-sustained.spec.ts`.
//
// THE RAID IS SCRIPTED (work 144 M2, 2026-11-06). This spec waited for the
// computer's own Dark Age raid on the idle human, a Militia's at tick 3,312 by
// then. DE's Dark Age boom ended it: the computer trains no Dark Age Militia,
// and its first blow on the idle human lands near tick 21,000. A HUD spec that
// needs an attack must not depend on the computer's opening strategy, so it
// runs on `boot-map-raid-fixture` (`src/game/simulation/fixtures/raidWarning.ts`):
// `aoe2-prototype` itself, the view the pixel floor below was sized on, with
// owner 2's AI off and one Militia of owner 2's out of reach until this spec
// orders it onto the human's nearest villager through the command pipeline
// (`helpers/bootMapRaid.ts`). Headless, the first villager is hit 196 ticks
// after the order.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - One scenario (the boot map) and one raid, a scripted one. The rule's
//    other cases — the throttle, the things that must NOT warn — are
//    `tests/ui/attackWarning.test.ts` over a synthetic feed.
//  - The raid is FOUND, not pinned to a tick: after the order the match runs
//    in 10-tick steps until a human villager first loses HP, up to 3,600
//    ticks, and the mark is looked for from that step on. `expect(raidTick)`
//    below fails with "no villager lost HP" if the scenario stops producing
//    the raid, so a run that did not exercise the warning cannot report itself
//    as one that did, and cannot report itself as a broken warning either.
//  - The quiet-frame half asserts the boot frame carries ZERO alert pixels
//    and no alert toast, which is what makes the raid frame's count mean
//    something.
//  - One viewport, 800x600, where the minimap is DISPLAYED at 164x120 over
//    its 220x160 backing (below 1120px of window width, hudCommandPanel.css),
//    so the floor is met through the display-scale sizing. The full-size
//    minimap (218px shown, at 1280 wide and up) is `tests/ui/minimap.test.ts`
//    by draw calls and the v0.3.229 before/after captures at 1600x900.
import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
import { ALERT_SCREEN_PIXEL_FLOOR, countAlertScreenPixels as countAlertPixels } from './helpers/attackWarningPixels';
import { BOOT_MAP_RAID_SEED, orderBootMapRaid } from './helpers/bootMapRaid';

const ALERT_TOAST = '[data-hud="toast"][data-hud-toast-kind="alert"]';

async function settleFrames(page: import('@playwright/test').Page): Promise<void> {
  // Three frames: the audio mount's rAF polls the attack feed and raises the
  // mark, the HUD's rAF sees the changed minimap signature, and the repaint
  // lands on the canvas.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
}

// Find the raid: run in 10-tick steps, inside the page, and stop at the first
// step that leaves a human villager below full HP. The HUD holds an attack for
// ten ticks, so the mark is still due when this returns; one long step would
// step straight over it. Every villager is at full HP at boot (and at the
// tick-100 save below), so the first hurt villager is a fresh hit.
async function findRaid(page: import('@playwright/test').Page): Promise<number | null> {
  return page.evaluate(() => {
    const api = window.__AOE2_TEST__!;
    for (let step = 0; step < 360; step += 1) {
      api.advanceTicks(10, 100);
      const hurt = api.getRenderState().entities.some(
        (entity) => entity.owner === 1
          && entity.entityType === 'villager'
          && entity.currentHp !== null
          && entity.maxHp !== null
          && entity.currentHp < entity.maxHp,
      );
      if (hurt) return api.getHudState().tick;
    }
    return null;
  });
}

// Let the HUD's frame loop see the feed, then look for the mark on this step
// and the next few, in small steps so the held attack is not skipped.
async function lookForMark(page: import('@playwright/test').Page): Promise<{ marked: number; cell: string | null }> {
  let marked = 0;
  let cell: string | null = null;
  for (let step = 0; step < 5 && marked < ALERT_SCREEN_PIXEL_FLOOR; step += 1) {
    if (step > 0) await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(10, 100));
    await settleFrames(page);
    marked = await countAlertPixels(page);
    cell ??= await page.locator('[data-hud="minimap"]').getAttribute('data-attack-warning-cell');
  }
  return { marked, cell };
}

function floorMessage(raidTick: number | null, marked: number): string {
  return `a villager was damaged at tick ${String(raidTick)} and the minimap's attack mark covers `
    + `${marked.toFixed(0)} screen pixels, under the ${ALERT_SCREEN_PIXEL_FLOOR}-pixel floor a player can find`;
}

const NO_RAID = "no villager of the human's lost HP within 3600 ticks of the raid's order — "
  + 'the scenario no longer produces the raid this gate is about, so nothing was tested';

test('an enemy raiding your villagers puts a mark on the minimap', async ({ page }) => {
  test.slow();
  await game.waitForPausedBootWithSeed(page, BOOT_MAP_RAID_SEED);
  await settleFrames(page);

  // A quiet frame carries no alert pixels at all. Without this, the raid
  // frame's count would prove nothing — it could be an enemy unit's marker.
  expect(await countAlertPixels(page), 'the boot frame must be quiet').toBe(0);
  await expect(page.locator(ALERT_TOAST)).toHaveCount(0);
  expect(
    await page.locator('[data-hud="minimap"]').getAttribute('data-attack-warning-cell'),
  ).toBeNull();

  await orderBootMapRaid(page);
  const raidTick = await findRaid(page);
  // Distinguishes "the warning failed" from "the raid never happened".
  expect(raidTick, NO_RAID).not.toBeNull();

  const { marked, cell } = await lookForMark(page);
  expect(marked, floorMessage(raidTick, marked)).toBeGreaterThanOrEqual(ALERT_SCREEN_PIXEL_FLOOR);
  expect(cell, 'the mark must name the cell that was hit').not.toBeNull();
  test.info().annotations.push({ type: 'measured', description: `${marked.toFixed(0)} alert screen pixels at raid tick ${String(raidTick)}` });
  // And in words, on the same decision that sounds the horn.
  await expect(page.locator(ALERT_TOAST)).toHaveText(['You are under attack!']);
  await expect(page.locator(ALERT_TOAST).first()).toBeVisible();
});

// v0.3.229 (defect register 2026-09-24): loading an EARLIER save kept the old
// world's horn tick in the audio controller, so the same raid, met again after
// the load, fell inside a throttle window measured across two worlds and came
// with no horn and no words. The real menu is driven for both the save and the
// load. Bound: one save (tick 100) and one load, of the same match; a load
// from another match or a later tick is the unit case in
// `tests/ui/raidWarning.test.ts`. The raid is ordered after the save, so the
// saved world holds no order, and ordered again after the load: the same raid,
// met again, at the same distance from the order (work 144 M2).
test('the first raid after loading an earlier save is announced again', async ({ page }) => {
  test.slow();
  await game.waitForPausedBootWithSeed(page, BOOT_MAP_RAID_SEED);
  // Count every alert toast the page raises: the first raid's toast can still
  // be on screen when the second arrives, so what is on screen cannot tell
  // the two apart, and a count of raised toasts can.
  await page.evaluate(() => {
    window.localStorage.removeItem('aoe2-save-v1');
    const counted = document.querySelector('[data-hud="toast-container"]')!;
    counted.setAttribute('data-alerts-raised', '0');
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.dataset.hudToastKind === 'alert') {
            counted.setAttribute('data-alerts-raised', String(Number(counted.getAttribute('data-alerts-raised')) + 1));
          }
        }
      }
    }).observe(counted, { childList: true });
    window.__AOE2_TEST__!.advanceTicks(100, 100);
  });
  const raised = async (): Promise<number> => Number(
    await page.locator('[data-hud="toast-container"]').getAttribute('data-alerts-raised'),
  );
  await page.locator('[data-hud="menu-button"]').click();
  await page.locator('[data-hud="save-button"]').click();
  await page.locator('[data-hud="menu-resume"]').click();
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));

  await orderBootMapRaid(page);
  expect(await findRaid(page), NO_RAID).not.toBeNull();
  await lookForMark(page);
  expect(await raised(), 'the raid before the load was not announced').toBe(1);

  await page.locator('[data-hud="menu-button"]').click();
  await page.locator('[data-hud="load-button"]').click();
  await page.locator('[data-hud="load-source-localstorage"]').check();
  await page.locator('[data-hud="load-confirm"]').click();
  await expect(page.locator('[data-hud="load-panel"]')).toBeHidden();
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
  const loadedTick = await page.evaluate(() => window.__AOE2_TEST__!.getHudState().tick);
  expect(loadedTick, 'the load did not go back to the tick-100 save').toBeLessThan(200);
  await settleFrames(page);
  expect(await countAlertPixels(page), "the old world's mark survived the load").toBe(0);

  await orderBootMapRaid(page);
  const raidTick = await findRaid(page);
  expect(raidTick, NO_RAID).not.toBeNull();
  const { marked } = await lookForMark(page);
  expect(marked, floorMessage(raidTick, marked)).toBeGreaterThanOrEqual(ALERT_SCREEN_PIXEL_FLOOR);
  expect(await raised(), `the raid at tick ${String(raidTick)} after loading the tick-${loadedTick} save came with no words`).toBe(2);
});
