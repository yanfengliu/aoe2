// Cell passability + occupancy queries. Wraps `worldOccupancy` and the
// terrain tile grid so the rest of the bridge doesn't need to know which
// subsystem owns the answer. Pure read-only.

import type { Position, World } from 'civ-engine';
import type {
  ActionType,
  BuildingComponent,
  BuildingType,
  ResourceComponent,
  TerrainComponent,
} from '../types';
import {
  buildingFootprint,
  type GameCommands,
  type GameEvents,
  type GameWorld,
} from './pureHelpers';
import { buildingGarrisonCapacity } from '../prototypeBuildingRules';
import type { WildlifeState } from './systems/systemTypes';

type CivWorld = World<GameEvents, GameCommands>;

interface ConstructionStateLike {
  width: number;
  height: number;
}

interface WorldOccupancyLike {
  isCellBlockedByBuilding(x: number, y: number): boolean;
  isCellBlockedByResource(x: number, y: number, ignoredResourceId?: number | null): boolean;
  isCellPassableForSpawn(x: number, y: number): boolean;
  isCellPassableForWildlife(resourceId: number, x: number, y: number): boolean;
  isPlacementBlocked(x: number, y: number, width: number, height: number): boolean;
}

export interface CellPassabilityDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  worldOccupancy: WorldOccupancyLike;
  tiles: number[][];
  constructionStates: Map<number, ConstructionStateLike>;
  wildlifeStates: Map<number, WildlifeState>;
  garrisonedByBuilding: Map<number, number[]>;
  garrisonedUnitToBuilding: Map<number, number>;
}

export interface CellPassability {
  buildingOccupiesCell(
    buildingId: number,
    x: number,
    y: number,
    activeWorld?: CivWorld,
  ): boolean;
  isTerrainPassableForUnit(x: number, y: number, activeWorld?: CivWorld): boolean;
  isCellBlockedByBuilding(x: number, y: number): boolean;
  isCellBlockedByResource(
    x: number,
    y: number,
    ignoredResourceId?: number | null,
  ): boolean;
  isCellPassableForSpawn(x: number, y: number): boolean;
  isCellPassableForUnit(
    unitId: number,
    x: number,
    y: number,
    activeWorld?: CivWorld,
  ): boolean;
  isCellPassableForWildlife(resourceId: number, x: number, y: number): boolean;
  isHarvestableResource(resourceId: number, resource: ResourceComponent): boolean;
  isPlacementBlocked(x: number, y: number, width: number, height: number): boolean;
  isGarrisonedUnit(id: number): boolean;
  getActionOptions(
    owner: number,
    buildingType: BuildingType,
    buildingId: number,
  ): ActionType[];
}

export function createCellPassability(deps: CellPassabilityDeps): CellPassability {
  const {
    world,
    humanPlayerId,
    mapWidth,
    mapHeight,
    worldOccupancy,
    tiles,
    constructionStates,
    wildlifeStates,
    garrisonedByBuilding,
    garrisonedUnitToBuilding,
  } = deps;

  function buildingOccupiesCell(
    buildingId: number,
    x: number,
    y: number,
    activeWorld: CivWorld = world,
  ): boolean {
    const position = activeWorld.getComponent<Position>(buildingId, 'position');
    const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
    if (!position || !building) return false;

    const construction = constructionStates.get(buildingId);
    const footprint = construction ?? {
      width: buildingFootprint(building.buildingType).width,
      height: buildingFootprint(building.buildingType).height,
    };

    return (
      x >= position.x
      && x < position.x + footprint.width
      && y >= position.y
      && y < position.y + footprint.height
    );
  }

  function isTerrainPassableForUnit(
    x: number,
    y: number,
    activeWorld: CivWorld = world,
  ): boolean {
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) return false;
    const tile = tiles[y]?.[x];
    const terrain = tile === undefined ? null : activeWorld.getComponent<TerrainComponent>(tile, 'terrain');
    return terrain ? terrain.kind !== 'water' && terrain.kind !== 'forest' : false;
  }

  function isCellBlockedByBuilding(x: number, y: number): boolean {
    return worldOccupancy.isCellBlockedByBuilding(x, y);
  }

  function isCellBlockedByResource(
    x: number,
    y: number,
    ignoredResourceId: number | null = null,
  ): boolean {
    return worldOccupancy.isCellBlockedByResource(x, y, ignoredResourceId);
  }

  function isCellPassableForSpawn(x: number, y: number): boolean {
    return worldOccupancy.isCellPassableForSpawn(x, y);
  }

  function isCellPassableForUnit(
    unitId: number,
    x: number,
    y: number,
    activeWorld: CivWorld = world,
  ): boolean {
    void unitId;
    void activeWorld;
    return isCellPassableForSpawn(x, y);
  }

  function isCellPassableForWildlife(
    resourceId: number,
    x: number,
    y: number,
  ): boolean {
    return worldOccupancy.isCellPassableForWildlife(resourceId, x, y);
  }

  function isHarvestableResource(
    resourceId: number,
    resource: ResourceComponent,
  ): boolean {
    if (resource.amount <= 0) return false;
    if (resource.resourceType === 'relic') return false;

    const wildlife = wildlifeStates.get(resourceId);
    if (!wildlife) return true;

    return !wildlife.isAlive && resource.resourceType !== 'wolf';
  }

  function isPlacementBlocked(
    x: number,
    y: number,
    width: number,
    height: number,
  ): boolean {
    return worldOccupancy.isPlacementBlocked(x, y, width, height);
  }

  function isGarrisonedUnit(id: number): boolean {
    return garrisonedUnitToBuilding.has(id);
  }

  function getActionOptions(
    owner: number,
    buildingType: BuildingType,
    buildingId: number,
  ): ActionType[] {
    if (
      owner === humanPlayerId
      && buildingGarrisonCapacity(buildingType) > 0
      && (garrisonedByBuilding.get(buildingId)?.length ?? 0) > 0
    ) {
      return ['ungarrison'];
    }
    return [];
  }

  return {
    buildingOccupiesCell,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    isCellPassableForSpawn,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    isPlacementBlocked,
    isGarrisonedUnit,
    getActionOptions,
  };
}
