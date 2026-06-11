// Unit-transform + occupancy bookkeeping. The bridge owns
// `worldOccupancy`, the unit-transform components, and the world; these
// helpers wire them together so movement systems, scenario seeding, and
// the destroy/garrison paths share one occupancy-sync definition.

import type { Position, SubcellSlotOffset } from 'civ-engine';
import type {
  BuildingComponent,
  ResourceComponent,
  TerrainComponent,
  UnitComponent,
  UnitTransformComponent,
} from '../types';
import {
  buildingFootprint,
  clampUnitTransformToMap,
  getUnitTargetTransformForCell,
  gridPositionFromUnitTransform,
  isAtTarget,
  isUnitTransformAtTarget,
  stepUnitTransformToward,
  type GameWorld,
} from './pureHelpers';
import { UNIT_SUBGRID_STEP_PER_TICK } from './pureHelpers';
import { constructionStatesCodec } from './bridgeStateSerialize';

type CivWorld = GameWorld;

// Spec §12.6 contract surface — the worldOccupancy module returns this and
// exposes `placeUnitForSpawn` / `getUnitSlotOffset` so future spawn / movement
// layers can consume the engine-allocated visual slot. Production code paths
// today still use the entity-id-derived fallback in pureHelpers.
interface SyncUnitResult {
  placedAt: Position;
  slotOffset: SubcellSlotOffset | null;
}

interface WorldOccupancyLike {
  release(entity: number): void;
  syncBuilding(entity: number, position: Position, footprint: { width: number; height: number }): void;
  syncResource(entity: number, position: Position): void;
  syncUnit(entity: number, position: Position): SyncUnitResult;
  getUnitSlotOffset(entity: number): SubcellSlotOffset | null;
  findNearestFreeUnitCell(entity: number, requestedPosition: Position): Position | null;
  reset(): void;
  blockTerrain(cells: Position[]): void;
}

export interface TransformOpsDeps {
  world: GameWorld;
  mapWidth: number;
  mapHeight: number;
  worldOccupancy: WorldOccupancyLike;
  tiles: number[][];
  // Phase 2D: constructionStates migrated to world.state.aoe2.* via accessor.
  // The factory's other slot reads were already on the accessor side, so we
  // can drop the bridgeState dep entirely here.
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
  isBootstrappingScenario: () => boolean;
}

export interface TransformOps {
  getUnitTransform(id: number, activeWorld?: CivWorld): UnitTransformComponent | null;
  syncUnitTransformToPosition(
    id: number,
    position: Position,
    activeWorld?: CivWorld,
  ): void;
  moveUnitOneSubgridStep(
    id: number,
    target: Position,
    activeWorld?: CivWorld,
    stepUnits?: number,
  ): Position | null;
  isUnitAtTarget(id: number, target: Position, activeWorld?: CivWorld): boolean;
  // Spec §12.7 lazy redirect: returns null if the unit found a free slot at
  // its arrival cell; returns a redirected cell when the unit is in overflow
  // and a free slot exists in a neighbor cell. Caller rewrites the move
  // command's target so movement does not re-aim at the original full target.
  resolveArrivalRedirect(unitId: number, arrivalCell: Position): Position | null;
  syncOccupancyForEntity(entity: number, activeWorld?: CivWorld): void;
  setPositionAndSyncOccupancy(
    entity: number,
    position: Position,
    activeWorld?: CivWorld,
  ): void;
  clearPositionAndSyncOccupancy(entity: number, activeWorld?: CivWorld): void;
  syncSpawnedEntityOccupancy(entity: number): void;
  rebuildWorldOccupancyFromWorld(): void;
}

