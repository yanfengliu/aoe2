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
// something the player can SEE, at the place it happened. The assertion is
// pixels on the minimap canvas, not a flag on an object, because a field can
// be correct and rendered by nothing.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - One scenario (`aoe2-prototype`) and one raid, the reproduced one. The
//    rule's other cases — the throttle, the things that must NOT warn — are
//    `tests/ui/attackWarning.test.ts` over a synthetic feed.
//  - The raid is FOUND, not pinned to a tick: the match runs from boot in
//    10-tick steps until a human villager first loses HP, up to tick 3600,
//    and the mark is looked for from that step on. The raid was at tick 3084
//    until DE's 50-food Militia (v0.3.228) moved it to 1450; a fixed window
//    of 3050-3600 then read a villager hurt long before the window as "hurt
//    and no mark", which is the wrong failure. `expect(raidTick)` below
//    fails with "no villager lost HP" if the scenario stops producing a raid
//    by tick 3600, so a run that did not exercise the warning cannot report
//    itself as one that did, and cannot report itself as a broken warning
//    either.
//  - The quiet-frame half asserts the boot frame carries ZERO alert pixels,
//    which is what makes the raid frame's count mean something.
import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

// NEAR-WHITE pixels, which only the mark's core draws. Not "reddish": owner
// 2's tint is a red too, so a red band would pass on the raider's own marker
// — a green run that proves the enemy is on the minimap, not the warning.
// Nothing else this canvas paints comes close to white; measured across the
// boot frame and the raid frame, the brightest minimum channel anywhere else
// is 181 (terrain), against this threshold of 200.
const WHITE_ENOUGH = 200;

async function countAlertPixels(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('[data-hud="minimap"]').evaluate((canvas: HTMLCanvasElement, floor) => {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Expected the minimap canvas to have a 2D context.');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let found = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.min(data[i]!, data[i + 1]!, data[i + 2]!) >= floor) found += 1;
    }
    return found;
  }, WHITE_ENOUGH);
}

async function settleFrames(page: import('@playwright/test').Page): Promise<void> {
  // Three frames: the audio mount's rAF polls the attack feed and raises the
  // mark, the HUD's rAF sees the changed minimap signature, and the repaint
  // lands on the canvas.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }));
}

test('an enemy raiding your villagers puts a mark on the minimap', async ({ page }) => {
  test.slow();
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  await settleFrames(page);

  // A quiet frame carries no alert pixels at all. Without this, the raid
  // frame's count would prove nothing — it could be an enemy unit's marker.
  expect(await countAlertPixels(page), 'the boot frame must be quiet').toBe(0);
  expect(
    await page.locator('[data-hud="minimap"]').getAttribute('data-attack-warning-cell'),
  ).toBeNull();

  // Find the raid: run in 10-tick steps from boot, inside the page, and stop
  // at the first step that leaves a human villager below full HP. The HUD
  // holds an attack for ten ticks, so the mark is still due when this
  // returns; one long step would step straight over it. Every villager is at
  // full HP at boot, so the first hurt villager is a fresh hit.
  const raidTick = await page.evaluate(() => {
    const api = window.__AOE2_TEST__!;
    for (let tick = 10; tick <= 3600; tick += 10) {
      api.advanceTicks(10, 100);
      const hurt = api.getRenderState().entities.some(
        (entity) => entity.owner === 1
          && entity.entityType === 'villager'
          && entity.currentHp !== null
          && entity.maxHp !== null
          && entity.currentHp < entity.maxHp,
      );
      if (hurt) return tick;
    }
    return null;
  });

  // Distinguishes "the warning failed" from "the raid never happened".
  expect(raidTick, 'no villager of the human\'s lost HP between boot and tick 3600 — '
    + 'the scenario no longer produces the raid this gate is about, so nothing was tested').not.toBeNull();

  // Let the HUD's frame loop see the feed, then look for the mark on this
  // step and the next few, in small steps so the held attack is not skipped.
  let marked = 0;
  let markedCell: string | null = null;
  for (let step = 0; step < 5 && marked === 0; step += 1) {
    if (step > 0) await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(10, 100));
    await settleFrames(page);
    marked = await countAlertPixels(page);
    markedCell ??= await page
      .locator('[data-hud="minimap"]')
      .getAttribute('data-attack-warning-cell');
  }
  expect(marked, `a villager was damaged at tick ${String(raidTick)} and the minimap shows no attack mark`).toBeGreaterThan(0);
  expect(markedCell, 'the mark must name the cell that was hit').not.toBeNull();
});
