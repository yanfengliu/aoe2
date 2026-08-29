// The Dark-Age tuning seam (2026-08-29). `DARK_AGE_TUNING` was extracted so
// `scripts/ai-dark-age-sweep.mjs` can sweep the villager cap and the food/wood
// split together — they only make sense together — and these pin the two
// things that extraction could get wrong: that the shipped numbers are still
// the shipped numbers, and that the plan functions actually read the seam
// rather than keeping their own copy.
//
// The values are pinned rather than merely wired because a sweep row was
// adopted and withdrawn the same day: it won on `default-seed` and lost 800
// ticks on `aoe2-prototype`, the map the game boots. A silent drift back to a
// swept-but-unadopted row is exactly the regression this guards.

import { describe, expect, it } from 'vitest';

import {
  DARK_AGE_TUNING,
  villagerCapForAge,
  villagerTargetsForAge,
} from '../../src/game/simulation/aiEconomyPlan';

describe('the Dark-Age tuning seam', () => {
  it('ships the measured baseline: cap 10, food 4 : wood 3', () => {
    expect(DARK_AGE_TUNING.villagerCap).toBe(10);
    expect(DARK_AGE_TUNING.weights).toEqual({ food: 4, wood: 3, gold: 0, stone: 0 });
  });

  it('is what the plan functions actually read', () => {
    const cap = DARK_AGE_TUNING.villagerCap;
    const weights = { ...DARK_AGE_TUNING.weights };
    try {
      DARK_AGE_TUNING.villagerCap = 17;
      DARK_AGE_TUNING.weights = { food: 9, wood: 1, gold: 0, stone: 0 };
      expect(villagerCapForAge('dark-age')).toBe(17);
      expect(villagerTargetsForAge('dark-age')).toEqual({ food: 9, wood: 1, gold: 0, stone: 0 });
    } finally {
      DARK_AGE_TUNING.villagerCap = cap;
      DARK_AGE_TUNING.weights = weights;
    }
  });

  it('hands out a COPY, so a caller cannot mutate the tuning through it', () => {
    const targets = villagerTargetsForAge('dark-age') as Record<string, number>;
    targets.food = 99;
    expect(DARK_AGE_TUNING.weights.food).toBe(4);
    expect(villagerTargetsForAge('dark-age')).toEqual({ food: 4, wood: 3, gold: 0, stone: 0 });
  });

  it('leaves the other ages alone', () => {
    expect(villagerCapForAge('feudal-age')).toBe(22);
    expect(villagerCapForAge('castle-age')).toBe(40);
    expect(villagerCapForAge('imperial-age')).toBe(60);
  });
});
