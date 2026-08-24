// Shore fishing: which fish a VILLAGER can work.
//
// Age of Empires II has two kinds of fish, and only one of them needs a boat.
// Shore Fish sit in the shallow water against the coast and are gathered by
// villagers standing on the land beside them, with no Dock and no Fishing Ship
// involved — it is one of the standard opening food sources on a water map.
// Everything further out (perch, salmon, tuna, marlin) is fishing-ship work.
//
// This build models fish as one resource kind on water tiles, so the
// distinction is GEOMETRIC rather than a second entity: a fish with a land cell
// beside it is a shore fish. That is also the honest test of the thing the
// domain rule was protecting against — a villager sent at open water walks to
// the coast and stands there forever, while a villager sent at a fish it can
// stand next to simply works it.
//
// Pure: the land test is passed in, so this is testable without a world and is
// shared by the villager assignment, the AI, and a player's own right-click.

import type { Position } from 'civ-engine';

/** The eight neighbours, because a villager may stand on a diagonal. */
const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

/**
 * Whether this water cell touches land — i.e. whether a villager could stand
 * beside it and fish.
 *
 * `isLandCell` answers for a cell a land unit can occupy; off-map cells must
 * answer false, so a fish against the map edge is not mistaken for a shore fish
 * with nowhere to stand.
 */
export function isShoreFish(
  position: Position,
  isLandCell: (x: number, y: number) => boolean,
): boolean {
  const x = Math.floor(position.x);
  const y = Math.floor(position.y);
  for (const [dx, dy] of NEIGHBOURS) {
    if (isLandCell(x + dx, y + dy)) return true;
  }
  return false;
}
