// DE muscle-memory hotkeys (v0.3.155): H selects the Town Center and
// centres, ',' cycles idle military, F3 pauses, +/- steps the game speed.
// Real key presses per the unwatched-seam rule — a registry entry proves
// nothing about what a keyboard does.

import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

test.describe('DE control hotkeys', () => {
  test('H selects the Town Center and centres the camera on it', async ({ page }) => {
    await game.waitForBoot(page);
    await page.keyboard.press('h');
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    const centred = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const tc = api.getEconomyState().buildings.find(
        (b) => b.owner === 1 && b.buildingType === 'town-center',
      )!;
      return { tcSelected: api.getSnapshot().selectionState?.selectedEntityId === tc.id };
    });
    expect(centred.tcSelected).toBe(true);
  });

  test("',' selects an idle military unit", async ({ page }) => {
    // los-techs-fixture: a militia parked far from any enemy, so it is
    // still idle when the key lands (auto-aggression empties the cycle in
    // fixtures where soldiers spawn in sight of each other).
    await game.waitForBootWithSeed(page, 'los-techs-fixture');
    await page.keyboard.press(',');
    const selected = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const id = api.getSnapshot().selectionState?.selectedEntityId;
      const unit = api.getEconomyState().units.find((u) => u.id === id);
      return unit?.unitType ?? null;
    });
    expect(selected).toBe('militia');
  });

  test('F3 pauses and unpauses the simulation', async ({ page }) => {
    await game.waitForBoot(page);
    await page.keyboard.press('F3');
    const t1 = await page.evaluate(() => window.__AOE2_TEST__!.getSnapshot().hudState.tick);
    await page.waitForTimeout(700);
    const t2 = await page.evaluate(() => window.__AOE2_TEST__!.getSnapshot().hudState.tick);
    expect(t2).toBe(t1);
    await page.keyboard.press('F3');
    await page.waitForTimeout(700);
    const t3 = await page.evaluate(() => window.__AOE2_TEST__!.getSnapshot().hudState.tick);
    expect(t3).toBeGreaterThan(t2);
  });

  test('+ and - step the game speed ladder', async ({ page }) => {
    await game.waitForBoot(page);
    // Measure ticks over a window at 1.0x, then again after '+' (1.5x).
    const rate = async () => {
      const a = await page.evaluate(() => window.__AOE2_TEST__!.getSnapshot().hudState.tick);
      await page.waitForTimeout(1000);
      const b = await page.evaluate(() => window.__AOE2_TEST__!.getSnapshot().hudState.tick);
      return b - a;
    };
    const slow = await rate();
    await page.keyboard.press('+');
    const normal = await rate();
    expect(normal).toBeGreaterThan(slow);
    await page.keyboard.press('-');
    const backDown = await rate();
    expect(backDown).toBeLessThan(normal);
  });
});
