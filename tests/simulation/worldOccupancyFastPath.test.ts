// The occupancy spawn-passability fast path must answer exactly what the
// merged status did.
//
// `isCellPassableForSpawn` is the hottest query in the simulation — pathfinding
// asks it for every neighbour of every expanded node, and it profiled at 32% of
// all CPU during AI self-play, nearly all of that allocation the predicate then
// discards (a position-key string, two filtered arrays, two spread arrays and a
// status object per call). It now reads the engine's claims directly. That is
// only safe while it agrees with the merged answer everywhere, so this compares
// the two cell by cell over a populated occupancy rather than trusting the
// rewrite.

import { describe, expect, it } from 'vitest';

import { createWorldOccupancy } from '../../src/game/simulation/worldOccupancy';

/** The pre-optimisation definition, expressed against the merged status. */
function passableViaMergedStatus(
  occupancy: ReturnType<typeof createWorldOccupancy>,
  x: number,
  y: number,
): boolean {
  return !occupancy.getCellStatus(x, y).blockedBy.some((claim) => (
    claim.kind === 'bounds' || claim.kind === 'terrain'
    || claim.kind === 'building' || claim.kind === 'resource'
  ));
}

describe('the occupancy spawn-passability fast path', () => {
  it('agrees with the merged status on open, terrain, building, resource and out-of-bounds cells', () => {
    const width = 24;
    const height = 20;
    const occupancy = createWorldOccupancy(width, height);
    // Terrain wall, a building footprint, and scattered resources — so the
    // sweep meets every claim kind the predicate discriminates on.
    occupancy.blockTerrain([{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 5, y: 7 }]);
    occupancy.syncBuilding(101, { x: 10, y: 10 }, { width: 3, height: 3 });
    occupancy.syncResource(201, { x: 15, y: 4 });
    occupancy.syncResource(202, { x: 16, y: 4 });
    // A unit CROWDS rather than blocks: the predicate must still pass its cell.
    occupancy.syncUnit(301, { x: 8, y: 3 });

    let checked = 0;
    let blockedSeen = 0;
    const disagreements: string[] = [];
    for (let y = -2; y <= height + 1; y += 1) {
      for (let x = -2; x <= width + 1; x += 1) {
        const fast = occupancy.isCellPassableForSpawn(x, y);
        const merged = passableViaMergedStatus(occupancy, x, y);
        checked += 1;
        if (!merged) blockedSeen += 1;
        if (fast !== merged) disagreements.push(`(${x},${y}) fast=${fast} merged=${merged}`);
      }
    }

    expect(checked, 'the sweep must cover the map and its margins').toBeGreaterThan(500);
    expect(blockedSeen, 'blocked cells must exist or this proves nothing').toBeGreaterThan(10);
    expect(disagreements.slice(0, 5)).toEqual([]);
  });

  it('still passes a cell that only a UNIT occupies', () => {
    const occupancy = createWorldOccupancy(12, 12);
    occupancy.syncUnit(1, { x: 4, y: 4 });
    // Units crowd; they do not block spawn passability. A fast path that
    // conflated the two would wall the map off behind its own villagers.
    expect(occupancy.isCellPassableForSpawn(4, 4)).toBe(true);
    expect(occupancy.isCellPassableForSpawn(4, 4)).toBe(passableViaMergedStatus(occupancy, 4, 4));
  });

  it('refuses every out-of-bounds cell, as bounds claims did', () => {
    const occupancy = createWorldOccupancy(8, 8);
    for (const [x, y] of [[-1, 0], [0, -1], [8, 0], [0, 8], [-5, -5]]) {
      expect(occupancy.isCellPassableForSpawn(x, y)).toBe(false);
      expect(occupancy.isCellPassableForSpawn(x, y)).toBe(passableViaMergedStatus(occupancy, x, y));
    }
  });

  it('refuses a non-integer or NaN cell instead of aliasing another one', () => {
    // The merged path raised `occupancy_coords_not_integer` for these. The memo
    // would index out of range — or, on an even-width map, land on a DIFFERENT
    // cell's slot: (4, 4.5) on a 16-wide map computes index 76, which is (12, 4).
    const occupancy = createWorldOccupancy(16, 16);
    occupancy.syncBuilding(1, { x: 12, y: 4 }, { width: 1, height: 1 });
    for (const [x, y] of [[4.5, 4], [4, 4.5], [Number.NaN, 4], [4, Number.NaN]]) {
      expect(occupancy.isCellPassableForSpawn(x, y)).toBe(false);
    }
    // And the aliasing candidate did not poison the cell it would have hit.
    expect(occupancy.isCellPassableForSpawn(4, 4)).toBe(true);
  });

  // The sweep above populates the world and THEN queries it, so it would pass
  // against a memo that never invalidated at all — a critic proved exactly that
  // by mutating the invalidation condition and watching all nine tests stay
  // green. The memo's whole correctness argument is about invalidation, so it
  // needs a test that mutates AFTER a query and asks again. This one found a
  // real defect on its first run: `syncUnit` released an entity's claims
  // without bumping the revision, so a cell freed by a building or resource
  // being re-synced as a unit stayed blocked in the memo forever.
  describe('invalidation — a query after a mutation must see the mutation', () => {
    const width = 16;
    const height = 16;

    /** Warm the memo on `cell`, run `mutate`, then require agreement again. */
    function requireFreshAnswer(
      label: string,
      cell: { x: number; y: number },
      setUp: (occupancy: ReturnType<typeof createWorldOccupancy>) => void,
      mutate: (occupancy: ReturnType<typeof createWorldOccupancy>) => void,
    ): void {
      const occupancy = createWorldOccupancy(width, height);
      setUp(occupancy);
      // Warming is the point: without this read the memo is empty and any
      // implementation passes.
      const warmed = occupancy.isCellPassableForSpawn(cell.x, cell.y);
      expect(warmed, `${label}: setup must establish a verdict to go stale`)
        .toBe(passableViaMergedStatus(occupancy, cell.x, cell.y));

      mutate(occupancy);

      const after = occupancy.isCellPassableForSpawn(cell.x, cell.y);
      const truth = passableViaMergedStatus(occupancy, cell.x, cell.y);
      expect(after, `${label}: answer is stale after the mutation`).toBe(truth);
      expect(truth, `${label}: the mutation must actually change the verdict`)
        .not.toBe(warmed);
    }

    it('sees a building appear and disappear', () => {
      requireFreshAnswer('building added', { x: 6, y: 6 }, () => {}, (o) => {
        o.syncBuilding(700, { x: 6, y: 6 }, { width: 2, height: 2 });
      });
      requireFreshAnswer(
        'building released',
        { x: 6, y: 6 },
        (o) => o.syncBuilding(700, { x: 6, y: 6 }, { width: 2, height: 2 }),
        (o) => o.release(700),
      );
    });

    it('sees a resource appear and disappear', () => {
      requireFreshAnswer('resource added', { x: 9, y: 3 }, () => {}, (o) => {
        o.syncResource(500, { x: 9, y: 3 });
      });
      requireFreshAnswer(
        'resource released',
        { x: 9, y: 3 },
        (o) => o.syncResource(500, { x: 9, y: 3 }),
        (o) => o.release(500),
      );
    });

    it('sees terrain blocked and unblocked', () => {
      requireFreshAnswer('terrain blocked', { x: 2, y: 11 }, () => {}, (o) => {
        o.blockTerrain([{ x: 2, y: 11 }]);
      });
      requireFreshAnswer(
        'terrain unblocked',
        { x: 2, y: 11 },
        (o) => o.blockTerrain([{ x: 2, y: 11 }]),
        (o) => o.unblockTerrain([{ x: 2, y: 11 }]),
      );
    });

    it('sees a structural claim dropped by syncUnit reusing the same id', () => {
      // The defect this suite was extended to catch. An id synced as a unit may
      // still hold a building or resource claim from a previous life; that
      // release frees the cell, so the memo must not keep answering `false`.
      requireFreshAnswer(
        'resource id re-synced as a unit',
        { x: 11, y: 11 },
        (o) => o.syncResource(500, { x: 11, y: 11 }),
        (o) => o.syncUnit(500, { x: 11, y: 11 }),
      );
      requireFreshAnswer(
        'building id re-synced as a unit',
        { x: 7, y: 7 },
        (o) => o.syncBuilding(700, { x: 6, y: 6 }, { width: 2, height: 2 }),
        (o) => o.syncUnit(700, { x: 0, y: 0 }),
      );
    });

    it('sees a route opened by notePassabilityChange', () => {
      // A gate finishing opens a cell without claiming or releasing one, so it
      // is the one mutation with no claim change to key on.
      const occupancy = createWorldOccupancy(width, height);
      occupancy.syncBuilding(900, { x: 4, y: 9 }, { width: 1, height: 1 });
      expect(occupancy.isCellPassableForSpawn(4, 9)).toBe(false);
      const before = occupancy.structuralRevision();
      occupancy.notePassabilityChange();
      expect(occupancy.structuralRevision()).not.toBe(before);
    });
  });
});
