import { describe, expect, it } from 'vitest';

import { findPlacementAnchorNear } from '../../src/game/simulation/bridge/placementSearch';

// v0.1.93 FIND → v0.1.94 fix: the AI could never place a 4x4 building (market,
// castle, wonder) in an established base — findBuildPlacementNear only scanned
// Chebyshev radius 2..6 around the Town Center, and no 4x4 gap survives the
// packed inner rings, so the search returned null and the AI hoarded resources
// on a build it could never complete. The fix widens the default cap to 12.

const ORIGIN = { x: 20, y: 20 };
const MAP = 48;
// A base whose inner rings (Chebyshev distance <= 6 from the origin) are fully
// built up; open ground only starts at radius 7.
const innerRingBlocked = (x: number, y: number): boolean =>
  Math.max(Math.abs(x - ORIGIN.x), Math.abs(y - ORIGIN.y)) <= 6;

describe('findPlacementAnchorNear — reaches past a crowded base for large footprints', () => {
  it('finds a 4x4 (market/castle/wonder) anchor past the packed inner rings', () => {
    // The old radius-6 cap cannot reach it — proves the bug.
    expect(
      findPlacementAnchorNear(ORIGIN, { width: 4, height: 4 }, MAP, MAP, innerRingBlocked, 6),
    ).toBeNull();
    // The default cap must reach the open radius-7+ ring.
    const anchor = findPlacementAnchorNear(ORIGIN, { width: 4, height: 4 }, MAP, MAP, innerRingBlocked);
    expect(anchor).not.toBeNull();
    // ...and the anchor it returns must actually be unblocked.
    expect(innerRingBlocked(anchor!.x, anchor!.y)).toBe(false);
  });

  it('still finds a 3x3 building an anchor in the near ring (no regression for small buildings)', () => {
    // Only radius 2 blocked; a 3x3 slots into radius 3 as before.
    const justCoreBlocked = (x: number, y: number): boolean =>
      Math.max(Math.abs(x - ORIGIN.x), Math.abs(y - ORIGIN.y)) <= 2;
    const anchor = findPlacementAnchorNear(ORIGIN, { width: 3, height: 3 }, MAP, MAP, justCoreBlocked);
    expect(anchor).not.toBeNull();
  });

  it('returns null when the entire search area is blocked', () => {
    const allBlocked = (): boolean => true;
    expect(findPlacementAnchorNear(ORIGIN, { width: 4, height: 4 }, MAP, MAP, allBlocked)).toBeNull();
  });
});
