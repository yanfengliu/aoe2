// Whom a foundation nobody has started building stands aside for, and whom it
// will wall in (work 126; spec §12.1, §8.1).
//
// Definitive Edition update 185872: "Fixed a bug causing unbuilt building
// Foundations to prevent players from building upon them". The note does not
// say which players. This game's decision where it leaves the choice (the
// coordinator, 2026-10-14): what the player is shown blocks it. An enemy of the
// owner is never shown an unstarted foundation (work 121, unstartedFoundations.ts),
// so for an enemy it stands aside and refuses nothing; its owner and the
// owner's allies are shown it, and it refuses their placement as before.
//
// It still becomes a wall the moment it is started, so for its owner and the
// owner's allies it is a FUTURE wall: the route a builder must be able to walk
// to a new site (builderReachability.ts, placementKnowledge.ts) does not count
// on crossing it, or a second foundation could be founded behind the first and
// stranded when the first goes up (the register entry of 2026-09-06, "a queued
// chain cannot strand its own next site"). A Farm stays walkable once started,
// so it is never a future wall. The AI's seal guard counts every unstarted
// foundation as a future wall, whoever owns it (aiSitePlacement.ts).
//
// The walls are handed over as map-sized masks, built from the buildings rather
// than asked of the occupancy cell by cell: a route labelling and a seal-guard
// flood read every cell of the map, and a merged occupancy status per cell
// would allocate on each read.

import type { OccupancyCellClaim, Position } from 'civ-engine';

import { isEnemyOwner } from '../alliances';
import type { BuildingComponent } from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { constructionStatesCodec, playerTeamsCodec } from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';
import { isConstructionStarted, isUnstartedFoundation } from './unstartedFoundations';

export type ClaimTest = (claim: OccupancyCellClaim) => boolean;

export interface FoundationClaimRules {
  /** For a placement by `placer`: whether a claim stands aside, which is an
   *  unstarted foundation of a player `placer` is at war with. */
  standsAsideFor(placer: number): ClaimTest;
  /** The cells that will wall `owner`'s routes: every unstarted foundation,
   *  not a Farm, of `owner` or an ally. Null when there are none. */
  futureWallsOf(owner: number): Uint8Array | null;
  /** The cells of every unstarted foundation, not a Farm, of any owner: the AI's
   *  seal guard. Null when there are none. */
  unstartedFoundationCells(): Uint8Array | null;
}

export function createFoundationClaimRules(world: GameWorld, accessor: BridgeStateAccessor): FoundationClaimRules {
  /** The foundations nobody has started, not Farms, whose owner `keep` admits,
   *  as a mask over the map; null when there are none. */
  function maskOf(keep: (owner: number) => boolean): Uint8Array | null {
    const { width, height } = world.grid;
    const states = accessor.get(constructionStatesCodec);
    let mask: Uint8Array | null = null;
    for (const id of world.query('building', 'position')) {
      const state = states.get(id);
      if (isConstructionStarted(state)) continue;
      const building = world.getComponent<BuildingComponent>(id, 'building');
      const anchor = world.getComponent<Position>(id, 'position');
      if (!building || !anchor || building.buildingType === 'farm' || !keep(building.owner)) continue;
      mask ??= new Uint8Array(width * height);
      for (let y = anchor.y; y < anchor.y + state!.height; y += 1) {
        for (let x = anchor.x; x < anchor.x + state!.width; x += 1) {
          if (x >= 0 && y >= 0 && x < width && y < height) mask[y * width + x] = 1;
        }
      }
    }
    return mask;
  }

  return {
    standsAsideFor(placer) {
      const teams = accessor.get(playerTeamsCodec);
      return (claim) => {
        if (claim.entity === null || !isUnstartedFoundation(accessor, claim.entity)) return false;
        const building = world.getComponent<BuildingComponent>(claim.entity, 'building');
        return building !== undefined && isEnemyOwner(teams, placer, building.owner);
      };
    },
    futureWallsOf(owner) {
      const teams = accessor.get(playerTeamsCodec);
      return maskOf((foundationOwner) => !isEnemyOwner(teams, owner, foundationOwner));
    },
    unstartedFoundationCells() {
      return maskOf(() => true);
    },
  };
}

/** The 4-connected components a builder standing at `start` can reach when
 *  its own cell is not labelled: it stands on a future wall, which it may
 *  still walk off now, so the components it reaches are those of the labelled
 *  cells it can step to across future-wall cells that are open ground today.
 *  Empty when it stands nowhere it could leave. */
export function componentsReachedFrom(
  start: { x: number; y: number },
  mapWidth: number,
  mapHeight: number,
  labels: Int32Array,
  isOpenFutureWall: (x: number, y: number) => boolean,
): Set<number> {
  const reached = new Set<number>();
  if (!isOpenFutureWall(start.x, start.y)) return reached;
  const seen = new Set<number>([start.y * mapWidth + start.x]);
  const queue: Array<{ x: number; y: number }> = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const { x, y } = queue[head]!;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= mapWidth || ny >= mapHeight) continue;
      const index = ny * mapWidth + nx;
      if (seen.has(index)) continue;
      seen.add(index);
      const label = labels[index]!;
      if (label >= 0) reached.add(label);
      else if (isOpenFutureWall(nx, ny)) queue.push({ x: nx, y: ny });
    }
  }
  return reached;
}

/** Whether a site whose ring cells carry `ringLabels` is reachable from every
 *  component in `reached`. On open ground `reached` is the one component the
 *  builder stands in. On a future wall it is every component the builder could
 *  be standing in when that wall goes up, by walking off it or by being put
 *  beside it at the start; a site reachable from only some of them could be
 *  stranded, so it must be reachable from all (the review of work 126, round
 *  0). Never true for an empty `reached`. */
export function reachesFromEvery(reached: ReadonlySet<number>, ringLabels: Iterable<number>): boolean {
  if (reached.size === 0) return false;
  const ring = new Set(ringLabels);
  for (const component of reached) if (!ring.has(component)) return false;
  return true;
}
