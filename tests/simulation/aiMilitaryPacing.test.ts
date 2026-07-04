import { describe, expect, it } from 'vitest';

import { militaryGrowthPausedForAgeUp } from '../../src/game/simulation/ai';

// v0.1.92 (wood/age-up): grounded 2026-07-04 by replaying the default-seed
// corpus (LABELED dump + gather-state --detail). The AI stalls in Feudal at
// 1/2 Castle prerequisites: it over-produces military (21 units) to its ~40 pop
// cap, forcing a House-build treadmill that drains the wood it needs for a 2nd
// Feudal-prerequisite building (stable/archery-range/market). Wood GATHERING is
// healthy (not gridlocked) — the blocker is the pop-cap treadmill. This helper
// pauses military GROWTH once the AI holds a full attack group AND is stuck
// short of the next age, so pop room (and thus wood) frees up for that building.
// It preserves the FU4 "5+ military" guard: it only pauses AT/above
// attackGroupSize, never below it.

describe('militaryGrowthPausedForAgeUp — free pop/wood for a stuck Feudal age-up', () => {
  it('pauses growth when stuck in Feudal with a full attack group (>= 5)', () => {
    // Feudal, cannot yet advance (only 1/2 prereqs), already has 21 military.
    expect(militaryGrowthPausedForAgeUp('feudal-age', false, 21)).toBe(true);
  });

  it('keeps growing while below the attack-group floor (preserves the 5+ guard)', () => {
    // Stuck, but only 4 military — must keep training to reach 5+.
    expect(militaryGrowthPausedForAgeUp('feudal-age', false, 4)).toBe(false);
  });

  it('pins the boundary: pauses at exactly the attack-group floor (5), not before', () => {
    expect(militaryGrowthPausedForAgeUp('feudal-age', false, 5)).toBe(true);
  });

  it('does NOT pause once the AI can advance (prereqs met — resume military)', () => {
    // qualifiesForNextAge = true → the age-up reserve takes over; grow freely.
    expect(militaryGrowthPausedForAgeUp('feudal-age', true, 21)).toBe(false);
  });

  it('never pauses outside Feudal (Dark rush + Castle/Imperial push unaffected)', () => {
    expect(militaryGrowthPausedForAgeUp('dark-age', false, 21)).toBe(false);
    expect(militaryGrowthPausedForAgeUp('castle-age', false, 21)).toBe(false);
    expect(militaryGrowthPausedForAgeUp('imperial-age', false, 21)).toBe(false);
  });
});
