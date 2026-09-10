// Where the AI puts a building. Split out of trainingMarketOps.ts (2026-09-08)
// for the 500-line budget, and because the site search is its own subject: it
// is the one place the AI decides a footprint, and the rules it applies are the
// three that stop the AI from stranding itself.
//
//   1. Do not build where you cannot GET (register entry 2026-09-06): the site
//      has to satisfy the same reachability rule the placement validator
//      applies, or the AI proposes an unreachable site, is refused, and
//      proposes the same one again — measured at 705 refusals over the
//      45,000-tick coverage lab. `isPlacementBlocked` with `builderIds` is that
//      rule, shared with the validator.
//   2. Do not SEAL ground (placementSearch.ts): a footprint that cuts the free
//      ground beside it in two is refused, at every radius, with no fallback —
//      see the header there for the measurement that removed the fallback.
//   3. Do not forget what you asked for a moment ago. One AI decision can push
//      a watch tower and a next build, both judged against the current world,
//      and an intention becomes a foundation only when its handler runs next
//      tick. So every pending `building.placeConfirm` footprint counts as
//      blocked ground here — for the footprint test AND for the seal guard —
//      whichever owner asked for it: two AI seats decide on the same ticks.
//
// The seal guard walks the SAME predicate the pathfinder and the walk-order
// flood use, `isCellPassableForUnit`, asked about a probe that is no unit at
// all: it then takes the land domain and admits no gate to anyone, and it is
// memoised per structural revision (spawnPassabilityMemo.ts). Before this the
// guard had its own three-way merge of terrain, building and resource claims,
// two un-memoised `getCellStatus` merges per flooded cell — a second definition
// of "walkable" that the movement could one day disagree with.
//
// One consequence of sharing that predicate: a farm is walkable ground
// (passableStructures.ts, 2026-09-08), so the guard sees a farm cell as OPEN.
// A farm can neither seal a corridor nor be counted as sealing one, while
// `isPlacementBlocked` still refuses to build on it. An independent flood that
// counts farm footprints as walls (`staticGridOf`) is therefore stricter than
// this guard, and `scripts/mapConnectivity.mjs` prints both views side by side.

import type { Position } from 'civ-engine';

import type { BuildableBuildingType, BuildingType } from '../types';
import type { BridgeState } from './bridgeState';
import { buildingFootprint } from './pureHelpers';
import {
  createPlacementSearchStats,
  findPlacementAnchorNear,
  type PlacementSearchStats,
} from './placementSearch';

/** Entity ids are never negative, so this id has no `unit` component:
 *  `isCellPassableForUnit` answers for a land walker that owns no gate. */
export const LAND_PROBE_UNIT_ID = -1;

export interface AiSitePlacementDeps {
  state: BridgeState;
  mapWidth: number;
  mapHeight: number;
  isPlacementBlocked: (
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: BuildingType,
    builderIds?: readonly number[],
  ) => boolean;
  isCellPassableForUnit: (unitId: number, x: number, y: number) => boolean;
}

export interface AiSitePlacement {
  findBuildPlacementNear(
    origin: Position,
    buildingType: BuildableBuildingType,
    builderIds?: readonly number[],
  ): Position | null;
  /** The search's own counters, surfaced on the debug snapshot. */
  readonly stats: PlacementSearchStats;
}

/**
 * Instrument seam for `scripts/mapConnectivity.mjs`, which measures the shipped
 * search against the pre-2026-09-08 one — the unguarded fallback restored, the
 * pending mask off — in ONE process, so the tree cannot move between the two
 * arms of the comparison. Production code never writes it; a recording made
 * with it set cannot be replayed faithfully, so do not record under it.
 */
export const placementSearchInstrument: {
  /** Replaces the pure search when set. */
  search: typeof findPlacementAnchorNear | null;
  /** Whether pending `building.placeConfirm` footprints count as blocked. */
  maskPending: boolean;
} = { search: null, maskPending: true };

export function createAiSitePlacement(deps: AiSitePlacementDeps): AiSitePlacement {
  const { state, mapWidth, mapHeight, isPlacementBlocked, isCellPassableForUnit } = deps;
  const stats = createPlacementSearchStats();

  /** The cells every pending `building.placeConfirm` will occupy next tick, as
   *  a map-sized mask; null when nothing is pending, which is the common case. */
  function pendingFootprintMask(): Uint8Array | null {
    if (!placementSearchInstrument.maskPending) return null;
    let mask: Uint8Array | null = null;
    for (const command of state.pendingCommands) {
      if (command.type !== 'building.placeConfirm') continue;
      const { buildingType, position } = command.data;
      const footprint = buildingFootprint(buildingType);
      mask ??= new Uint8Array(mapWidth * mapHeight);
      for (let y = position.y; y < position.y + footprint.height; y += 1) {
        for (let x = position.x; x < position.x + footprint.width; x += 1) {
          if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) mask[y * mapWidth + x] = 1;
        }
      }
    }
    return mask;
  }

  function findBuildPlacementNear(
    origin: Position,
    buildingType: BuildableBuildingType,
    builderIds?: readonly number[],
  ): Position | null {
    // A gate or wall is exempt from the seal guard: sealing ground is the whole
    // point of building one. (The AI builds neither today; the exemption is
    // kept so the day it does, the rule is already right.)
    const sealsDeliberately = buildingType === 'palisade-wall'
      || buildingType === 'stone-wall'
      || buildingType === 'palisade-gate'
      || buildingType === 'stone-gate';
    const pending = pendingFootprintMask();
    const pendingAt = (x: number, y: number): boolean =>
      pending !== null && pending[y * mapWidth + x] === 1;
    const isBlocked = (x: number, y: number, width: number, height: number): boolean => {
      if (isPlacementBlocked(x, y, width, height, undefined, builderIds)) return true;
      if (pending === null) return false;
      for (let cellY = y; cellY < y + height; cellY += 1) {
        for (let cellX = x; cellX < x + width; cellX += 1) {
          if (pendingAt(cellX, cellY)) return true;
        }
      }
      return false;
    };
    const isFree = (x: number, y: number): boolean =>
      isCellPassableForUnit(LAND_PROBE_UNIT_ID, x, y) && !pendingAt(x, y);
    const search = placementSearchInstrument.search ?? findPlacementAnchorNear;
    return search(
      origin,
      buildingFootprint(buildingType),
      mapWidth,
      mapHeight,
      isBlocked,
      { isFree: sealsDeliberately ? undefined : isFree, stats },
    );
  }

  return { findBuildPlacementNear, stats };
}
