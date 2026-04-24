import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - age up', () => {
  test('can research Feudal Age and train an Archer through the live command panel', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-age-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="research-feudal-age"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Feudal Age');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1320, 100));

    await expect(page.locator('[data-hud="age"]')).toHaveText('Feudal Age');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-archery-range"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Archery Range');
    const archeryRangePlacement = await game.findValidPlacementNearTownCenter(page, 'archery-range');
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        archeryRangePlacement,
      ),
    ).toBe(true);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(280, 100));

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await page.locator('[data-command="train-archer"]').click();

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(380, 100),
    );

    expect(
      trainedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'archer',
      ),
    ).toHaveLength(1);
  });

  test('can research Castle Age and train a Knight through the live command panel', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'castle-age-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="research-castle-age"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Castle Age');
    await expect(page.locator('[data-hud="food"]')).toHaveText('200');
    await expect(page.locator('[data-hud="gold"]')).toHaveText('200');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1620, 100));

    await expect(page.locator('[data-hud="age"]')).toHaveText('Castle Age');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'stable')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Stable');
    await page.locator('[data-command="train-knight"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('140');
    await expect(page.locator('[data-hud="gold"]')).toHaveText('125');

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(320, 100),
    );

    const playerKnights = trainedSnapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'knight',
    );
    expect(playerKnights).toHaveLength(1);
    expect(playerKnights[0]).toMatchObject({
      attackDamage: 10,
      attackRange: 1,
    });
  });

  test('shows locked Town Center age-up buttons before their prerequisites are met', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    const feudalButton = page.locator('[data-command="research-feudal-age"]');
    await expect(feudalButton).toBeVisible();
    await expect(feudalButton).toBeDisabled();
    await expect(page.locator('[data-command="research-castle-age"]')).toHaveCount(0);
  });
});
