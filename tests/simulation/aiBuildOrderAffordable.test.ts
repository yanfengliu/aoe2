// The build order is a priority list, not a queue (2026-09-06).
//
// `pickNextBuildTarget` returned the first MISSING building and the caller
// then checked whether the owner could pay for it — so an AI that could not
// afford its first choice built nothing at all, for as long as that lasted.
//
// Measured in the coverage lab (`selfPlayContentCoverage.test.ts`) on
// 2026-09-06: owner 1 spent the whole Castle Age with its wood pinned between
// 6 and 127 while a Siege Workshop costs 200, so the Castle-Age order never
// got past its first entry — and it was sitting on 2,506 STONE, enough for
// three Castles, with a Castle alone qualifying it for the Imperial Age
// (spec §7.2). It stood in the Castle Age to the 45,000-tick horizon.
//
// BOUND: this pins the CHOICE the function makes, over a hand-supplied
// affordability predicate. Whether the AI then reaches the Imperial Age is
// `selfPlayContentCoverage.test.ts`, which is where the numbers above came
// from.

import { describe, expect, it } from 'vitest';

import { pickNextBuildTarget } from '../../src/game/simulation/ai';
import type { BuildableBuildingType } from '../../src/game/simulation/types';

const nothingBuilt = () => true;
const only = (...types: BuildableBuildingType[]) => (t: BuildableBuildingType) => types.includes(t);
const everythingBuilt = () => false;
/** Feudal prerequisites and the Dark-Age pair all standing; the Castle-Age
 *  tier is not. */
const castleTierMissing = (t: BuildableBuildingType) =>
  t === 'siege-workshop' || t === 'monastery' || t === 'castle';

describe('AI build order — falls through to what it can pay for', () => {
  it('takes the Castle it can afford over the Siege Workshop it cannot', () => {
    // Owner 1's exact position at tick 40,000 of the lab: 9 wood, 2,506 stone.
    const target = pickNextBuildTarget(
      'castle-age',
      castleTierMissing,
      false,
      { owned: 8, villagerCount: 30, food: 1296 },
      only('castle'),
    );
    expect(target, 'the AI stalled on a Siege Workshop it had no wood for').toBe('castle');
  });

  it('still prefers the first choice when it can pay for that', () => {
    const target = pickNextBuildTarget(
      'castle-age',
      castleTierMissing,
      false,
      { owned: 8, villagerCount: 30, food: 1296 },
      only('siege-workshop', 'monastery', 'castle'),
    );
    expect(target, 'the fall-through overtook an affordable first choice')
      .toBe('siege-workshop');
  });

  it('still names the first choice when it can afford NOTHING, so it keeps saving', () => {
    const target = pickNextBuildTarget(
      'castle-age',
      castleTierMissing,
      false,
      { owned: 8, villagerCount: 30, food: 1296 },
      () => false,
    );
    expect(target, 'a broke AI must still name what it is saving for')
      .toBe('siege-workshop');
  });

  it('keeps the Dark Age inside the Dark Age', () => {
    // Falling through must not offer a Feudal building to a Dark-Age AI: the
    // age bound on the order is a rule, not a preference.
    const target = pickNextBuildTarget(
      'dark-age',
      nothingBuilt,
      false,
      { owned: 0, villagerCount: 6, food: 100 },
      only('blacksmith', 'archery-range', 'stable', 'market', 'castle'),
    );
    expect(
      ['barracks', 'mill', 'lumber-camp', 'mining-camp'],
      'a Dark-Age AI was offered a building it cannot place',
    ).toContain(target);
  });

  it('keeps the Feudal Age out of the Castle-Age tier', () => {
    const target = pickNextBuildTarget(
      'feudal-age',
      castleTierMissing,
      false,
      { owned: 8, villagerCount: 22, food: 900 },
      only('siege-workshop', 'monastery', 'castle'),
    );
    expect(target, 'a Feudal AI was offered a Castle-Age building').toBe(null);
  });

  it('falls through the Feudal order too', () => {
    const target = pickNextBuildTarget(
      'feudal-age',
      only('blacksmith', 'archery-range', 'stable', 'market'),
      false,
      { owned: 8, villagerCount: 22, food: 900 },
      only('market'),
    );
    expect(target, 'the Feudal order stalled on a Blacksmith it had no wood for')
      .toBe('market');
  });

  it('leaves the population block alone: a house or nothing', () => {
    expect(
      pickNextBuildTarget('castle-age', nothingBuilt, true, null, only('castle')),
      'a pop-blocked AI built something other than the House that unblocks it',
    ).toBe('house');
  });

  it('keeps the old answers when no affordability is supplied', () => {
    // Every existing caller and fixture passes four arguments; the default
    // must be the pre-fall-through behaviour exactly.
    expect(pickNextBuildTarget('dark-age', nothingBuilt, false)).toBe('barracks');
    expect(pickNextBuildTarget('castle-age', nothingBuilt, true)).toBe('house');
    expect(
      pickNextBuildTarget('castle-age', castleTierMissing, false, {
        owned: 8, villagerCount: 30, food: 1296,
      }),
    ).toBe('siege-workshop');
    expect(
      pickNextBuildTarget('castle-age', everythingBuilt, false, {
        owned: 0, villagerCount: 30, food: 100,
      }),
    ).toBe('farm');
  });
});
