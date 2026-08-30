// The approach timeout is a TRAVEL budget, not a tick count (v0.3.163).
//
// `GATHER_APPROACH_TIMEOUT_TICKS = 80` was written when a unit moved 2 fine
// units per tick — 0.5 tiles/tick, so 80 ticks bought roughly 40 tiles of
// walking and only a villager genuinely stuck behind others ever hit it. The
// §12.4.2 movement clock (v0.3.160) makes a villager walk 0.08 tiles/tick, so
// the same 80 ticks buy 6.4 tiles. Measured on `aoe2-prototype`: owner 2's
// food assignments sit a median 7 tiles away — an ~87-tick walk — so the
// villager abandoned its target JUST before arriving, re-targeted, and did it
// again, forever. It gathered 8% of the time and never left the Dark Age,
// while owner 1 (median 3 tiles, ~37 ticks) was unaffected.

import { describe, expect, it } from 'vitest';

import { gatherApproachBudgetTicks } from '../../src/game/simulation/bridge/systems/gatherApproachBudget';

describe('the gather approach budget', () => {
  it('always allows enough ticks to finish the walk it was given', () => {
    // A villager walks 0.8 tiles/s = 12.5 ticks per tile at TPS 10.
    for (const distance of [1, 3, 7, 12, 20]) {
      const budget = gatherApproachBudgetTicks(distance);
      const walk = distance * 12.5;
      expect(budget, `distance ${distance} must outlast its own walk`).toBeGreaterThan(walk);
    }
  });

  it('still gives up on a contested target rather than waiting forever', () => {
    // The point of the timeout is fan-out: it must remain bounded and modest
    // relative to the walk, not grow without limit.
    expect(gatherApproachBudgetTicks(7)).toBeLessThan(7 * 12.5 * 3);
    expect(gatherApproachBudgetTicks(0)).toBeGreaterThan(0);
  });

  it('grows with distance, so a far target is not judged on a near one’s clock', () => {
    expect(gatherApproachBudgetTicks(12)).toBeGreaterThan(gatherApproachBudgetTicks(3));
  });
});
