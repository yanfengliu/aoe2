// The fan-out budget for walking to a CONTESTED resource (v0.3.165).
//
// The previous version of this test asserted `budget(d) > d * 12.5` against a
// distance-based budget and passed — while the property it claimed did NOT
// hold, because movement steps ONE AXIS per tick, so a walk costs MANHATTAN
// distance x 12.5 and the budget was computed from Euclidean hypot. A test
// that models the walk wrongly certifies a property the game does not have.
// The budget is flat now, so the property it must have is about the constant.

import { describe, expect, it } from 'vitest';

import {
  GATHER_APPROACH_BUDGET_TICKS,
  TICKS_PER_TILE,
} from '../../src/game/simulation/bridge/systems/gatherApproachBudget';

// The unreachable backstop this must stay under, from toResourceStep.
const GATHER_UNREACHABLE_TIMEOUT_TICKS = 600;

describe('the gather approach budget', () => {
  it('tracks the movement clock instead of being a bare tick count', () => {
    // The whole defect was a constant whose meaning silently changed when the
    // movement clock did: 80 ticks was ~40 tiles, then 6.4.
    expect(TICKS_PER_TILE).toBeCloseTo(12.5, 5);
    expect(GATHER_APPROACH_BUDGET_TICKS).toBe(Math.round(32 * TICKS_PER_TILE));
  });

  it('outlasts an ordinary walk measured the way the game actually walks', () => {
    // MANHATTAN, not Euclidean: `stepUnitTransformToward` moves one axis per
    // tick. A 12x12 diagonal is 24 tiles of travel, not 17.
    const manhattanWalkTicks = (dx: number, dy: number) => (dx + dy) * TICKS_PER_TILE;
    for (const [dx, dy] of [[7, 0], [6, 6], [5, 5], [3, 3], [10, 2]]) {
      expect(
        GATHER_APPROACH_BUDGET_TICKS,
        `a ${dx}x${dy} walk must fit inside the budget`,
      ).toBeGreaterThan(manhattanWalkTicks(dx, dy));
    }
  });

  it('stays under the unreachable backstop, so that ordering holds', () => {
    // toResourceStep documents the backstop as "much longer than the fan-out
    // timeout, so a genuinely long walk finishes first". A budget that can
    // exceed it inverts the two.
    expect(GATHER_APPROACH_BUDGET_TICKS).toBeLessThan(GATHER_UNREACHABLE_TIMEOUT_TICKS);
  });

  it('still gives up eventually, so fan-out remains a real mechanism', () => {
    expect(GATHER_APPROACH_BUDGET_TICKS).toBeGreaterThan(0);
    expect(GATHER_APPROACH_BUDGET_TICKS).toBeLessThan(GATHER_UNREACHABLE_TIMEOUT_TICKS);
  });
});
