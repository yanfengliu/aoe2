import {
  expect,
  type Page,
  test,
} from '@playwright/test';

import type {
  BrowserTestSnapshot,
} from '../../src/app/bootstrap/browserTestApi';

interface MinimapStats {
  width: number;
  height: number;
  nonBackgroundPixelCount: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

async function waitForBoot(page: Page): Promise<void> {
  await waitForBootWithSeed(page, 'aoe2-prototype');
}

async function waitForBootWithSeed(page: Page, seed: string): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  await expect(page.locator('[data-hud="seed"]')).toHaveText(seed);
  await expect.poll(async () => {
    const snapshot = await getSnapshot(page);
    return snapshot.hudState.tick;
  }).toBeGreaterThan(0);
}

async function getSnapshot(
  page: Page,
): Promise<BrowserTestSnapshot> {
  return page.evaluate(() => window.__AOE2_TEST__!.getSnapshot());
}

async function getMinimapStats(
  page: Page,
): Promise<MinimapStats> {
  return page.locator('[data-hud="minimap"]').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Expected the minimap canvas to have a 2D context.');
    }

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    let nonBackgroundPixelCount = 0;

    for (let index = 0; index < image.data.length; index += 4) {
      const red = image.data[index];
      const green = image.data[index + 1];
      const blue = image.data[index + 2];

      if (red !== 8 || green !== 16 || blue !== 18) {
        nonBackgroundPixelCount += 1;
      }
    }

    return {
      width: canvas.width,
      height: canvas.height,
      nonBackgroundPixelCount,
    };
  });
}

async function getScreenPointForCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<ScreenPoint> {
  return page.evaluate(
    ({ cellX: x, cellY: y }) => window.__AOE2_TEST__!.worldToScreen(x, y),
    { cellX, cellY },
  );
}

async function clickCell(
  page: Page,
  cellX: number,
  cellY: number,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  const point = await getScreenPointForCell(page, cellX, cellY);
  const canvas = page.locator('#game-root canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  await canvas.click({
    position: {
      x: point.x - (bounds?.x ?? 0),
      y: point.y - (bounds?.y ?? 0),
    },
    button,
    force: true,
  });
}

async function doubleClickCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<void> {
  const point = await getScreenPointForCell(page, cellX, cellY);
  const canvas = page.locator('#game-root canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  await canvas.dblclick({
    position: {
      x: point.x - (bounds?.x ?? 0),
      y: point.y - (bounds?.y ?? 0),
    },
    button: 'left',
    force: true,
  });
}

async function dragSelectCells(
  page: Page,
  startCellX: number,
  startCellY: number,
  endCellX: number,
  endCellY: number,
): Promise<void> {
  const startPoint = await getScreenPointForCell(page, startCellX, startCellY);
  const endPoint = await getScreenPointForCell(page, endCellX, endCellY);

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(endPoint.x, endPoint.y, { steps: 6 });
}

async function moveMouseToCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<void> {
  const point = await getScreenPointForCell(page, cellX, cellY);
  await page.mouse.move(point.x, point.y);
}

async function selectOwnedUnitDirect(
  page: Page,
  owner: number,
  unitType: string,
): Promise<boolean> {
  return page.evaluate(
    ({ owner: playerOwner, unitType: expectedUnitType }) => {
      const api = window.__AOE2_TEST__!;
      const unit = api
        .getSnapshot()
        .economyState.units.find(
          (candidate) =>
            candidate.owner === playerOwner && candidate.unitType === expectedUnitType,
        );
      return unit ? api.selectEntityAtCell(unit.x, unit.y) : false;
    },
    { owner, unitType },
  );
}

async function getOwnedUnitCells(
  page: Page,
  owner: number,
  unitType: string,
): Promise<Array<{ x: number; y: number }>> {
  return page.evaluate(
    ({ owner: playerOwner, unitType: expectedUnitType }) =>
      window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.units.filter(
          (candidate) =>
            candidate.owner === playerOwner && candidate.unitType === expectedUnitType,
        )
        .map((unit) => ({ x: unit.x, y: unit.y })),
    { owner, unitType },
  );
}

