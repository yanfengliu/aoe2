import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - simulation and exploration', () => {
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
    await game.waitForBoot(page);

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
    await game.clickCell(page, 12, 7, 'right');

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
    await game.waitForBoot(page);

    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(12, 7))).toBe(true);

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

  test('can select the Town Center and train a villager through the command panel', async ({ page }) => {
    await game.waitForBoot(page);

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await expect(page.locator('[data-selection-entity-icon="town-center"]')).toHaveText('TC');
    await game.expectSelectionDetail(page, 'health', '2400 / 2400');
    await game.expectSelectionDetail(page, 'attack', '5');
    await game.expectSelectionDetail(page, 'armor', '0');
    await game.expectSelectionDetail(page, 'faction', 'Player');
    await game.expectSelectionDetail(page, 'civ', 'Britons');
    await game.expectSelectionDetail(page, 'inventory', '0 / 5 garrisoned');
    await expect(page.locator('[data-selection-position]')).toHaveCount(0);
    await expect(page.locator('[data-selection-cycle]')).toHaveCount(0);
    await expect(page.locator('[data-selection-resource]')).toHaveCount(0);
    await expect(page.locator('[data-placement-mode]')).toHaveCount(0);
    await page.locator('[data-command="train-villager"]').click();

    await expect(page.locator('[data-hud="food"]')).toHaveText('150');
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Training: Villager');
    await expect(page.locator('[data-selection-queue-item="0"]')).not.toContainText('ticks remaining');

    const advancedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(260, 100),
    );

    await expect(page.locator('[data-hud="pop"]')).toHaveText('5/5');
    expect(
      advancedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(4);
  });

  test('can inspect visible resources through the HUD selection panel', async ({ page }) => {
    await game.waitForBoot(page);
    const sheepCells = await game.getOwnedResourceCells(page, 1, 'sheep');
    expect(sheepCells.length).toBeGreaterThan(0);

    const initialSnapshot = await game.getSnapshot(page);
    expect(
      initialSnapshot.economyState.resources.some(
        (resource) => resource.resourceType === 'sheep' && resource.baseOwner === 1 && resource.owner === 1,
      ),
    ).toBe(true);

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        sheepCells[0],
      ),
    ).toBe(true);
    const selectedSnapshot = await game.getSnapshot(page);

    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await expect(page.locator('[data-selection-entity-icon="sheep"]')).toHaveText('SH');
    await game.expectSelectionDetail(page, 'faction', 'Player');
    await game.expectSelectionDetail(page, 'inventory', '100 / 100 food remaining');
    await game.expectSelectionDetailAbsent(page, 'health');
    await game.expectSelectionDetailAbsent(page, 'attack');
    await game.expectSelectionDetailAbsent(page, 'armor');
    await game.expectSelectionDetailAbsent(page, 'civ');
    await expect(page.locator('[data-selection-position]')).toHaveCount(0);
    await expect(page.locator('[data-selection-cycle]')).toHaveCount(0);
    await expect(page.locator('[data-selection-resource]')).toHaveCount(0);
    expect(selectedSnapshot.selectionState.owner).toBe(1);
  });

  test('renders shoreline fish on water and lets villagers gather food from them', async ({ page }) => {
    test.slow();
    await game.waitForBootWithSeed(page, 'fish-fixture');

    const fish = await page.evaluate(() =>
      window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.resources.find((resource) => resource.resourceType === 'fish') ?? null,
    );
    expect(fish).not.toBeNull();

    await game.clickCell(page, fish?.x ?? 0, fish?.y ?? 0);
    await expect(page.locator('[data-selection-name]')).toHaveText('Fish');
    await expect(page.locator('[data-selection-entity-icon="fish"]')).toHaveText('F');
    await game.expectSelectionDetail(page, 'faction', 'Gaia');
    await game.expectSelectionDetail(page, 'inventory', `${fish?.amount} / ${fish?.maxAmount} food remaining`);
    await game.expectSelectionDetailAbsent(page, 'health');
    await game.expectSelectionDetailAbsent(page, 'attack');
    await game.expectSelectionDetailAbsent(page, 'armor');
    await game.expectSelectionDetailAbsent(page, 'civ');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommand(x, y),
        { x: fish?.x ?? 0, y: fish?.y ?? 0 },
      ),
    ).toBe(true);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      return snapshot.hudState.playerResources.food;
    }, { timeout: 15_000 }).toBeGreaterThan(0);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      return snapshot.economyState.resources.find((resource) => resource.resourceType === 'fish')?.amount ?? 0;
    }, { timeout: 15_000 }).toBeLessThan(fish?.amount ?? 0);
  });

  test('removes depleted resources from the live world instead of rendering zero-amount nodes', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'resource-depletion-fixture');

    await game.clickCell(page, 12, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Tree');
    await game.expectSelectionDetail(page, 'inventory', '1 / 1 wood remaining');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(12, 8))).toBe(true);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
      return snapshot.economyState.resources.some(
        (resource) => resource.resourceType === 'tree' && resource.x === 12 && resource.y === 8,
      );
    }).toBe(false);

    const depletedSnapshot = await game.getSnapshot(page);
    expect(
      depletedSnapshot.economyState.resources.some(
        (resource) => resource.resourceType === 'tree' && resource.x === 12 && resource.y === 8,
      ),
    ).toBe(false);
    expect(
      depletedSnapshot.renderState.entities.some(
        (entity) => entity.kind === 'resource' && entity.entityType === 'tree' && entity.x === 10 && entity.y === 8,
      ),
    ).toBe(false);
  });

  test('claims neutral sheep for the player once a nearby scout moves into range', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'sheep-ownership-fixture');

    const initialSnapshot = await game.getSnapshot(page);
    expect(
      initialSnapshot.economyState.resources.find((resource) => resource.resourceType === 'sheep'),
    ).toMatchObject({
      owner: null,
      baseOwner: null,
      x: 10,
      y: 8,
    });

    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(7, 8))).toBe(true);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      return snapshot.economyState.resources.find((resource) => resource.resourceType === 'sheep')?.owner ?? null;
    }).toBe(1);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(10, 8))).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await expect.poll(async () => (await game.getSnapshot(page)).selectionState.owner).toBe(1);
  });

  test('lets the player right-click an owned sheep to walk it to a destination', async ({ page }) => {
    test.slow();
    await game.waitForBootWithSeed(page, 'sheep-movement-fixture');

    // Wait for the human villager to claim its adjacent sheep at (20, 19).
    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
      return snapshot.economyState.resources.find(
        (resource) => resource.resourceType === 'sheep' && resource.x === 20 && resource.y === 19,
      )?.owner ?? null;
    }).toBe(1);

    // Select the now-owned sheep at its current cell.
    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(20, 19))).toBe(true);

    // Right-click a destination several tiles away on open terrain.
    const targetX = 14;
    const targetY = 19;
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommand(x, y),
        { x: targetX, y: targetY },
      ),
    ).toBe(true);

    // Advance enough ticks for the sheep to make visible progress and assert the cell
    // position has shifted toward the target.
    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(20, 100));
      const sheep = snapshot.economyState.resources.find(
        (resource) => resource.resourceType === 'sheep' && resource.owner === 1,
      );
      if (!sheep) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(sheep.x - targetX) + Math.abs(sheep.y - targetY);
    }).toBeLessThan(Math.abs(20 - targetX) + Math.abs(19 - targetY));
  });

  test('double clicking an owned sheep selects every visible owned sheep', async ({ page }) => {
    test.slow();
    await game.waitForBootWithSeed(page, 'sheep-movement-fixture');

    // Wait for the human villager to claim the adjacent sheep cluster.
    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
      return snapshot.economyState.resources.filter(
        (resource) => resource.resourceType === 'sheep' && resource.owner === 1,
      ).length;
    }).toBeGreaterThanOrEqual(2);

    // Snapshot owned sheep positions and the villager position before any selection.
    const ownedSheepCells = await page.evaluate(() =>
      window
        .__AOE2_TEST__!.getSnapshot()
        .economyState.resources.filter(
          (resource) => resource.resourceType === 'sheep' && resource.owner === 1,
        )
        .map((resource) => ({ x: resource.x, y: resource.y })),
    );
    expect(ownedSheepCells.length).toBeGreaterThanOrEqual(2);

    // The sheep cluster is at (19-20, 18-19); the default camera is centered on the
    // human TC at (4, 4), so the sheep may land off the rendered canvas. Click the
    // minimap to center the camera on the sheep before issuing the canvas clicks.
    const minimapPoint = await game.getMinimapPoint(page, 20 / 60, 19 / 36);
    await page.mouse.click(minimapPoint.x, minimapPoint.y);
    // Let the scene flush the new camera position.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 16));

    const renderedSheep = await game.getRenderedOwnedEntitiesByType(page, 1, 'resource', 'sheep');
    expect(renderedSheep.length).toBeGreaterThanOrEqual(ownedSheepCells.length);

    // Double-click the first visible sheep body. The first click selects the single
    // sheep; the second (inside the double-click window) triggers same-type selection
    // expansion to every visible owned sheep.
    await game.doubleClickWorldPosition(
      page,
      (renderedSheep[0]?.x ?? 0) + 0.5,
      (renderedSheep[0]?.y ?? 0) + 0.5,
    );

    const selectedSnapshot = await game.getSnapshot(page);
    expect(selectedSnapshot.selectionState.selectedCount).toBeGreaterThanOrEqual(
      ownedSheepCells.length,
    );
    expect(selectedSnapshot.selectionState.selectedKind).toBe('resource');
    expect(selectedSnapshot.selectionState.owner).toBe(1);
  });

  test('remembers an enemy house with reduced-opacity memory rendering after the scout walks away', async ({ page }) => {
    test.slow();
    await game.waitForBootWithSeed(page, 'fog-memory-fixture');

    // Warm up a couple of ticks so visibility updates run.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(3, 100));

    // Confirm the enemy house starts in live vision (non-memory).
    const initialHouse = await page.evaluate(() =>
      window
        .__AOE2_TEST__!.getRenderState()
        .entities.find(
          (entity) =>
            entity.kind === 'building'
            && entity.entityType === 'house'
            && entity.owner === 2,
        ),
    );
    expect(initialHouse).toBeTruthy();
    expect(initialHouse!.isMemory).toBe(false);

    // Select the scout and walk it back near the human TC so the house leaves vision.
    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(4, 5))).toBe(true);

    // Poll until the scout arrives (it can take many ticks).
    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(10, 100));
      const scout = snapshot.economyState.units.find(
        (unit) => unit.owner === 1 && unit.unitType === 'scout',
      );
      if (!scout) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(scout.x - 4) + Math.abs(scout.y - 5);
    }).toBeLessThanOrEqual(1);

    // A few more ticks for visibility to settle.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(5, 100));

    const memoryHouse = await page.evaluate(() =>
      window
        .__AOE2_TEST__!.getRenderState()
        .entities.find(
          (entity) =>
            entity.kind === 'building'
            && entity.entityType === 'house'
            && entity.owner === 2,
        ),
    );
    expect(memoryHouse).toBeTruthy();
    expect(memoryHouse!.isMemory).toBe(true);
    expect(memoryHouse!.x).toBe(14);
    expect(memoryHouse!.y).toBe(10);
  });

});
