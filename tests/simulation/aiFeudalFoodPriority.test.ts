import { describe, expect, it } from 'vitest';

import { villagerTargetsForAge } from '../../src/game/simulation/ai';

// v0.1.89: the AI's Feudal villager allocation is food-dominant so it banks the
// food-heavy Castle age-up instead of hoarding gold. Grounded 2026-07-04 by
// replaying the default-seed corpus bundle (engine-tools-first): BOTH AIs
// stalled in Feudal — owner 1's food stayed pinned at ~20-76 for the entire age
// while its gold climbed monotonically 641 -> 891 -> 1071 -> 1551 (hoarded,
// unused), because the old {food:5,wood:4,gold:2} split put too many villagers
// on the gold the AI never spends and too few on the 800 food a Castle costs.
// These lock the food-priority contract so a future tweak can't silently
// regress the allocation back toward gold and re-strand the AI in Feudal.

describe('AI Feudal allocation — food-priority for the Castle age-up (v0.1.89)', () => {
  it('weights food far above gold (Castle age-up is 800 food : 200 gold = 4:1)', () => {
    const feudal = villagerTargetsForAge('feudal-age');
    // Food must dominate gold by at least 3:1 — the old 5:2 split (2.5:1) let
    // gold out-accumulate the food the AI actually needs to advance.
    expect(feudal.food ?? 0).toBeGreaterThan((feudal.gold ?? 0) * 3);
  });

  it('makes food the single largest Feudal allocation', () => {
    const feudal = villagerTargetsForAge('feudal-age');
    expect(feudal.food ?? 0).toBeGreaterThan(feudal.wood ?? 0);
    expect(feudal.food ?? 0).toBeGreaterThan(feudal.gold ?? 0);
    expect(feudal.food ?? 0).toBeGreaterThan(feudal.stone ?? 0);
  });

  it('still allocates some gold in Feudal (Militia 20 each + the Castle 200 gold)', () => {
    // Cutting gold entirely would starve Militia/archer training and the
    // Castle's own 200-gold half; the fix minimizes gold, it does not zero it.
    const feudal = villagerTargetsForAge('feudal-age');
    expect(feudal.gold ?? 0).toBeGreaterThan(0);
  });
});
