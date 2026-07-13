import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - rendering and world interactions', () => {
  test('renders construction and completion building visuals with authoritative footprint sizing', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    const townCenterVisual = await game.getBuildingVisualState(page, 1, 'town-center', 8, 8);
    expect(townCenterVisual).toMatchObject({
      footprintWidthCells: 4,
      footprintHeightCells: 4,
      visualVariant: 'complete',
      hasFoundationSlab: false,
      hasScaffoldPosts: false,
      hasStructureBody: true,
      hasRoofAccent: true,
      hasConstructionIndicator: false,
      hasCompletionAccent: true,
    });

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.locator('[data-command="build-house"]').click();
    const housePlacement = await game.findValidPlacementNearTownCenter(page, 'house', 1, [{ x: 10, y: 5 }]);
    const didPlaceHouse = await page.evaluate(
      ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
      housePlacement,
    );
    expect(didPlaceHouse).toBe(true);

    // Placement commands are applied at the next deterministic simulation
    // boundary; do not depend on a browser animation frame winning this race.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));

    const placedSnapshot = await game.getSnapshot(page);
    expect(
      placedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'house'
          && building.x === housePlacement.x
          && building.y === housePlacement.y
          && building.isComplete === false,
      ),
    ).toBe(true);

    const constructingHouseVisual = await game.getBuildingVisualState(
      page,
      1,
      'house',
      housePlacement.x,
      housePlacement.y,
    );
    expect(constructingHouseVisual).toMatchObject({
      footprintWidthCells: 2,
      footprintHeightCells: 2,
      visualVariant: 'construction',
      hasFoundationSlab: true,
      hasScaffoldPosts: true,
      hasStructureBody: false,
      hasRoofAccent: false,
      hasConstructionIndicator: true,
      hasCompletionAccent: false,
    });
    expect(constructingHouseVisual?.widthPx).toBe((constructingHouseVisual?.heightPx ?? 0));
    expect(townCenterVisual?.widthPx).toBe((constructingHouseVisual?.widthPx ?? 0) * 2);
    expect(townCenterVisual?.heightPx).toBe((constructingHouseVisual?.heightPx ?? 0) * 2);

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));

    const completedHouseVisual = await game.getBuildingVisualState(
      page,
      1,
      'house',
      housePlacement.x,
      housePlacement.y,
    );
    expect(completedHouseVisual).toMatchObject({
      footprintWidthCells: 2,
      footprintHeightCells: 2,
      visualVariant: 'complete',
      hasFoundationSlab: false,
      hasScaffoldPosts: false,
      hasStructureBody: true,
      hasRoofAccent: true,
      hasConstructionIndicator: false,
      hasCompletionAccent: true,
    });
    expect(completedHouseVisual?.widthPx).toBe(constructingHouseVisual?.widthPx);
    expect(completedHouseVisual?.heightPx).toBe(constructingHouseVisual?.heightPx);
  });

  test('renders health bars above units and buildings and updates them as health changes', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'conquest-victory-fixture');

    const initialMilitiaBar = await game.getEntityHealthBarState(page, 1, 'unit', 'militia');
    const initialHouseBar = await game.getEntityHealthBarState(page, 2, 'building', 'house');

    expect(initialMilitiaBar).toMatchObject({
      currentHp: 40,
      maxHp: 40,
      fillRatio: 1,
    });
    expect(initialHouseBar).toMatchObject({
      currentHp: 75,
      maxHp: 75,
      fillRatio: 1,
    });
    expect(initialMilitiaBar?.barY ?? 0).toBeLessThan(initialMilitiaBar?.entityTopPx ?? 0);
    expect(initialHouseBar?.barY ?? 0).toBeLessThan(initialHouseBar?.entityTopPx ?? 0);

    await game.clickCell(page, 8, 8);
    await game.clickCell(page, 10, 8, 'right');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(80, 100));

    const damagedHouseBar = await game.getEntityHealthBarState(page, 2, 'building', 'house');
    expect(damagedHouseBar?.currentHp).toBeLessThan(damagedHouseBar?.maxHp ?? 75);
    expect(damagedHouseBar?.fillRatio ?? 1).toBeLessThan(1);
    expect(damagedHouseBar?.barY ?? 0).toBeLessThan(damagedHouseBar?.entityTopPx ?? 0);
  });

  test('shows player-facing boar details and a wildlife health bar when a boar is selected', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'boar-aggro-fixture');

    // The iso camera frames the human base; the boar sits outside that view, so
    // centre the camera on its cell via the minimap before the canvas click
    // (matches the owned-sheep / fish tests' approach to off-screen targets).
    const boarMinimap = await game.getMinimapPoint(page, 13 / 60, 8 / 36);
    await page.mouse.click(boarMinimap.x, boarMinimap.y);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 16));

    await game.clickCell(page, 13, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Boar');
    await game.expectSelectionDetail(page, 'health', '75 / 75');
    await game.expectSelectionDetail(page, 'attack', '7');
    await game.expectSelectionDetail(page, 'armor', '0');
    await game.expectSelectionDetail(page, 'faction', 'Gaia');
    await game.expectSelectionDetailAbsent(page, 'civ');
    await game.expectSelectionDetail(page, 'inventory', '340 / 340 food remaining');

    const boarBar = await game.getEntityHealthBarState(page, null, 'resource', 'boar');
    expect(boarBar).toMatchObject({
      currentHp: 75,
      maxHp: 75,
      fillRatio: 1,
    });
    expect(boarBar?.barY ?? 0).toBeLessThan(boarBar?.entityTopPx ?? 0);

    const initialVillagerBar = await game.getEntityHealthBarState(page, 1, 'unit', 'villager');
    expect(initialVillagerBar?.currentHp).toBe(25);

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(80, 100));

    const idleVillagerBar = await game.getEntityHealthBarState(page, 1, 'unit', 'villager');
    expect(idleVillagerBar?.currentHp).toBe(25);
  });

  test('renders a wolf health bar and lets hostile wildlife auto-aggro nearby human units', async ({
    page,
  }) => {
    // Freeze the fixture before reading its baseline. The assertion below
    // advances deterministic ticks explicitly, so wall-clock renderer startup
    // must not race the first wolf strike.
    await game.waitForPausedBootWithSeed(page, 'wolf-aggro-fixture');

    const initialWolfBar = await game.getEntityHealthBarState(page, null, 'resource', 'wolf');
    const initialVillagerBar = await game.getEntityHealthBarState(page, 1, 'unit', 'villager');

    expect(initialWolfBar).toMatchObject({
      currentHp: 25,
      maxHp: 25,
      fillRatio: 1,
    });
    expect(initialVillagerBar).toMatchObject({
      currentHp: 25,
      maxHp: 25,
      fillRatio: 1,
    });
    expect(initialWolfBar?.barY ?? 0).toBeLessThan(initialWolfBar?.entityTopPx ?? 0);

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(120, 100));

    const damagedVillagerBar = await game.getEntityHealthBarState(page, 1, 'unit', 'villager');
    if (!damagedVillagerBar) {
      const survivingVillager = await page.evaluate(() =>
        window.__AOE2_TEST__!.getRenderState().entities.find(
          (entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager',
        ) ?? null);
      expect(survivingVillager).toBeNull();
    } else {
      expect(damagedVillagerBar.currentHp).toBeLessThan(damagedVillagerBar.maxHp);
    }
  });

  test('shows valid and invalid building placement preview feedback before construction', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    const validAnchor = await game.findValidPlacementNearTownCenter(page, 'house');
    await game.moveMouseToCell(page, validAnchor.x, validAnchor.y);
    let previewState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewState(),
    );
    let previewVisualState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewVisualState(),
    );
    expect(previewState).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: validAnchor.x,
      cellY: validAnchor.y,
      width: 2,
      height: 2,
      isValid: true,
    });
    expect(previewVisualState).toMatchObject({
      active: true,
      isValid: true,
      cellOutlineCount: 4,
      blockedMarkerCount: 0,
    });

    // Pick any resource cell on the map — a 2x2 house anchored there
    // must overlap the resource and therefore be invalid.
    const invalidAnchor = await page.evaluate(() => {
      const resources = window.__AOE2_TEST__!.getSnapshot().economyState.resources;
      const humanTc = window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.buildings.find(
          (building) => building.owner === 1 && building.buildingType === 'town-center',
        );
      if (!humanTc) {
        throw new Error('Expected human Town Center.');
      }
      let closest: { x: number; y: number } | null = null;
      let closestDist = Infinity;
      for (const resource of resources) {
        const dx = resource.x - humanTc.x;
        const dy = resource.y - humanTc.y;
        const dist = dx * dx + dy * dy;
        if (dist < closestDist) {
          closest = { x: resource.x, y: resource.y };
          closestDist = dist;
        }
      }
      if (!closest) {
        throw new Error('Expected at least one resource near the Town Center.');
      }
      return closest;
    });
    await game.moveMouseToCell(page, invalidAnchor.x, invalidAnchor.y);
    previewState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewState(),
    );
    previewVisualState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewVisualState(),
    );
    expect(previewState).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: invalidAnchor.x,
      cellY: invalidAnchor.y,
      width: 2,
      height: 2,
      isValid: false,
    });
    expect(previewVisualState).toMatchObject({
      active: true,
      isValid: false,
      cellOutlineCount: 4,
    });
    expect(previewVisualState?.blockedMarkerCount ?? 0).toBeGreaterThan(0);

    await game.clickCell(page, 8, 8);
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    const postInvalidClickSnapshot = await game.getSnapshot(page);
    expect(
      postInvalidClickSnapshot.economyState.buildings.some(
        (building) => building.owner === 1 && building.buildingType === 'house',
      ),
    ).toBe(false);
  });

  test('shows house placement as invalid on blocked terrain, resources, buildings, and units', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'blocking-rules-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    const blockedAnchors = [
      { x: 10, y: 5 },
      { x: 12, y: 5 },
      { x: 14, y: 5 },
      { x: 8, y: 13 },
      { x: 7, y: 13 },
      { x: 4, y: 8 },
    ];

    for (const anchor of blockedAnchors) {
      const preview = await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.getPlacementPreviewAt(x, y),
        anchor,
      );
      expect(preview).toMatchObject({
        active: true,
        buildingType: 'house',
        cellX: anchor.x,
        cellY: anchor.y,
        isValid: false,
      });
    }
  });

  test('routes movement around blocked terrain and resources without treating units as hard blockers', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'blocking-rules-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(10, 13))).toBe(true);

    const visitedCells = await page.evaluate(() => {
      const blocked = new Set(['8,13', '10,5', '12,5', '14,5']);
      const api = window.__AOE2_TEST__!;
      const visited: string[] = [];

      for (let index = 0; index < 80; index += 1) {
        const snapshot = api.advanceTicks(1, 100);
        const scout = snapshot.economyState.units.find(
          (unit) => unit.owner === 1 && unit.unitType === 'scout',
        );
        if (!scout) {
          throw new Error('Expected the human scout to exist.');
        }
        const key = `${scout.x},${scout.y}`;
        if (blocked.has(key)) {
          throw new Error(`Scout entered blocked cell ${key}.`);
        }
        visited.push(key);
      }

      return visited;
    });

    expect(visitedCells).toContain('10,13');
  });

  test('can right-click a visible resource to redirect villager gathering', async ({ page }) => {
    await game.waitForBoot(page);

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');

    const goldMine = await page.evaluate(() => {
      const snapshot = window.__AOE2_TEST__!.getSnapshot();
      const humanTc = snapshot.economyState.buildings.find(
        (building) => building.owner === 1 && building.buildingType === 'town-center',
      );
      if (!humanTc) {
        throw new Error('Expected human Town Center.');
      }
      const mines = snapshot.economyState.resources.filter(
        (resource) => resource.resourceType === 'gold-mine' && resource.baseOwner === 1,
      );
      if (mines.length === 0) {
        throw new Error('Expected at least one gold mine near the human base.');
      }
      mines.sort((a, b) => {
        const distA = (a.x - humanTc.x) ** 2 + (a.y - humanTc.y) ** 2;
        const distB = (b.x - humanTc.x) ** 2 + (b.y - humanTc.y) ** 2;
        return distA - distB;
      });
      return { x: mines[0].x, y: mines[0].y };
    });

    await game.clickCell(page, goldMine.x, goldMine.y, 'right');

    const advancedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(260, 100),
    );

    await expect(page.locator('[data-hud="gold"]')).toHaveText(
      String(advancedSnapshot.hudState.playerResources.gold),
    );
    expect(advancedSnapshot.hudState.playerResources.gold).toBeGreaterThan(100);
  });

  test('can build a Mining Camp from the villager build panel and use it for gold drop-off', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'mining-camp-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-mining-camp"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Mining Camp');
    const miningCampPlacement = await game.findValidPlacementNearTownCenter(page, 'mining-camp', 1, [
      { x: 15, y: 7 },
      { x: 15, y: 8 },
      { x: 15, y: 6 },
    ]);
    await game.clickCell(page, miningCampPlacement.x, miningCampPlacement.y);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('100');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));

    const completedSnapshot = await game.getSnapshot(page);
    expect(
      completedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'mining-camp'
          && building.isComplete,
      ),
    ).toBe(true);

    await game.clickCell(page, 13, 7, 'right');
    const incomeSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(120, 100),
    );

    await expect(page.locator('[data-hud="gold"]')).toHaveText(
      String(incomeSnapshot.hudState.playerResources.gold),
    );
    expect(incomeSnapshot.hudState.playerResources.gold).toBeGreaterThan(100);
  });

});
