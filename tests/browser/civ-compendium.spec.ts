// The civilizations compendium through the REAL UI (spec §11.14): the menu
// button and F4 open it, all thirty are listed at once, the search reads the
// bonus text, a row expands in place, and a civilization this game has not
// finished says so rather than promising a unit it cannot train.
//
// BOUND: the default 1280x720 viewport and the default civilization (Britons).
// It proves the panel is reachable and honest, not that its wording is right.

import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

test.describe('civilizations compendium', () => {
  test('opens from the game menu and compares all thirty at once', async ({ page }) => {
    await game.waitForBoot(page); // default Britons
    await page.locator('[data-hud="menu-button"]').click();
    await page.locator('[data-hud="menu-civilizations"]').click();
    const panel = page.locator('[data-hud="civ-compendium"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-civ-row]')).toHaveCount(30);

    // The player's own civilization is marked, and it is the only one.
    await expect(panel.locator('.civ-compendium__row--yours')).toHaveCount(1);
    await expect(panel.locator('.civ-compendium__row--yours')).toHaveAttribute('data-civ-row', 'Britons');

    // A civilization whose unique unit this game cannot train says so, and one
    // it can does not. Both marks have to be present, or the flag carries no
    // information.
    await expect(panel.locator('[data-civ-row="Vietnamese"]')).toHaveAttribute('data-civ-partial', 'true');
    await expect(panel.locator('[data-civ-row="Britons"]')).not.toHaveAttribute('data-civ-partial', 'true');
    await expect(
      panel.locator('[data-civ-row="Vietnamese"] [data-civ-absent="true"]').first(),
    ).toContainText('Rattan Archer');

    await panel.locator('[data-hud="civ-compendium-close"]').click();
    await expect(panel).toBeHidden();
  });

  test('F4 toggles it, the search reads the bonus text, and a row opens in place', async ({ page }) => {
    await game.waitForBoot(page);
    await page.keyboard.press('F4');
    const panel = page.locator('[data-hud="civ-compendium"]');
    await expect(panel).toBeVisible();

    // "Which civilizations do X" is the question this answers, and the word is
    // in the BONUS lines rather than in any name.
    await panel.locator('[data-hud="civ-compendium-search"]').fill('elephant');
    await expect(panel.locator('[data-civ-row="Persians"]')).toBeVisible();
    await expect(panel.locator('[data-civ-row="Britons"]')).toHaveCount(0);

    // Typing does not steal the caret: the box is still focused after a repaint.
    await expect(panel.locator('[data-hud="civ-compendium-search"]')).toBeFocused();

    await panel.locator('[data-hud="civ-compendium-search"]').fill('');
    await expect(panel.locator('[data-civ-row]')).toHaveCount(30);

    // A row expands in place, and only one at a time.
    await panel.locator('[data-civ-toggle="Goths"]').click();
    await expect(panel.locator('[data-civ-row="Goths"] .civ-compendium__detail')).toBeVisible();
    await expect(panel.locator('.civ-compendium__detail')).toHaveCount(1);
    await expect(panel.locator('[data-civ-row="Goths"] .civ-compendium__bonuses li').first())
      .toContainText('Infantry cost 35% less');
    await panel.locator('[data-civ-toggle="Goths"]').click();
    await expect(panel.locator('.civ-compendium__detail')).toHaveCount(0);

    await page.keyboard.press('F4');
    await expect(panel).toBeHidden();
  });
});
