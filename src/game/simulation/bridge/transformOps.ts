// Unit-transform + occupancy bookkeeping. The bridge owns
// `worldOccupancy`, the unit-transform components, and the world; these
// helpers wire them together so movement systems, scenario seeding, and
// the destroy/garrison paths share one occupancy-sync definition.

import type { Position, World } from 'civ-engine';
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
  type GameCommands,
  type GameEvents,
  type GameWorld,
} from './pureHelpers';
import { UNIT_SUBGRID_STEP_PER_TICK } from './pureHelpers';

type CivWorld = World<GameEvents, GameCommands>;

interface ConstructionStateLike {
  width: number;
  height: number;
}

interface WorldOccupancyLike {
  release(entity: number): void;
  syncBuilding(entity: number, position: Position, footprint: { width: number; height: number }): void;
  syncResource(entity: number, position: Position): void;
  syncUnit(entity: number, position: Position): void;
  reset(): void;
  blockTerrain(cells: Position[]): void;
}

export interface TransformOpsDeps {
  world: GameWorld;
  mapWidth: number;
  mapHeight: number;
  worldOccupancy: WorldOccupancyLike;
  tiles: number[][];
  constructionStates: Map<number, ConstructionStateLike>;
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
    constructionStates,
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

    const targetTransform = getUnitTargetTransformForCell(id, position);
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
      const construction = constructionStates.get(entity);
      const footprint = construction ?? buildingFootprint(building.buildingType);
      worldOccupancy.syncBuilding(entity, position, footprint);
      return;
    }

    if (activeWorld.getComponent<ResourceComponent>(entity, 'resource')) {
      worldOccupancy.syncResource(entity, position);
      return;
    }

    if (activeWorld.getComponent<UnitComponent>(entity, 'unit')) {
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
    } catch {
      // Fresh-scenario validation owns the user-facing error for invalid
      // fixture spawns; suppress so the seed-named throw stays primary.
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
    syncOccupancyForEntity,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncSpawnedEntityOccupancy,
    rebuildWorldOccupancyFromWorld,
  };
}
