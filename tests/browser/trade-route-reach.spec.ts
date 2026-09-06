// Land trade, proved with a mouse (spec §6.7).
//
// The simulation tests pin the cycle and the profit formula; this pins that a
// player can train the cart at the Market's card, right-click the other
// player's Market, and watch gold arrive — plus the "Trading with Market"
// verb in the selection panel, which is how they know the order took.
//
// The camera centres on the cell this spec CLICKS — `market.x + 1, market.y + 1`
// — and not on the Market's own anchor. Changed 2026-09-05: centring on the
// anchor put the click one tile further down the screen, at (400, 357.6) in the
// suite's 800x600 viewport, and the command bar's box starts at y 352. The
// click was 5.6px INSIDE the bar, and it worked only because the HUD leaked
// clicks through to the world canvas — a hole no player could aim through,
// which the same day's `pointer-events` fix closed (defect register,
// 2026-09-05, the HUD click-through entry; its gate is
// `hud-opaque-surfaces-swallow-clicks.spec.ts`). Measured, not inferred, with
// `installCanvasProbe` from `helpers/hudOpaqueSurfaceSweep.ts`: centred on the
// anchor the point hit-tests to `div.hud-panel.hud-panel--selection` and the
// canvas receives NOTHING; centred on the clicked cell it lands at (400, 319.2),
// hit-tests to `canvas.voxel-world-canvas`, and the canvas receives pointerdown,
// pointerup and contextmenu. Do NOT "simplify" the `+ 1` back onto the anchor:
// that aims the mouse at the HUD again, and the spec would then be asserting
// the leak rather than the trade route.

import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('a trade route through the live UI', () => {
  test('trains a Trade Cart, opens a route, and gold arrives', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'trade-route-fixture');

    // The Market trains the cart (the fixture already stands one cart; train
    // proves the card offers it and the queue delivers).
    expect(await game.selectOwnedBuildingDirect(page, 1, 'market')).toBe(true);
    await expect(page.locator('[data-command="train-trade-cart"]')).toBeVisible();

    // Route the standing cart at the enemy Market with a real right-click.
    expect(await game.selectOwnedUnitDirect(page, 1, 'trade-cart')).toBe(true);
    const enemyMarket = await page.evaluate(() => {
      const market = window.__AOE2_TEST__!.getEconomyState().buildings.find(
        (building) => building.owner === 2 && building.buildingType === 'market',
      )!;
      window.__AOE2_TEST__!.centerCameraOnWorldPosition(market.x + 1, market.y + 1);
      return market;
    });
    const screen = await page.evaluate(
      ({ x, y }) => window.__AOE2_TEST__!.worldToScreen(x + 1, y + 1),
      { x: enemyMarket.x, y: enemyMarket.y },
    );
    // A step BEFORE the click and a step AFTER it, and both are load-bearing.
    // This was the suite's one flaky spec: about one run in six failed against
    // an IDENTICAL build, polling "Idle" nine times over five seconds. Measured
    // one variable at a time — the pre-click step alone still failed 1 in 6,
    // the post-click step alone 2 in 8, and the two together passed 18 of 18
    // (and 12 of 12 again in this arrangement). The click needs a world the
    // simulation has already revealed, or the order is refused at an unseen
    // entity, which is the fog contract working rather than the question this
    // spec asks; and the order it submits does not EXECUTE until the next
    // step, which a loaded machine can leave undone past the five-second poll.
    // A real player cannot click before the first frame is drawn either.
    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(2, 100); });
    await page.mouse.click(screen.x, screen.y, { button: 'right' });
    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(5, 100); });

    // The order took: the panel says so.
    expect(await game.selectOwnedUnitDirect(page, 1, 'trade-cart')).toBe(true);
    await expect(page.locator('[data-selection-activity]')).toContainText('Trading');

    // And the cycle pays: gold strictly grows over a round trip.
    const before = await page.evaluate(
      () => window.__AOE2_TEST__!.getEconomyState().playerResources[1]!.gold,
    );
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(2600, 100));
    const after = await page.evaluate(
      () => window.__AOE2_TEST__!.getEconomyState().playerResources[1]!.gold,
    );
    expect(after).toBeGreaterThan(before);
  });
});
