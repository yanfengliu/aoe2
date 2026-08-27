import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - upgrades', () => {
  test('can research Fletching and buff both existing and newly trained Archers', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-blacksmith-fixture');

    let snapshot = await game.getSnapshot(page);
    expect(
      snapshot.economyState.units.find((unit) => unit.owner === 1 && unit.unitType === 'archer'),
    ).toMatchObject({
      attackDamage: 4,
      attackRange: 4,
    });

    expect(await game.selectOwnedBuildingDirect(page, 1, 'blacksmith')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Blacksmith');
    await page.locator('[data-command="research-fletching"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Fletching');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(320, 100));

    snapshot = await game.getSnapshot(page);
    expect(
      snapshot.economyState.units.find((unit) => unit.owner === 1 && unit.unitType === 'archer'),
    ).toMatchObject({
      attackDamage: 5,
      attackRange: 5,
    });

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await page.locator('[data-command="train-archer"]').click();

    snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(380, 100),
    );

    const playerArchers = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'archer',
    );
    expect(playerArchers).toHaveLength(2);
    expect(
      playerArchers.every((unit) => unit.attackDamage === 5 && unit.attackRange === 5),
    ).toBe(true);
  });

  test('can research the Crossbowman upgrade and swap the Archer train option in the HUD', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'castle-upgrades-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await expect(page.locator('[data-command="train-archer"]')).toBeVisible();
    await expect(page.locator('[data-command="train-crossbowman"]')).toHaveCount(0);

    await page.locator('[data-command="research-crossbowman-upgrade"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Crossbowman');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(380, 100));

    const snapshot = await game.getSnapshot(page);
    expect(
      snapshot.economyState.units.find(
        (unit) => unit.owner === 1 && unit.unitType === 'crossbowman',
      ),
    ).toMatchObject({
      attackDamage: 5,
      // 5 base + 1 Britons Castle-Age foot-archer range ladder (v0.3.145).
      attackRange: 6,
    });
    expect(
      snapshot.economyState.units.some(
        (unit) => unit.owner === 1 && unit.unitType === 'archer',
      ),
    ).toBe(false);

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-command="train-crossbowman"]')).toBeVisible();
    await expect(page.locator('[data-command="train-archer"]')).toHaveCount(0);
    await expect(page.locator('[data-command="research-crossbowman-upgrade"]')).toHaveCount(0);

    expect(await game.selectOwnedUnitDirect(page, 1, 'crossbowman')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Crossbowman');
    await expect(
      page.locator('[data-selection-unit-icon="crossbowman"]'),
    ).toHaveText('CB');
  });

  test('can research Arbalest in Imperial Age and train it through the live command panel', async ({
    page,
  }) => {
    // Slice 7E browser coverage: one canonical Imperial case. The
    // imperial-arbalest-fixture boots the human straight into Imperial
    // Age with an Archery Range and one base Crossbowman, so the test
    // skips the Dark → Feudal → Castle → Imperial climb and focuses on
    // the Arbalest research + train + HUD-label flow.
    await game.waitForBootWithSeed(page, 'imperial-arbalest-fixture');

    await expect(page.locator('[data-hud="age"]')).toHaveText('Imperial Age');

    // Research the Arbalest upgrade at the Archery Range.
    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await expect(page.locator('[data-command="research-arbalest-upgrade"]')).toBeVisible();
    await page.locator('[data-command="research-arbalest-upgrade"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText(
      'Researching: Arbalest',
    );

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(700, 100));

    // Post-research: the Archery Range swaps its archer-line train slot
    // to Arbalest and the pre-existing Crossbowman has mutated in place.
    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-command="train-arbalest"]')).toBeVisible();
    await expect(page.locator('[data-command="train-crossbowman"]')).toHaveCount(0);
    await page.locator('[data-command="train-arbalest"]').click();

    const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));
    const arbalests = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'arbalest',
    );
    // One from the pre-existing Crossbowman mutation + one freshly trained.
    expect(arbalests.length).toBeGreaterThanOrEqual(2);
    expect(arbalests[0]).toMatchObject({
      attackDamage: 6,
      // 5 base + 2 Britons Imperial foot-archer range ladder (v0.3.145).
      attackRange: 7,
    });

    expect(await game.selectOwnedUnitDirect(page, 1, 'arbalest')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Arbalest');
    await expect(
      page.locator('[data-selection-unit-icon="arbalest"]'),
    ).toHaveText('Ab');
  });
});
