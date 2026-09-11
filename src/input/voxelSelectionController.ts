// Renderer-neutral click selection and right-click command dispatch.
// Recent-click bookkeeping stays local so exact-cycle and same-type
// double-click behavior survives renderer or bridge replacement.

import type { SimulationBridge } from '../game/simulation/createSimulationBridge';
import {
  HUMAN_PLAYER_ID,
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
import { isUnitType } from './unitTypeMap';
import {
  CELL_SIZE,
  DOUBLE_CLICK_WINDOW_MS,
  type RecentExactSelectionClick,
  type RecentFriendlyUnitClick,
} from '../rendering/viewTypes';

export interface VoxelSelectionControllerDeps {
  isActive: () => boolean;
  /**
   * The INPUT clock, in milliseconds — the only thing the double-click window
   * is measured against.
   *
   * It must not be the RENDER clock. The view used to pass the timestamp of
   * the last rendered frame, so two clicks 80 ms apart measured 0 ms apart
   * when one frame covered both and over 300 ms apart when a slow frame fell
   * between them: the gesture stopped working exactly when the machine was
   * busy. Measured 2026-09-11 at 1600x900 — identical double-clicks selected
   * "all 3 villagers" or "the Town Centre behind them" depending only on which
   * frame was in flight.
   */
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
    /** True when this came from the pointer. See the double-click note below. */
    isPointerClick?: boolean,
  ): boolean;
  issueContextCommandAtWorldPosition(
    worldX: number,
    worldY: number,
    isoX?: number,
    isoY?: number,
    garrison?: boolean,
    forceAttack?: boolean,
    queueMove?: boolean,
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
    isPointerClick = false,
  ): boolean {
    if (!isActive()) {
      return false;
    }

    const map = deps.getBridge().getMapSize();
    const clickCellX = clamp(Math.floor(worldX), 0, map.width - 1);
    const clickCellY = clamp(Math.floor(worldY), 0, map.height - 1);
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

    // A DOUBLE-click outranks the stacked-entity cycle below, and this order is
    // the whole fix. Both gestures are "click the same place again", and the
    // cycle's test is purely positional while the double-click's is a 300 ms
    // window, so the cycle was taking every fast repeat: double-clicking a
    // villager standing in front of the Town Centre selected the TOWN CENTRE,
    // and one standing on a sheep selected the SHEEP (play-test 2026-09-11,
    // `16-dblclick-villagers.png`). Select-all-of-type is what a DE player
    // means by two quick clicks; a slower repeat still walks the stack.
    //
    // Only a POINTER click can be half of a double-click. A caller that is not
    // the pointer — `selectEntityAtCell`, and the harness scans built on it —
    // has no tempo, so it neither claims a double-click nor records one; without
    // that, a scan firing four selections inside one `page.evaluate` reads as a
    // 0 ms double-click every time and the stack cycle becomes unreachable.
    // BOUND: the double-click is therefore only exercised through real pointer
    // input, which is where `de-command-surface.spec.ts` drives it.
    if (isPointerClick && trySelectSameTypeOnDoubleClick(clickCellX, clickCellY)) {
      clearRecentSelectionClicks();
      return true;
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

    if (isPointerClick) updateRecentFriendlyUnitClick(clickCellX, clickCellY);
    return true;
  }

  function issueContextCommandAtWorldPosition(
    worldX: number,
    worldY: number,
    isoX?: number,
    isoY?: number,
    garrison = false,
    forceAttack = false,
    queueMove = false,
  ): boolean {
    if (!isActive()) {
      return false;
    }

    const map = deps.getBridge().getMapSize();
    const clampedCellX = clamp(Math.floor(worldX), 0, map.width - 1);
    const clampedCellY = clamp(Math.floor(worldY), 0, map.height - 1);
    const displayed = getDisplayedEntities();
    const voxelTargets = isoX === undefined || isoY === undefined
      ? []
      : deps.getVoxelHitEntities(isoX, isoY, 'command');
    const displayedTargetEntity = (
      chooseVillagerContextTarget(voxelTargets, getBridge().getSelectionState())
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

    if (
      targetEntity
      // Shift (v0.3.141): the same held Shift that queues a ground waypoint
      // queues an ENTITY order — gather after gather, kill after kill.
      && getBridge().issueContextCommandAtEntity(targetEntity.id, { garrison, forceAttack, queue: queueMove })
    ) {
      return true;
    }

    // Ground fallback. `clampedCell*` is the click inverted through the FLAT
    // ground plane, which is exactly what spec §9.3 asks for: clicking a
    // building's base resolves to its footprint (walk up to it), clicking its
    // roof resolves to the cell behind it (walk behind it), because the iso
    // projection maps higher screen points to deeper ground.
    // Shift (v0.3.125): a held Shift makes the ground click a QUEUED waypoint.
    if (queueMove) {
      return getBridge().issueMoveCommand(clampedCellX, clampedCellY, { queue: true });
    }
    return getBridge().issueContextCommand(clampedCellX, clampedCellY, garrison);
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
    const map = deps.getBridge().getMapSize();
    return {
      minX: clamp(Math.floor(bounds.minX), 0, map.width - 1),
      minY: clamp(Math.floor(bounds.minY), 0, map.height - 1),
      maxX: clamp(Math.floor(bounds.maxX), 0, map.width - 1),
      maxY: clamp(Math.floor(bounds.maxY), 0, map.height - 1),
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
const EXACT_CLICK_REPEAT_RADIUS_ISO_PX = 4;

    return deltaX * deltaX + deltaY * deltaY
      <= EXACT_CLICK_REPEAT_RADIUS_ISO_PX * EXACT_CLICK_REPEAT_RADIUS_ISO_PX;
  }

  return {
    selectEntityAtWorldPosition,
    issueContextCommandAtWorldPosition,
    clearRecentSelectionClicks,
  };
}


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

function chooseVillagerContextTarget(
  rawHits: readonly ProjectedEntityView[],
  selectionState: SelectionState,
): ProjectedEntityView | null {
  const firstHit = rawHits[0] ?? null;
  if (selectionState.selectedEntityType !== 'villager') {
    return firstHit;
  }

  // A friendly villager may visually stand in front of the resource or enemy
  // that a villager group is trying to act on. Friendly units have no villager
  // context action of their own, so prefer the first actionable hit beneath
  // them. Keep the raw presented-hit order for every other selection type so
  // Monk healing and selection semantics remain unchanged.
  return rawHits.find(
    (entity) => entity.kind !== 'unit' || entity.owner !== HUMAN_PLAYER_ID,
  ) ?? firstHit;
}

function selectionCycleGroup(entity: ProjectedEntityView): string {
  return `${entity.kind}:${entity.entityType}:${entity.owner ?? 'neutral'}`;
}
