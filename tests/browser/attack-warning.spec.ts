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
//  - The search window is ticks 3050-3600. `expect(damaged)` below fails with
//    "no villager lost HP" if the scenario ever stops producing the raid, so
//    a run that did not exercise the warning cannot report itself as one that
//    did.
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

  // Run up to just before the raid in one step, then in small chunks so the
  // HUD's own frame loop gets to observe the feed — it holds an attack for
  // ten ticks, so a single 3110-tick step would step straight over it.
  await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(3050, 100));

  let damaged = false;
  let marked = 0;
  let markedCell: string | null = null;
  for (let tick = 3050; tick < 3600 && marked === 0; tick += 10) {
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(10, 100));
    await settleFrames(page);
    damaged ||= await page.evaluate(() => window.__AOE2_TEST__!.getRenderState().entities.some(
      (entity) => entity.owner === 1
        && entity.entityType === 'villager'
        && entity.currentHp !== null
        && entity.maxHp !== null
        && entity.currentHp < entity.maxHp,
    ));
    marked = await countAlertPixels(page);
    markedCell ??= await page
      .locator('[data-hud="minimap"]')
      .getAttribute('data-attack-warning-cell');
  }

  // Distinguishes "the warning failed" from "the raid never happened".
  expect(damaged, 'no villager of the human\'s lost HP between ticks 3050 and 3600 — '
    + 'the scenario no longer produces the raid this gate is about, so nothing was tested').toBe(true);
  expect(marked, 'a villager was damaged and the minimap shows no attack mark').toBeGreaterThan(0);
  expect(markedCell, 'the mark must name the cell that was hit').not.toBeNull();
});
