// Cell passability + occupancy queries. Wraps `worldOccupancy` and the
// terrain tile grid so the rest of the bridge doesn't need to know which
// subsystem owns the answer. Pure read-only.

import type { OccupancyCellStatus, Position } from 'civ-engine';
import type {
  ActionType,
  BuildingComponent,
  BuildingType,
  ResourceComponent,
  TerrainComponent,
} from '../types';
import {
  buildingFootprint,
  type GameWorld,
} from './pureHelpers';
import { buildingGarrisonCapacity } from '../prototypeBuildingRules';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  constructionStatesCodec,
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  wildlifeStatesCodec,
} from './bridgeStateSerialize';
type CivWorld = GameWorld;

interface WorldOccupancyLike {
  isCellBlockedByBuilding(x: number, y: number): boolean;
  isCellBlockedByResource(x: number, y: number, ignoredResourceId?: number | null): boolean;
  isCellPassableForSpawn(x: number, y: number): boolean;
  isCellPassableForWildlife(resourceId: number, x: number, y: number): boolean;
  isPlacementBlocked(x: number, y: number, width: number, height: number): boolean;
  getCellStatus(x: number, y: number, ignoredEntityId?: number | null): OccupancyCellStatus;
}

// agent-affordances A3: structured "why is this placement blocked"
// report. The validator composes it into the placement_blocked message;
// cause strings are agent/HUD-facing ('water', 'a town-center
// (building)', 'the map edge', ...).
export interface PlacementBlockReport {
  firstBlockedCell: Position;
  cause: string;
  blockedCellCount: number;
  totalCellCount: number;
}

export interface CellPassabilityDeps {
  world: GameWorld;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  worldOccupancy: WorldOccupancyLike;
  tiles: number[][];
  // Phase 2D: all slots cellPassability needs (constructionStates,
  // garrisonedByBuilding, garrisonedUnitToBuilding, wildlifeStates) are
  // on the accessor now; the BridgeState dep is no longer needed.
  // Phase 2D: garrisonedByBuilding migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
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
  // agent-affordances A3: name what blocks a footprint (null = open).
  describePlacementBlockers(
    x: number,
    y: number,
    width: number,
    height: number,
  ): PlacementBlockReport | null;
  // agent-affordances C: deterministic outward ring scan for open
  // footprint anchors. Only anchors whose EVERY footprint cell passes
  // `isCellVisible` are returned, so fog hides nothing (callers curry
  // the owner into the probe). Used by the placement_blocked rejection
  // suggestion and the agent snapshot's placementHints.
  findOpenPlacementAnchors(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    opts: {
      max: number;
      maxRadius?: number;
      isCellVisible: (x: number, y: number) => boolean;
    },
  ): Position[];
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
    accessor,
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

    const construction = accessor.get(constructionStatesCodec).get(buildingId);
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

    const wildlife = accessor.get(wildlifeStatesCodec).get(resourceId);
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

  // Mirrors worldOccupancy.isPlacementBlocked's per-cell predicate:
  // whole-cell blockers OR unit crowding both veto placement.
  function isCellBlockedForPlacement(status: OccupancyCellStatus): boolean {
    return status.blockedBy.length > 0 || status.crowdedBy.some((claim) => claim.kind === 'unit');
  }

  function blockerCauseAt(status: OccupancyCellStatus, x: number, y: number): string {
    const byKind = (kind: string) => status.blockedBy.find((claim) => claim.kind === kind);
    if (byKind('bounds')) return 'the map edge';
    if (byKind('terrain')) {
      const tile = tiles[y]?.[x];
      const terrain = tile === undefined
        ? null
        : world.getComponent<TerrainComponent>(tile, 'terrain');
      if (terrain?.kind === 'water') return 'water';
      if (terrain?.kind === 'forest') return 'forest';
      return 'impassable terrain';
    }
    const buildingClaim = byKind('building');
    if (buildingClaim) {
      const building = buildingClaim.entity === null
        ? null
        : world.getComponent<BuildingComponent>(buildingClaim.entity, 'building');
      return building ? `a ${building.buildingType} (building)` : 'a building';
    }
    const resourceClaim = byKind('resource');
    if (resourceClaim) {
      const resource = resourceClaim.entity === null
        ? null
        : world.getComponent<ResourceComponent>(resourceClaim.entity, 'resource');
      return resource ? `a ${resource.resourceType} (resource)` : 'a resource';
    }
    if (status.blockedBy.length > 0) return 'an obstacle';
    return 'a unit standing there';
  }

  function describePlacementBlockers(
    x: number,
    y: number,
    width: number,
    height: number,
  ): PlacementBlockReport | null {
    let first: PlacementBlockReport | null = null;
    let blockedCellCount = 0;
    for (let cellY = y; cellY < y + height; cellY += 1) {
      for (let cellX = x; cellX < x + width; cellX += 1) {
        const status = worldOccupancy.getCellStatus(cellX, cellY);
        if (!isCellBlockedForPlacement(status)) continue;
        blockedCellCount += 1;
        if (!first) {
          first = {
            firstBlockedCell: { x: cellX, y: cellY },
            cause: blockerCauseAt(status, cellX, cellY),
            blockedCellCount: 0,
            totalCellCount: width * height,
          };
        }
      }
    }
    if (!first) return null;
    return { ...first, blockedCellCount };
  }

  function findOpenPlacementAnchors(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    opts: {
      max: number;
      maxRadius?: number;
      isCellVisible: (x: number, y: number) => boolean;
    },
  ): Position[] {
    const out: Position[] = [];
    const maxRadius = opts.maxRadius ?? 12;
    const consider = (x: number, y: number): void => {
      if (out.length >= opts.max) return;
      if (x < 0 || y < 0 || x + width > mapWidth || y + height > mapHeight) return;
      for (let cellY = y; cellY < y + height; cellY += 1) {
        for (let cellX = x; cellX < x + width; cellX += 1) {
          if (!opts.isCellVisible(cellX, cellY)) return;
        }
      }
      if (worldOccupancy.isPlacementBlocked(x, y, width, height)) return;
      out.push({ x, y });
    };
    // Chebyshev rings outward from the center, row-major within each
    // ring — pure function of (occupancy, visibility, center), so runs
    // are deterministic and replay-stable.
    for (let radius = 0; radius <= maxRadius && out.length < opts.max; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          consider(centerX + dx, centerY + dy);
        }
      }
    }
    return out;
  }

  function isGarrisonedUnit(id: number): boolean {
    return accessor.get(garrisonedUnitToBuildingCodec).has(id);
  }

  function getActionOptions(
    owner: number,
    buildingType: BuildingType,
    buildingId: number,
  ): ActionType[] {
    if (
      owner === humanPlayerId
      && buildingGarrisonCapacity(buildingType) > 0
      && (accessor.get(garrisonedByBuildingCodec).get(buildingId)?.length ?? 0) > 0
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
    describePlacementBlockers,
    findOpenPlacementAnchors,
    isGarrisonedUnit,
    getActionOptions,
  };
}
