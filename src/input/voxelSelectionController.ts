// Renderer-neutral click selection and right-click command dispatch.
// Recent-click bookkeeping stays local so exact-cycle and same-type
// double-click behavior survives renderer or bridge replacement.

import type { SimulationBridge } from '../game/simulation/createSimulationBridge';
import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../game/simulation/prototypeScenario';
import type {
  ProjectedEntityView,
  SelectionState,
  UnitType,
} from '../game/simulation/types';
import {
  findCommandTargetEntityAtWorldPointInEntities,
  findEntitiesAtWorldPointInEntities,
} from './entityHitTest';
import type { VoxelHitPurpose } from '../rendering/voxel/aoeVoxelHitProxy';
import { worldToIso } from '../rendering/isometricProjection';
import { isUnitType as isUnitTypeExternal } from './unitTypeMap';
import {
  CELL_SIZE,
  DOUBLE_CLICK_WINDOW_MS,
  type RecentExactSelectionClick,
  type RecentFriendlyUnitClick,
} from '../rendering/viewTypes';

export interface VoxelSelectionControllerDeps {
  isActive: () => boolean;
  nowMs: () => number;
  getBridge: () => SimulationBridge;
  // Read fresh so a stale array is never captured across frames.
  getDisplayedEntities: () => ProjectedEntityView[];
  getVoxelHitEntities: (
    isoX: number,
    isoY: number,
    purpose: VoxelHitPurpose,
  ) => ProjectedEntityView[];
  getViewportCellBounds: () => {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

export interface VoxelSelectionController {
  selectEntityAtWorldPosition(
    worldX: number,
    worldY: number,
    isoX?: number,
    isoY?: number,
  ): boolean;
  issueContextCommandAtWorldPosition(
    worldX: number,
    worldY: number,
    isoX?: number,
    isoY?: number,
  ): boolean;
  clearRecentSelectionClicks(): void;
}

export function createVoxelSelectionController(
  deps: VoxelSelectionControllerDeps,
): VoxelSelectionController {
  const { isActive, nowMs, getBridge, getDisplayedEntities } = deps;

  let recentExactSelectionClick: RecentExactSelectionClick | null = null;
  let recentFriendlyUnitClick: RecentFriendlyUnitClick | null = null;

  function selectEntityAtWorldPosition(
    worldX: number,
    worldY: number,
    isoX?: number,
    isoY?: number,
  ): boolean {
    if (!isActive()) {
      return false;
    }

    const clickCellX = clamp(Math.floor(worldX), 0, MAP_WIDTH - 1);
    const clickCellY = clamp(Math.floor(worldY), 0, MAP_HEIGHT - 1);
    const displayed = getDisplayedEntities();
    const groundTargets = findEntitiesAtWorldPointInEntities(
      displayed,
      worldX * CELL_SIZE,
      worldY * CELL_SIZE,
      CELL_SIZE,
    );
    const voxelTargets = isoX === undefined || isoY === undefined
      ? []
      : deps.getVoxelHitEntities(isoX, isoY, 'selection');
    const targetEntities = uniqueEntities([...voxelTargets, ...groundTargets]);
    if (targetEntities.length === 0) {
      clearRecentSelectionClicks();
      getBridge().clearSelection();
      return false;
    }

    const selectionState = getBridge().getSelectionState();
    const currentSelectedId = selectionState.selectedCount === 1
      ? selectionState.selectedEntityId
      : null;
    const exactPoint = isoX === undefined || isoY === undefined
      ? worldToIso(worldX, worldY)
      : { x: isoX, y: isoY };
    const repeatedExactClick = wasRepeatedExactSelectionClick(exactPoint.x, exactPoint.y);
    const exactClickStack = orderCurrentSelectionCycleEntities(
      targetEntities,
      repeatedExactClick ? recentExactSelectionClick?.entityGroups ?? [] : [],
    );
    let targetEntity = targetEntities[0]!;
    let didCycleExactSelection = false;
    if (currentSelectedId !== null && repeatedExactClick) {
      // Search the stable visible+ground stack circularly after the current
      // entity. Equivalent friendly units are skipped so their repeated click
      // remains the same-type double-click gesture, while mixed stacks still
      // reach every distinct kind/type/owner group and wrap predictably.
      const currentIndex = exactClickStack.findIndex(
        (candidate) => candidate.id === currentSelectedId,
      );
      if (currentIndex >= 0 && exactClickStack.length > 1) {
        const current = exactClickStack[currentIndex]!;
        for (let offset = 1; offset < exactClickStack.length; offset += 1) {
          const candidate = exactClickStack[
            (currentIndex + offset) % exactClickStack.length
          ]!;
          if (
            candidate.kind !== current.kind
            || candidate.entityType !== current.entityType
            || candidate.owner !== current.owner
          ) {
            targetEntity = candidate;
            didCycleExactSelection = true;
            break;
          }
        }
      }
    }

    if (!getBridge().selectEntityById(targetEntity.id)) {
      clearRecentSelectionClicks();
      getBridge().clearSelection();
      return false;
    }

    recentExactSelectionClick = {
      isoX: exactPoint.x,
      isoY: exactPoint.y,
      entityGroups: exactClickStack.map(selectionCycleGroup),
    };

    if (didCycleExactSelection) {
      recentFriendlyUnitClick = null;
      return true;
    }

    if (trySelectSameTypeOnDoubleClick(clickCellX, clickCellY)) {
      clearRecentSelectionClicks();
      return true;
    }

    updateRecentFriendlyUnitClick(clickCellX, clickCellY);
    return true;
  }

  function issueContextCommandAtWorldPosition(
    worldX: number,
    worldY: number,
    isoX?: number,
    isoY?: number,
  ): boolean {
    if (!isActive()) {
      return false;
    }

    const clampedCellX = clamp(Math.floor(worldX), 0, MAP_WIDTH - 1);
    const clampedCellY = clamp(Math.floor(worldY), 0, MAP_HEIGHT - 1);
    const displayed = getDisplayedEntities();
    const displayedTargetEntity = (
      isoX === undefined || isoY === undefined
        ? null
        : deps.getVoxelHitEntities(isoX, isoY, 'command')[0] ?? null
    ) ?? findCommandTargetEntityAtWorldPointInEntities(
      displayed,
      worldX * CELL_SIZE,
      worldY * CELL_SIZE,
      CELL_SIZE,
    );
    const projectedTargetEntity = displayedTargetEntity
      ? null
      : findCommandTargetEntityAtWorldPointInEntities(
        getBridge().getRenderState().entities,
        worldX * CELL_SIZE,
        worldY * CELL_SIZE,
        CELL_SIZE,
      );
    const targetEntity = displayedTargetEntity ?? projectedTargetEntity;

    if (targetEntity && getBridge().issueContextCommandAtEntity(targetEntity.id)) {
      return true;
    }

    return getBridge().issueContextCommand(clampedCellX, clampedCellY);
  }

  function trySelectSameTypeOnDoubleClick(cellX: number, cellY: number): boolean {
    const recentClick = recentFriendlyUnitClick;
    if (
      recentClick === null
      || recentClick.cellX !== cellX
      || recentClick.cellY !== cellY
      || nowMs() - recentClick.atMs > DOUBLE_CLICK_WINDOW_MS
    ) {
      return false;
    }

    const bounds = getViewportCellBounds();
    return getBridge().selectOwnedUnitsByTypeInRect(
      recentClick.unitType,
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
    );
  }

  function updateRecentFriendlyUnitClick(cellX: number, cellY: number): void {
    const selectionState = getBridge().getSelectionState();
    if (
      selectionState.owner !== HUMAN_PLAYER_ID
      || selectionState.selectedCount !== 1
    ) {
      return;
    }

    const isUnit = selectionState.selectedKind === 'unit'
      && isUnitType(selectionState.selectedEntityType);
    const isOwnedSheep = selectionState.selectedKind === 'resource'
      && selectionState.selectedEntityType === 'sheep';

    if (!isUnit && !isOwnedSheep) {
      return;
    }

    recentFriendlyUnitClick = {
      atMs: nowMs(),
      cellX,
      cellY,
      unitType: isOwnedSheep ? 'sheep' : (selectionState.selectedEntityType as UnitType),
    };
  }

  function getViewportCellBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    // The isometric camera covers a diamond of cells; its AABB is a safe
    // conservative viewport for "select all of type on screen".
    const bounds = deps.getViewportCellBounds();
    return {
      minX: clamp(Math.floor(bounds.minX), 0, MAP_WIDTH - 1),
      minY: clamp(Math.floor(bounds.minY), 0, MAP_HEIGHT - 1),
      maxX: clamp(Math.floor(bounds.maxX), 0, MAP_WIDTH - 1),
      maxY: clamp(Math.floor(bounds.maxY), 0, MAP_HEIGHT - 1),
    };
  }

  function clearRecentSelectionClicks(): void {
    recentExactSelectionClick = null;
    recentFriendlyUnitClick = null;
  }

  function wasRepeatedExactSelectionClick(isoX: number, isoY: number): boolean {
    if (!recentExactSelectionClick) return false;
    const deltaX = isoX - recentExactSelectionClick.isoX;
    const deltaY = isoY - recentExactSelectionClick.isoY;
    return deltaX * deltaX + deltaY * deltaY
      <= EXACT_CLICK_REPEAT_RADIUS_ISO_PX * EXACT_CLICK_REPEAT_RADIUS_ISO_PX;
  }

  function isUnitType(entityType: SelectionState['selectedEntityType']): entityType is UnitType {
    return isUnitTypeExternal(entityType);
  }

  return {
    selectEntityAtWorldPosition,
    issueContextCommandAtWorldPosition,
    clearRecentSelectionClicks,
  };
}

const EXACT_CLICK_REPEAT_RADIUS_ISO_PX = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function uniqueEntities(entities: readonly ProjectedEntityView[]): ProjectedEntityView[] {
  const seen = new Set<number>();
  return entities.filter((entity) => {
    if (seen.has(entity.id)) return false;
    seen.add(entity.id);
    return true;
  });
}

function orderCurrentSelectionCycleEntities(
  entities: readonly ProjectedEntityView[],
  priorGroups: readonly string[],
): ProjectedEntityView[] {
  const currentByGroup = new Map<string, ProjectedEntityView>();
  for (const entity of entities) {
    const group = selectionCycleGroup(entity);
    if (!currentByGroup.has(group)) currentByGroup.set(group, entity);
  }

  const orderedGroups = [
    ...priorGroups.filter((group) => currentByGroup.has(group)),
    ...[...currentByGroup.keys()].filter((group) => !priorGroups.includes(group)),
  ];
  return orderedGroups.map((group) => currentByGroup.get(group)!);
}

function selectionCycleGroup(entity: ProjectedEntityView): string {
  return `${entity.kind}:${entity.entityType}:${entity.owner ?? 'neutral'}`;
}