export function createTransformOps(deps: TransformOpsDeps): TransformOps {
  const {
    world,
    mapWidth,
    mapHeight,
    worldOccupancy,
    tiles,
    accessor,
    isBootstrappingScenario,
  } = deps;

  function getUnitTransform(
    id: number,
    activeWorld: CivWorld = world,
  ): UnitTransformComponent | null {
    return activeWorld.getComponent<UnitTransformComponent>(id, 'unitTransform') ?? null;
  }

  function syncUnitTransformToPosition(
    id: number,
    position: Position,
    activeWorld: CivWorld = world,
  ): void {
    const transform = getUnitTransform(id, activeWorld);
    if (!transform) return;

    // Spec §12.6 visual non-overlap: snap to the engine-allocated slot
    // offset when one is available, otherwise fall back to the entity-id-
    // derived offset (early bootstrap, overflowed units, fixtures without
    // a worldOccupancy attached). Callers reach this from spawn-time and
    // move-arrival sites — both are stationary moments where snapping the
    // transform to the allocated slot produces visual non-overlap. This is
    // intentionally NOT called from `syncOccupancyForEntity` because that
    // path fires on every cell crossing during movement and snapping there
    // would teleport mid-flight sprites.
    const slotOffset = worldOccupancy.getUnitSlotOffset(id);
    const targetTransform = getUnitTargetTransformForCell(id, position, slotOffset);
    transform.fineX = targetTransform.fineX;
    transform.fineY = targetTransform.fineY;
  }

  function syncOccupancyForEntity(
    entity: number,
    activeWorld: CivWorld = world,
  ): void {
    const position = activeWorld.getComponent<Position>(entity, 'position');
    if (!position) {
      worldOccupancy.release(entity);
      return;
    }

    const building = activeWorld.getComponent<BuildingComponent>(entity, 'building');
    if (building) {
      const construction = accessor.get(constructionStatesCodec).get(entity);
      const footprint = construction ?? buildingFootprint(building.buildingType);
      worldOccupancy.syncBuilding(entity, position, footprint);
      return;
    }

    if (activeWorld.getComponent<ResourceComponent>(entity, 'resource')) {
      worldOccupancy.syncResource(entity, position);
      return;
    }

    if (activeWorld.getComponent<UnitComponent>(entity, 'unit')) {
      // Spec §12.6: syncUnit allocates a sub-tile slot via the engine's
      // SubcellOccupancyGrid. The transform is NOT snapped here because
      // this path runs every tick during movement (cell crossings) and
      // snapping fineX/fineY mid-flight would teleport the unit. The slot
      // offset is consumed lazily — `moveUnitOneSubgridStep` reads it via
      // `getUnitSlotOffset` so the unit aims at the allocated slot in its
      // target cell, and `placeFreshSpawnUnit` / `syncSpawnedEntityOccupancy`
      // do snap once at spawn time.
      worldOccupancy.syncUnit(entity, position);
      return;
    }

    worldOccupancy.release(entity);
  }

  function setPositionAndSyncOccupancy(
    entity: number,
    position: Position,
    activeWorld: CivWorld = world,
  ): void {
    activeWorld.setPosition(entity, position);
    syncOccupancyForEntity(entity, activeWorld);
  }

  function clearPositionAndSyncOccupancy(
    entity: number,
    activeWorld: CivWorld = world,
  ): void {
    worldOccupancy.release(entity);
    activeWorld.removeComponent(entity, 'position');
  }

  function syncSpawnedEntityOccupancy(entity: number): void {
    if (!isBootstrappingScenario()) {
      syncOccupancyForEntity(entity);
      return;
    }
    try {
      syncOccupancyForEntity(entity);
    } catch (err) {
      // Fresh-scenario validation owns the user-facing error for invalid
      // fixture spawns; suppress so the seed-named throw stays primary.
      // V4-15: log so unexpected errors surface in dev instead of being
      // silently swallowed under the bootstrap-mode umbrella.
      if (typeof console !== 'undefined') {
        console.warn('syncSpawnedEntityOccupancy suppressed during bootstrap', err);
      }
    }
  }

  function moveUnitOneSubgridStep(
    id: number,
    target: Position,
    activeWorld: CivWorld = world,
    stepUnits: number = UNIT_SUBGRID_STEP_PER_TICK,
  ): Position | null {
    const transform = getUnitTransform(id, activeWorld);
    if (!transform) return null;

    const targetTransform = getUnitTargetTransformForCell(id, target);
    const nextTransform = clampUnitTransformToMap(
      stepUnitTransformToward(transform, targetTransform, stepUnits),
    );
    transform.fineX = nextTransform.fineX;
    transform.fineY = nextTransform.fineY;

    const nextGridPosition = gridPositionFromUnitTransform(nextTransform);
    const currentGridPosition = activeWorld.getComponent<Position>(id, 'position');
    if (
      !currentGridPosition
      || currentGridPosition.x !== nextGridPosition.x
      || currentGridPosition.y !== nextGridPosition.y
    ) {
      setPositionAndSyncOccupancy(id, nextGridPosition, activeWorld);
    }

    return nextGridPosition;
  }

  function isUnitAtTarget(
    id: number,
    target: Position,
    activeWorld: CivWorld = world,
  ): boolean {
    const transform = getUnitTransform(id, activeWorld);
    if (!transform) {
      const position = activeWorld.getComponent<Position>(id, 'position');
      return position ? isAtTarget(position, target) : false;
    }

    return isUnitTransformAtTarget(transform, id, target);
  }

  function resolveArrivalRedirect(unitId: number, arrivalCell: Position): Position | null {
    // No redirect when the unit holds a slot at the arrival cell.
    if (worldOccupancy.getUnitSlotOffset(unitId) !== null) {
      return null;
    }
    const freeCell = worldOccupancy.findNearestFreeUnitCell(unitId, arrivalCell);
    if (!freeCell) {
      return null;
    }
    if (freeCell.x === arrivalCell.x && freeCell.y === arrivalCell.y) {
      // The arrival cell itself reports free for this entity (the entity is
      // currently in overflow there). Letting movement clear the command and
      // calling `syncOccupancyForEntity` re-binds the unit to a real slot in
      // the same cell — no redirect needed.
      return null;
    }
    return freeCell;
  }

  function rebuildWorldOccupancyFromWorld(): void {
    worldOccupancy.reset();

    const blockedTerrainCells: Position[] = [];
    for (let y = 0; y < mapHeight; y += 1) {
      for (let x = 0; x < mapWidth; x += 1) {
        const tile = tiles[y]?.[x];
        const terrain = tile === undefined ? null : world.getComponent<TerrainComponent>(tile, 'terrain');
        if (!terrain || (terrain.kind !== 'water' && terrain.kind !== 'forest')) {
          continue;
        }
        blockedTerrainCells.push({ x, y });
      }
    }
    worldOccupancy.blockTerrain(blockedTerrainCells);

    for (const entity of world.query('position', 'building')) {
      syncOccupancyForEntity(entity);
    }
    for (const entity of world.query('position', 'resource')) {
      syncOccupancyForEntity(entity);
    }
    for (const entity of world.query('position', 'unit')) {
      syncOccupancyForEntity(entity);
    }
  }

  return {
    getUnitTransform,
    syncUnitTransformToPosition,
    moveUnitOneSubgridStep,
    isUnitAtTarget,
    resolveArrivalRedirect,
    syncOccupancyForEntity,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncSpawnedEntityOccupancy,
    rebuildWorldOccupancyFromWorld,
  };
}
