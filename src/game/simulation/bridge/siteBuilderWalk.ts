// Which villager walks to a building site: the one with the shortest walk to a
// cell beside it (work 152 M1d, spec §13.2).
//
// Why it exists. The computer sent its first villager in entity order to every
// building it placed and every site it crewed, wherever that villager stood.
// Traced in the lobby's default all-AI match (plan 152): a House at (46,24)
// went to a woodcutter 6 cells away in a straight line and 56 by foot while six
// villagers stood on the site's own approach cell, and work started 69 s after
// the House was placed. Played from the start on main 2d8824a6, 21 of that
// match's first 24 placements passed over a villager with a shorter walk.
//
// The measure is the WALK, not the straight line, because the mover walks: the
// flood steps orthogonally over `isCellPassableForUnit`, the predicate
// `findMovementPathToCandidates` hands to `findGridPath`, starting from the
// cells the mover aims at (`getApproachCellsForFootprint` at range 1, kept only
// where a villager may stand). A villager's walk is the flood's distance at its
// cell. The path search counts the cell a unit stands on as open (work 145), so
// a villager on a closed cell, one a sheep stopped on, is one step further
// than the nearest reached cell beside it. `tests/simulation/siteBuilderWalk.test.ts`
// holds the choice to the real path search on seeded random maps.
//
// The flood is lazy. Breadth-first search reaches cells in order of distance,
// so it stops once the cells nearer than the best candidate found have all been
// expanded: a villager beside the site costs a few dozen cell reads, and the
// whole of a seat's reachable ground is read only when nobody stands nearer.
// The crew phase asks for a site's builders one at a time, so ONE flood is kept
// and carried on from where it stopped, for the same site, side and structural
// revision. Units never close a cell (`worldOccupancy.structuralRevision`), so
// nothing the flood read can change until that counter moves.
//
// What it does not decide. Who is a candidate is the caller's
// (`aiSystemGating.ts`: the availability test did not change). Where a site is
// put is `aiSitePlacement.ts`, which still asks whether today's first villager
// can reach it. For a site still to be placed the placement validator asks its
// own question of the builder the command names (`builderReachability.ts`: no
// route may count on crossing a foundation nobody has started, and a builder on
// a closed cell reaches nothing), so a candidate is named only if that rule
// passes it; the nearest one always does unless one of those two holds.
//
// KNOWN BOUNDARY, the path search's own: `findGridPath` gives up after 10,000
// iterations, which a map past about 8,000 cells can reach, so there a villager
// the flood reaches may still be refused by the mover (builderReachability.ts
// names the same boundary). The caller's fallback is today's first villager.

import type { Position } from 'civ-engine';

import type { UnitComponent } from '../types';
import type { GameWorld } from './pureHelpers';

export interface BuildSite {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Not placed yet: its builder must pass the placement rule's reach. */
  toBePlaced: boolean;
}

/**
 * Of `candidateIds`, the villager with the shortest walk to a cell beside the
 * site, the lowest id on a tie. Null when the flood reaches none of them.
 */
export type NearestSiteBuilder = (
  candidateIds: readonly number[],
  site: BuildSite,
  activeWorld: GameWorld,
) => number | null;

export interface SiteBuilderWalkDeps {
  mapWidth: number;
  mapHeight: number;
  /** The mover's own passability predicate. */
  isCellPassableForUnit: (unitId: number, x: number, y: number, activeWorld: GameWorld) => boolean;
  /** The mover's own approach ring, so "beside the footprint" has one definition. */
  getApproachCellsForFootprint: (anchor: Position, width: number, height: number, range?: number) => Position[];
  /** The placement rule's reach, asked of one builder (builderReachability.ts). */
  canBuilderReachFootprint: (builderId: number, site: BuildSite, activeWorld: GameWorld) => boolean;
  structuralRevision: () => number;
}

/** Cell states below zero; at zero and above, the walk to that cell. */
const UNREAD = -1;
const CLOSED = -2;

