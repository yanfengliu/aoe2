import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - progression and production', () => {
  test('can build an additional Town Center in Castle Age and use it to train a villager', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'castle-town-center-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-town-center"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Town Center');

    const townCenterPlacement = await game.findValidPlacementNearTownCenter(page, 'town-center', 1, [{ x: 14, y: 8 }]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        townCenterPlacement,
      ),
    ).toBe(true);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('425');
    await expect(page.locator('[data-hud="stone"]')).toHaveText('250');

    await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      for (let index = 0; index < 420; index += 1) {
        const snapshot = api.advanceTicks(1, 100);
        const townCenter = snapshot.economyState.buildings.find(
          (building) =>
            building.owner === 1
            && building.buildingType === 'town-center'
            && building.x === 14
            && building.y === 8,
        );
        if (townCenter?.isComplete) {
          break;
        }
      }
    });
    await game.clickCell(page, 18, 10, 'right');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(80, 100));

    expect(
      await game.selectOwnedBuildingAtDirect(
        page,
        1,
        'town-center',
        townCenterPlacement.x,
        townCenterPlacement.y,
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="train-villager"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('150');

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(320, 100),
    );

    expect(
      trainedSnapshot.economyState.buildings.filter(
        (building) => building.owner === 1 && building.buildingType === 'town-center',
      ),
    ).toHaveLength(2);
    expect(
      trainedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);
  });

  test('can build a Watch Tower and let it automatically kill a nearby visible Scout', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-watch-tower-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-watch-tower"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Watch Tower');
    const watchTowerPlacement = await game.findValidPlacementNearTownCenter(page, 'watch-tower', 1, [
      { x: 14, y: 11 },
      { x: 12, y: 10 },
      { x: 12, y: 11 },
      { x: 16, y: 10 },
    ]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        watchTowerPlacement,
      ),
    ).toBe(true);
    await expect(page.locator('[data-hud="stone"]')).toHaveText('75');

    const postTowerSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(520, 100),
    );

    expect(
      postTowerSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'watch-tower'
          && building.isComplete,
      ),
    ).toBe(true);
    expect(
      postTowerSnapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  });

  test('can garrison and ungarrison a villager through the Town Center in the live game', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(8, 8))).toBe(true);

    let snapshot = await game.getSnapshot(page);
    expect(
      snapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(8, 8))).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="action-ungarrison"]').click();

    snapshot = await game.getSnapshot(page);
    const villagersAfterUngarrison = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'villager',
    );
    expect(villagersAfterUngarrison).toHaveLength(3);
    expect(
      villagersAfterUngarrison.some(
        (villager) =>
          villager.x !== 6 && villager.y !== 8 && Math.abs(villager.x - 8) <= 2 && Math.abs(villager.y - 8) <= 2,
      ),
    ).toBe(true);
  });

  test('lets a garrisoned Town Center automatically kill a nearby enemy scout', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'town-center-defense-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(8, 8))).toBe(true);

    const snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(80, 100),
    );

    expect(
      snapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  });

  test('can build a Market and exchange resources through the live command panel', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-market-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-market"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Market');
    const marketPlacement = await game.findValidPlacementNearTownCenter(page, 'market', 1, [{ x: 17, y: 8 }]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        marketPlacement,
      ),
    ).toBe(true);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('275');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(280, 100));

    expect(await game.selectOwnedBuildingDirect(page, 1, 'market')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Market');

    const afterBuild = await game.getSnapshot(page);
    await page.locator('[data-command="market-sell-wood"]').click();
    const afterFirstSale = await game.getSnapshot(page);
    expect(afterFirstSale.hudState.playerResources.wood).toBe(
      afterBuild.hudState.playerResources.wood - 100,
    );
    expect(afterFirstSale.hudState.playerResources.gold).toBeGreaterThan(
      afterBuild.hudState.playerResources.gold,
    );

    await page.locator('[data-command="market-buy-food"]').click();
    const afterFirstBuy = await game.getSnapshot(page);
    expect(afterFirstBuy.hudState.playerResources.food).toBe(
      afterFirstSale.hudState.playerResources.food + 100,
    );
    expect(afterFirstBuy.hudState.playerResources.gold).toBeLessThan(
      afterFirstSale.hudState.playerResources.gold,
    );
  });

  test('can set a rally point on an Archery Range so newly trained units move to it automatically', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-skirmisher-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(15, 10))).toBe(true);
    await page.locator('[data-command="train-skirmisher"]').click();

    const postRallySnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let index = 0; index < 360; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const ralliedUnit = snapshot.economyState.units.find(
          (unit) =>
            unit.owner === 1
            && unit.unitType === 'skirmisher'
            && Math.abs(unit.x - 15) + Math.abs(unit.y - 10) <= 1,
        );
        if (ralliedUnit) {
          break;
        }
      }
      return snapshot;
    });

    expect(
      postRallySnapshot.economyState.units.some(
        (unit) =>
          unit.owner === 1
          && unit.unitType === 'skirmisher'
          && Math.abs(unit.x - 15) + Math.abs(unit.y - 10) <= 1,
      ),
    ).toBe(true);
  });

  test('can place and complete a House with villager build controls', async ({ page }) => {
    test.slow();
    await game.waitForBoot(page);

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    const housePosition = await game.findValidPlacementNearTownCenter(page, 'house');
    await game.clickCell(page, housePosition.x, housePosition.y);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('175');

    const placedSnapshot = await game.getSnapshot(page);
    expect(
      placedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'house'
          && building.x === housePosition.x
          && building.y === housePosition.y
          && building.isComplete === false,
      ),
    ).toBe(true);

    await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      for (let index = 0; index < 700; index += 1) {
        const snapshot = api.advanceTicks(1, 100);
        const isComplete = snapshot.economyState.buildings.some(
          (building) =>
            building.owner === 1
            && building.buildingType === 'house'
            && building.isComplete,
        );
        if (isComplete) {
          return snapshot;
        }
      }

      return api.getSnapshot();
    });

    await expect(page.locator('[data-hud="pop"]')).toHaveText('4/10');
    const completedSnapshot = await game.getSnapshot(page);
    expect(
      completedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'house'
          && building.isComplete,
      ),
    ).toBe(true);
  });

});
