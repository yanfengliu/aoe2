// A building sees from the middle of its footprint (2026-09-24). Until then
// its sight was a circle around its TOP-LEFT cell, so a 4x4 Town Center saw
// seven cells past its west edge and four past its east edge, and a House
// (line of sight 2) could not see a raider on two of the cells beside it.
//
// The contract: a cell is lit when its centre lies within the line of sight of
// the footprint's centre — the circle a unit standing on a continuous plane
// would have. The engine's VisibilityMap only takes circles around whole cells,
// and an even footprint's centre is a cell CORNER, so the geometry answers with
// the central cell (odd sizes) or the four central cells (even sizes) and one
// shared radius. This test holds that answer to the continuous definition,
// written out here independently of the module under test.
//
// BOUND: square footprints 1-4 (every building in the game) and lines of sight
// 0-22. An even footprint's four circles match a centred circle exactly up to
// 22 and cover a few cells too many from 23 (8 of 1,664 at 23). The widest
// even-footprint sight a player can research is 19 (a Castle's 11 with Town
// Watch and Town Patrol); a converted building keeps its old owner's bumps and
// can reach 22 after one conversion and pass it after two. Odd footprints are
// exact at any radius.

import { describe, expect, it } from 'vitest';

import { footprintVisionSources } from '../../src/game/simulation/buildingVisionSources';
import { buildingVisionRadius } from '../../src/game/simulation/prototypeBuildingRules';

// The engine's rule (civ-engine VisibilityMap.computeVisible): a cell (x, y) is
// lit by a source at (sx, sy) when (x - sx)^2 + (y - sy)^2 <= radius^2.
function litByEngineCircles(
  cells: ReadonlyArray<{ x: number; y: number }>,
  radius: number,
): Set<string> {
  const lit = new Set<string>();
  for (const cell of cells) {
    const span = Math.ceil(radius) + 1;
    for (let y = cell.y - span; y <= cell.y + span; y += 1) {
      for (let x = cell.x - span; x <= cell.x + span; x += 1) {
        const dx = x - cell.x;
        const dy = y - cell.y;
        if (dx * dx + dy * dy <= radius * radius) lit.add(`${x},${y}`);
      }
    }
  }
  return lit;
}

// The continuous definition: cell (x, y) is the unit square [x, x+1) x [y, y+1),
// its centre is (x + 0.5, y + 0.5), and a footprint anchored at (ax, ay) of size
// w x h has its centre at (ax + w/2, ay + h/2).
function litByCentredCircle(
  anchor: { x: number; y: number },
  size: number,
  lineOfSight: number,
): Set<string> {
  const cx = anchor.x + size / 2;
  const cy = anchor.y + size / 2;
  const lit = new Set<string>();
  const span = Math.ceil(lineOfSight) + size + 1;
  for (let y = anchor.y - span; y <= anchor.y + span; y += 1) {
    for (let x = anchor.x - span; x <= anchor.x + span; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= lineOfSight * lineOfSight) lit.add(`${x},${y}`);
    }
  }
  return lit;
}

const difference = (left: Set<string>, right: Set<string>): string[] =>
  [...left].filter((cell) => !right.has(cell));

describe('footprintVisionSources', () => {
  it('lights exactly the cells whose centres lie within sight of the footprint centre', () => {
    const problems: string[] = [];
    // Two anchors, so an answer that ignores the anchor cannot pass.
    for (const anchor of [{ x: 0, y: 0 }, { x: 13, y: 7 }]) {
      for (const size of [1, 2, 3, 4]) {
        for (let lineOfSight = 0; lineOfSight <= 22; lineOfSight += 1) {
          const { cells, radius } = footprintVisionSources(
            anchor,
            { width: size, height: size },
            lineOfSight,
          );
          const got = litByEngineCircles(cells, radius);
          const want = litByCentredCircle(anchor, size, lineOfSight);
          const missing = difference(want, got);
          const extra = difference(got, want);
          if (missing.length > 0 || extra.length > 0) {
            problems.push(
              `${size}x${size} at (${anchor.x},${anchor.y}) sight ${lineOfSight}: `
              + `missing ${missing.slice(0, 4).join(' ')}${missing.length > 4 ? ' ...' : ''} `
              + `extra ${extra.slice(0, 4).join(' ')}${extra.length > 4 ? ' ...' : ''}`,
            );
          }
        }
      }
    }
    expect(problems, problems.slice(0, 12).join('\n')).toEqual([]);
  });

  it('uses the central cell for an odd footprint and the four central cells for an even one', () => {
    // The count is part of the contract: it is what a building costs the
    // visibility map on every recompute.
    const at = { x: 10, y: 20 };
    expect(footprintVisionSources(at, { width: 1, height: 1 }, 6).cells).toEqual([{ x: 10, y: 20 }]);
    expect(footprintVisionSources(at, { width: 3, height: 3 }, 6).cells).toEqual([{ x: 11, y: 21 }]);
    expect(footprintVisionSources(at, { width: 2, height: 2 }, 2).cells).toEqual([
      { x: 10, y: 20 }, { x: 11, y: 20 }, { x: 10, y: 21 }, { x: 11, y: 21 },
    ]);
    expect(footprintVisionSources(at, { width: 4, height: 4 }, 8).cells).toEqual([
      { x: 11, y: 21 }, { x: 12, y: 21 }, { x: 11, y: 22 }, { x: 12, y: 22 },
    ]);
  });

  it('keeps the radius to two decimals, because it is written into every save and recorded tick', () => {
    const long: string[] = [];
    for (const size of [1, 2, 3, 4]) {
      for (let lineOfSight = 0; lineOfSight <= 22; lineOfSight += 1) {
        const { radius } = footprintVisionSources({ x: 0, y: 0 }, { width: size, height: size }, lineOfSight);
        if (String(radius).length > String(Math.floor(radius)).length + 3) long.push(`${String(size)}x${String(size)} sight ${String(lineOfSight)}: ${String(radius)}`);
      }
    }
    expect(long).toEqual([]);
  });

  it('lets a House see every cell an attacker can stand on beside it', () => {
    // The reported case: a House is 2x2 with the game's line of sight for it
    // (2, DE's), and a melee attacker stands on one of the eight cells that
    // share an edge with it.
    expect(buildingVisionRadius('house')).toBe(2);
    const anchor = { x: 44, y: 26 };
    const { cells, radius } = footprintVisionSources(anchor, { width: 2, height: 2 }, buildingVisionRadius('house'));
    const lit = litByEngineCircles(cells, radius);
    const beside = [
      [43, 26], [43, 27], [46, 26], [46, 27], [44, 25], [45, 25], [44, 28], [45, 28],
    ].map(([x, y]) => `${String(x)},${String(y)}`);
    expect(beside.filter((cell) => !lit.has(cell))).toEqual([]);
    // ...and no further: the diagonal corners are 2.12 cells from the centre.
    expect(['43,25', '46,25', '43,28', '46,28'].filter((cell) => lit.has(cell))).toEqual([]);
  });
});
