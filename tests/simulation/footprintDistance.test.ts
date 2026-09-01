// Distance to a building must be to the nearest cell it OCCUPIES, not to its
// origin corner.
//
// Measured on `seed-7`: a carrier holding ten wood paced between (49,21) and
// (50,21) indefinitely, traffic granting `proceed` on every tick, because the
// two cells disagreed about which drop-off was nearest. Measuring to origins,
// from (49,21) the Town Centre at (48,24) reads 4 and the Lumber Camp at
// (52,22) reads 4; from (50,21) they read 5 and 3. Measuring to real
// footprints, the Town Centre's nearest cell is (50,24) — distance 3 from
// both cells — and the disagreement disappears. A 4x4 origin is up to three
// tiles from the cell a unit actually walks to, and wrong by a different
// amount from each side.

import { describe, expect, it } from 'vitest';

import { manhattanDistanceToFootprint } from '../../src/game/simulation/bridge/footprintDistance';

const TC = { x: 48, y: 24 };
const TC_SIZE = { width: 4, height: 4 };
const CAMP = { x: 52, y: 22 };
const CAMP_SIZE = { width: 2, height: 2 };

describe('distance to a building footprint', () => {
  it('measures to the nearest occupied cell, not the origin corner', () => {
    // (50,21) is directly above the Town Centre's (50,24).
    expect(manhattanDistanceToFootprint({ x: 50, y: 21 }, TC, TC_SIZE)).toBe(3);
  });

  it('stops the winner REVERSING between two adjacent cells', () => {
    // The property that matters is not that both cells agree outright — it is
    // that the ordering never flips, so a stable tie-break lands on the same
    // building from either cell. Origin distances flip it; footprint distances
    // do not.
    //
    //                     to origin              to footprint
    //   from (49,21)  TC 4  camp 4  tie      TC 3  camp 4  TC
    //   from (50,21)  TC 5  camp 3  camp     TC 3  camp 3  tie
    const from49 = { x: 49, y: 21 };
    const from50 = { x: 50, y: 21 };
    const originDelta = (from: { x: number; y: number }): number => (
      (Math.abs(from.x - TC.x) + Math.abs(from.y - TC.y))
      - (Math.abs(from.x - CAMP.x) + Math.abs(from.y - CAMP.y))
    );
    // The defect, pinned: measured to origins the Town Centre goes from tied
    // to strictly worse across one step.
    expect(originDelta(from49)).toBe(0);
    expect(originDelta(from50)).toBeGreaterThan(0);

    const footprintDelta = (from: { x: number; y: number }): number => (
      manhattanDistanceToFootprint(from, TC, TC_SIZE)
      - manhattanDistanceToFootprint(from, CAMP, CAMP_SIZE)
    );
    // The fix: never strictly worse from either cell, so the ordering cannot
    // reverse across the step.
    expect(footprintDelta(from49)).toBeLessThanOrEqual(0);
    expect(footprintDelta(from50)).toBeLessThanOrEqual(0);
  });

  it('is zero inside the footprint', () => {
    expect(manhattanDistanceToFootprint({ x: 49, y: 25 }, TC, TC_SIZE)).toBe(0);
  });

  it('matches plain Manhattan for a 1x1 building', () => {
    const farm = { x: 49, y: 22 };
    expect(manhattanDistanceToFootprint({ x: 45, y: 20 }, farm, { width: 1, height: 1 }))
      .toBe(Math.abs(45 - 49) + Math.abs(20 - 22));
  });

  it('never exceeds the distance to the origin', () => {
    // The footprint contains its origin, so the nearest cell is never farther.
    for (const point of [{ x: 40, y: 40 }, { x: 60, y: 10 }, { x: 48, y: 30 }, { x: 51, y: 24 }]) {
      const toFootprint = manhattanDistanceToFootprint(point, TC, TC_SIZE);
      const toOrigin = Math.abs(point.x - TC.x) + Math.abs(point.y - TC.y);
      expect(toFootprint).toBeLessThanOrEqual(toOrigin);
    }
  });
});
