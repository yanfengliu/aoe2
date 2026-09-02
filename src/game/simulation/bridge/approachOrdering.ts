// Which edge of a thing a unit walks to (2026-09-02, play-test finding F2).
//
// The approach search returns the FIRST candidate cell it can reach, so the
// ORDER of the candidate list is the choice. Unsorted, it took whatever cell
// the footprint enumeration named first: a villager two tiles west of a House
// site walked around to the EAST edge — 22 s of game time before the first
// hammer blow — and a 37-villager AI crew all queued for that one cell while
// the Wonder crept up at a single builder's rate.
//
// Only APPROACHES order by distance. A plain move's candidate list is arrival
// SLOTS, where the caller's order IS the allocation and must be honoured.

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
