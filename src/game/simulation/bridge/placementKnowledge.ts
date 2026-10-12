// What the player placing a building knows about the ground (work 122; defect
// register 2026-09-23; spec §12.1).
//
// The defect: the placement verdict read the true map everywhere, so the ghost
// went red over unexplored water, forest and enemy buildings and green over
// open ground, and sweeping it across black ground mapped them. Definitive
// Edition's notes give the rule this module applies to the player's placement:
//
//  * update 44725 (2021-01-25): a blueprint over unexplored terrain no longer
//    reveals whether a building or unit occupies it; it can still be placed,
//    and it is not buildable if the ground is obstructed;
//  * hotfix 45185 (2021-02-11): a foundation may be placed over unexplored
//    ground if part of it is explored, and never on ground wholly unexplored;
//  * update 46295 (2021-03-24): a foundation over an obstacle the fog hid is
//    cancelled when villagers try to begin construction (foundationStart.ts).
//
// So for the player the verdict reads only explored ground — explored by the
// player or by anyone it shares vision with, the ground the frame does not draw
// black. Under the footprint an unexplored cell blocks nothing: whatever it
// hides is found when building starts. Beside the footprint it meets no
// requirement: a Dock needs water the player has seen (placementFootprint.ts).
// A footprint with no explored cell is refused. Reachability is asked over
// explored ground only: a builder must be able to walk to a cell beside the
// footprint without crossing the fog. Taking the fog as passable would let a
// hidden lake or wall strand a paid foundation (the register entry of
// 2026-09-06), and taking the true map would let the ghost reveal whether the
// fog hides a way through. Every one of these readings leaves the verdict
// independent of what any unexplored cell holds, which is the property
// `tests/simulation/placementUnexplored.test.ts` holds.
//
// Who places this way: the human seat, unless an AI drives it (the AI-vs-AI
// corpus forces one onto it). An AI seat's site search and commands read the
// true map, unchanged: the notes describe the player's blueprint, and none asks
// the AI to change. The rule is chosen by the owner of the builders the call
// names, so every caller of the three placement answers — the preview, the
// validator, the handler's re-check, the suggestion and the agent's hints —
// gets the right one without being told.

import type { Position, VisibilityMap } from 'civ-engine';

import type { UnitComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { aiStatesCodec } from './bridgeStateSerialize';
import type {
  PlacementOccupancyOps,
  PlacementReachabilityOps,
  ReachabilityBlockReport,
} from './builderReachability';
import type { PlacementCellView } from './placementFootprint';
import { readSightOwners } from './humanSight';
import type { GameWorld } from './pureHelpers';
import { unitDomain } from '../unitDomain';

/** A placement report taken through the player's view. */
export interface KnowledgeBlockReport extends ReachabilityBlockReport {
  /** No cell of the footprint has been explored (hotfix 45185). */
  unexplored?: boolean;
}

/** The occupancy answers, able to read through a view. */
export interface ViewablePlacementOccupancy extends PlacementOccupancyOps {
  isPlacementBlocked(
    x: number,
    y: number,
    width: number,
    height: number,
    buildingType?: import('../types').BuildingType,
    view?: PlacementCellView,
  ): boolean;
  describePlacementBlockers(
    x: number,
    y: number,
    width: number,
    height: number,
    view?: PlacementCellView,
  ): ReachabilityBlockReport | null;
}

export interface PlacementKnowledgeDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  visibility: Pick<VisibilityMap, 'isExplored'>;
  humanPlayerId: number;
  mapWidth: number;
  mapHeight: number;
  occupancy: ViewablePlacementOccupancy;
  /** The mover's own passability predicate, as builderReachability asks it. */
  isCellPassableForUnit: (unitId: number, x: number, y: number, activeWorld: GameWorld) => boolean;
  /** The mover's own approach ring: one definition of "beside the footprint". */
  getApproachCellsForFootprint: (anchor: Position, width: number, height: number, range?: number) => Position[];
  /** The true map's answer (builderReachability's labelling, kept per
   *  structural revision). A route over explored ground is a route on the
   *  true map, so where the true map has none the flood is skipped: the same
   *  verdict, without walking a whole explored island every frame. */
  reachesOnTheMap?: (builderIds: readonly number[], x: number, y: number, width: number, height: number) => boolean;
}

/** Whether `owner` places by what it has explored rather than by the true map. */
export function placesByKnowledge(
  accessor: BridgeStateAccessor,
  humanPlayerId: number,
  owner: number,
): boolean {
  return owner === humanPlayerId && !accessor.get(aiStatesCodec).has(owner);
}

