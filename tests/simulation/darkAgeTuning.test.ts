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
//
// Work 141 (2026-11-04) replaced the 4 : 3 split with DE's own: 75% food and
// 25% wood below 12 villagers (Promisory dawn.per 72-78); the cap stays 10, so
// the AI never reaches 12 in the Dark Age, until work 141's M2 decides the
// per-level villager counts. The pins below are DE's numbers now.
//
// Work 144 M2 (2026-11-05): the Dark Age trains to DE's `darkvills`, 29
// (const.per 3384), under DE's own villager rule (`aiDarkAgeBoom.ts`), which
// reads its bound from this seam (`villagerCapForAge`); from 12 villagers the
// split is dawn.per's per-villager counts, so the 3 : 1 weights are the split
// below 12 only. The Feudal bound is the Castle Age's 40 (the coordinator's
// decision 6): DE's Feudal rule trains until the Castle Age is banked, with no
// count of its own (units.per 409-415).

import { describe, expect, it } from 'vitest';

import {
  DARK_AGE_TUNING,
  villagerCapForAge,
  villagerTargetsForAge,
} from '../../src/game/simulation/aiEconomyPlan';

describe('the Dark-Age tuning seam', () => {
  it('ships DE\'s Dark Age: food 3 : wood 1 below 12 villagers, and the count to 29', () => {
    expect(DARK_AGE_TUNING.villagerCap).toBe(29);
    expect(DARK_AGE_TUNING.weights).toEqual({ food: 3, wood: 1, gold: 0, stone: 0 });
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
    expect(DARK_AGE_TUNING.weights.food).toBe(3);
    expect(villagerTargetsForAge('dark-age')).toEqual({ food: 3, wood: 1, gold: 0, stone: 0 });
  });

  it('bounds the Feudal Age by the Castle Age, and leaves the later ages alone', () => {
    expect(villagerCapForAge('feudal-age')).toBe(40);
    expect(villagerCapForAge('castle-age')).toBe(40);
    expect(villagerCapForAge('imperial-age')).toBe(60);
  });
});
