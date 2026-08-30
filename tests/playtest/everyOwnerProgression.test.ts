// The gate that can see a FROZEN player (2026-08-29).
//
// `checkAgeProgression` passes when ANY living owner reaches the age, so a
// match where one side never plays reads green. That is not hypothetical: on
// `aoe2-prototype` — the map the game boots — owner 2 sat in the Dark Age past
// 24,000 ticks while owner 1 aged up, and the corpus was green throughout
// (root cause fixed in v0.3.163; see the defect register). A gate that cannot
// see the player who did not progress is not guarding progression.
//
// `everyOwner` is the strict reading: every LIVING owner must have reached the
// age. Eliminated players are still exempt — losing is not a stall.

import { describe, expect, it } from 'vitest';

import { checkEveryOwnerAgeProgression } from '../../src/game/playtest/progressionCheck';

describe('every-owner age progression', () => {
  it('fails when one living owner is frozen and the other advanced', () => {
    const result = checkEveryOwnerAgeProgression(
      { 1: 'feudal-age', 2: 'dark-age' }, [1, 2], 'feudal-age',
    );
    expect(result.ok, 'a frozen second player must be visible').toBe(false);
    expect(result.message).toContain('2:dark-age');
  });

  it('passes when every living owner reached the age', () => {
    expect(checkEveryOwnerAgeProgression(
      { 1: 'feudal-age', 2: 'castle-age' }, [1, 2], 'feudal-age',
    ).ok).toBe(true);
  });

  it('exempts the eliminated: losing is not a progression stall', () => {
    // Owner 2 is dark-age but DEAD — it lost, which the old check already
    // treated as legitimate and this one must not regress.
    expect(checkEveryOwnerAgeProgression(
      { 1: 'feudal-age', 2: 'dark-age' }, [1], 'feudal-age',
    ).ok).toBe(true);
  });

  it('passes on mutual elimination, like the any-owner check', () => {
    expect(checkEveryOwnerAgeProgression({}, [], 'feudal-age').ok).toBe(true);
  });
});
