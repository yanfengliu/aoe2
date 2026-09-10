// What blocks a building footprint, in words.
//
// agent-affordances A3: the placement validator composes this into the
// placement_blocked message and the HUD shows it, so the cause strings are
// agent- and player-facing ('water', 'a town-center (building)', 'the map
// edge', ...). A farm reads as 'a farm (building)' even though its claim kind
// is 'farm' rather than 'building' (passableStructures.ts): the player asked
// why the ghost is red, and the answer is the farm, not the bookkeeping.
//
// Extracted from cellPassability.ts on 2026-09-08 when that file reached the
// 500-line budget; pure read-only, like the file it came from.

import type { OccupancyCellStatus, Position } from 'civ-engine';
import type {
  BuildingComponent,
  ResourceComponent,
  TerrainComponent,
} from '../types';
import type { GameWorld } from './pureHelpers';

export interface PlacementBlockReport {
  firstBlockedCell: Position;
  cause: string;
  blockedCellCount: number;
  totalCellCount: number;
}

export interface PlacementBlockReportDeps {
  world: GameWorld;
  tiles: number[][];
  getCellStatus(x: number, y: number): OccupancyCellStatus;
}

// Mirrors worldOccupancy.isPlacementBlocked's per-cell predicate:
// whole-cell blockers OR unit crowding both veto placement.
export function isCellBlockedForPlacement(status: OccupancyCellStatus): boolean {
  return status.blockedBy.length > 0 || status.crowdedBy.some((claim) => claim.kind === 'unit');
}

export function createPlacementBlockReporter(deps: PlacementBlockReportDeps): {
  describePlacementBlockers(x: number, y: number, width: number, height: number): PlacementBlockReport | null;
} {
  const { world, tiles, getCellStatus } = deps;

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
    // A 'farm' claim is a building for this purpose: it is the thing standing
    // on the cell, and its own `buildingType` names it.
    const buildingClaim = byKind('building') ?? byKind('farm');
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
        const status = getCellStatus(cellX, cellY);
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

  return { describePlacementBlockers };
}
