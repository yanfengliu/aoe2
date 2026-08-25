// Self-healing and Berserkergang, proved with a mouse.
//
// Regeneration is the one mechanic a player observes by doing NOTHING, so the
// browser proof is the health bar climbing on its own — read off the rendered
// bar, not a snapshot — and then climbing twice as fast after the Castle
// button is clicked. The simulation tests pin the exact rate; this pins that a
// player can see it and reach the technology that doubles it.

import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

async function berserkHp(page: import('@playwright/test').Page): Promise<number> {
  const bar = await game.getEntityHealthBarState(page, 1, 'unit', 'berserk');
  expect(bar, 'the Berserk should have a rendered health bar').not.toBeNull();
  return bar!.currentHp;
}

test.describe('a Berserk heals itself, and Berserkergang doubles it', () => {
  test('the health bar climbs on its own and the Castle offers Berserkergang', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'vikings-regeneration-fixture');

    // The wound the fixture starts with, as the player sees it in the panel.
    expect(await game.selectOwnedUnitDirect(page, 1, 'berserk')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Berserk');
    await game.expectSelectionDetail(page, 'health', '10 / 55');
    // Not exactly 10: the match has been running while the page booted and
    // the selection landed, and the healing runs during that too.
    const wounded = await berserkHp(page);
    expect(wounded).toBeGreaterThanOrEqual(10);
    expect(wounded).toBeLessThan(11);

    // Thirty seconds of standing still: one hit point every three seconds.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(300, 100));
    const healed = await berserkHp(page);
    expect(healed - wounded).toBeGreaterThan(9);
    expect(healed - wounded).toBeLessThan(11);

    // The technology that doubles it, reached the way a player reaches it.
    expect(await game.selectOwnedBuildingDirect(page, 1, 'castle')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Castle');
    const research = page.locator('[data-command="research-berserkergang"]');
    await expect(research).toBeVisible();
    await research.click();

    // 40 s of research at 10 ticks per second, plus room for the queue to
    // start. The Berserk keeps healing at the base rate while it runs.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(450, 100));
    expect(await game.selectOwnedBuildingDirect(page, 1, 'castle')).toBe(true);
    await expect(research).toHaveCount(0);

    // Twenty seconds at the doubled rate is thirteen hit points, where the
    // base rate would be six or seven — so the window tells them apart.
    const before = await berserkHp(page);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(200, 100));
    const after = await berserkHp(page);
    expect(after - before).toBeGreaterThan(11);
    expect(after).toBeLessThanOrEqual(55);
  });
});
