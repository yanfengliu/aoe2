import { describe, expect, it } from 'vitest';

import { findSafeSpawnWithEgress, hasSpawnEgress } from '../../src/game/simulation/spawn';

const CARDINALS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

// A 12x12 field, free except for the named cells.
function fieldWithout(blocked: readonly string[]): (x: number, y: number) => boolean {
  const wall = new Set(blocked);
  return (x, y) => x >= 0 && y >= 0 && x < 12 && y < 12 && !wall.has(`${String(x)},${String(y)}`);
}

describe('where a building puts the unit it just trained', () => {
  // The AI closed a two-cell pocket at (48,23) between its house, mill,
  // barracks, farm and its own Town Center, and then spawned every villager it
  // trained into it. Each one passed the old egress rule — the pocket's second
  // cell is a passable neighbour — and then stood there for the rest of the
  // match with gather targets it had no path to. Seven of eleven units ended up
  // in that pocket and the AI's food and wood income was zero from tick 12000.
  it('rejects a cell whose only way out is a dead end', () => {
    const pocket = fieldWithout([
      '4,5', '5,4', '6,4', '7,4', '5,6', '6,6', '7,6', '7,5',
    ]);
    expect(hasSpawnEgress({ x: 5, y: 5 }, {
      isCellPassable: pocket, neighborOffsets: CARDINALS,
    })).toBe(false);
  });

  it('accepts a cell that opens onto the rest of the map', () => {
    const openField = fieldWithout(['5,4', '6,4', '7,4']);
    expect(hasSpawnEgress({ x: 5, y: 5 }, {
      isCellPassable: openField, neighborOffsets: CARDINALS,
    })).toBe(true);
  });

  it('still rejects a cell that is blocked outright', () => {
    expect(hasSpawnEgress({ x: 5, y: 5 }, {
      isCellPassable: fieldWithout(['5,5']), neighborOffsets: CARDINALS,
    })).toBe(false);
  });

  it('passes over a pocket to reach a candidate with real room', () => {
    const pocket = fieldWithout([
      '4,5', '5,4', '6,4', '7,4', '5,6', '6,6', '7,6', '7,5',
    ]);
    expect(findSafeSpawnWithEgress({
      candidates: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 2, y: 2 }],
      isCellPassable: pocket,
      neighborOffsets: CARDINALS,
    })).toEqual({ x: 2, y: 2 });
  });
});
