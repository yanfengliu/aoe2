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

interface MinimapViewportState {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface HudChipRect {
  left: number;
  width: number;
}

interface DisplayedEntityState {
  id: number;
  kind: 'tile' | 'unit' | 'building' | 'resource';
  entityType: string;
  owner: number | null;
  x: number;
  y: number;
}

async function expectSelectionDetail(
  page: Page,
  key: 'health' | 'attack' | 'armor' | 'faction' | 'civ' | 'inventory',
  value: string,
): Promise<void> {
  await expect(page.locator(`[data-selection-detail-value="${key}"]`)).toHaveText(value);
}

async function expectSelectionDetailAbsent(
  page: Page,
  key: 'health' | 'attack' | 'armor' | 'faction' | 'civ' | 'inventory',
): Promise<void> {
  await expect(page.locator(`[data-selection-detail-value="${key}"]`)).toHaveCount(0);
}

async function getHudChipKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-hud-chip]'))
      .map((chip) => chip.dataset.hudChip ?? '')
      .filter((value) => value.length > 0),
  );
}

async function waitForBoot(page: Page): Promise<void> {
  await waitForBootWithSeed(page, 'aoe2-prototype');
}

async function waitForBootWithSeed(page: Page, seed: string): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  await expect.poll(async () => (await getSnapshot(page)).hudState.seed).toBe(seed);
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

