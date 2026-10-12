// The footprint half of a placement verdict: whether the cells a building would
// stand on — and, for a Dock, the water it must touch — let it stand there.
// Whether a builder can walk to it is folded on top in builderReachability.ts,
// and what the placing player knows in placementKnowledge.ts.
//
// Split out of cellPassability.ts (work 122, 2026-10-12) when the rule gained a
// VIEW: which cells it may read, and what it ignores. Three views exist:
//
//  * none — the true map, the verdict every AI seat and every system reads.
//    This path is the code that stood in cellPassability.ts before, unchanged.
//  * `isCellKnown` — the placing player's view (spec §12.1): an unexplored
//    cell neither blocks the footprint nor meets a requirement, because what
//    lies under the fog must not decide the verdict (Definitive Edition update
//    44725: a blueprint over unexplored terrain no longer reveals what occupies
//    it, and can still be placed). So whatever the fog hides under a footprint
//    is found when building starts, and the water a Dock needs beside it has
//    to be water the player has seen. Cells off the map are never unexplored:
//    the map edge is known to everyone, so it still refuses.
//  * `ignoredEntityId` — the start check
//    (update 46295, foundationStart.ts): the true map with the foundation's own
//    claims left out, so a builder arriving at it can see whether anything
//    else stands on its ground.
//
// `tests/simulation/placementFootprintViews.test.ts` holds the empty view to the
// unviewed path on every anchor of the boot map, so the two cannot drift.

import type { OccupancyCellStatus } from 'civ-engine';

import type { BuildingType, TerrainKind } from '../types';
import {
  requiresShorePlacement,
  requiresWaterPlacement,
  sitsOnWater,
  touchesWater,
} from '../shorePlacement';

/** Which cells a placement verdict may read, and what it leaves out. */
export interface PlacementCellView {
  /** Present for a player's view: false for an in-map cell the player has not
   *  explored. Never asked about a cell off the map. */
  isCellKnown?: (x: number, y: number) => boolean;
  /** An entity whose own claims do not count: the foundation being started. */
  ignoredEntityId?: number;
}

export interface PlacementFootprintDeps {
  mapWidth: number;
  mapHeight: number;
  getCellStatus(x: number, y: number, ignoredEntityId?: number | null): OccupancyCellStatus;
  terrainKindAt(x: number, y: number): TerrainKind | null;
  /** The occupancy's own whole-footprint test, the unviewed path's land rule. */
  isFootprintOccupied(x: number, y: number, width: number, height: number): boolean;
}

export interface PlacementFootprint {
  isFootprintBlocked(
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: BuildingType,
    view?: PlacementCellView,
  ): boolean;
}

export function createPlacementFootprint(deps: PlacementFootprintDeps): PlacementFootprint {
  const { mapWidth, mapHeight, getCellStatus, terrainKindAt, isFootprintOccupied } = deps;
  const inMap = (x: number, y: number): boolean => x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;

  function isFootprintBlockedOnTheMap(
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: BuildingType,
  ): boolean {
    // A Fish Trap goes ON the water, so the occupancy grid's static terrain
    // blocker for a water cell is exactly what it must be allowed past — while
    // every OTHER claim on that cell (a ship, another trap) still refuses it.
    if (buildingType && requiresWaterPlacement(buildingType)) {
      if (!sitsOnWater(x, y, width, height, terrainKindAt)) return true;
      for (let cellY = y; cellY < y + height; cellY += 1) {
        for (let cellX = x; cellX < x + width; cellX += 1) {
          const status = getCellStatus(cellX, cellY);
          if (status.blockedBy.some((claim) => claim.kind !== 'terrain')) return true;
          if (status.crowdedBy.some((claim) => claim.kind === 'unit')) return true;
        }
      }
      return false;
    }
    if (isFootprintOccupied(x, y, width, height)) return true;
    // M5 naval: a Dock must stand on land AND touch water. Checked here rather
    // than at the call sites so the placement PREVIEW and the confirm share
    // one answer — a preview that says valid and a confirm that refuses is
    // the worst possible pairing.
    if (buildingType && requiresShorePlacement(buildingType)) {
      return !touchesWater(x, y, width, height, terrainKindAt);
    }
    return false;
  }

  function isFootprintBlockedInView(
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType: BuildingType | undefined,
    view: PlacementCellView,
  ): boolean {
    const { isCellKnown } = view;
    // Off the map is known to everyone; only an in-map cell can be unexplored.
    const reads = (cellX: number, cellY: number): boolean => (
      isCellKnown === undefined || !inMap(cellX, cellY) || isCellKnown(cellX, cellY)
    );
    const ignored = view.ignoredEntityId ?? null;
    const unitStands = (status: OccupancyCellStatus): boolean => (
      status.crowdedBy.some((claim) => claim.kind === 'unit')
    );
    if (buildingType && requiresWaterPlacement(buildingType)) {
      for (let cellY = y; cellY < y + height; cellY += 1) {
        for (let cellX = x; cellX < x + width; cellX += 1) {
          if (!reads(cellX, cellY)) continue;
          if (terrainKindAt(cellX, cellY) !== 'water') return true;
          const status = getCellStatus(cellX, cellY, ignored);
          if (status.blockedBy.some((claim) => claim.kind !== 'terrain')) return true;
          if (unitStands(status)) return true;
        }
      }
      return false;
    }
    for (let cellY = y; cellY < y + height; cellY += 1) {
      for (let cellX = x; cellX < x + width; cellX += 1) {
        if (!reads(cellX, cellY)) continue;
        const status = getCellStatus(cellX, cellY, ignored);
        if (status.blockedBy.length > 0 || unitStands(status)) return true;
      }
    }
    if (buildingType && requiresShorePlacement(buildingType)) {
      // The land half is the claims above (water and forest carry terrain
      // claims). The water half: some cell of the ring around the footprint,
      // diagonals counted, is water the view can read. Unexplored water does
      // not count: beside the footprint the fog hides a requirement, not an
      // obstacle, so the ghost waits for water the player has seen.
      for (let ringY = y - 1; ringY <= y + height; ringY += 1) {
        for (let ringX = x - 1; ringX <= x + width; ringX += 1) {
          const inside = ringX >= x && ringX < x + width && ringY >= y && ringY < y + height;
          if (inside || !inMap(ringX, ringY)) continue;
          if (reads(ringX, ringY) && terrainKindAt(ringX, ringY) === 'water') return false;
        }
      }
      return true;
    }
    return false;
  }

  return {
    isFootprintBlocked(x, y, width, height, buildingType, view) {
      return view === undefined
        ? isFootprintBlockedOnTheMap(x, y, width, height, buildingType)
        : isFootprintBlockedInView(x, y, width, height, buildingType, view);
    },
  };
}
