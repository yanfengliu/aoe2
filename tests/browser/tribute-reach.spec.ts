// Tribute, proved with a mouse (spec §6.8).
//
// The simulation tests pin the fee ladder (30% → Coinage 20% → Banking 0) and
// the transfer arithmetic; this pins the other half — that a player standing
// at a real Market can click "100 gold → P2" and watch both stockpiles move.
// The button renders only while a completed own Market is selected, which is
// AoE2's own rule: no Market, no tribute.

import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('tribute through the live command panel', () => {
  test('sends 100 gold to the other player for 130', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'feudal-market-fixture');

    // No Market yet, so no tribute button anywhere.
    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-command="tribute-2-gold"]')).toHaveCount(0);

    // Build the Market the way a player does.
    await page.locator('[data-command="build-market"]').click();
    const placement = await game.findValidPlacementNearTownCenter(page, 'market', 1, [{ x: 17, y: 8 }]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        placement,
      ),
    ).toBe(true);
    // §12.4.2 walk clock (v0.3.160): commute + build time.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(900, 100));

    expect(await game.selectOwnedBuildingDirect(page, 1, 'market')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Market');

    // The tribute row is there for the other player, all four resources.
    for (const resource of ['food', 'wood', 'gold', 'stone']) {
      await expect(page.locator(`[data-command="tribute-2-${resource}"]`)).toBeVisible();
    }

    const before = await game.getSnapshot(page);
    await page.locator('[data-command="tribute-2-gold"]').click();
    const after = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));

    // Sender pays the amount plus the 30% fee; the recipient gets the amount.
    expect(after.hudState.playerResources.gold).toBe(
      before.hudState.playerResources.gold - 130,
    );
    const recipient = await page.evaluate(
      () => window.__AOE2_TEST__!.getEconomyState().playerResources[2]!.gold,
    );
    const recipientBefore = before.economyState.playerResources[2]!.gold;
    expect(recipient).toBe(recipientBefore + 100);
  });
});
