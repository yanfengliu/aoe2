import { describe, expect, it } from 'vitest';

import type { TerrainKind } from '../../src/game/simulation/types';
import {
  requiresShorePlacement,
  touchesWater,
} from '../../src/game/simulation/shorePlacement';

/** A tiny terrain lookup: `map[y][x]`, defaulting to grass outside it. */
function lookup(map: readonly (readonly TerrainKind[])[]) {
  return (x: number, y: number): TerrainKind | null => map[y]?.[x] ?? null;
}

const G: TerrainKind = 'grass';
const W: TerrainKind = 'water';

describe('which buildings need a shore', () => {
  it('is the Dock and nothing else', () => {
    expect(requiresShorePlacement('dock')).toBe(true);
    for (const buildingType of [
      'town-center', 'house', 'mill', 'barracks', 'castle', 'university',
      'watch-tower', 'farm', 'stone-wall',
    ] as const) {
      expect(requiresShorePlacement(buildingType)).toBe(false);
    }
  });
});

describe('touching water', () => {
  // A 3x3 pond in the middle of a 6x6 grass map.
  const POND = [
    [G, G, G, G, G, G],
    [G, G, G, G, G, G],
    [G, G, W, W, W, G],
    [G, G, W, W, W, G],
    [G, G, W, W, W, G],
    [G, G, G, G, G, G],
  ];

  it('accepts a footprint whose edge sits against the water', () => {
    // A 2x2 at (0,2)-(1,3) has its right edge against the pond at x=2.
    expect(touchesWater(0, 2, 2, 2, lookup(POND))).toBe(true);
  });

  it('accepts a footprint touching the water only diagonally', () => {
    // AoE2 docks sit on a corner too; (0,0)-(1,1) touches the pond corner (2,2).
    expect(touchesWater(0, 0, 2, 2, lookup(POND))).toBe(true);
  });

  it('rejects a footprint that is nowhere near water', () => {
    expect(touchesWater(4, 0, 2, 1, lookup(POND))).toBe(false);
  });

  it('rejects a footprint standing IN the water', () => {
    // A Dock is a land building on the shore, not a platform on the sea.
    expect(touchesWater(2, 2, 2, 2, lookup(POND))).toBe(false);
  });

  it('rejects a footprint that is only partly on water', () => {
    // (1,2)-(2,3) covers one grass column and one water column.
    expect(touchesWater(1, 2, 2, 2, lookup(POND))).toBe(false);
  });

  it('treats the map edge as neither land nor water', () => {
    // Off-map cells must not count as adjacent water, or every coastal-looking
    // spot at the border would accept a Dock over nothing.
    const allGrass = Array.from({ length: 4 }, () => [G, G, G, G]);
    expect(touchesWater(0, 0, 2, 2, lookup(allGrass))).toBe(false);
  });
});
