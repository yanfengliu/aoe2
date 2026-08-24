// Every unit added since v0.3.45, proved reachable with a MOUSE.
//
// The simulation tests prove these units exist, cost what units.csv says, and
// upgrade from the right tier. None of that is worth anything if the button is
// missing: a unit that is in the roster, in the production validator and in a
// passing test but never rendered as a command card is a unit nobody can
// build. That is exactly how nine warships shipped in v0.3.20 with stats and
// combat tests and no Dock menu offering any of them.
//
// So each of these clicks the real command card and then reads the world for
// the thing it produced.

import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('units added since v0.3.45 are reachable with a mouse', () => {
  test('the Barracks trains an Eagle Warrior and offers its Elite upgrade', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'new-unit-reach-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Barracks');

    const train = page.locator('[data-command="train-eagle-warrior"]');
    await expect(train).toBeVisible();
    await train.click();
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));

    const snapshot = await game.getSnapshot(page);
    const eagles = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'eagle-warrior',
    );
    expect(eagles).toHaveLength(1);

    // The Elite upgrade is a Barracks research, per technologies.csv.
    expect(await game.selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await expect(
      page.locator('[data-command="research-elite-eagle-warrior-upgrade"]'),
    ).toBeVisible();
  });

  test('the Archery Range trains a Hand Cannoneer and an Elite Skirmisher', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'new-unit-reach-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');

    // The Skirmisher line's menu entry resolves to the tier the owner has
    // researched, and this fixture has the Elite upgrade — so the button is
    // the Elite one, not a separate extra entry.
    await expect(page.locator('[data-command="train-elite-skirmisher"]')).toBeVisible();

    const handCannon = page.locator('[data-command="train-hand-cannoneer"]');
    await expect(handCannon).toBeVisible();
    await handCannon.click();
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));

    const snapshot = await game.getSnapshot(page);
    const cannoneers = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'hand-cannoneer',
    );
    expect(cannoneers).toHaveLength(1);
    expect(cannoneers[0]).toMatchObject({ attackDamage: 17, attackRange: 7 });
  });

  test('the Siege Workshop trains a Capped Ram and offers the two tiers above it', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'new-unit-reach-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'siege-workshop')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Siege Workshop');

    // The fixture has researched the Capped Ram and the Onager, so the ram
    // line's entry is the Capped Ram and the mangonel line's is the Onager.
    const cappedRam = page.locator('[data-command="train-capped-ram"]');
    await expect(cappedRam).toBeVisible();
    await cappedRam.click();
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(500, 100));

    const snapshot = await game.getSnapshot(page);
    const rams = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'capped-ram',
    );
    expect(rams).toHaveLength(1);

    // Both new research steps are on the card: the Siege Ram is only offered
    // because the Capped Ram is researched, which is the rule v0.3.45 added.
    expect(await game.selectOwnedBuildingDirect(page, 1, 'siege-workshop')).toBe(true);
    await expect(page.locator('[data-command="research-siege-ram-upgrade"]')).toBeVisible();
    await expect(page.locator('[data-command="research-siege-onager-upgrade"]')).toBeVisible();
  });
});
