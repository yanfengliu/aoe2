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
    // Britons TC wood -50% from Castle Age (sourced v0.3.150): 700 - 138.
    await expect(page.locator('[data-hud="wood"]')).toHaveText('562');
    await expect(page.locator('[data-hud="stone"]')).toHaveText('250');

    // A DE Town Center is 1,500 ticks (structures.csv 150 s) plus the walk, so
    // the old 420-tick cap fell out with the foundation still up — and a
    // foundation SELECTS, so the failure surfaced three assertions later as
    // "food 200, expected 150" (an incomplete TC trains nothing).
    await game.advanceUntilBuildingComplete(page, 1, 'town-center', 6_000, townCenterPlacement);
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

    await game.advanceUntilBuildingComplete(page, 1, 'watch-tower');

    // Completion is the START of the tower's job: it still has to see the
    // Scout and shoot it, so this waits for the KILL rather than assuming a
    // fixed number of ticks covers both the build and the shooting.
    let scoutDead = false;
    for (let advanced = 0; advanced < 1_200 && !scoutDead; advanced += 100) {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(100, 100));
      scoutDead = !snapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      );
    }
    expect(scoutDead).toBe(true);
  });

  test('can garrison and ungarrison a villager through the Town Center in the live game', async ({
    page,
  }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    const garrisonedVillagerId = await page.evaluate(
      () => window.__AOE2_TEST__!.getSelectionState().selectedEntityIds[0],
    );
    expect(garrisonedVillagerId).toBeDefined();
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(8, 8, true))).toBe(true);

    // Garrisoning WALKS since v0.3.42 — the villager crosses the two cells to
    // the Town Center before it goes inside, which takes about 26 ticks. This
    // test still advanced ONE, so it had been asserting the instant garrison
    // that the walk replaced.
    let snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(60, 100));
    expect(
      snapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(8, 8))).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="action-ungarrison"]').click();

    snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
    const villagersAfterUngarrison = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'villager',
    );
    expect(villagersAfterUngarrison).toHaveLength(3);
    const releasedVillager = villagersAfterUngarrison.find(
      (villager) => villager.id === garrisonedVillagerId,
    );
    expect(releasedVillager).toBeDefined();
    expect(releasedVillager!.x === 12 || releasedVillager!.y === 12).toBe(true);
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
    await game.waitForPausedBootWithSeed(page, 'town-center-defense-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(8, 8, true))).toBe(true);

    // The villager spends about 26 of these ticks WALKING into the Town
    // Center (v0.3.42) before its presence adds an arrow, so the budget has to
    // cover the walk and the shooting rather than the shooting alone.
    const snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(300, 100),
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
    await game.waitForPausedBootWithSeed(page, 'feudal-market-fixture');

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
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
    await expect(page.locator('[data-hud="wood"]')).toHaveText('275');

    // §12.4.2 walk clock (v0.3.160): the builder WALKS to the site now, so the
    // construction window carries the commute on top of the build time.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(900, 100));

    expect(await game.selectOwnedBuildingDirect(page, 1, 'market')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Market');

    const afterBuild = await game.getSnapshot(page);
    await page.locator('[data-command="market-sell-wood"]').click();
    const afterFirstSale = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(1, 100),
    );
    expect(afterFirstSale.hudState.playerResources.wood).toBe(
      afterBuild.hudState.playerResources.wood - 100,
    );
    expect(afterFirstSale.hudState.playerResources.gold).toBeGreaterThan(
      afterBuild.hudState.playerResources.gold,
    );

    await page.locator('[data-command="market-buy-food"]').click();
    const afterFirstBuy = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(1, 100),
    );
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
