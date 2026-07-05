import { expect, type Page } from '@playwright/test';

import type {
  DisplayedEntityState,
  HudChipRect,
  MinimapStats,
  MinimapViewportState,
  RenderedEntityStateWithSize,
  RenderedUnitState,
} from './types';

export async function expectSelectionDetail(
  page: Page,
  key: 'health' | 'attack' | 'armor' | 'pierce-armor' | 'faction' | 'civ' | 'inventory',
  value: string,
): Promise<void> {
  await expect(page.locator(`[data-selection-detail-value="${key}"]`)).toHaveText(value);
}

export async function expectSelectionDetailAbsent(
  page: Page,
  key: 'health' | 'attack' | 'armor' | 'pierce-armor' | 'faction' | 'civ' | 'inventory',
): Promise<void> {
  await expect(page.locator(`[data-selection-detail-value="${key}"]`)).toHaveCount(0);
}

export async function getHudChipKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-hud-chip]'))
      // Slice 8 / v0.1.95: chips that only surface during an active countdown
      // (Wonder/Relic) must not count toward chip ordering — the running-match
      // baseline still renders 7 chips. The countdown chip's SLOT is now always
      // present (reserved so it can't reflow the bar) with its content faded via
      // `data-hud-countdown-active="false"`, so exclude that inactive state too.
      .filter((chip) => !chip.hidden && chip.dataset.hudCountdownActive !== 'false')
      .map((chip) => chip.dataset.hudChip ?? '')
      .filter((value) => value.length > 0),
  );
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
