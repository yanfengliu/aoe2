// Slice 12 Task A: Shared "find nearest legal spawn with egress" helper.
//
// The same pattern grew in three places in `createSimulationBridge`:
//
//   - Scenario spawn: when a fixture spawns a unit on a cell that is blocked
//     (or walled off), find the nearest legal cell whose neighbors are also
//     passable so the unit is not instantly wedged.
//   - Producer spawn: when a building finishes training a unit, the new
//     unit must land on a cell adjacent to the footprint from which it can
//     actually walk away.
//   - Ungarrison: when units exit a building, they need a legal, non-wedged
//     cell on the building's perimeter.
//
// Extracting the shared body keeps the egress rule uniform across every caller.
// That rule used to be "at least one cardinal neighbor is also passable", which
// a dead end satisfies: the AI closed a two-cell pocket between its own house,
// mill, barracks, farm and Town Center, and every villager it trained after
// that was spawned into the pocket and never left. The rule is now that the
// cell belongs to a walkable region of a workable size.
//
// This is plain, side-effect-free logic. It does not import from
// `createSimulationBridge`; callers pass their own passability predicate so
// the helper stays decoupled from world state.

import type { Position } from 'civ-engine';

export interface SpawnSearchOptions {
  // Ordered list of candidate cells (nearest-first). The helper picks the
  // first candidate that passes both the cell-passability and the egress
  // check.
  candidates: ReadonlyArray<Position>;
  // Cell-passability: returns true if the cell itself is free for the
  // spawning entity (no blocking terrain, building, resource, or unit).
  isCellPassable(x: number, y: number): boolean;
  // Cardinal neighbor offsets. Callers pass in a reusable module-level
  // constant so the helper does not allocate per call.
  neighborOffsets: ReadonlyArray<Position>;
  // How much connected walkable ground a spawn cell must belong to. The search
  // stops counting here, so the cost stays a couple of dozen cells per
  // candidate however open the map is.
  minEgressCells?: number;
}

// Small enough that an ordinary gap between two buildings still qualifies, and
// large enough that a unit landing there can reach the world outside the base.
const DEFAULT_MIN_EGRESS_CELLS = 8;

// Returns true if the candidate cell is itself passable AND belongs to a
// walkable region of at least `minEgressCells` cells. A cell whose only exit
// is a dead end is wedged just as surely as one with no exit at all.
export function hasSpawnEgress(
  candidate: Position,
  options: Pick<SpawnSearchOptions, 'isCellPassable' | 'neighborOffsets' | 'minEgressCells'>,
): boolean {
  if (!options.isCellPassable(candidate.x, candidate.y)) {
    return false;
  }

  const minCells = options.minEgressCells ?? DEFAULT_MIN_EGRESS_CELLS;
  const seen = new Set<string>([`${String(candidate.x)},${String(candidate.y)}`]);
  const queue: Position[] = [candidate];
  while (queue.length > 0 && seen.size < minCells) {
    const cell = queue.shift();
    if (!cell) break;
    for (const offset of options.neighborOffsets) {
      const next = { x: cell.x + offset.x, y: cell.y + offset.y };
      const key = `${String(next.x)},${String(next.y)}`;
      if (seen.has(key) || !options.isCellPassable(next.x, next.y)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return seen.size >= minCells;
}

// Walks the caller-supplied candidate list and returns the first one whose cell
// is passable AND sits in a walkable region of workable size. Returns null when
// every candidate is wedged.
export function findSafeSpawnWithEgress(options: SpawnSearchOptions): Position | null {
  for (const candidate of options.candidates) {
    if (hasSpawnEgress(candidate, options)) {
      return candidate;
    }
  }

  return null;
}
