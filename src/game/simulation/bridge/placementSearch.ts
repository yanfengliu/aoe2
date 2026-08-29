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
/**
 * Whether placing `footprint` at `anchor` would cut the free ground beside it
 * in two — the free cells touching the building must still reach each other
 * without passing through it. The flood is GLOBAL (whole map, typed-array
 * visited), not margin-boxed: a 3-cell local box passed every individual farm
 * of a wall whose COLLECTIVE effect sealed the corridor three-plus cells out
 * (v0.3.160 feudal-stone profile: eleven carriers walled off from every
 * drop-off by farms the local guard had individually approved). At 60x36
 * cells one flood is ~2K visits — cheaper than the string-keyed local Set.
 *
 * Measured on the default map (v0.1.x): the AI packed its buildings into a
 * solid mass ten cells wide and sealed its own sheep, boar and forest into a
 * pocket its villagers could not enter; six of them then held that one
 * unreachable sheep for thirteen thousand ticks while the economy stood
 * still.
 */
export function placementKeepsGroundConnected(
  anchor: Position,
  footprint: { width: number; height: number },
  mapWidth: number,
  mapHeight: number,
  isFree: (x: number, y: number) => boolean,
): boolean {
  const insideFootprint = (x: number, y: number): boolean => (
    x >= anchor.x && x < anchor.x + footprint.width
    && y >= anchor.y && y < anchor.y + footprint.height
  );
  const walkable = (x: number, y: number): boolean => (
    x >= 0 && x < mapWidth && y >= 0 && y < mapHeight
    && !insideFootprint(x, y) && isFree(x, y)
  );

  const border: Position[] = [];
  for (let y = anchor.y - 1; y <= anchor.y + footprint.height; y += 1) {
    for (let x = anchor.x - 1; x <= anchor.x + footprint.width; x += 1) {
      // Orthogonal neighbours of the footprint only: a diagonal touch is not a
      // step a unit can take, so it says nothing about being able to get past.
      const isDiagonal =
        (x < anchor.x || x >= anchor.x + footprint.width)
        && (y < anchor.y || y >= anchor.y + footprint.height);
      if (isDiagonal || insideFootprint(x, y)) continue;
      if (walkable(x, y)) border.push({ x, y });
    }
  }
  // Nothing to separate.
  if (border.length <= 1) return true;

  const visited = new Uint8Array(mapWidth * mapHeight);
  const queue = new Int32Array(mapWidth * mapHeight);
  let head = 0;
  let tail = 0;
  const push = (x: number, y: number): void => {
    const index = y * mapWidth + x;
    if (visited[index]) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  push(border[0]!.x, border[0]!.y);
  while (head < tail) {
    const index = queue[head]!;
    head += 1;
    const x = index % mapWidth;
    const y = (index - x) / mapWidth;
    if (x + 1 < mapWidth && walkable(x + 1, y)) push(x + 1, y);
    if (x - 1 >= 0 && walkable(x - 1, y)) push(x - 1, y);
    if (y + 1 < mapHeight && walkable(x, y + 1)) push(x, y + 1);
    if (y - 1 >= 0 && walkable(x, y - 1)) push(x, y - 1);
  }
  return border.every((cell) => visited[cell.y * mapWidth + cell.x] === 1);
}

export function findPlacementAnchorNear(
  origin: Position,
  footprint: { width: number; height: number },
  mapWidth: number,
  mapHeight: number,
  isBlocked: (x: number, y: number, width: number, height: number) => boolean,
  maxRadius = 12,
  // When supplied, an anchor that would sever the free ground beside it is
  // skipped — unless NO anchor survives that, in which case the search runs
  // again without the guard, because a sealed pocket beats not building at all.
  isFree?: (x: number, y: number) => boolean,
): Position | null {
  if (isFree) {
    const guarded = searchRings(
      origin, footprint, mapWidth, mapHeight, isBlocked, maxRadius, isFree,
    );
    if (guarded) return guarded;
  }
  return searchRings(origin, footprint, mapWidth, mapHeight, isBlocked, maxRadius, undefined);
}

function searchRings(
  origin: Position,
  footprint: { width: number; height: number },
  mapWidth: number,
  mapHeight: number,
  isBlocked: (x: number, y: number, width: number, height: number) => boolean,
  maxRadius: number,
  isFree: ((x: number, y: number) => boolean) | undefined,
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
        if (isBlocked(candidate.x, candidate.y, footprint.width, footprint.height)) {
          continue;
        }
        if (
          isFree
          && !placementKeepsGroundConnected(candidate, footprint, mapWidth, mapHeight, isFree)
        ) {
          continue;
        }
        return candidate;
      }
    }
  }
  return null;
}