async function getHudChipRects(
  page: Page,
  keys: string[],
): Promise<Record<string, HudChipRect | null>> {
  return page.evaluate((requestedKeys) => {
    const result: Record<string, HudChipRect | null> = {};

    for (const key of requestedKeys) {
      const value = document.querySelector<HTMLElement>(`[data-hud="${key}"]`);
      const chip = value?.closest<HTMLElement>('.hud-chip');
      const rect = chip?.getBoundingClientRect();

      result[key] = rect
        ? {
          left: rect.left,
          width: rect.width,
        }
        : null;
    }

    return result;
  }, keys);
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

async function getMinimapViewportState(
  page: Page,
): Promise<MinimapViewportState | null> {
  return page.locator('[data-hud="minimap"]').evaluate((canvas: HTMLCanvasElement) => {
    const { viewportActive, viewportX, viewportY, viewportWidth, viewportHeight } = canvas.dataset;
    if (viewportActive !== 'true') {
      return null;
    }

    return {
      active: true,
      x: Number(viewportX),
      y: Number(viewportY),
      width: Number(viewportWidth),
      height: Number(viewportHeight),
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
  await clickCanvasAtPoint(page, point, button);
}

async function clickCanvasAtPoint(
  page: Page,
  point: ScreenPoint,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { button });
}

async function clickMinimapAt(
  page: Page,
  normalizedX: number,
  normalizedY: number,
): Promise<void> {
  const point = await getMinimapPoint(page, normalizedX, normalizedY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { button: 'left' });
}

async function getMinimapPoint(
  page: Page,
  normalizedX: number,
  normalizedY: number,
): Promise<ScreenPoint> {
  return page.locator('[data-hud="minimap"]').evaluate(
    (canvas: HTMLCanvasElement, point: { x: number; y: number }) => {
      const frame = window.__AOE2_TEST__!.getSnapshot().renderState.frame;
      if (!frame) {
        throw new Error('Expected the minimap frame to exist.');
      }

      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(canvas.width / frame.mapWidth, canvas.height / frame.mapHeight);
      const drawWidth = frame.mapWidth * scale;
      const drawHeight = frame.mapHeight * scale;
      const offsetX = (canvas.width - drawWidth) * 0.5;
      const offsetY = (canvas.height - drawHeight) * 0.5;
      const cssScaleX = bounds.width / canvas.width;
      const cssScaleY = bounds.height / canvas.height;

      return {
        x: bounds.left + (offsetX + drawWidth * point.x) * cssScaleX,
        y: bounds.top + (offsetY + drawHeight * point.y) * cssScaleY,
      };
    },
    { x: normalizedX, y: normalizedY },
  );
}

async function dragMinimapTo(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): Promise<void> {
  const startPoint = await getMinimapPoint(page, startX, startY);
  const endPoint = await getMinimapPoint(page, endX, endY);

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(endPoint.x, endPoint.y, { steps: 10 });
  await page.mouse.up({ button: 'left' });
}

async function getGameCanvasBounds(page: Page): Promise<NonNullable<Awaited<ReturnType<ReturnType<Page['locator']>['boundingBox']>>>> {
  const canvas = page.locator('#game-root canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

async function getGameCanvasMetrics(page: Page): Promise<{
  canvasWidth: number;
  canvasHeight: number;
  rootWidth: number;
  rootHeight: number;
  boundsWidth: number;
  boundsHeight: number;
  boundsLeft: number;
  boundsTop: number;
}> {
  return page.evaluate(() => {
    const root = document.getElementById('game-root');
    const canvas = document.querySelector<HTMLCanvasElement>('#game-root canvas');
    if (!root || !canvas) {
      throw new Error('Expected #game-root and its canvas to exist.');
    }

    const bounds = canvas.getBoundingClientRect();
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rootWidth: root.clientWidth,
      rootHeight: root.clientHeight,
      boundsWidth: bounds.width,
      boundsHeight: bounds.height,
      boundsLeft: bounds.left,
      boundsTop: bounds.top,
    };
  });
}

async function doubleClickCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<void> {
  const point = await getScreenPointForCell(page, cellX, cellY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { button: 'left' });
  await page.mouse.click(point.x, point.y, { button: 'left' });
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
      if (!unit) {
        return false;
      }

      if (api.selectOwnedUnitsByTypeInRect(expectedUnitType as never, unit.x, unit.y, unit.x, unit.y)) {
        return api.getSelectionState().selectedEntityType === expectedUnitType;
      }

      return api.selectEntityAtCell(unit.x, unit.y);
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

async function getOwnedResourceCells(
  page: Page,
  owner: number,
  resourceType: string,
): Promise<Array<{ x: number; y: number }>> {
  return page.evaluate(
    ({ owner: playerOwner, resourceType: expectedResourceType }) =>
      window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.resources.filter(
          (candidate) =>
            candidate.resourceType === expectedResourceType
            && (candidate.owner === playerOwner || candidate.baseOwner === playerOwner),
        )
        .map((resource) => ({ x: resource.x, y: resource.y })),
    { owner, resourceType },
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

      for (let offsetY = 0; offsetY < building.footprintHeight; offsetY += 1) {
        for (let offsetX = 0; offsetX < building.footprintWidth; offsetX += 1) {
          api.selectEntityAtCell(building.x + offsetX, building.y + offsetY);
          if (api.getSelectionState().selectedEntityType === expectedBuildingType) {
            return true;
          }
        }
      }

      return false;
    },
    { owner, buildingType },
  );
}

async function selectOwnedBuildingAtDirect(
  page: Page,
  owner: number,
  buildingType: string,
  cellX: number,
  cellY: number,
): Promise<boolean> {
  return page.evaluate(
    ({
      owner: playerOwner,
      buildingType: expectedBuildingType,
      cellX: targetX,
      cellY: targetY,
    }) => {
      const api = window.__AOE2_TEST__!;
      const building = api
        .getSnapshot()
        .economyState.buildings.find(
          (candidate) =>
            candidate.owner === playerOwner
            && candidate.buildingType === expectedBuildingType
            && candidate.x === targetX
            && candidate.y === targetY,
        );
      if (!building) {
        return false;
      }

      for (let offsetY = 0; offsetY < building.footprintHeight; offsetY += 1) {
        for (let offsetX = 0; offsetX < building.footprintWidth; offsetX += 1) {
          api.selectEntityAtCell(building.x + offsetX, building.y + offsetY);
          if (api.getSelectionState().selectedEntityId === building.id) {
            return true;
          }
        }
      }

      return false;
    },
    {
      owner,
      buildingType,
      cellX,
      cellY,
    },
  );
}

async function getBuildingVisualState(
  page: Page,
  owner: number,
  buildingType: string,
  cellX: number,
  cellY: number,
): Promise<{
  footprintWidthCells: number;
  footprintHeightCells: number;
  widthPx: number;
  heightPx: number;
  visualVariant: string;
  hasFoundationSlab: boolean;
  hasScaffoldPosts: boolean;
  hasStructureBody: boolean;
  hasRoofAccent: boolean;
  hasConstructionIndicator: boolean;
  hasCompletionAccent: boolean;
} | null> {
  return page.evaluate(
    ({ owner: playerOwner, buildingType: expectedBuildingType, cellX: targetX, cellY: targetY }) =>
      window.__AOE2_TEST__!
        .getBuildingVisualStates()
        .find(
          (building) =>
            building.owner === playerOwner
            && building.buildingType === expectedBuildingType
            && building.cellX === targetX
            && building.cellY === targetY,
        ) ?? null,
    {
      owner,
      buildingType,
      cellX,
      cellY,
    },
  );
}

async function getEntityHealthBarState(
  page: Page,
  owner: number | null,
  entityKind: 'unit' | 'building' | 'resource',
  entityType: string,
): Promise<{
  currentHp: number;
  maxHp: number;
  fillRatio: number;
  barX: number;
  barY: number;
  barWidthPx: number;
  barHeightPx: number;
  entityTopPx: number;
} | null> {
  return page.evaluate(
    ({ owner: playerOwner, entityKind: expectedKind, entityType: expectedType }) =>
      window.__AOE2_TEST__!
        .getEntityHealthBarStates()
        .find(
          (state) =>
            state.owner === playerOwner
            && state.entityKind === expectedKind
            && state.entityType === expectedType,
        ) ?? null,
    {
      owner,
      entityKind,
      entityType,
    },
  );
}

async function getDisplayedEntityState(
  page: Page,
  owner: number,
  entityKind: 'unit' | 'building',
  entityType: string,
): Promise<DisplayedEntityState | null> {
  return page.evaluate(
    ({ owner: playerOwner, entityKind: expectedKind, entityType: expectedType }) =>
      (
        window.__AOE2_TEST__ as unknown as {
          getDisplayedEntities: () => DisplayedEntityState[];
        }
      )
        .getDisplayedEntities()
        .find(
          (entity) =>
            entity.owner === playerOwner
            && entity.kind === expectedKind
            && entity.entityType === expectedType,
        ) ?? null,
    {
      owner,
      entityKind,
      entityType,
    },
  );
}

async function findValidPlacementNearTownCenter(
  page: Page,
  buildingType: string,
  owner = 1,
  preferredAnchors: Array<{ x: number; y: number }> = [],
): Promise<{ x: number; y: number }> {
  const townCenter = await page.evaluate(
    (playerOwner) =>
      window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.buildings.find(
          (building) => building.owner === playerOwner && building.buildingType === 'town-center',
        ) ?? null,
    owner,
  );

  if (!townCenter) {
    throw new Error(`Expected Town Center for player ${owner}.`);
  }

  const isValidAnchor = async (x: number, y: number): Promise<boolean> => {
    const preview = await page.evaluate(
      ({ anchorX, anchorY }) => window.__AOE2_TEST__!.getPlacementPreviewAt(anchorX, anchorY),
      { anchorX: x, anchorY: y },
    );
    return preview?.isValid === true;
  };

  for (const anchor of preferredAnchors) {
    if (await isValidAnchor(anchor.x, anchor.y)) {
      return anchor;
    }
  }

  for (let radius = 1; radius <= 12; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) {
          continue;
        }

        const x = townCenter.x + offsetX;
        const y = townCenter.y + offsetY;
        if (await isValidAnchor(x, y)) {
          return { x, y };
        }
      }
    }
  }

  throw new Error(`Expected a valid ${buildingType} placement near player ${owner}'s Town Center.`);
}

test.describe('browser gameplay smoke tests', () => {
  test('boots into a live simulation and renders the HUD/minimap', async ({ page }) => {
    test.slow();
    await waitForBoot(page);

    const snapshot = await getSnapshot(page);
    const minimap = await getMinimapStats(page);

    expect(snapshot.hudState.tick).toBeGreaterThan(0);
    expect(snapshot.hudState.worldSize).toBe('60x36');
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

  test('keeps top status-bar chip positions stable as live values change', async ({ page }) => {
    await waitForBoot(page);

    await expect.poll(async () => getHudChipKeys(page)).toEqual([
      'food',
      'wood',
      'gold',
      'stone',
      'age',
      'pop',
      'time',
    ]);

    const trackedKeys = ['food', 'wood', 'gold', 'stone', 'age', 'pop', 'time'];
    const initialRects = await getHudChipRects(page, trackedKeys);

    expect(await selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await page.locator('[data-command="train-villager"]').click();
    await page.locator('[data-command="train-villager"]').click();
    await page.locator('[data-command="train-villager"]').click();

    await expect(page.locator('[data-hud="food"]')).toHaveText('50');
    await expect(page.locator('[data-hud="time"]')).toHaveText(/\d{2}:\d{2}/);

    const updatedRects = await getHudChipRects(page, trackedKeys);

    for (const key of trackedKeys) {
      expect(initialRects[key]).not.toBeNull();
      expect(updatedRects[key]).not.toBeNull();
      expect(updatedRects[key]?.left ?? 0).toBeCloseTo(initialRects[key]?.left ?? 0, 1);
      expect(updatedRects[key]?.width ?? 0).toBeCloseTo(initialRects[key]?.width ?? 0, 1);
    }
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

  test('supports middle-mouse drag panning on the game canvas', async ({ page }) => {
    await waitForBoot(page);

    const bounds = await getGameCanvasBounds(page);
    const initialCamera = (await getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    const dragStartX = bounds.x + bounds.width * 0.55;
    const dragStartY = bounds.y + bounds.height * 0.55;
    const dragEndX = bounds.x + bounds.width * 0.25;
    const dragEndY = bounds.y + bounds.height * 0.35;

    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(dragEndX, dragEndY, { steps: 8 });
    await page.mouse.up({ button: 'middle' });

    await expect.poll(async () => {
      const snapshot = await getSnapshot(page);
      return {
        scrollX: snapshot.cameraState?.scrollX ?? 0,
        scrollY: snapshot.cameraState?.scrollY ?? 0,
      };
    }).toMatchObject({
      scrollX: expect.any(Number),
      scrollY: expect.any(Number),
    });

    const movedCamera = (await getSnapshot(page)).cameraState;
    expect(movedCamera).not.toBeNull();
    expect(movedCamera?.scrollX ?? 0).toBeGreaterThan((initialCamera?.scrollX ?? 0) + 40);
    expect(movedCamera?.scrollY ?? 0).toBeGreaterThan((initialCamera?.scrollY ?? 0) + 20);
  });

  test('pans the camera when the mouse hovers near the screen edge', async ({ page }) => {
    await waitForBoot(page);

    const bounds = await getGameCanvasBounds(page);
    const initialCamera = (await getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await page.mouse.move(bounds.x + bounds.width - 3, bounds.y + bounds.height * 0.5);
    await page.waitForTimeout(700);

    await expect.poll(async () => {
      const snapshot = await getSnapshot(page);
      return snapshot.cameraState?.scrollX ?? 0;
    }).toBeGreaterThan((initialCamera?.scrollX ?? 0) + 35);
  });

  test('clicking the minimap pans the camera toward that map region', async ({ page }) => {
    await waitForBoot(page);

    const gameCanvas = page.locator('#game-root canvas');
    const canvasBox = await gameCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    await page.mouse.move(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.5,
      (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.5,
    );
    await page.mouse.wheel(0, -1200);

    const initialCamera = (await getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await clickMinimapAt(page, 0.84, 0.76);

    await expect.poll(async () => (await getSnapshot(page)).cameraState?.scrollX ?? 0)
      .toBeGreaterThan((initialCamera?.scrollX ?? 0) + 40);

    const movedSnapshot = await getSnapshot(page);
    const movedCamera = movedSnapshot.cameraState;
    const frame = movedSnapshot.renderState.frame;
    expect(movedCamera).not.toBeNull();
    expect(frame).not.toBeNull();

    const visibleWorldWidth = movedCamera?.viewWidth ?? 0;
    const visibleWorldHeight = movedCamera?.viewHeight ?? 0;
    const centerX = (movedCamera?.viewX ?? 0) + visibleWorldWidth * 0.5;
    const centerY = (movedCamera?.viewY ?? 0) + visibleWorldHeight * 0.5;
    const worldWidth = (frame?.mapWidth ?? 0) * 24;
    const worldHeight = (frame?.mapHeight ?? 0) * 24;

    const expectedCenterX = Math.min(0.84 * worldWidth, worldWidth - visibleWorldWidth * 0.5);
    const expectedCenterY = Math.min(0.76 * worldHeight, worldHeight - visibleWorldHeight * 0.5);
    expect(Math.abs(centerX - expectedCenterX)).toBeLessThan(10);
    expect(Math.abs(centerY - expectedCenterY)).toBeLessThan(10);
    expect(centerX).toBeLessThanOrEqual(worldWidth - visibleWorldWidth * 0.5 + 0.5);
    expect(centerY).toBeLessThanOrEqual(worldHeight - visibleWorldHeight * 0.5 + 0.5);
  });

  test('clicking the minimap centers the camera exactly on the clicked world position', async ({
    page,
  }) => {
    await waitForBoot(page);

    const gameCanvas = page.locator('#game-root canvas');
    const canvasBox = await gameCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    await page.mouse.move(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.5,
      (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.5,
    );
    await page.mouse.wheel(0, -800);

    await clickMinimapAt(page, 0.5, 0.5);

    await expect.poll(async () => {
      const snapshot = await getSnapshot(page);
      const camera = snapshot.cameraState;
      const frame = snapshot.renderState.frame;
      if (!camera || !frame) {
        return null;
      }
      return {
        centerX: Math.round(camera.viewX + camera.viewWidth / 2),
        centerY: Math.round(camera.viewY + camera.viewHeight / 2),
        worldCenterX: Math.round((frame.mapWidth * 24) / 2),
        worldCenterY: Math.round((frame.mapHeight * 24) / 2),
      };
    }).toMatchObject({
      centerX: 720,
      centerY: 432,
      worldCenterX: 720,
      worldCenterY: 432,
    });
  });

  test('dragging across the minimap continuously pans the camera', async ({ page }) => {
    await waitForBoot(page);

    const initialCamera = (await getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await dragMinimapTo(page, 0.2, 0.2, 0.82, 0.78);

    await expect.poll(async () => (await getSnapshot(page)).cameraState?.scrollX ?? 0)
      .toBeGreaterThan((initialCamera?.scrollX ?? 0) + 60);

    const movedSnapshot = await getSnapshot(page);
    const movedCamera = movedSnapshot.cameraState;
    const frame = movedSnapshot.renderState.frame;
    expect(movedCamera).not.toBeNull();
    expect(frame).not.toBeNull();

    const visibleWorldWidth = movedCamera?.viewWidth ?? 0;
    const visibleWorldHeight = movedCamera?.viewHeight ?? 0;
    const centerX = (movedCamera?.viewX ?? 0) + visibleWorldWidth * 0.5;
    const centerY = (movedCamera?.viewY ?? 0) + visibleWorldHeight * 0.5;
    const worldWidth = (frame?.mapWidth ?? 0) * 24;
    const worldHeight = (frame?.mapHeight ?? 0) * 24;

    const expectedCenterX = Math.min(0.82 * worldWidth, worldWidth - visibleWorldWidth * 0.5);
    const expectedCenterY = Math.min(0.78 * worldHeight, worldHeight - visibleWorldHeight * 0.5);
    expect(Math.abs(centerX - expectedCenterX)).toBeLessThan(10);
    expect(Math.abs(centerY - expectedCenterY)).toBeLessThan(10);
  });

  test('the minimap exposes a viewport rectangle that tracks the current camera coverage', async ({
    page,
  }) => {
    await waitForBoot(page);

    const gameCanvas = page.locator('#game-root canvas');
    await gameCanvas.click();
    const canvasBounds = await getGameCanvasBounds(page);
    await page.mouse.move(
      canvasBounds.x + canvasBounds.width * 0.5,
      canvasBounds.y + canvasBounds.height * 0.5,
    );
    await page.mouse.wheel(0, -275);

    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(
      canvasBounds.x + canvasBounds.width * 0.5 + 73,
      canvasBounds.y + canvasBounds.height * 0.5 + 41,
      { steps: 6 },
    );
    await page.mouse.up({ button: 'middle' });

    await expect.poll(async () => {
      const viewport = await getMinimapViewportState(page);
      const snapshot = await getSnapshot(page);
      const frame = snapshot.renderState.frame;
      const camera = snapshot.cameraState;
      const minimap = await getMinimapStats(page);

      if (!viewport || !frame || !camera) {
        return false;
      }

      const worldWidth = frame.mapWidth * 24;
      const worldHeight = frame.mapHeight * 24;
      const scale = Math.min(
        minimap.width / frame.mapWidth,
        minimap.height / frame.mapHeight,
      );
      const drawWidth = frame.mapWidth * scale;
      const drawHeight = frame.mapHeight * scale;
      const offsetX = (minimap.width - drawWidth) * 0.5;
      const offsetY = (minimap.height - drawHeight) * 0.5;
      const expectedViewport = {
        active: true,
        x: Number((offsetX + (camera.viewX / worldWidth) * drawWidth).toFixed(2)),
        y: Number((offsetY + (camera.viewY / worldHeight) * drawHeight).toFixed(2)),
        width: Number(((camera.viewWidth / worldWidth) * drawWidth).toFixed(2)),
        height: Number(((camera.viewHeight / worldHeight) * drawHeight).toFixed(2)),
      };

      return JSON.stringify(viewport) === JSON.stringify(expectedViewport);
    }).toBe(true);
  });

  test('preserves the game aspect ratio with letterboxing after the browser viewport shrinks', async ({
    page,
  }) => {
    await waitForBoot(page);

    const initialSnapshot = await getSnapshot(page);
    const worldAspect =
      (initialSnapshot.renderState.frame?.mapWidth ?? 0)
      / (initialSnapshot.renderState.frame?.mapHeight ?? 1);

    await page.setViewportSize({
      width: 520,
      height: 560,
    });

    await expect.poll(async () => {
      const metrics = await getGameCanvasMetrics(page);
      const camera = (await getSnapshot(page)).cameraState;

      return {
        rootWidth: metrics.rootWidth,
        rootHeight: metrics.rootHeight,
        canvasWidth: metrics.canvasWidth,
        canvasHeight: metrics.canvasHeight,
        cameraWidth: Math.round(camera?.width ?? -1),
        cameraHeight: Math.round(camera?.height ?? -1),
      };
    }).toEqual({
      rootWidth: 520,
      rootHeight: 312,
      canvasWidth: 520,
      canvasHeight: 312,
      cameraWidth: 520,
      cameraHeight: 312,
    });

    const metrics = await getGameCanvasMetrics(page);
    expect(metrics.boundsLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.boundsTop).toBeGreaterThanOrEqual(0);
    expect(metrics.boundsWidth).toBe(520);
    expect(metrics.boundsHeight).toBe(312);
    expect(metrics.boundsWidth / metrics.boundsHeight).toBeCloseTo(worldAspect, 2);
  });

  test('prevents zooming out beyond the playable map bounds', async ({ page }) => {
    await waitForBoot(page);

    await clickMinimapAt(page, 0.88, 0.82);

    const gameCanvas = page.locator('#game-root canvas');
    const canvasBox = await gameCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    await page.mouse.move(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.5,
      (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.5,
    );

    for (let index = 0; index < 6; index += 1) {
      await page.mouse.wheel(0, 1200);
    }

    const snapshot = await getSnapshot(page);
    const camera = snapshot.cameraState;
    const frame = snapshot.renderState.frame;
    expect(camera).not.toBeNull();
    expect(frame).not.toBeNull();

    const worldWidth = (frame?.mapWidth ?? 0) * 24;
    const worldHeight = (frame?.mapHeight ?? 0) * 24;
    const visibleWorldWidth = (camera?.width ?? 0) / (camera?.zoom ?? 1);
    const visibleWorldHeight = (camera?.height ?? 0) / (camera?.zoom ?? 1);
    const minZoomToFitWorld = Math.max(
      (camera?.width ?? 0) / worldWidth,
      (camera?.height ?? 0) / worldHeight,
    );

    expect(camera?.zoom ?? 0).toBeGreaterThanOrEqual(minZoomToFitWorld - 0.001);
    expect(visibleWorldWidth).toBeLessThanOrEqual(worldWidth + 0.5);
    expect(visibleWorldHeight).toBeLessThanOrEqual(worldHeight + 0.5);
    expect(camera?.viewX ?? 0).toBeGreaterThanOrEqual(-0.5);
    expect(camera?.viewY ?? 0).toBeGreaterThanOrEqual(-0.5);
    expect((camera?.viewX ?? 0) + (camera?.viewWidth ?? 0)).toBeLessThanOrEqual(worldWidth + 0.5);
    expect((camera?.viewY ?? 0) + (camera?.viewHeight ?? 0)).toBeLessThanOrEqual(worldHeight + 0.5);
  });

  test('keeps human starting units idle until the player gives orders', async ({ page }) => {
    await waitForBoot(page);

    const initialSnapshot = await getSnapshot(page);
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
    await waitForBootWithSeed(page, 'orders-fixture');

    const initialSnapshot = await getSnapshot(page);
    const sheepCells = await getOwnedResourceCells(page, 1, 'sheep');
    expect(sheepCells.length).toBeGreaterThan(0);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommand(x, y),
        sheepCells[0],
      ),
    ).toBe(true);

    expect(await selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
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
    await waitForBoot(page);

    const initialSnapshot = await getSnapshot(page);
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

    expect(await selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    await clickCell(page, 12, 7, 'right');

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
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(12, 7))).toBe(true);

    await expect.poll(async () => {
      const displayedScout = await getDisplayedEntityState(page, 1, 'unit', 'scout');
      const projectedScout = (await getSnapshot(page)).renderState.entities.find(
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
    await waitForBootWithSeed(page, 'unit-sharing-fixture');

    const initialSnapshot = await getSnapshot(page);
    const initialUnits = initialSnapshot.economyState.units.filter((unit) => unit.owner === 1);
    expect(initialUnits).toHaveLength(2);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.clearSelection())).toBeUndefined();
    await dragSelectCells(page, 5, 9, 8, 11);
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
    await waitForBoot(page);

    expect(await selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await expect(page.locator('[data-selection-entity-icon="town-center"]')).toHaveText('TC');
    await expectSelectionDetail(page, 'health', '2400 / 2400');
    await expectSelectionDetail(page, 'attack', '5');
    await expectSelectionDetail(page, 'armor', '0');
    await expectSelectionDetail(page, 'faction', 'Player');
    await expectSelectionDetail(page, 'civ', 'Britons');
    await expectSelectionDetail(page, 'inventory', '0 / 5 garrisoned');
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
    await waitForBoot(page);
    const sheepCells = await getOwnedResourceCells(page, 1, 'sheep');
    expect(sheepCells.length).toBeGreaterThan(0);

    const initialSnapshot = await getSnapshot(page);
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
    const selectedSnapshot = await getSnapshot(page);

    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await expect(page.locator('[data-selection-entity-icon="sheep"]')).toHaveText('SH');
    await expectSelectionDetail(page, 'faction', 'Player');
    await expectSelectionDetail(page, 'inventory', '100 / 100 food remaining');
    await expectSelectionDetailAbsent(page, 'health');
    await expectSelectionDetailAbsent(page, 'attack');
    await expectSelectionDetailAbsent(page, 'armor');
    await expectSelectionDetailAbsent(page, 'civ');
    await expect(page.locator('[data-selection-position]')).toHaveCount(0);
    await expect(page.locator('[data-selection-cycle]')).toHaveCount(0);
    await expect(page.locator('[data-selection-resource]')).toHaveCount(0);
    expect(selectedSnapshot.selectionState.owner).toBe(1);
  });

  test('renders shoreline fish on water and lets villagers gather food from them', async ({ page }) => {
    test.slow();
    await waitForBootWithSeed(page, 'fish-fixture');

    const fish = await page.evaluate(() =>
      window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.resources.find((resource) => resource.resourceType === 'fish') ?? null,
    );
    expect(fish).not.toBeNull();

    await clickCell(page, fish?.x ?? 0, fish?.y ?? 0);
    await expect(page.locator('[data-selection-name]')).toHaveText('Fish');
    await expect(page.locator('[data-selection-entity-icon="fish"]')).toHaveText('F');
    await expectSelectionDetail(page, 'faction', 'Gaia');
    await expectSelectionDetail(page, 'inventory', `${fish?.amount} / ${fish?.maxAmount} food remaining`);
    await expectSelectionDetailAbsent(page, 'health');
    await expectSelectionDetailAbsent(page, 'attack');
    await expectSelectionDetailAbsent(page, 'armor');
    await expectSelectionDetailAbsent(page, 'civ');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
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
    await waitForBootWithSeed(page, 'resource-depletion-fixture');

    await clickCell(page, 12, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Tree');
    await expectSelectionDetail(page, 'inventory', '1 / 1 wood remaining');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(12, 8))).toBe(true);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
      return snapshot.economyState.resources.some(
        (resource) => resource.resourceType === 'tree' && resource.x === 12 && resource.y === 8,
      );
    }).toBe(false);

    const depletedSnapshot = await getSnapshot(page);
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
    await waitForBootWithSeed(page, 'sheep-ownership-fixture');

    const initialSnapshot = await getSnapshot(page);
    expect(
      initialSnapshot.economyState.resources.find((resource) => resource.resourceType === 'sheep'),
    ).toMatchObject({
      owner: null,
      baseOwner: null,
      x: 10,
      y: 8,
    });

    expect(await selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(7, 8))).toBe(true);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      return snapshot.economyState.resources.find((resource) => resource.resourceType === 'sheep')?.owner ?? null;
    }).toBe(1);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(10, 8))).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await expect.poll(async () => (await getSnapshot(page)).selectionState.owner).toBe(1);
  });

  test('lets the player right-click an owned sheep to walk it to a destination', async ({ page }) => {
    test.slow();
    await waitForBootWithSeed(page, 'sheep-movement-fixture');

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
    await waitForBootWithSeed(page, 'sheep-movement-fixture');

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

    // Double-click the first owned sheep's cell. The first click selects the single
    // sheep; the second (inside the double-click window) triggers same-type selection
    // expansion to every visible owned sheep.
    await doubleClickCell(page, ownedSheepCells[0].x, ownedSheepCells[0].y);

    const selectedSnapshot = await getSnapshot(page);
    expect(selectedSnapshot.selectionState.selectedCount).toBeGreaterThanOrEqual(
      ownedSheepCells.length,
    );
    expect(selectedSnapshot.selectionState.selectedKind).toBe('resource');
    expect(selectedSnapshot.selectionState.owner).toBe(1);
  });

  test('remembers an enemy house with reduced-opacity memory rendering after the scout walks away', async ({ page }) => {
    test.slow();
    await waitForBootWithSeed(page, 'fog-memory-fixture');

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
    expect(await selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
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

  test('shows a player-facing info card for an individually selected unit', async ({ page }) => {
    await waitForBootWithSeed(page, 'villager-selection-fixture');
    const villagerCells = await getOwnedUnitCells(page, 1, 'villager');
    expect(villagerCells.length).toBeGreaterThan(0);

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        villagerCells[0],
      ),
    ).toBe(true);

    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await expect(page.locator('[data-selection-unit-icon="villager"]')).toHaveText('V');
    await expect(page.locator('[data-selection-unit-label="villager"]')).toHaveText('Villager');
    await expectSelectionDetail(page, 'health', '25 / 25');
    await expectSelectionDetail(page, 'attack', '3');
    await expectSelectionDetail(page, 'armor', '0');
    await expectSelectionDetail(page, 'faction', 'Player');
    await expectSelectionDetail(page, 'civ', 'Britons');
    await expectSelectionDetail(page, 'inventory', 'Empty');
    await expect(page.locator('[data-selection-position]')).toHaveCount(0);
    await expect(page.locator('[data-selection-cycle]')).toHaveCount(0);
    await expect(page.locator('[data-selection-resource]')).toHaveCount(0);
    await expect(page.locator('[data-placement-mode]')).toHaveCount(0);
  });

  test('cycles through every selectable entity stacked on a clicked tile', async ({ page }) => {
    await waitForBootWithSeed(page, 'tile-selection-cycle-fixture');
    const stackCell = await page.evaluate(() => {
      const house = window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.buildings.find(
          (building) => building.owner === 1 && building.buildingType === 'house',
        );
      return house ? { x: house.x, y: house.y } : null;
    });
    expect(stackCell).not.toBeNull();

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        { x: stackCell?.x ?? 0, y: stackCell?.y ?? 0 },
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Militia');
    await expectSelectionDetail(page, 'attack', '4');

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        { x: stackCell?.x ?? 0, y: stackCell?.y ?? 0 },
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('House');
    await expect(page.locator('[data-selection-entity-icon="house"]')).toHaveText('H');

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        { x: stackCell?.x ?? 0, y: stackCell?.y ?? 0 },
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await expectSelectionDetail(page, 'inventory', '100 / 100 food remaining');
  });

  test('shows a marquee while dragging and selects multiple villagers with one drag box', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'villager-selection-fixture');

    const villagerCells = await getOwnedUnitCells(page, 1, 'villager');
    expect(villagerCells).toHaveLength(3);
    const minX = Math.min(...villagerCells.map((unit) => unit.x));
    const maxX = Math.max(...villagerCells.map((unit) => unit.x));
    const minY = Math.min(...villagerCells.map((unit) => unit.y));
    const maxY = Math.max(...villagerCells.map((unit) => unit.y));
    await dragSelectCells(page, minX, minY, maxX, maxY === minY ? maxY + 1 : maxY);

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

    const movedSnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();

      for (let index = 0; index < 80; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const arrivedCount = snapshot.economyState.units.filter(
          (unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.x >= 9 && unit.y >= 11,
        ).length;
        if (arrivedCount === 3) {
          break;
        }
      }

      return snapshot;
    });

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
    const movableCells = await page.evaluate(() =>
      window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.units.filter(
          (unit) => unit.owner === 1 && ['villager', 'militia', 'scout'].includes(unit.unitType),
        )
        .map((unit) => ({ x: unit.x, y: unit.y })),
    );
    const minX = Math.min(...movableCells.map((unit) => unit.x));
    const maxX = Math.max(...movableCells.map((unit) => unit.x));
    const minY = Math.min(...movableCells.map((unit) => unit.y));
    const maxY = Math.max(...movableCells.map((unit) => unit.y));
    await dragSelectCells(page, minX, minY, maxX, maxY);

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

    expect(
      await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(14, 12)),
    ).toBe(true);

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
    const villagerCells = await getOwnedUnitCells(page, 1, 'villager');
    expect(villagerCells).toHaveLength(3);

    await doubleClickCell(page, villagerCells[0].x, villagerCells[0].y);

    await expect(page.locator('[data-selection-name]')).toHaveText('3 Villagers Selected');

    const selectedSnapshot = await getSnapshot(page);
    expect(selectedSnapshot.selectionState.selectedCount).toBe(3);
    expect(selectedSnapshot.selectionState.selectedEntityType).toBe('villager');
  });

  test('can research Feudal Age and train an Archer through the live command panel', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'feudal-age-fixture');

    expect(await selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="research-feudal-age"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Feudal Age');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1320, 100));

    await expect(page.locator('[data-hud="age"]')).toHaveText('Feudal Age');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-archery-range"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Archery Range');
    const archeryRangePlacement = await findValidPlacementNearTownCenter(page, 'archery-range');
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        archeryRangePlacement,
      ),
    ).toBe(true);
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

    expect(await selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="research-castle-age"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Castle Age');
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

  test('shows locked Town Center age-up buttons before their prerequisites are met', async ({
    page,
  }) => {
    await waitForBoot(page);

    expect(await selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    const feudalButton = page.locator('[data-command="research-feudal-age"]');
    await expect(feudalButton).toBeVisible();
    await expect(feudalButton).toBeDisabled();
    await expect(page.locator('[data-command="research-castle-age"]')).toHaveCount(0);
  });

  test('can build an additional Town Center in Castle Age and use it to train a villager', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'castle-town-center-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-town-center"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Town Center');

    const townCenterPlacement = await findValidPlacementNearTownCenter(page, 'town-center', 1, [{ x: 14, y: 8 }]);
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
    await clickCell(page, 18, 10, 'right');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(80, 100));

    expect(
      await selectOwnedBuildingAtDirect(
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
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Fletching');

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
    const stablePlacement = await findValidPlacementNearTownCenter(page, 'stable', 1, [{ x: 17, y: 8 }]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        stablePlacement,
      ),
    ).toBe(true);
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
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(14, 10))).toBe(true);

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
    const enemyArcher = await getDisplayedEntityState(page, 2, 'unit', 'archer');
    expect(enemyArcher).not.toBeNull();
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommandAtWorldPosition(x + 0.5, y + 0.5),
        { x: enemyArcher?.x ?? 14, y: enemyArcher?.y ?? 10 },
      ),
    ).toBe(true);

    await expect.poll(async () => {
      const postCombatSnapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      return postCombatSnapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'archer',
      );
    }, { timeout: 20_000 }).toBe(false);
  });

  test('can build a Watch Tower and let it automatically kill a nearby visible Scout', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'feudal-watch-tower-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-watch-tower"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Watch Tower');
    const watchTowerPlacement = await findValidPlacementNearTownCenter(page, 'watch-tower', 1, [
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
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(8, 8))).toBe(true);

    let snapshot = await getSnapshot(page);
    expect(
      snapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(8, 8))).toBe(true);
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
    await waitForBootWithSeed(page, 'feudal-market-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-market"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Market');
    const marketPlacement = await findValidPlacementNearTownCenter(page, 'market', 1, [{ x: 17, y: 8 }]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        marketPlacement,
      ),
    ).toBe(true);
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

  test('renders construction and completion building visuals with authoritative footprint sizing', async ({
    page,
  }) => {
    await waitForBoot(page);

    const townCenterVisual = await getBuildingVisualState(page, 1, 'town-center', 8, 8);
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

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.locator('[data-command="build-house"]').click();
    const housePlacement = await findValidPlacementNearTownCenter(page, 'house', 1, [{ x: 10, y: 5 }]);
    const didPlaceHouse = await page.evaluate(
      ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
      housePlacement,
    );
    expect(didPlaceHouse).toBe(true);

    const placedSnapshot = await getSnapshot(page);
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

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));

    const constructingHouseVisual = await getBuildingVisualState(
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

    const completedHouseVisual = await getBuildingVisualState(
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
    await waitForBootWithSeed(page, 'conquest-victory-fixture');

    const initialMilitiaBar = await getEntityHealthBarState(page, 1, 'unit', 'militia');
    const initialHouseBar = await getEntityHealthBarState(page, 2, 'building', 'house');

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

    await clickCell(page, 8, 8);
    await clickCell(page, 10, 8, 'right');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(80, 100));

    const damagedHouseBar = await getEntityHealthBarState(page, 2, 'building', 'house');
    expect(damagedHouseBar?.currentHp).toBeLessThan(damagedHouseBar?.maxHp ?? 75);
    expect(damagedHouseBar?.fillRatio ?? 1).toBeLessThan(1);
    expect(damagedHouseBar?.barY ?? 0).toBeLessThan(damagedHouseBar?.entityTopPx ?? 0);
  });

  test('shows player-facing boar details and a wildlife health bar when a boar is selected', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'boar-aggro-fixture');

    await clickCell(page, 13, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Boar');
    await expectSelectionDetail(page, 'health', '75 / 75');
    await expectSelectionDetail(page, 'attack', '7');
    await expectSelectionDetail(page, 'armor', '0');
    await expectSelectionDetail(page, 'faction', 'Gaia');
    await expectSelectionDetailAbsent(page, 'civ');
    await expectSelectionDetail(page, 'inventory', '340 / 340 food remaining');

    const boarBar = await getEntityHealthBarState(page, null, 'resource', 'boar');
    expect(boarBar).toMatchObject({
      currentHp: 75,
      maxHp: 75,
      fillRatio: 1,
    });
    expect(boarBar?.barY ?? 0).toBeLessThan(boarBar?.entityTopPx ?? 0);

    const initialVillagerBar = await getEntityHealthBarState(page, 1, 'unit', 'villager');
    expect(initialVillagerBar?.currentHp).toBe(25);

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(80, 100));

    const idleVillagerBar = await getEntityHealthBarState(page, 1, 'unit', 'villager');
    expect(idleVillagerBar?.currentHp).toBe(25);
  });

  test('renders a wolf health bar and lets hostile wildlife auto-aggro nearby human units', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'wolf-aggro-fixture');

    const initialWolfBar = await getEntityHealthBarState(page, null, 'resource', 'wolf');
    const initialVillagerBar = await getEntityHealthBarState(page, 1, 'unit', 'villager');

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

    const damagedVillagerBar = await getEntityHealthBarState(page, 1, 'unit', 'villager');
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
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    await moveMouseToCell(page, 10, 5);
    let previewState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewState(),
    );
    let previewVisualState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewVisualState(),
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
    expect(previewVisualState).toMatchObject({
      active: true,
      isValid: true,
      cellOutlineCount: 4,
      blockedMarkerCount: 0,
    });

    await moveMouseToCell(page, 13, 7);
    previewState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewState(),
    );
    previewVisualState = await page.evaluate(
      () => window.__AOE2_TEST__!.getPlacementPreviewVisualState(),
    );
    expect(previewState).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: 13,
      cellY: 7,
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

    await clickCell(page, 8, 8);
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    const postInvalidClickSnapshot = await getSnapshot(page);
    expect(
      postInvalidClickSnapshot.economyState.buildings.some(
        (building) => building.owner === 1 && building.buildingType === 'house',
      ),
    ).toBe(false);
  });

  test('shows house placement as invalid on blocked terrain, resources, buildings, and units', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'blocking-rules-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
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
    await waitForBootWithSeed(page, 'blocking-rules-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
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
    await waitForBootWithSeed(page, 'mining-camp-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-mining-camp"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Mining Camp');
    const miningCampPlacement = await findValidPlacementNearTownCenter(page, 'mining-camp', 1, [
      { x: 15, y: 7 },
      { x: 15, y: 8 },
      { x: 15, y: 6 },
    ]);
    await clickCell(page, miningCampPlacement.x, miningCampPlacement.y);
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
      () => window.__AOE2_TEST__!.advanceTicks(120, 100),
    );

    await expect(page.locator('[data-hud="gold"]')).toHaveText(
      String(incomeSnapshot.hudState.playerResources.gold),
    );
    expect(incomeSnapshot.hudState.playerResources.gold).toBeGreaterThan(100);
  });

  test('can build a Barracks and train a Militia through the live command panel', async ({
    page,
  }) => {
    test.slow();
    await waitForBoot(page);

    expect(await selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-barracks"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Barracks');
    const barracksPlacement = await findValidPlacementNearTownCenter(page, 'barracks');
    await clickCell(page, barracksPlacement.x, barracksPlacement.y);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('25');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(500, 100));

    expect(await selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Barracks');
    await page.locator('[data-command="train-militia"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Training: Militia');

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
    await waitForBootWithSeed(page, 'militia-combat-fixture');

    expect(await selectOwnedUnitDirect(page, 1, 'militia')).toBe(true);
    const stagedSnapshot = await getSnapshot(page);
    const enemyScout = stagedSnapshot.economyState.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'scout',
    );
    expect(enemyScout).toBeDefined();

    expect(await selectOwnedUnitDirect(page, 1, 'militia')).toBe(true);
    await clickCell(page, enemyScout?.x ?? 0, enemyScout?.y ?? 0, 'right');

    const combatSnapshot = await page.evaluate((targetScoutId) => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let index = 0; index < 480; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const scoutStillAlive = snapshot.economyState.units.some(
          (unit) => unit.id === targetScoutId,
        );
        if (!scoutStillAlive) {
          break;
        }
      }
      return snapshot;
    }, enemyScout?.id ?? -1);

    expect(
      combatSnapshot.economyState.units.some(
        (unit) => unit.id === (enemyScout?.id ?? -1),
      ),
    ).toBe(false);
  });

  test('can right-click the rendered body of a moving enemy unit to issue an attack', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'moving-enemy-attack-fixture');

    const stagedSnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();

      for (let index = 0; index < 12; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const enemyScout = snapshot.economyState.units.find(
          (unit) => unit.owner === 2 && unit.unitType === 'scout',
        );
        const renderedEnemyScout = snapshot.renderState.entities.find(
          (entity) => entity.id === (enemyScout?.id ?? -1),
        );

        if (
          enemyScout
          && renderedEnemyScout
          && (
            Math.abs(renderedEnemyScout.x - enemyScout.x) > 0
            || Math.abs(renderedEnemyScout.y - enemyScout.y) > 0
          )
        ) {
          return snapshot;
        }
      }

      return snapshot;
    });
    const enemyScout = stagedSnapshot.economyState.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'scout',
    );
    const renderedEnemyScout = stagedSnapshot.renderState.entities.find(
      (entity) => entity.id === (enemyScout?.id ?? -1),
    );

    expect(enemyScout).toBeDefined();
    expect(renderedEnemyScout?.x).toBeGreaterThan(enemyScout?.x ?? 0);
    expect(renderedEnemyScout?.x).toBeLessThan((enemyScout?.x ?? 0) + 1);

    expect(await selectOwnedUnitDirect(page, 1, 'militia')).toBe(true);
    let militiaHasAttackOrder = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const refreshedSnapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      const refreshedEnemyScout = refreshedSnapshot.economyState.units.find(
        (unit) => unit.id === (enemyScout?.id ?? -1),
      );
      const refreshedRenderedEnemyScout = refreshedSnapshot.renderState.entities.find(
        (entity) => entity.id === (enemyScout?.id ?? -1),
      );

      if (!refreshedEnemyScout) {
        break;
      }

      await page.evaluate(
        ({ targetX, targetY }) =>
          window.__AOE2_TEST__!.issueContextCommandAtWorldPosition(targetX, targetY),
        {
          targetX: (refreshedRenderedEnemyScout?.x ?? refreshedEnemyScout.x) + 0.5,
          targetY: (refreshedRenderedEnemyScout?.y ?? refreshedEnemyScout.y) + 0.5,
        },
      );
      const postCommandSnapshot = await getSnapshot(page);
      militiaHasAttackOrder =
        postCommandSnapshot.economyState.units.find(
          (unit) => unit.owner === 1 && unit.unitType === 'militia',
        )?.task === 'attacking';
      if (militiaHasAttackOrder) {
        break;
      }
    }
    expect(militiaHasAttackOrder).toBe(true);

    const combatSnapshot = await page.evaluate((targetScoutId) => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let index = 0; index < 480; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const scoutStillAlive = snapshot.economyState.units.some(
          (unit) => unit.id === targetScoutId,
        );
        if (!scoutStillAlive) {
          break;
        }
      }
      return snapshot;
    }, enemyScout?.id ?? -1);

    expect(
      combatSnapshot.economyState.units.some(
        (unit) => unit.id === (enemyScout?.id ?? -1),
      ),
    ).toBe(false);
  });

  test('can command a Militia to destroy a visible enemy house', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'conquest-victory-fixture');

    const stagedSnapshot = await getSnapshot(page);
    const enemyHouse = stagedSnapshot.economyState.buildings.find(
      (building) =>
        building.owner === 2
        && building.buildingType === 'house'
    );
    expect(enemyHouse).toBeDefined();

    expect(await selectOwnedUnitDirect(page, 1, 'militia')).toBe(true);
    const enemyHouseRender = stagedSnapshot.renderState.entities.find(
      (entity) =>
        entity.owner === 2
        && entity.kind === 'building'
        && entity.entityType === 'house'
        && entity.x === (enemyHouse?.x ?? 10)
        && entity.y === (enemyHouse?.y ?? 8),
    );
    expect(enemyHouseRender).toBeDefined();
    const issuedAttack = await page.evaluate(
      ({ x, y, width, height }) =>
        window.__AOE2_TEST__!.issueContextCommandAtWorldPosition(
          x + width * 0.5,
          y + height * 0.5,
        ),
      {
        x: enemyHouseRender?.x ?? 10,
        y: enemyHouseRender?.y ?? 8,
        width: enemyHouseRender?.footprintWidth ?? 2,
        height: enemyHouseRender?.footprintHeight ?? 2,
      },
    );
    expect(issuedAttack).toBe(true);

    await expect.poll(async () => {
      const combatSnapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(10, 100),
      );
      return combatSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 2
          && building.buildingType === 'house'
          && building.x === (enemyHouse?.x ?? 10)
          && building.y === (enemyHouse?.y ?? 8),
      );
    }, { timeout: 20_000 }).toBe(false);
  });

  test('runs the baseline AI barracks rush through the live game loop', async ({
    page,
  }) => {
    await waitForBootWithSeed(page, 'ai-rush-fixture');

    const advancedSnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let index = 0; index < 2_000; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const aiBarracksComplete = snapshot.economyState.buildings.some(
          (building) =>
            building.owner === 2
            && building.buildingType === 'barracks'
            && building.isComplete,
        );
        const villagerLossOccurred =
          snapshot.economyState.units.filter(
            (unit) => unit.owner === 1 && unit.unitType === 'villager',
          ).length < 3;
        if (aiBarracksComplete && villagerLossOccurred) {
          break;
        }
      }
      return snapshot;
    });

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
