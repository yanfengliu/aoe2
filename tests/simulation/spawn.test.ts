import { describe, expect, it } from 'vitest';

import type { Position } from 'civ-engine';

import { findSafeSpawnWithEgress, hasSpawnEgress } from '../../src/game/simulation/spawn';

const CARDINALS: ReadonlyArray<Position> = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

// A run of walkable cells long enough to count as somewhere a unit can go.
// A spawn cell must belong to a region of workable size, not merely have one
// passable neighbour: a two-cell pocket satisfies "has a neighbour" and still
// traps forever, which is how the AI stranded seven villagers beside its own
// Town Center (see the note in spawn.ts).
function roomAlongRow(y: number, fromX: number, toX: number): string[] {
  const cells: string[] = [];
  for (let x = fromX; x <= toX; x += 1) cells.push(`${String(x)},${String(y)}`);
  return cells;
}

describe('findSafeSpawnWithEgress', () => {
  it('returns the first candidate that is passable and opens onto real room', () => {
    const passable = new Set<string>(roomAlongRow(1, 1, 10));
    const result = findSafeSpawnWithEgress({
      candidates: [
        { x: 0, y: 0 }, // blocked
        { x: 1, y: 1 }, // passable, and the row it sits in leads somewhere
        { x: 2, y: 1 }, // likewise, but the first match wins
      ],
      isCellPassable: (x, y) => passable.has(`${x},${y}`),
      neighborOffsets: CARDINALS,
    });

    expect(result).toEqual({ x: 1, y: 1 });
  });

  it('skips candidates that are passable but wedged', () => {
    // (1,1) is passable but completely surrounded by blocked cells, and the
    // (3,3)-(4,3) pair is a pocket that traps just as surely. Only the row at
    // y=6 is somewhere a unit can actually leave from.
    const passable = new Set<string>(['1,1', '3,3', '4,3', ...roomAlongRow(6, 1, 10)]);
    const result = findSafeSpawnWithEgress({
      candidates: [
        { x: 1, y: 1 }, // wedged with no neighbour at all
        { x: 3, y: 3 }, // a two-cell pocket — a neighbour, but nowhere to go
        { x: 3, y: 6 }, // real room
      ],
      isCellPassable: (x, y) => passable.has(`${x},${y}`),
      neighborOffsets: CARDINALS,
    });

    expect(result).toEqual({ x: 3, y: 6 });
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

  it('returns false when passable but nothing adjoins it', () => {
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

  it('returns false when its only neighbour is a dead end', () => {
    const passable = new Set<string>(['1,1', '0,1']);
    const result = hasSpawnEgress(
      { x: 1, y: 1 },
      {
        isCellPassable: (x, y) => passable.has(`${x},${y}`),
        neighborOffsets: CARDINALS,
      },
    );

    expect(result).toBe(false);
  });

  it('returns true when it belongs to a region a unit can leave by', () => {
    const passable = new Set<string>(roomAlongRow(1, 0, 10));
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