async function selectOwnedBuildingDirect(
  page: Page,
  owner: number,
  buildingType: string,
): Promise<boolean> {
  return page.evaluate(
    ({ owner: playerOwner, buildingType: expectedBuildingType }) => {
      const api = window.__AOE2_TEST__!;
      const building = api
        .getSnapshot()
        .economyState.buildings.find(
          (candidate) =>
            candidate.owner === playerOwner && candidate.buildingType === expectedBuildingType,
        );
      if (!building) {
        return false;
      }

      const offsets = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ];

      for (const offset of offsets) {
        api.selectEntityAtCell(building.x + offset.x, building.y + offset.y);
        if (api.getSelectionState().selectedEntityType === expectedBuildingType) {
          return true;
        }
      }

      return false;
    },
    { owner, buildingType },
  );
}

test.describe('browser gameplay smoke tests', () => {
  test('boots into a live simulation and renders the HUD/minimap', async ({ page }) => {
    await waitForBoot(page);

    const snapshot = await getSnapshot(page);
    const minimap = await getMinimapStats(page);

    expect(snapshot.hudState.tick).toBeGreaterThan(0);
    expect(snapshot.hudState.worldSize).toBe('36x24');
    expect(snapshot.hudState.playerResources).toEqual({
      food: 200,
      wood: 200,
      gold: 100,
      stone: 200,
    });
    expect(snapshot.renderState.entities.length).toBeGreaterThan(0);
    expect(snapshot.renderState.frame?.visibleCells.length ?? 0).toBeGreaterThan(0);
    expect(minimap.width).toBe(220);
    expect(minimap.height).toBe(160);
    expect(minimap.nonBackgroundPixelCount).toBeGreaterThan(1_000);
    await expect(page.locator('[data-hud="match-summary"]')).toBeHidden();
  });

  test('supports camera panning and zoom with in-game controls', async ({ page }) => {
    await waitForBoot(page);
    const gameCanvas = page.locator('#game-root canvas');
    await gameCanvas.click();

    const initialCamera = (await getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await page.keyboard.down('KeyD');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyD');

    await expect.poll(async () => {
      const snapshot = await getSnapshot(page);
      return snapshot.cameraState?.scrollX ?? 0;
    }).toBeGreaterThan((initialCamera?.scrollX ?? 0) + 40);

    const movedCamera = (await getSnapshot(page)).cameraState;
    expect(movedCamera).not.toBeNull();

    const canvasBox = await gameCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    await page.mouse.move(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.5,
      (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.5,
    );
    await page.mouse.wheel(0, -400);

    await expect.poll(async () => {
      const snapshot = await getSnapshot(page);
      return snapshot.cameraState?.zoom ?? 0;
    }).toBeGreaterThan((movedCamera?.zoom ?? 0) + 0.2);
  });

  test('can fast-forward deterministic economy and exploration behavior', async ({ page }) => {
    await waitForBoot(page);

    const initialSnapshot = await getSnapshot(page);

    const advancedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(120, 100),
    );

    await expect
      .poll(async () => page.locator('[data-hud="food"]').textContent())
      .toBe(String(advancedSnapshot.hudState.playerResources.food));

    expect(advancedSnapshot.hudState.playerResources.food).toBeGreaterThan(
      initialSnapshot.hudState.playerResources.food,
    );
    expect(advancedSnapshot.hudState.playerResources.wood).toBeGreaterThan(
      initialSnapshot.hudState.playerResources.wood,
    );
    expect(advancedSnapshot.renderState.frame?.exploredCells.length ?? 0).toBeGreaterThan(
      initialSnapshot.renderState.frame?.exploredCells.length ?? 0,
    );
    expect(
      advancedSnapshot.economyState.resources.some(
        (resource) =>
          resource.baseOwner === 1
          && (resource.resourceType === 'sheep' || resource.resourceType === 'tree')
          && resource.amount < resource.maxAmount,
      ),
    ).toBe(true);
    expect(
      advancedSnapshot.economyState.villagers.every((villager) => villager.task !== 'idle'),
    ).toBe(true);
  });

  test('can select the Town Center and train a villager through the command panel', async ({ page }) => {
    await waitForBoot(page);

    await clickCell(page, 8, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="train-villager"]').click();

    await expect(page.locator('[data-hud="food"]')).toHaveText('150');
    await expect(page.locator('[data-selection-queue]')).toHaveText('1 queued');
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Training: Villager');

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
    await waitForBoot(page);

    await clickCell(page, 10, 10);

    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await expect(page.locator('[data-selection-position]')).toHaveText('Tile 10, 10');
    await expect(page.locator('[data-selection-cycle]')).toHaveText('1 of 1 on tile');
    await expect(page.locator('[data-selection-resource]')).toHaveText('Remaining: 100/100');
  });

  test('shows a unit icon for an individually selected unit', async ({ page }) => {
    await waitForBootWithSeed(page, 'villager-selection-fixture');

    await clickCell(page, 8, 10);

    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await expect(page.locator('[data-selection-unit-icon="villager"]')).toHaveText('V');
    await expect(page.locator('[data-selection-unit-label="villager"]')).toHaveText('Villager');
  });

  test('cycles through every selectable entity stacked on a clicked tile', async ({ page }) => {
    await waitForBootWithSeed(page, 'tile-selection-cycle-fixture');

    await clickCell(page, 10, 10);
    await expect(page.locator('[data-selection-name]')).toHaveText('Militia');
    await expect(page.locator('[data-selection-cycle]')).toHaveText('1 of 3 on tile');

    await clickCell(page, 10, 10);
    await expect(page.locator('[data-selection-name]')).toHaveText('House');
    await expect(page.locator('[data-selection-cycle]')).toHaveText('2 of 3 on tile');

    await clickCell(page, 10, 10);
    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await expect(page.locator('[data-selection-cycle]')).toHaveText('3 of 3 on tile');
    await expect(page.locator('[data-selection-resource]')).toHaveText('Remaining: 100/100');
  });

  test('shows a marquee while dragging and selects multiple villagers with one drag box', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'villager-selection-fixture');

    const villagerCells = await getOwnedUnitCells(page, 1, 'villager');
    expect(villagerCells).toHaveLength(3);
    await dragSelectCells(page, 7, 9, 10, 10);

    const marqueeState = await page.evaluate(
      () => (window.__AOE2_TEST__ as { getSelectionBoxState: () => {
        active: boolean;
        width: number;
        height: number;
      } | null }).getSelectionBoxState(),
    );
    expect(marqueeState).not.toBeNull();
    expect(marqueeState?.active).toBe(true);
    expect(marqueeState?.width ?? 0).toBeGreaterThan(0);
    expect(marqueeState?.height ?? 0).toBeGreaterThan(0);

    await page.mouse.up({ button: 'left' });

    await expect(page.locator('[data-selection-name]')).toHaveText(`${villagerCells.length} Villagers Selected`);
    await expect(page.locator('[data-selection-unit-icon="villager"]')).toHaveText('V');
    await expect(page.locator('[data-selection-unit-count="villager"]')).toHaveText('x3');

    const selectedSnapshot = await getSnapshot(page);
    expect((selectedSnapshot.selectionState as { selectedCount?: number }).selectedCount).toBe(villagerCells.length);

    await clickCell(page, 10, 12, 'right');

    const movedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(40, 100),
    );

    expect(
      movedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.x >= 9 && unit.y >= 11,
      ),
    ).toHaveLength(villagerCells.length);
  });

  test('drag-selects every friendly movable unit in the box while ignoring buildings', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'mixed-selection-fixture');

    await dragSelectCells(page, 7, 9, 10, 10);

    const marqueeState = await page.evaluate(
      () => window.__AOE2_TEST__!.getSelectionBoxState(),
    );
    expect(marqueeState).not.toBeNull();
    expect(marqueeState?.active).toBe(true);

    await page.mouse.up({ button: 'left' });

    await expect(page.locator('[data-selection-name]')).toHaveText('3 Units Selected');
    await expect(page.locator('[data-selection-unit-icon="villager"]')).toHaveText('V');
    await expect(page.locator('[data-selection-unit-icon="militia"]')).toHaveText('M');
    await expect(page.locator('[data-selection-unit-icon="scout"]')).toHaveText('SC');

    const selectedSnapshot = await getSnapshot(page);
    expect(selectedSnapshot.selectionState.selectedCount).toBe(3);
    expect(selectedSnapshot.selectionState.selectedEntityType).toBeNull();

    await clickCell(page, 14, 12, 'right');

    const movedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(40, 100),
    );

    expect(
      movedSnapshot.economyState.units.filter(
        (unit) =>
          unit.owner === 1
          && ['villager', 'militia', 'scout'].includes(unit.unitType)
          && unit.x >= 13
          && unit.y >= 11,
      ),
    ).toHaveLength(3);
  });

  test('double clicking a friendly unit selects same-type friendly units on screen', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'double-click-selection-fixture');

    await doubleClickCell(page, 8, 10);

    await expect(page.locator('[data-selection-name]')).toHaveText('3 Villagers Selected');

    const selectedSnapshot = await getSnapshot(page);
    expect(selectedSnapshot.selectionState.selectedCount).toBe(3);
    expect(selectedSnapshot.selectionState.selectedEntityType).toBe('villager');
  });

  test('can research Feudal Age and train an Archer through the live command panel', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'feudal-age-fixture');

    await clickCell(page, 8, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="research-feudal-age"]').click();
    await expect(page.locator('[data-selection-queue]')).toHaveText('1 queued');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1320, 100));

    await expect(page.locator('[data-hud="age"]')).toHaveText('Feudal Age');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-archery-range"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Archery Range');

    await clickCell(page, 14, 8);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(280, 100));

    expect(await selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
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
    await waitForBootWithSeed(page, 'castle-age-fixture');

    await clickCell(page, 8, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="research-castle-age"]').click();
    await expect(page.locator('[data-selection-queue]')).toHaveText('1 queued');
    await expect(page.locator('[data-hud="food"]')).toHaveText('200');
    await expect(page.locator('[data-hud="gold"]')).toHaveText('200');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1620, 100));

    await expect(page.locator('[data-hud="age"]')).toHaveText('Castle Age');

    expect(await selectOwnedBuildingDirect(page, 1, 'stable')).toBe(true);
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

  test('can build an additional Town Center in Castle Age and use it to train a villager', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'castle-town-center-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-town-center"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Town Center');

    await clickCell(page, 14, 8);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('425');
    await expect(page.locator('[data-hud="stone"]')).toHaveText('250');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(320, 100));
    await clickCell(page, 16, 10, 'right');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(40, 100));

    await clickCell(page, 14, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="train-villager"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('150');

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(260, 100),
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

  test('can research Fletching and buff both existing and newly trained Archers', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'feudal-blacksmith-fixture');

    let snapshot = await getSnapshot(page);
    expect(
      snapshot.economyState.units.find((unit) => unit.owner === 1 && unit.unitType === 'archer'),
    ).toMatchObject({
      attackDamage: 4,
      attackRange: 4,
    });

    expect(await selectOwnedBuildingDirect(page, 1, 'blacksmith')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Blacksmith');
    await page.locator('[data-command="research-fletching"]').click();
    await expect(page.locator('[data-selection-queue]')).toHaveText('1 queued');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(320, 100));

    snapshot = await getSnapshot(page);
    expect(
      snapshot.economyState.units.find((unit) => unit.owner === 1 && unit.unitType === 'archer'),
    ).toMatchObject({
      attackDamage: 5,
      attackRange: 5,
    });

    expect(await selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
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

  test('can build a Stable and train a Scout Cavalry through the live command panel', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'feudal-stable-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-stable"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Stable');

    await clickCell(page, 18, 8);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('75');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(280, 100));

    expect(await selectOwnedBuildingDirect(page, 1, 'stable')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Stable');
    await page.locator('[data-command="train-scout"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('170');

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(320, 100),
    );

    const playerScouts = trainedSnapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'scout',
    );
    expect(playerScouts).toHaveLength(1);
    expect(playerScouts[0]).toMatchObject({
      attackDamage: 3,
      attackRange: 1,
    });
  });

  test('can train a Spearman and use it to kill a visible Scout through the live command panel', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'feudal-spearman-fixture');

    expect(await selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Barracks');
    await page.locator('[data-command="train-spearman"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('215');
    await expect(page.locator('[data-hud="wood"]')).toHaveText('125');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(240, 100));

    expect(await selectOwnedUnitDirect(page, 1, 'spearman')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Spearman');
    await clickCell(page, 14, 10, 'right');

    const postCombatSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(80, 100),
    );

    expect(
      postCombatSnapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  });

  test('shows military units consuming population in the live HUD', async ({ page }) => {
    await waitForBootWithSeed(page, 'feudal-spearman-fixture');

    await expect(page.locator('[data-hud="pop"]')).toHaveText('0/5');

    expect(await selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await page.locator('[data-command="train-spearman"]').click();

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(230, 100));

    await expect(page.locator('[data-hud="pop"]')).toHaveText('1/5');
  });

  test('can train a Skirmisher and use it to kill a visible Archer through the live command panel', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'feudal-skirmisher-fixture');

    expect(await selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await page.locator('[data-command="train-skirmisher"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('215');
    await expect(page.locator('[data-hud="wood"]')).toHaveText('225');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(240, 100));

    expect(await selectOwnedUnitDirect(page, 1, 'skirmisher')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Skirmisher');
    await clickCell(page, 14, 10, 'right');

    const postCombatSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(120, 100),
    );

    expect(
      postCombatSnapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'archer',
      ),
    ).toBe(false);
  });

  test('can build a Watch Tower and let it automatically kill a nearby visible Scout', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'feudal-watch-tower-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-watch-tower"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Watch Tower');

    await clickCell(page, 14, 8);
    await expect(page.locator('[data-hud="stone"]')).toHaveText('75');

    const postTowerSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(360, 100),
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
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await clickCell(page, 8, 8, 'right');

    let snapshot = await getSnapshot(page);
    expect(
      snapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);

    await clickCell(page, 8, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="action-ungarrison"]').click();

    snapshot = await getSnapshot(page);
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
    await waitForBootWithSeed(page, 'town-center-defense-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await clickCell(page, 8, 8, 'right');

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
    await waitForBootWithSeed(page, 'feudal-market-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-market"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Market');

    await clickCell(page, 17, 8);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('275');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(280, 100));

    expect(await selectOwnedBuildingDirect(page, 1, 'market')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Market');

    const afterBuild = await getSnapshot(page);
    await page.locator('[data-command="market-sell-wood"]').click();
    const afterFirstSale = await getSnapshot(page);
    expect(afterFirstSale.hudState.playerResources.wood).toBe(
      afterBuild.hudState.playerResources.wood - 100,
    );
    expect(afterFirstSale.hudState.playerResources.gold).toBeGreaterThan(
      afterBuild.hudState.playerResources.gold,
    );

    await page.locator('[data-command="market-buy-food"]').click();
    const afterFirstBuy = await getSnapshot(page);
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
    await waitForBootWithSeed(page, 'feudal-skirmisher-fixture');

    expect(await selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await clickCell(page, 15, 10, 'right');
    await page.locator('[data-command="train-skirmisher"]').click();

    const postRallySnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(300, 100),
    );

    expect(
      postRallySnapshot.economyState.units.some(
        (unit) =>
          unit.owner === 1
          && unit.unitType === 'skirmisher'
          && unit.x === 15
          && unit.y === 10,
      ),
    ).toBe(true);
  });

  test('can place and complete a House with villager build controls', async ({ page }) => {
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    await clickCell(page, 10, 5);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('175');

    const placedSnapshot = await getSnapshot(page);
    expect(
      placedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'house'
          && building.x === 10
          && building.y === 5
          && building.isComplete === false,
      ),
    ).toBe(true);

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));

    await expect(page.locator('[data-hud="pop"]')).toHaveText('4/10');
    const completedSnapshot = await getSnapshot(page);
    expect(
      completedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'house'
          && building.isComplete,
      ),
    ).toBe(true);
  });

  test('shows valid and invalid building placement preview feedback before construction', async ({
    page,
  }) => {
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    await moveMouseToCell(page, 10, 5);
    let previewState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewState(),
    );
    expect(previewState).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: 10,
      cellY: 5,
      width: 2,
      height: 2,
      isValid: true,
    });

    await moveMouseToCell(page, 8, 8);
    previewState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewState(),
    );
    expect(previewState).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: 8,
      cellY: 8,
      width: 2,
      height: 2,
      isValid: false,
    });

    await clickCell(page, 8, 8);
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    const postInvalidClickSnapshot = await getSnapshot(page);
    expect(
      postInvalidClickSnapshot.economyState.buildings.some(
        (building) => building.owner === 1 && building.buildingType === 'house',
      ),
    ).toBe(false);
  });

  test('can right-click a visible resource to redirect villager gathering', async ({ page }) => {
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await clickCell(page, 13, 7, 'right');

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
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-mining-camp"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Mining Camp');

    await clickCell(page, 15, 7);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('100');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));

    const completedSnapshot = await getSnapshot(page);
    expect(
      completedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'mining-camp'
          && building.isComplete,
      ),
    ).toBe(true);

    await clickCell(page, 13, 7, 'right');
    const incomeSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(67, 100),
    );

    await expect(page.locator('[data-hud="gold"]')).toHaveText(
      String(incomeSnapshot.hudState.playerResources.gold),
    );
    expect(incomeSnapshot.hudState.playerResources.gold).toBeGreaterThan(100);
  });

  test('can build a Barracks and train a Militia through the live command panel', async ({
    page,
  }) => {
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-barracks"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Barracks');

    await clickCell(page, 10, 5);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('25');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(500, 100));

    expect(await selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Barracks');
    await page.locator('[data-command="train-militia"]').click();
    await expect(page.locator('[data-selection-queue]')).toHaveText('1 queued');

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(260, 100),
    );

    expect(
      trainedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'militia',
      ),
    ).toHaveLength(1);
  });

  test('can command a Militia to attack and kill a visible enemy scout', async ({
    page,
  }) => {
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.locator('[data-command="build-barracks"]').click();
    await clickCell(page, 10, 5);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(500, 100));

    expect(await selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await page.locator('[data-command="train-militia"]').click();
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(260, 100));

    const trainedSnapshot = await getSnapshot(page);
    const militia = trainedSnapshot.economyState.units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'militia',
    );
    const enemyScout = trainedSnapshot.economyState.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'scout' && unit.x === 13 && unit.y === 5,
    );
    expect(militia).toBeDefined();
    expect(enemyScout).toBeDefined();

    expect(await selectOwnedUnitDirect(page, 1, 'militia')).toBe(true);
    await clickCell(page, enemyScout?.x ?? 0, enemyScout?.y ?? 0, 'right');

    const combatSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(220, 100),
    );

    expect(
      combatSnapshot.economyState.units.some(
        (unit) =>
          unit.owner === 2
          && unit.unitType === 'scout'
          && unit.x === (enemyScout?.x ?? 13)
          && unit.y === (enemyScout?.y ?? 5),
      ),
    ).toBe(false);
  });

  test('can command a Militia to destroy a visible enemy house', async ({
    page,
  }) => {
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.locator('[data-command="build-barracks"]').click();
    await clickCell(page, 10, 5);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(500, 100));

    expect(await selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await page.locator('[data-command="train-militia"]').click();
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(260, 100));

    const trainedSnapshot = await getSnapshot(page);
    const militia = trainedSnapshot.economyState.units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'militia',
    );
    const enemyHouse = trainedSnapshot.economyState.buildings.find(
      (building) =>
        building.owner === 2
        && building.buildingType === 'house'
        && building.x === 12
        && building.y === 3,
    );
    expect(militia).toBeDefined();
    expect(enemyHouse).toBeDefined();

    const issuedAttack = await page.evaluate(
      ({ militiaX, militiaY }) => {
        const api = window.__AOE2_TEST__!;
        api.clearSelection();
        api.selectEntityAtCell(militiaX, militiaY);
        return api.issueContextCommand(12, 3);
      },
      {
        militiaX: militia?.x ?? 0,
        militiaY: militia?.y ?? 0,
      },
    );
    expect(issuedAttack).toBe(true);

    const combatSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(420, 100),
    );

    expect(
      combatSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 2
          && building.buildingType === 'house'
          && building.x === (enemyHouse?.x ?? 12)
          && building.y === (enemyHouse?.y ?? 3),
      ),
    ).toBe(false);
  });

  test('runs the baseline AI barracks rush through the live game loop', async ({
    page,
  }) => {
    await waitForBoot(page);

    const advancedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(1_200, 100),
    );

    expect(
      advancedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 2
          && building.buildingType === 'barracks'
          && building.isComplete,
      ),
    ).toBe(true);
    expect(
      advancedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ).length,
    ).toBeLessThan(3);
  });

  test('shows victory after the player destroys the last enemy structure in the conquest fixture', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'conquest-victory-fixture');

    await clickCell(page, 8, 8);
    await clickCell(page, 10, 8, 'right');

    const snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(220, 100),
    );

    await expect(page.locator('[data-hud="match-outcome"]')).toHaveText('Victory');
    await expect(page.locator('[data-hud="match-summary"]')).toHaveText(
      'All enemy forces have been eliminated.',
    );
    expect(snapshot.hudState.matchState.outcome).toBe('victory');
    expect(snapshot.hudState.matchState.summary).toBe('All enemy forces have been eliminated.');
  });

  test('shows defeat and freezes the sim after the last human structure falls in the defeat fixture', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'conquest-defeat-fixture');

    const snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(220, 100),
    );

    await expect(page.locator('[data-hud="match-outcome"]')).toHaveText('Defeat');
    await expect(page.locator('[data-hud="match-summary"]')).toHaveText(
      'All of your units and buildings have been destroyed.',
    );
    expect(snapshot.hudState.matchState.outcome).toBe('defeat');
    expect(snapshot.hudState.matchState.summary).toBe(
      'All of your units and buildings have been destroyed.',
    );

    const frozenTick = snapshot.hudState.tick;
    const nextSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(1, 100),
    );

    expect(nextSnapshot.hudState.tick).toBe(frozenTick);
  });
});
