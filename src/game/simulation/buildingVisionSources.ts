// Where a building's sight comes from (2026-09-24): the middle of its
// footprint. Until then every building saw from its TOP-LEFT cell, so a 4x4
// Town Center saw seven cells past its west edge and four past its east edge,
// and a House (line of sight 2) could not see a raider on two of the eight
// cells beside it.
//
// The contract is the continuous one: a cell is lit when its centre lies
// within the line of sight of the footprint's centre. civ-engine's
// VisibilityMap lights a cell (x, y) from a source standing on a WHOLE cell
// (sx, sy) when (x - sx)^2 + (y - sy)^2 <= radius^2, and an even side's centre
// is a cell corner that no whole cell stands on. So an odd side answers with
// its central cell and an even side with its two central cells — one source
// for a 1x1 or 3x3 building, four for a 2x2 or 4x4 — all with one radius,
// chosen so the circles' union is exactly the centred circle.
//
// BOUND (tests/simulation/buildingVisionSources.test.ts): for square
// footprints the union is exact up to a line of sight of 22; from 23 an even
// footprint lights a few cells too many (8 of 1,664 at 23). The widest
// even-footprint sight a player can research is 19, a Castle's 11 with Town
// Watch and Town Patrol. A converted building keeps its old owner's bumps and
// takes its new owner's too (conversion flips the owner in place), so a sight-6
// building can reach 22 after one conversion and pass it after two. Odd
// footprints are exact at any radius.

export interface FootprintVisionSources {
  /** The central cell (odd side) or cells (even side), row by row, west to east. */
  readonly cells: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  /** One radius for every cell, in the engine's terms. */
  readonly radius: number;
}

const centralOffsets = (length: number): number[] => (
  length % 2 === 1 ? [(length - 1) / 2] : [length / 2 - 1, length / 2]
);

const radiusCache = new Map<string, number | null>();

// The squared radius, around each central cell, that lights exactly the
// centred circle: the largest p^2 + q^2 over the whole-cell offsets (p, q) >= 0
// from the nearest central cell whose centre is within sight — (p + hx)^2 +
// (q + hy)^2 <= R^2, where hx and hy are half a cell on an even side and zero
// on an odd one. Every lit cell's squared distance to its nearest central cell
// is an integer no larger than this and, in the bound above, every unlit
// cell's is larger, so half a cell of slack past it cannot let one in. Null
// when no cell centre is within sight at all (an even footprint at sight 0).
function sourceRadius(lineOfSight: number, halfX: number, halfY: number): number | null {
  const key = `${String(lineOfSight)}:${String(halfX)}:${String(halfY)}`;
  const cached = radiusCache.get(key);
  if (cached !== undefined) return cached;
  const limit = lineOfSight * lineOfSight;
  let best = -1;
  for (let p = 0; (p + halfX) ** 2 <= limit; p += 1) {
    for (let q = 0; (p + halfX) ** 2 + (q + halfY) ** 2 <= limit; q += 1) {
      best = Math.max(best, p * p + q * q);
    }
  }
  // Two decimals, because the radius is written into every save and every
  // recorded tick that changes sight: rounding moves it at most 0.005, so its
  // square stays strictly between `best` and `best + 1` for any radius under
  // 49.5, which is all the engine's integer comparison can tell apart.
  const radius = best < 0 ? null : Math.round(Math.sqrt(best + 0.5) * 100) / 100;
  radiusCache.set(key, radius);
  return radius;
}

export function footprintVisionSources(
  anchor: { readonly x: number; readonly y: number },
  footprint: { readonly width: number; readonly height: number },
  lineOfSight: number,
): FootprintVisionSources {
  const radius = sourceRadius(
    Math.max(0, lineOfSight),
    footprint.width % 2 === 0 ? 0.5 : 0,
    footprint.height % 2 === 0 ? 0.5 : 0,
  );
  if (radius === null) return { cells: [], radius: 0 };
  const cells: Array<{ x: number; y: number }> = [];
  for (const offsetY of centralOffsets(footprint.height)) {
    for (const offsetX of centralOffsets(footprint.width)) {
      cells.push({ x: anchor.x + offsetX, y: anchor.y + offsetY });
    }
  }
  return { cells, radius };
}
