// The candidates a target search looks at, from a list of units and buildings
// only, instead of from the engine's spatial grid.
//
// WHY. Auto-aggression asks, for every idle unit on every tick, "is there an
// enemy within my sight?", and every Town Centre, tower and Castle that is not
// reloading asks the same about its range. Those searches called
// `world.queryInRadius`, and the engine answers that from its spatial grid: it
// collects EVERY entity in every cell of the disc, sorts them by id, then
// drops the ones without the components asked for. On a real map most of
// those entities are trees and mines, so almost all of the work was thrown
// away, and on the busiest ticks almost every search found nothing at all.
// CPU profile of the coverage lab's 45,000-tick match (the match
// `selfPlayContentCoverage.test.ts` plays), scripts/profile-selfplay.mjs,
// 2026-09-25: 30.2% of all CPU was target finding and 27.2% was
// `queryInRadius` inside it; in the shipped configuration's match
// (`aiReachesCastleAge.test.ts`) the same searches were 8.4%.
//
// EXACT, NOT APPROXIMATE. A search must return what it returned before, or the
// match changes. `candidatesInRadius` yields exactly the ids `queryInRadius`
// yields, in the same order:
//  - the same set: entities holding `position` plus the kind's component (the
//    engine's query cache for those two components), within the same
//    Euclidean disc — `dx*dx + dy*dy <= radius*radius`, which is
//    `SpatialGrid.getInRadius`'s default metric, written the same way. Its
//    bounding box and its clamp to the map exclude nothing more: a cell inside
//    the disc is inside the box, and every entity is on the map;
//  - the same order: ascending id, which is the query cache's order and the
//    order `getInRadius` sorts its result into;
//  - the same failures: an origin that is not a whole cell on the map, or a
//    radius that is not a finite non-negative number, goes to the engine,
//    which throws the error it always threw.
// `tests/simulation/targetScanIndex.test.ts` holds the equivalence against the
// engine on real match states, and full matches end in the same state digest.
//
// A SNAPSHOT, SO IT HAS A LIFETIME. The index copies each entity's position
// once. It is right only while no position changes and no unit or building
// appears or disappears, so it is made at the top of ONE system pass and
// dropped at the end of it, and only by a pass that changes none of those:
// auto-aggression queues intentions, and tower combat launches projectiles
// whose damage lands in the projectile system. Everything else a search
// checks — owner, team, hit points, visibility — is still read live, per
// candidate, by the search itself.

import type { Position } from 'civ-engine';

import type { GameWorld } from './pureHelpers';

type Kind = 'unit' | 'building';

interface PositionList {
  readonly ids: Int32Array;
  readonly xs: Int32Array;
  readonly ys: Int32Array;
  readonly count: number;
}

export interface TargetScanIndex {
  /** The ids `world.queryInRadius(cx, cy, radius, 'position', kind)` would
   *  yield, in the same order. */
  candidatesInRadius(kind: Kind, cx: number, cy: number, radius: number): Iterable<number>;
}

function listPositions(world: GameWorld, kind: Kind): PositionList {
  const all = [...world.query('position', kind)];
  const ids = new Int32Array(all.length);
  const xs = new Int32Array(all.length);
  const ys = new Int32Array(all.length);
  let count = 0;
  for (const id of all) {
    const position = world.getComponent<Position>(id, 'position');
    if (!position) continue;
    ids[count] = id;
    xs[count] = position.x;
    ys[count] = position.y;
    count += 1;
  }
  return { ids, xs, ys, count };
}

/** One per system pass; see the header for why it must not outlive one. */
export function createTargetScanIndex(world: GameWorld): TargetScanIndex {
  const lists = new Map<Kind, PositionList>();
  const width = world.grid.width;
  const height = world.grid.height;
  return {
    candidatesInRadius(kind, cx, cy, radius) {
      if (
        !Number.isInteger(cx) || !Number.isInteger(cy)
        || cx < 0 || cy < 0 || cx >= width || cy >= height
        || !Number.isFinite(radius) || radius < 0
      ) {
        return world.queryInRadius(cx, cy, radius, 'position', kind);
      }
      let list = lists.get(kind);
      if (!list) {
        list = listPositions(world, kind);
        lists.set(kind, list);
      }
      const radiusSq = radius * radius;
      const found: number[] = [];
      const { ids, xs, ys, count } = list;
      for (let i = 0; i < count; i += 1) {
        const dx = xs[i]! - cx;
        const dy = ys[i]! - cy;
        if (dx * dx + dy * dy <= radiusSq) found.push(ids[i]!);
      }
      return found;
    },
  };
}
