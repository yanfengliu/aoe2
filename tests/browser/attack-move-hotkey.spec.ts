import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

// M6 control: attack-move is only reachable through the A-then-click
// interaction, so a unit test proving the simulation works says nothing about
// whether a player can actually issue one.
test.describe('attack-move interaction', () => {
  test('arms on A and turns the next left click into an attack-move order', async ({ page }) => {
    await game.waitForBoot(page);

    // Select a villager so there is something to command.
    const selected = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const unit = api.getEconomyState().units.find(
        (u) => u.owner === 1 && u.unitType === 'villager',
      );
      if (!unit) return null;
      api.selectEntityAtCell(unit.x, unit.y);
      return { id: unit.id, x: unit.x, y: unit.y };
    });
    expect(selected).not.toBeNull();

    await page.keyboard.press('a');
    // Click somewhere on the world canvas; the armed order consumes it.
    const canvas = page.locator('#game-root > canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    // Click OPEN WORLD: the selection panel is wide enough to swallow a click
    // in the lower-right half, which silently produces no order at all.
    await page.mouse.click(box!.x + box!.width * 0.35, box!.y + box!.height * 0.38);

    await page.evaluate(() => {
      window.__AOE2_TEST__!.advanceTicks(3);
    });

    const orderType = await page.evaluate((unitId) => {
      const paths = window.__AOE2_TEST__!.getDebugSnapshot().unitPaths;
      return paths.find((entry) => entry.id === unitId)?.commandType ?? null;
    }, selected!.id);

    expect(orderType).toBe('attack-move');
  });
});
