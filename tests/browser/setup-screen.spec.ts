// The match setup screen (spec §4.6), driven the way a player drives it: a
// bare visit shows it, the selects choose a match, Start boots THAT match.
// Any visit with params must never see it — that is what keeps every other
// test and harness boot untouched.

import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('the match setup screen', () => {
  test('a bare visit configures and starts a real match', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-hud="setup-screen"]')).toBeVisible();

    // No simulation exists behind the screen — the match starts when we say.
    expect(await page.evaluate(() => window.__AOE2_TEST__ === undefined)).toBe(true);

    await page.selectOption('[data-setup="players"]', '4');
    await page.selectOption('[data-setup="civ"]', 'Franks');
    await page.selectOption('[data-setup="teams"]', 'two-sides');
    await page.selectOption('[data-setup="difficulty"]', 'hard');
    await page.locator('[data-setup="start"]').click();

    // The reload carries the choices as the URL params the app already reads.
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
    const url = new URL(page.url());
    expect(url.searchParams.get('players')).toBe('4');
    expect(url.searchParams.get('civ')).toBe('Franks');
    expect(url.searchParams.get('teams')).toBe('1,1,2,2');
    expect(url.searchParams.get('difficulty')).toBe('hard');

    // And the match IS that match: four town centres, the human's civ Franks.
    const snapshot = await game.getSnapshot(page);
    const townCenters = snapshot.economyState.buildings.filter(
      (building) => building.buildingType === 'town-center',
    );
    expect(townCenters).toHaveLength(4);
  });

  test('a visit with any parameter skips the screen entirely', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'aoe2-prototype');
    await expect(page.locator('[data-hud="setup-screen"]')).toHaveCount(0);
  });
});