interface KeptFlood {
  world: GameWorld;
  revision: number;
  owner: number | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createSiteBuilderWalk(deps: SiteBuilderWalkDeps): NearestSiteBuilder {
  const { mapWidth, mapHeight } = deps;
  const size = Math.max(0, mapWidth * mapHeight);
  const walk = new Int32Array(size).fill(UNREAD);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  let kept: KeptFlood | null = null;

  /** Reads a cell the flood has not read: open ground joins the queue at `distance`. */
  function read(probe: number, x: number, y: number, distance: number, activeWorld: GameWorld): void {
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return;
    const index = y * mapWidth + x;
    if (walk[index] !== UNREAD) return;
    if (!deps.isCellPassableForUnit(probe, x, y, activeWorld)) {
      walk[index] = CLOSED;
      return;
    }
    walk[index] = distance;
    queue[tail] = index;
    tail += 1;
  }

  function begin(probe: number, site: BuildSite, activeWorld: GameWorld): void {
    walk.fill(UNREAD);
    head = 0;
    tail = 0;
    for (const cell of deps.getApproachCellsForFootprint(site, site.width, site.height, 1)) {
      read(probe, cell.x, cell.y, 0, activeWorld);
    }
  }

  /** Expands every queued cell at the frontier's distance. */
  function expandLayer(probe: number, activeWorld: GameWorld): void {
    const distance = walk[queue[head]!]!;
    while (head < tail && walk[queue[head]!] === distance) {
      const index = queue[head]!;
      head += 1;
      const x = index % mapWidth;
      const y = (index - x) / mapWidth;
      read(probe, x + 1, y, distance + 1, activeWorld);
      read(probe, x - 1, y, distance + 1, activeWorld);
      read(probe, x, y + 1, distance + 1, activeWorld);
      read(probe, x, y - 1, distance + 1, activeWorld);
    }
  }

  /** The walk from a cell as far as the flood knows it: its own distance, or
   *  one step off a closed cell onto the nearest reached cell beside it. */
  function knownWalk(position: Position): number {
    if (position.x < 0 || position.y < 0 || position.x >= mapWidth || position.y >= mapHeight) {
      return Number.POSITIVE_INFINITY;
    }
    const own = walk[position.y * mapWidth + position.x]!;
    if (own >= 0) return own;
    if (own === UNREAD) return Number.POSITIVE_INFINITY;
    let best = Number.POSITIVE_INFINITY;
    const consider = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) return;
      const beside = walk[y * mapWidth + x]!;
      if (beside >= 0 && beside + 1 < best) best = beside + 1;
    };
    consider(position.x + 1, position.y);
    consider(position.x - 1, position.y);
    consider(position.x, position.y + 1);
    consider(position.x, position.y - 1);
    return best;
  }

  return (candidateIds, site, activeWorld) => {
    if (candidateIds.length === 0) return null;
    const probe = candidateIds[0]!;
    const owner = activeWorld.getComponent<UnitComponent>(probe, 'unit')?.owner;
    const revision = deps.structuralRevision();
    if (
      kept === null || kept.world !== activeWorld || kept.revision !== revision || kept.owner !== owner
      || kept.x !== site.x || kept.y !== site.y || kept.width !== site.width || kept.height !== site.height
    ) {
      kept = { world: activeWorld, revision, owner, x: site.x, y: site.y, width: site.width, height: site.height };
      begin(probe, site, activeWorld);
    }

    const refused = new Set<number>();
    for (;;) {
      let bestId: number | null = null;
      let bestWalk = Number.POSITIVE_INFINITY;
      for (const id of candidateIds) {
        if (refused.has(id)) continue;
        const position = activeWorld.getComponent<Position>(id, 'position');
        if (!position) continue;
        const distance = knownWalk(position);
        if (distance < bestWalk || (distance === bestWalk && bestId !== null && id < bestId)) {
          bestId = id;
          bestWalk = distance;
        }
      }
      // Every cell nearer than the frontier has been expanded, so a walk no
      // longer than the frontier's distance cannot be beaten or tied from
      // beyond it: an unread cell is at least one step past the frontier, and
      // so is the step off a closed cell onto ground not yet reached.
      const frontier = head < tail ? walk[queue[head]!]! : Number.POSITIVE_INFINITY;
      if (bestId !== null && bestWalk <= frontier && Number.isFinite(bestWalk)) {
        if (!site.toBePlaced || deps.canBuilderReachFootprint(bestId, site, activeWorld)) return bestId;
        refused.add(bestId);
        continue;
      }
      if (head >= tail) return null;
      expandLayer(probe, activeWorld);
    }
  };
}
