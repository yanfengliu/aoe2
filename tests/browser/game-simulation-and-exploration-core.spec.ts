import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - game-simulation-and-exploration (core)', () => {
  test('keeps human starting units idle until the player gives orders', async ({ page }) => {
    await game.waitForBoot(page);

    const initialSnapshot = await game.getSnapshot(page);
    const initialHumanScout = initialSnapshot.economyState.units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'scout',
    );
    expect(initialHumanScout).toBeDefined();

    const advancedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(120, 100),
    );

    await expect
      .poll(async () => page.locator('[data-hud="food"]').textContent())
      .toBe(String(advancedSnapshot.hudState.playerResources.food));

    expect(advancedSnapshot.hudState.playerResources).toEqual(
      initialSnapshot.hudState.playerResources,
    );
    expect(advancedSnapshot.renderState.frame?.exploredCells.length ?? 0).toBe(
      initialSnapshot.renderState.frame?.exploredCells.length ?? 0,
    );
    expect(
      advancedSnapshot.economyState.villagers
        .filter((villager) => villager.owner === 1)
        .every((villager) => villager.task === 'idle'),
    ).toBe(true);
    expect(
      advancedSnapshot.economyState.units.find((unit) => unit.owner === 1 && unit.unitType === 'scout'),
    ).toMatchObject({
      x: initialHumanScout?.x,
      y: initialHumanScout?.y,
    });
  });

  test('advances human economy and exploration only after explicit gather and move orders', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'orders-fixture');

    const initialSnapshot = await game.getSnapshot(page);
    const sheepCells = await game.getOwnedResourceCells(page, 1, 'sheep');
    expect(sheepCells.length).toBeGreaterThan(0);

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommand(x, y),
        sheepCells[0],
      ),
    ).toBe(true);

    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(16, 12))).toBe(true);

    const advancedSnapshot = await page.evaluate(
      ({ initialFood, initialExploredCells }) => {
        const api = window.__AOE2_TEST__!;
        let snapshot = api.getSnapshot();
        for (let index = 0; index < 320; index += 1) {
          snapshot = api.advanceTicks(1, 100);
          const foodIncreased = snapshot.hudState.playerResources.food > initialFood;
          const exploredIncreased =
            (snapshot.renderState.frame?.exploredCells.length ?? 0) > initialExploredCells;
          const sheepHarvested = snapshot.economyState.resources.some(
            (resource) =>
              resource.baseOwner === 1
              && resource.resourceType === 'sheep'
              && resource.amount < resource.maxAmount,
          );
          if (foodIncreased && exploredIncreased && sheepHarvested) {
            break;
          }
        }
        return snapshot;
      },
      {
        initialFood: initialSnapshot.hudState.playerResources.food,
        initialExploredCells: initialSnapshot.renderState.frame?.exploredCells.length ?? 0,
      },
    );

    expect(advancedSnapshot.hudState.playerResources.food).toBeGreaterThan(
      initialSnapshot.hudState.playerResources.food,
    );
    expect(advancedSnapshot.renderState.frame?.exploredCells.length ?? 0).toBeGreaterThan(
      initialSnapshot.renderState.frame?.exploredCells.length ?? 0,
    );
    expect(
      advancedSnapshot.economyState.resources.some(
        (resource) =>
          resource.baseOwner === 1
          && resource.resourceType === 'sheep'
          && resource.amount < resource.maxAmount,
      ),
    ).toBe(true);
  });

  test('renders units on a finer sub-grid while buildings stay snapped to coarse cells', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');

    const initialSnapshot = await game.getSnapshot(page);
    const scout = initialSnapshot.economyState.units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'scout',
    );
    const initialScoutRender = initialSnapshot.renderState.entities.find((entity) => entity.id === scout?.id);
    const initialTownCenterRender = initialSnapshot.renderState.entities.find(
      (entity) => entity.owner === 1 && entity.entityType === 'town-center',
    );

    expect(scout).toBeDefined();
    expect(initialScoutRender).toBeDefined();
    expect(initialTownCenterRender).toBeDefined();

    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueMoveCommand(Math.max(x - 5, 0), y),
        { x: scout?.x ?? 0, y: scout?.y ?? 0 },
      ),
    ).toBe(true);

    const advancedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(1, 100),
    );
    const advancedScoutRender = advancedSnapshot.renderState.entities.find((entity) => entity.id === scout?.id);
    const advancedEconomyScout = advancedSnapshot.economyState.units.find((unit) => unit.id === scout?.id);
    const advancedTownCenterRender = advancedSnapshot.renderState.entities.find(
      (entity) => entity.owner === 1 && entity.entityType === 'town-center',
    );
    expect(
      Math.abs((advancedScoutRender?.x ?? 0) - (initialScoutRender?.x ?? 0))
      + Math.abs((advancedScoutRender?.y ?? 0) - (initialScoutRender?.y ?? 0)),
    ).toBeGreaterThan(0);
    expect(
      Math.abs((advancedScoutRender?.x ?? 0) - (initialScoutRender?.x ?? 0))
      + Math.abs((advancedScoutRender?.y ?? 0) - (initialScoutRender?.y ?? 0)),
    ).toBeLessThan(24);
    expect(
      Number.isInteger(advancedScoutRender?.x ?? NaN)
      && Number.isInteger(advancedScoutRender?.y ?? NaN),
    ).toBe(false);
    expect(advancedEconomyScout).toBeDefined();
    expect(advancedTownCenterRender?.x).toBe(initialTownCenterRender?.x);
    expect(Number.isInteger(advancedTownCenterRender?.x ?? NaN)).toBe(true);
  });

  test('interpolates live unit visuals between simulation ticks instead of only snapping to tick positions', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');

    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(12, 7))).toBe(true);
    await page.evaluate(() => window.__AOE2_TEST__!.setPaused(false));

    await expect.poll(async () => {
      const displayedScout = await game.getDisplayedEntityState(page, 1, 'unit', 'scout');
      const projectedScout = (await game.getSnapshot(page)).renderState.entities.find(
        (entity) => entity.owner === 1 && entity.kind === 'unit' && entity.entityType === 'scout',
      );
      if (!displayedScout || !projectedScout) {
        return 0;
      }

      return (
        Math.abs(displayedScout.x - projectedScout.x)
        + Math.abs(displayedScout.y - projectedScout.y)
      );
    }).toBeGreaterThan(0);
  });

  test('lets multiple friendly units share one coarse cell while rendering them at distinct sub-grid positions', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'unit-sharing-fixture');

    const initialSnapshot = await game.getSnapshot(page);
    const initialUnits = initialSnapshot.economyState.units.filter((unit) => unit.owner === 1);
    expect(initialUnits).toHaveLength(2);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.clearSelection())).toBeUndefined();
    await game.dragSelectCells(page, 5, 9, 8, 11);
    await page.mouse.up({ button: 'left' });
    await expect(page.locator('[data-selection-name]')).toHaveText('2 Units Selected');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(7, 10))).toBe(true);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
      return snapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.x === 7 && unit.y === 10,
      ).length;
    }).toBe(2);

    const displayedUnits = await page.evaluate(() =>
      window.__AOE2_TEST__!
        .getDisplayedEntities()
        .filter(
          (entity) =>
            entity.kind === 'unit'
            && entity.owner === 1
            && Math.floor(entity.x) === 7
            && Math.floor(entity.y) === 10,
        ),
    );
    expect(displayedUnits).toHaveLength(2);
    expect(
      Math.abs((displayedUnits[0]?.x ?? 0) - (displayedUnits[1]?.x ?? 0))
      + Math.abs((displayedUnits[0]?.y ?? 0) - (displayedUnits[1]?.y ?? 0)),
    ).toBeGreaterThan(0.05);
  });

});
