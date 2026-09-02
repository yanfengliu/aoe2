// Which edge of a thing a unit walks to (2026-09-02, play-test finding F2).
//
// The approach search returns the FIRST candidate cell it can reach, so the
// ORDER of the candidate list is the choice. Unsorted, it took whatever cell
// the footprint enumeration named first: a villager two tiles west of a House
// site walked around to the EAST edge — 22 s of game time before the first
// hammer blow — and a 37-villager AI crew all queued for that one cell while
// the Wonder crept up at a single builder's rate.
//
// Only BUILDING approaches order by distance. Two other callers deliberately
// do not:
//
//  - A plain MOVE's candidate list is arrival SLOTS, where the caller's order
//    IS the allocation and must be honoured.
//  - A RESOURCE approach keeps its enumeration order because ordering it
//    nearest-first DEADLOCKED the gather economy: on the boot map all nine of
//    owner 2's villagers ended stacked on one cell (51,28), every one latched
//    in `to-resource` and motionless across a 60-tick trace, its stockpile
//    byte-identical from tick 8,000, and it never left the Dark Age. Both the
//    finding this ordering exists for and the crew cap it also fixed are about
//    BUILDING sites, so the gather path was left alone. Making it nearest-first
//    is its own change and needs its own measurement.

import type { Position } from 'civ-engine';

/**
 * Orders approach candidates nearest-first from `start`.
 *
 * Chebyshev distance because a step is 8-way; squared straight-line distance
 * breaks a Chebyshev tie toward the cell that is genuinely closer; the x then
 * y comparison breaks what is left, so two equidistant cells always resolve
 * the same way — replay determinism depends on that last clause.
 */
export function orderApproachCandidates(
  start: Position,
  candidates: readonly Position[],
): Position[] {
  return [...candidates].sort((a, b) => {
    const chebyshev = Math.max(Math.abs(a.x - start.x), Math.abs(a.y - start.y))
      - Math.max(Math.abs(b.x - start.x), Math.abs(b.y - start.y));
    if (chebyshev !== 0) return chebyshev;
    const straight = ((a.x - start.x) ** 2 + (a.y - start.y) ** 2)
      - ((b.x - start.x) ** 2 + (b.y - start.y) ** 2);
    if (straight !== 0) return straight;
    return a.x !== b.x ? a.x - b.x : a.y - b.y;
  });
}
