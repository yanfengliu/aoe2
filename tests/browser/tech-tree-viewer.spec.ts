// The technology-tree viewer through the REAL UI (v0.3.157): the menu
// button and F1 open it, denied entries render dimmed-not-hidden, and the
// backdrop closes it.

import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

test.describe('technology tree viewer', () => {
  test('opens from the game menu, shows the civ holes dimmed, closes on ✕', async ({ page }) => {
    await game.waitForBoot(page); // default Britons
    await page.locator('[data-hud="menu-button"]').click();
    await page.locator('[data-hud="menu-tech-tree"]').click();
    const panel = page.locator('[data-hud="tech-tree-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.tech-tree__title')).toContainText('Britons');
    // A real Briton hole renders dimmed rather than vanishing.
    const denied = panel.locator('[data-tech-tree-item="hand-cannoneer"]');
    await expect(denied).toHaveAttribute('data-tech-tree-denied', 'true');
    // An available entry has no denial mark.
    const archer = panel.locator('[data-tech-tree-item="archer"]');
    await expect(archer).not.toHaveAttribute('data-tech-tree-denied', 'true');
    await panel.locator('[data-hud="tech-tree-close"]').click();
    await expect(panel).toBeHidden();
  });

  test('F1 toggles it without the menu', async ({ page }) => {
    await game.waitForBoot(page);
    await page.keyboard.press('F1');
    await expect(page.locator('[data-hud="tech-tree-panel"]')).toBeVisible();
    await page.keyboard.press('F1');
    await expect(page.locator('[data-hud="tech-tree-panel"]')).toBeHidden();
  });
});
