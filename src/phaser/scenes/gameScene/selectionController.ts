// Click-to-select + right-click context-command dispatch factored out of
// GameScene. Same dep-bag factory shape as the other gameScene/ extractions.
// The controller owns the recent-click bookkeeping (exact-cycle + same-type
// double-click) that used to live as mutable scene fields, so the scene no
// longer carries selection state. Move-only: every branch mirrors the prior
// private methods on GameScene.

import Phaser from 'phaser';

import type { SimulationBridge } from '../../../game/simulation/createSimulationBridge';
import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../../../game/simulation/prototypeScenario';
import type {
  ProjectedEntityView,
  SelectionState,
  UnitType,
} from '../../../game/simulation/types';
import {
  findCommandTargetEntityAtWorldPointInEntities,
  findEntitiesAtWorldPointInEntities,
} from '../entityHitTest';
import { isoViewportCellBounds } from './isoViewHelpers';
import { isUnitType as isUnitTypeExternal } from './unitTypeMap';
import {
  CELL_SIZE,
  DOUBLE_CLICK_WINDOW_MS,
  type RecentExactSelectionClick,
  type RecentFriendlyUnitClick,
} from './sceneViewTypes';

export interface SelectionControllerDeps {
  // The Phaser scene handle. Used only for `sys.isActive`, `time.now`, and
  // `cameras.main.worldView` — no simulation state lives here.
  scene: Phaser.Scene;
  getBridge: () => SimulationBridge;
  // Snapshot of the scene's `displayedEntities`. Read fresh each call so a
  // stale array reference is never captured across frames.
  getDisplayedEntities: () => ProjectedEntityView[];
}

export interface SelectionController {
  selectEntityAtWorldPosition(worldX: number, worldY: number): boolean;
  issueContextCommandAtWorldPosition(worldX: number, worldY: number): boolean;
  clearRecentSelectionClicks(): void;
}

export function createSelectionController(
  deps: SelectionControllerDeps,
): SelectionController {
  const { scene, getBridge, getDisplayedEntities } = deps;

  let recentExactSelectionClick: RecentExactSelectionClick | null = null;
  let recentFriendlyUnitClick: RecentFriendlyUnitClick | null = null;

  function selectEntityAtWorldPosition(worldX: number, worldY: number): boolean {
    if (!scene.sys.isActive()) {
      return false;
    }

    const clickCellX = Phaser.Math.Clamp(Math.floor(worldX), 0, MAP_WIDTH - 1);
    const clickCellY = Phaser.Math.Clamp(Math.floor(worldY), 0, MAP_HEIGHT - 1);
    const targetEntities = findEntitiesAtWorldPointInEntities(
      getDisplayedEntities(),
      worldX * CELL_SIZE,
      worldY * CELL_SIZE,
      CELL_SIZE,
    );
    if (targetEntities.length === 0) {
      clearRecentSelectionClicks();
      getBridge().clearSelection();
      return false;
    }

    const selectionState = getBridge().getSelectionState();
    const currentSelectedId = selectionState.selectedCount === 1
      ? selectionState.selectedEntityId
      : null;
    let targetEntity = targetEntities[0]!;
    let didCycleExactSelection = false;
    if (
      currentSelectedId !== null
      && targetEntities.length > 1
      && wasRepeatedExactSelectionClick(clickCellX, clickCellY)
    ) {
      const currentIndex = targetEntities.findIndex((candidate) => candidate.id === currentSelectedId);
      if (currentIndex >= 0) {
        targetEntity = targetEntities[(currentIndex + 1) % targetEntities.length] ?? targetEntity;
        didCycleExactSelection = targetEntity.id !== currentSelectedId;
      }
    }

    if (!getBridge().selectEntityById(targetEntity.id)) {
      clearRecentSelectionClicks();
      getBridge().clearSelection();
      return false;
    }

    recentExactSelectionClick = {
      cellX: clickCellX,
      cellY: clickCellY,
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

  function issueContextCommandAtWorldPosition(worldX: number, worldY: number): boolean {
    if (!scene.sys.isActive()) {
      return false;
    }

    const clampedCellX = Phaser.Math.Clamp(Math.floor(worldX), 0, MAP_WIDTH - 1);
    const clampedCellY = Phaser.Math.Clamp(Math.floor(worldY), 0, MAP_HEIGHT - 1);
    const displayedTargetEntity = findCommandTargetEntityAtWorldPointInEntities(
      getDisplayedEntities(),
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
      || scene.time.now - recentClick.atMs > DOUBLE_CLICK_WINDOW_MS
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
      atMs: scene.time.now,
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
    // The camera worldView (iso-pixel) covers a diamond of cells; take its cell
    // AABB (a conservative superset — fine for "select all of type on screen").
    const bounds = isoViewportCellBounds(scene.cameras.main.worldView);
    return {
      minX: Phaser.Math.Clamp(Math.floor(bounds.minX), 0, MAP_WIDTH - 1),
      minY: Phaser.Math.Clamp(Math.floor(bounds.minY), 0, MAP_HEIGHT - 1),
      maxX: Phaser.Math.Clamp(Math.floor(bounds.maxX), 0, MAP_WIDTH - 1),
      maxY: Phaser.Math.Clamp(Math.floor(bounds.maxY), 0, MAP_HEIGHT - 1),
    };
  }

  function clearRecentSelectionClicks(): void {
    recentExactSelectionClick = null;
    recentFriendlyUnitClick = null;
  }

  function wasRepeatedExactSelectionClick(cellX: number, cellY: number): boolean {
    return (
      recentExactSelectionClick?.cellX === cellX
      && recentExactSelectionClick.cellY === cellY
    );
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
