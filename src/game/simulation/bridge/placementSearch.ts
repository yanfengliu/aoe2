import type { Position } from 'civ-engine';

// Pure ring-search for an open building-placement anchor near an origin (the AI
// uses its Town Center). Scans Chebyshev rings from radius 2 outward to
// `maxRadius`, returning the first top-left cell whose FULL `footprint` is
// unblocked (and in-bounds), or null if none fits.
//
// `maxRadius` defaults to 12. A radius-6 cap silently stranded the AI: the inner
// rings of an established base are packed, and a 4x4 building (market, castle,
// wonder) needs 16 contiguous free cells where a 3x3 prereq needs only 9 — so
// only 3x3 buildings ever fit the inner ring, and the AI could NEVER place a 4x4
// one (it hoarded resources on a build it couldn't complete; v0.1.93 FIND).
// Reaching radius 12 lets the 4x4 gap be found past the crowded core.
export function findPlacementAnchorNear(
  origin: Position,
  footprint: { width: number; height: number },
  mapWidth: number,
  mapHeight: number,
  isBlocked: (x: number, y: number, width: number, height: number) => boolean,
  maxRadius = 12,
): Position | null {
  for (let radius = 2; radius <= maxRadius; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        // Only the ring's perimeter (skip cells already covered by inner rings).
        if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) {
          continue;
        }
        const candidate = { x: origin.x + offsetX, y: origin.y + offsetY };
        if (
          candidate.x < 0
          || candidate.y < 0
          || candidate.x + footprint.width > mapWidth
          || candidate.y + footprint.height > mapHeight
        ) {
          continue;
        }
        if (!isBlocked(candidate.x, candidate.y, footprint.width, footprint.height)) {
          return candidate;
        }
      }
    }
  }
  return null;
}
