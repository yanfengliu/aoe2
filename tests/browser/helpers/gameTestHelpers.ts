import { expect, type Page } from '@playwright/test';

import type {
  BrowserTestSnapshot,
} from '../../../src/app/bootstrap/browserTestApi';
import type { SelectionBoxState } from '../../../src/phaser/scenes/GameScene';

export interface MinimapStats {
  width: number;
  height: number;
  nonBackgroundPixelCount: number;
}

export interface MinimapViewportState {
  active: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export type SelectionBoxPreviewState = SelectionBoxState;

export interface HudChipRect {
  left: number;
  width: number;
}

export interface DisplayedEntityState {
  id: number;
  kind: 'tile' | 'unit' | 'building' | 'resource';
  entityType: string;
  owner: number | null;
  x: number;
  y: number;
}

export interface RenderedUnitState {
  id: number;
  owner: number | null;
  unitType: string;
  x: number;
  y: number;
  size: number;
}

export interface RenderedEntityStateWithSize {
  id: number;
  kind: 'unit' | 'resource' | 'building' | 'tile';
  entityType: string;
  owner: number | null;
  x: number;
  y: number;
  size: number;
}

export async function expectSelectionDetail(
  page: Page,
  key: 'health' | 'attack' | 'armor' | 'faction' | 'civ' | 'inventory',
  value: string,
): Promise<void> {
  await expect(page.locator(`[data-selection-detail-value="${key}"]`)).toHaveText(value);
}

export async function expectSelectionDetailAbsent(
  page: Page,
  key: 'health' | 'attack' | 'armor' | 'faction' | 'civ' | 'inventory',
): Promise<void> {
  await expect(page.locator(`[data-selection-detail-value="${key}"]`)).toHaveCount(0);
}

export async function getHudChipKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-hud-chip]'))
      // Slice 8: hidden chips (e.g. the Wonder/Relic countdown that only
      // surfaces during an active countdown) must not count toward chip
      // ordering — the running-match baseline still renders 7 chips.
      .filter((chip) => !chip.hidden)
      .map((chip) => chip.dataset.hudChip ?? '')
      .filter((value) => value.length > 0),
  );
}

export async function waitForBoot(page: Page): Promise<void> {
  await waitForBootWithSeed(page, 'aoe2-prototype');
}