export function withPlayerKnowledge(
  truth: PlacementReachabilityOps,
  deps: PlacementKnowledgeDeps,
): PlacementReachabilityOps {
  const { world, accessor, visibility, humanPlayerId, mapWidth, mapHeight, occupancy } = deps;
  const inMap = (x: number, y: number): boolean => x >= 0 && x < mapWidth && y >= 0 && y < mapHeight;

  /** The owner whose knowledge decides, or null for the true map. */
  function knowingOwner(builderIds: readonly number[] | undefined): number | null {
    const first = builderIds?.[0];
    if (first === undefined) return null;
    const unit = world.getComponent<UnitComponent>(first, 'unit');
    if (!unit) return null;
    return placesByKnowledge(accessor, humanPlayerId, unit.owner) ? unit.owner : null;
  }

  /** Explored by the owner or anyone whose vision it shares: not drawn black. */
  function knownCells(owner: number): (x: number, y: number) => boolean {
    const sight = readSightOwners(accessor, owner);
    return (x, y) => sight.some((viewer) => visibility.isExplored(viewer, x, y));
  }

  function countKnown(
    x: number,
    y: number,
    width: number,
    height: number,
    isCellKnown: (x: number, y: number) => boolean,
  ): number {
    let known = 0;
    for (let cellY = y; cellY < y + height; cellY += 1) {
      for (let cellX = x; cellX < x + width; cellX += 1) {
        if (inMap(cellX, cellY) && isCellKnown(cellX, cellY)) known += 1;
      }
    }
    return known;
  }

  /** Whether some builder can walk to a cell beside the footprint over
   *  explored ground only: the same question builderReachability asks of the
   *  true map, asked of the ground the player knows. */
  function reachesOverKnownGround(
    builderIds: readonly number[],
    x: number,
    y: number,
    width: number,
    height: number,
    isCellKnown: (x: number, y: number) => boolean,
  ): boolean {
    if (deps.reachesOnTheMap && !deps.reachesOnTheMap(builderIds, x, y, width, height)) return false;
    const ring = deps.getApproachCellsForFootprint({ x, y }, width, height, 1)
      .filter((cell) => inMap(cell.x, cell.y) && isCellKnown(cell.x, cell.y));
    if (ring.length === 0) return false;
    const target = new Set(ring.map((cell) => cell.y * mapWidth + cell.x));
    // One flood per movement domain: passability reads the unit's owner (all
    // builders share it) and its domain (a Fishing Ship sails, a villager walks).
    const byDomain = new Map<string, number[]>();
    for (const id of builderIds) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!unit) continue;
      const key = unitDomain(unit.unitType);
      byDomain.set(key, [...(byDomain.get(key) ?? []), id]);
    }
    for (const ids of byDomain.values()) {
      const probe = ids[0]!;
      const walkable = (cellX: number, cellY: number): boolean => (
        inMap(cellX, cellY) && isCellKnown(cellX, cellY)
        && deps.isCellPassableForUnit(probe, cellX, cellY, world)
      );
      const seen = new Uint8Array(mapWidth * mapHeight);
      const queue: number[] = [];
      for (const id of ids) {
        const position = world.getComponent<Position>(id, 'position');
        if (!position || !walkable(position.x, position.y)) continue;
        const index = position.y * mapWidth + position.x;
        if (seen[index] === 1) continue;
        seen[index] = 1;
        queue.push(index);
      }
      for (let head = 0; head < queue.length; head += 1) {
        const index = queue[head]!;
        if (target.has(index)) return true;
        const cellX = index % mapWidth;
        const cellY = (index - cellX) / mapWidth;
        for (const [nextX, nextY] of [[cellX - 1, cellY], [cellX + 1, cellY], [cellX, cellY - 1], [cellX, cellY + 1]] as const) {
          if (!walkable(nextX, nextY)) continue;
          const next = nextY * mapWidth + nextX;
          if (seen[next] === 1) continue;
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    return false;
  }

  return {
    isPlacementBlocked(x, y, width, height, buildingType, builderIds) {
      const owner = knowingOwner(builderIds);
      if (owner === null) return truth.isPlacementBlocked(x, y, width, height, buildingType, builderIds);
      const isCellKnown = knownCells(owner);
      if (countKnown(x, y, width, height, isCellKnown) === 0) return true;
      if (occupancy.isPlacementBlocked(x, y, width, height, buildingType, { isCellKnown })) return true;
      return !reachesOverKnownGround(builderIds!, x, y, width, height, isCellKnown);
    },
    describePlacementBlockers(x, y, width, height, builderIds): KnowledgeBlockReport | null {
      const owner = knowingOwner(builderIds);
      if (owner === null) return truth.describePlacementBlockers(x, y, width, height, builderIds);
      const isCellKnown = knownCells(owner);
      const report = occupancy.describePlacementBlockers(x, y, width, height, { isCellKnown });
      const knownCellCount = countKnown(x, y, width, height, isCellKnown);
      if (knownCellCount === 0) {
        // The map edge is known to everyone, so it is still the reason given.
        return report ?? {
          firstBlockedCell: { x, y },
          cause: 'unexplored ground',
          blockedCellCount: 0,
          totalCellCount: width * height,
          knownCellCount: 0,
          unexplored: true,
        };
      }
      if (report) return report;
      if (reachesOverKnownGround(builderIds!, x, y, width, height, isCellKnown)) return null;
      return {
        firstBlockedCell: { x, y },
        cause: 'no walkable route to it',
        blockedCellCount: 0,
        totalCellCount: width * height,
        knownCellCount,
        unreachableForBuilders: true,
      };
    },
    findOpenPlacementAnchors(centerX, centerY, width, height, opts) {
      const owner = knowingOwner(opts.builderIds);
      if (owner === null) return truth.findOpenPlacementAnchors(centerX, centerY, width, height, opts);
      // The occupancy scan offers only anchors the caller's sight covers, so
      // their footprints are explored; the route to them must be too.
      const isCellKnown = knownCells(owner);
      const candidates = occupancy.findOpenPlacementAnchors(centerX, centerY, width, height, {
        ...opts,
        max: Math.max(opts.max * 8, 64),
      });
      const out: Position[] = [];
      for (const anchor of candidates) {
        if (out.length >= opts.max) break;
        if (!reachesOverKnownGround(opts.builderIds!, anchor.x, anchor.y, width, height, isCellKnown)) continue;
        out.push(anchor);
      }
      return out;
    },
  };
}
