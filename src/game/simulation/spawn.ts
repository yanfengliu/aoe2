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
// Extracting the shared body keeps the egress rule ("at least one cardinal
// neighbor is also passable") uniform across every caller.
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
}

// Returns true if the candidate cell is itself passable AND at least one
// of its cardinal neighbors is passable. A spawn with no passable neighbor
// is considered wedged — the unit could sit there but could never leave.
export function hasSpawnEgress(
  candidate: Position,
  options: Pick<SpawnSearchOptions, 'isCellPassable' | 'neighborOffsets'>,
): boolean {
  if (!options.isCellPassable(candidate.x, candidate.y)) {
    return false;
  }

  for (const offset of options.neighborOffsets) {
    if (options.isCellPassable(candidate.x + offset.x, candidate.y + offset.y)) {
      return true;
    }
  }

  return false;
}

// Walks the caller-supplied candidate list and returns the first one whose
// cell is passable AND has at least one passable cardinal neighbor.
// Returns null when every candidate is wedged.
export function findSafeSpawnWithEgress(options: SpawnSearchOptions): Position | null {
  for (const candidate of options.candidates) {
    if (hasSpawnEgress(candidate, options)) {
      return candidate;
    }
  }

  return null;
}
