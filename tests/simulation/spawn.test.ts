import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';

import { findSafeSpawnWithEgress, hasSpawnEgress } from '../../src/game/simulation/spawn';

const CARDINALS: ReadonlyArray<Position> = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

describe('findSafeSpawnWithEgress', () => {
  it('returns the first candidate that is passable and has a passable neighbor', () => {
    // A 3x3 world where only (1,1) and (2,1) are passable. (1,1) is a
    // legal spawn because (2,1) is a passable neighbor.
    const passable = new Set<string>(['1,1', '2,1']);
    const result = findSafeSpawnWithEgress({
      candidates: [
        { x: 0, y: 0 }, // blocked
        { x: 1, y: 1 }, // passable, (2,1) is a passable cardinal neighbor
        { x: 2, y: 1 }, // passable, (1,1) is a passable cardinal neighbor
      ],
      isCellPassable: (x, y) => passable.has(`${x},${y}`),
      neighborOffsets: CARDINALS,
    });

    expect(result).toEqual({ x: 1, y: 1 });
  });

  it('skips candidates that are passable but have no passable neighbor', () => {
    // (1,1) is passable but completely surrounded by blocked cells; (3,3)
    // is passable and has a passable neighbor (4,3). The helper must
    // skip the wedged candidate.
    const passable = new Set<string>(['1,1', '3,3', '4,3']);
    const result = findSafeSpawnWithEgress({
      candidates: [
        { x: 1, y: 1 }, // wedged
        { x: 3, y: 3 }, // has neighbor (4,3)
      ],
      isCellPassable: (x, y) => passable.has(`${x},${y}`),
      neighborOffsets: CARDINALS,
    });

    expect(result).toEqual({ x: 3, y: 3 });
  });

  it('returns null when every candidate is blocked or wedged', () => {
    const passable = new Set<string>(['1,1']); // (1,1) wedged, nothing else
    const result = findSafeSpawnWithEgress({
      candidates: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
      isCellPassable: (x, y) => passable.has(`${x},${y}`),
      neighborOffsets: CARDINALS,
    });

    expect(result).toBeNull();
  });

  it('returns null when the candidate list is empty', () => {
    const result = findSafeSpawnWithEgress({
      candidates: [],
      isCellPassable: () => true,
      neighborOffsets: CARDINALS,
    });

    expect(result).toBeNull();
  });
});

describe('hasSpawnEgress', () => {
  it('returns false when the candidate cell itself is not passable', () => {
    const passable = new Set<string>(['2,1']);
    const result = hasSpawnEgress(
      { x: 1, y: 1 },
      {
        isCellPassable: (x, y) => passable.has(`${x},${y}`),
        neighborOffsets: CARDINALS,
      },
    );

    expect(result).toBe(false);
  });

  it('returns false when passable but no cardinal neighbor is passable', () => {
    const passable = new Set<string>(['1,1']);
    const result = hasSpawnEgress(
      { x: 1, y: 1 },
      {
        isCellPassable: (x, y) => passable.has(`${x},${y}`),
        neighborOffsets: CARDINALS,
      },
    );

    expect(result).toBe(false);
  });

  it('returns true when passable and at least one cardinal neighbor is passable', () => {
    const passable = new Set<string>(['1,1', '0,1']);
    const result = hasSpawnEgress(
      { x: 1, y: 1 },
      {
        isCellPassable: (x, y) => passable.has(`${x},${y}`),
        neighborOffsets: CARDINALS,
      },
    );

    expect(result).toBe(true);
  });
});
