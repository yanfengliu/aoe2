import type { Position } from 'civ-engine';

// Pure ring-search for an open building-placement anchor near an origin (the AI
// uses its Town Center). Scans Chebyshev rings from radius 2 outward, returning
// the first top-left cell whose FULL `footprint` is unblocked (and in-bounds)
// AND, when a free-ground predicate is supplied, does not cut the free ground
// beside it in two. It is the ONE place that says how far the AI looks and what
// it refuses: rings 2..12, then rings 13..24, then null.
//
// Why 12 (v0.1.93 FIND): a radius-6 cap silently stranded the AI — the inner
// rings of an established base are packed, and a 4x4 building (market, castle,
// wonder) needs 16 contiguous free cells where a 3x3 prereq needs only 9, so
// the AI could NEVER place a 4x4 one and hoarded resources on a build it could
// not complete. Why 24 (register entry 2026-09-06): an established base packs
// its inner rings solid, and without a wider pass the hard AI ran 777 empty site
// searches per 10,000 ticks by tick 40,000 and stopped building. Half the
// two-player map's width, so a boxed-in base can still expand.
//
// Why there is NO unguarded pass. From 2026-08-23 to 2026-09-08 a search that
// found only sealing anchors ran again without the guard — "a sealed pocket
// beats an AI that stops building" — so the AI would keep building on the
// default map. Measured on 2026-09-06 with an independent flood over terrain
// plus building and resource footprints (register entry "A normal match seals
// its own map, so the armies can never meet"): on `black-forest` the enemy
// units reachable from the human's own ground went from 4/4 at tick 0 to 0/26
// at tick 20,000, and with both sides played by the AI the human's units were
// split into 50-, 43- and 2-cell pockets by tick 15,000. No battle had ever
// happened in this game on any seed. A stalled AI can still fight with what it
// has; a sealed one never can. Definitive Edition's AI never seals itself in —
// it places elsewhere, or waits — so the fallback was removed and the wider
// guarded pass is what stands in for it.

/** Rings 2..this are searched first. */
export const AI_PLACEMENT_SEARCH_RADIUS = 12;
/** Rings above `AI_PLACEMENT_SEARCH_RADIUS` up to this are searched next, still
 *  guarded, before the search gives up. */
export const AI_PLACEMENT_WIDER_SEARCH_RADIUS = 24;

/** The search's own cost and refusals, so a claim about either is a number. */
export interface PlacementSearchStats {
  /** Guard evaluations — each a whole-map connectivity flood, except the
   *  trivial case of a footprint touching at most one free cell. */
  floods: number;
  /** Anchors whose footprint was open and which the guard refused because the
   *  building would sever the free ground beside it. */
  refusedByGuard: number;
  /** Searches that found no anchor at either radius. */
  nullSearches: number;
  /** Wall time inside the search, both passes included. */
  computeMs: number;
}

export function createPlacementSearchStats(): PlacementSearchStats {
  return { floods: 0, refusedByGuard: 0, nullSearches: 0, computeMs: 0 };
}

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

export interface PlacementSearchOptions {
  /** Rings 2..radius are searched first. Default `AI_PLACEMENT_SEARCH_RADIUS`. */
  radius?: number;
  /** Rings radius+1..widerRadius are searched next, under the same guard.
   *  `null` disables the wider pass. Default `AI_PLACEMENT_WIDER_SEARCH_RADIUS`. */
  widerRadius?: number | null;
  /** When supplied, an anchor whose footprint would sever the free ground
   *  beside it is skipped — at every radius, with no unguarded pass. Walls and
   *  gates pass nothing here: sealing ground is what they are for. */
  isFree?: (x: number, y: number) => boolean;
  /** Counters this search adds to. */
  stats?: PlacementSearchStats;
}

export function findPlacementAnchorNear(
  origin: Position,
  footprint: { width: number; height: number },
  mapWidth: number,
  mapHeight: number,
  isBlocked: (x: number, y: number, width: number, height: number) => boolean,
  options: PlacementSearchOptions = {},
): Position | null {
  const startedAt = performance.now();
  const radius = options.radius ?? AI_PLACEMENT_SEARCH_RADIUS;
  const widerRadius = options.widerRadius === undefined
    ? AI_PLACEMENT_WIDER_SEARCH_RADIUS
    : options.widerRadius;
  let anchor = searchRings(
    origin, footprint, mapWidth, mapHeight, isBlocked, 2, radius, options.isFree, options.stats,
  );
  if (anchor === null && widerRadius !== null && widerRadius > radius) {
    anchor = searchRings(
      origin, footprint, mapWidth, mapHeight, isBlocked,
      radius + 1, widerRadius, options.isFree, options.stats,
    );
  }
  if (options.stats) {
    if (anchor === null) options.stats.nullSearches += 1;
    options.stats.computeMs += performance.now() - startedAt;
  }
  return anchor;
}

function searchRings(
  origin: Position,
  footprint: { width: number; height: number },
  mapWidth: number,
  mapHeight: number,
  isBlocked: (x: number, y: number, width: number, height: number) => boolean,
  minRadius: number,
  maxRadius: number,
  isFree: ((x: number, y: number) => boolean) | undefined,
  stats: PlacementSearchStats | undefined,
): Position | null {
  for (let radius = minRadius; radius <= maxRadius; radius += 1) {
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
        if (isFree) {
          if (stats) stats.floods += 1;
          if (!placementKeepsGroundConnected(candidate, footprint, mapWidth, mapHeight, isFree)) {
            if (stats) stats.refusedByGuard += 1;
            continue;
          }
        }
        return candidate;
      }
    }
  }
  return null;
}