export async function waitForBootWithSeed(page: Page, seed: string): Promise<void> {
  await page.goto(`/?seed=${seed}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  await expect.poll(async () => (await getSnapshot(page)).hudState.seed).toBe(seed);
  await expect.poll(async () => {
    const snapshot = await getSnapshot(page);
    return snapshot.hudState.tick;
  }).toBeGreaterThan(0);
}

export async function emulateMonitorSize(
  page: Page,
  screenWidth = 1280,
  screenHeight = 720,
): Promise<void> {
  await page.addInitScript(
    ({ emulatedScreenWidth, emulatedScreenHeight }) => {
      Object.defineProperty(window.screen, 'width', {
        configurable: true,
        get: () => emulatedScreenWidth,
      });
      Object.defineProperty(window.screen, 'height', {
        configurable: true,
        get: () => emulatedScreenHeight,
      });
    },
    {
      emulatedScreenWidth: screenWidth,
      emulatedScreenHeight: screenHeight,
    },
  );
}

async function isCanvasContainedByFullscreenElement(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector('#game-root canvas');
    const fullscreenElement = document.fullscreenElement;
    return canvas instanceof Node && fullscreenElement instanceof Element && fullscreenElement.contains(canvas);
  });
}

export async function enterGameFullscreen(page: Page): Promise<void> {
  const isAlreadyFullscreen = await isCanvasContainedByFullscreenElement(page);
  if (isAlreadyFullscreen) {
    return;
  }

  await page.evaluate(() => {
    const root = document.getElementById('game-root');
    if (!root) {
      throw new Error('Expected #game-root to exist.');
    }

    // Chromium requires user activation for requestFullscreen(), so arm the
    // next click on a temporary button to promote the game root into
    // fullscreen mode without sending spurious input to the canvas.
    const trigger = document.createElement('button');
    trigger.id = '__aoe2-test-fullscreen-trigger';
    trigger.type = 'button';
    trigger.textContent = 'enter fullscreen';
    Object.assign(trigger.style, {
      position: 'fixed',
      top: '8px',
      left: '8px',
      zIndex: '2147483647',
    });
    trigger.addEventListener(
      'click',
      () => {
        void root.requestFullscreen();
      },
      { once: true },
    );
    document.body.appendChild(trigger);
  });
  await page.locator('#__aoe2-test-fullscreen-trigger').click();
  await expect.poll(async () => isCanvasContainedByFullscreenElement(page)).toBe(true);
  await page.evaluate(() => {
    document.getElementById('__aoe2-test-fullscreen-trigger')?.remove();
  });
}

export async function exitFullscreen(page: Page): Promise<void> {
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(async () =>
    page.evaluate(() => document.fullscreenElement === null)
  ).toBe(true);
}

export async function getSnapshot(
  page: Page,
): Promise<BrowserTestSnapshot> {
  return page.evaluate(() => window.__AOE2_TEST__!.getSnapshot());
}

export async function getHudChipRects(
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

export async function getMinimapStats(
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

export async function getMinimapViewportState(
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

export async function getScreenPointForCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<ScreenPoint> {
  return page.evaluate(
    ({ cellX: x, cellY: y }) => window.__AOE2_TEST__!.worldToScreen(x, y),
    { cellX, cellY },
  );
}

export async function getScreenPointForWorldPosition(
  page: Page,
  worldX: number,
  worldY: number,
): Promise<ScreenPoint> {
  return page.evaluate(
    ({ worldX: x, worldY: y }) => window.__AOE2_TEST__!.worldToScreen(x - 0.5, y - 0.5),
    { worldX, worldY },
  );
}

export async function clickCell(
  page: Page,
  cellX: number,
  cellY: number,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  const point = await getScreenPointForCell(page, cellX, cellY);
  await clickCanvasAtPoint(page, point, button);
}

export async function clickWorldPosition(
  page: Page,
  worldX: number,
  worldY: number,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  const point = await getScreenPointForWorldPosition(page, worldX, worldY);
  await clickCanvasAtPoint(page, point, button);
}

export async function doubleClickWorldPosition(
  page: Page,
  worldX: number,
  worldY: number,
): Promise<void> {
  const point = await getScreenPointForWorldPosition(page, worldX, worldY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { button: 'left' });
  await page.mouse.click(point.x, point.y, { button: 'left' });
}

export async function clickCanvasAtPoint(
  page: Page,
  point: ScreenPoint,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { button });
}

export async function clickMinimapAt(
  page: Page,
  normalizedX: number,
  normalizedY: number,
): Promise<void> {
  const point = await getMinimapPoint(page, normalizedX, normalizedY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { button: 'left' });
}

export async function getMinimapPoint(
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

export async function dragMinimapTo(
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

export async function getGameCanvasBounds(page: Page): Promise<NonNullable<Awaited<ReturnType<ReturnType<Page['locator']>['boundingBox']>>>> {
  const canvas = page.locator('#game-root canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

export async function getGameCanvasMetrics(page: Page): Promise<{
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

export async function dragSelectCells(
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

export async function dragSelectWorldRect(
  page: Page,
  startWorldX: number,
  startWorldY: number,
  endWorldX: number,
  endWorldY: number,
): Promise<void> {
  const startPoint = await getScreenPointForWorldPosition(page, startWorldX, startWorldY);
  const endPoint = await getScreenPointForWorldPosition(page, endWorldX, endWorldY);

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(endPoint.x, endPoint.y, { steps: 6 });
}

export async function moveMouseToCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<void> {
  const point = await getScreenPointForCell(page, cellX, cellY);
  await page.mouse.move(point.x, point.y);
}

export async function selectOwnedUnitDirect(
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

export async function getOwnedUnitCells(
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

export async function getOwnedResourceCells(
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

export async function selectOwnedBuildingDirect(
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

export async function selectOwnedBuildingAtDirect(
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

export async function getBuildingVisualState(
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

export async function getEntityHealthBarState(
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

export async function getDisplayedEntityState(
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

export async function getRenderedOwnedUnits(
  page: Page,
  owner: number,
  unitType: string,
): Promise<RenderedUnitState[]> {
  return page.evaluate(
    ({ owner: playerOwner, unitType: expectedType }) =>
      window.__AOE2_TEST__!
        .getRenderState()
        .entities
        .filter(
          (entity) =>
            entity.kind === 'unit'
            && entity.owner === playerOwner
            && entity.entityType === expectedType,
        )
        .map((entity) => ({
          id: entity.id,
          owner: entity.owner,
          unitType: String(entity.entityType),
          x: entity.x,
          y: entity.y,
          size: entity.size,
        })),
    {
      owner,
      unitType,
    },
  );
}

export async function getRenderedOwnedEntitiesByType(
  page: Page,
  owner: number,
  kind: 'unit' | 'resource',
  entityType: string,
): Promise<RenderedEntityStateWithSize[]> {
  return page.evaluate(
    ({ owner: playerOwner, kind: expectedKind, entityType: expectedType }) =>
      window.__AOE2_TEST__!
        .getRenderState()
        .entities
        .filter(
          (entity) =>
            entity.kind === expectedKind
            && entity.owner === playerOwner
            && entity.entityType === expectedType,
        )
        .map((entity) => ({
          id: entity.id,
          kind: entity.kind,
          entityType: String(entity.entityType),
          owner: entity.owner,
          x: entity.x,
          y: entity.y,
          size: entity.size,
        })),
    {
      owner,
      kind,
      entityType,
    },
  );
}

export async function findValidPlacementNearTownCenter(
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


