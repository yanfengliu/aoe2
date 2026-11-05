// DE's House thresholds, age by age, as a table (work 141, review round 0,
// F6). The self-play gate only fails when Houses come too LATE, so a
// threshold set too high, a pending count too generous or a missing hard-limit
// guard would pass it; this table pins each one from DE's own scripts
// (resources/_common/ai/Promisory/buildings.per, as `aiHousing.ts` reads them).
// Bound: the pure rule only. The building phase's wiring of the hard limit is
// `aiHousedAtLimit.test.ts`'s; the pending count and the Blacksmith the phase
// passes in are pinned by NO test: the self-play gate's window ends before a
// seat spends long enough in Feudal for 6 against 8 to matter.

import { describe, expect, it } from 'vitest';

import { houseWanted, type HousingState } from '../../src/game/simulation/aiHousing';

const base: HousingState = {
  age: 'dark-age',
  popCurrent: 0,
  popCap: 0,
  hardCap: 200,
  housesPending: 0,
  ownsBlacksmith: false,
};

/** Wanted with exactly `free` population left, everything else as given. */
function wantedWithFree(free: number, state: Partial<HousingState>): boolean {
  const popCap = state.popCap ?? 50;
  return houseWanted({ ...base, ...state, popCap, popCurrent: popCap - free });
}

/** The smallest free population at which no House is wanted. */
function threshold(state: Partial<HousingState>): number {
  let free = 0;
  while (wantedWithFree(free, state) && free < 100) free += 1;
  return free;
}

describe('the computer starts a House by DE\'s headroom rule (work 141)', () => {
  it('Dark Age: under 3 free, one at a time (buildings.per 1584-1596)', () => {
    expect(threshold({ age: 'dark-age' })).toBe(3);
    expect(wantedWithFree(0, { age: 'dark-age', housesPending: 1 })).toBe(false);
  });

  // INTERIM: DE's Feudal-war rule (1646-1659) at every level until work 141 M2
  // picks the rule per level and strategy; DE's usual strategy uses under 4, or
  // under 6 with a Blacksmith (1584-1596, 1623-1634). See aiHousing.ts.
  it('Feudal Age: under 6, or under 8 once a Blacksmith is placed, one at a time (interim, 1646-1659)', () => {
    expect(threshold({ age: 'feudal-age' })).toBe(6);
    expect(threshold({ age: 'feudal-age', ownsBlacksmith: true })).toBe(8);
    expect(wantedWithFree(0, { age: 'feudal-age', housesPending: 1 })).toBe(false);
  });

  it('Castle Age: under 10, 16 from 42 population, 20 from 64, two at a time (1767-1779)', () => {
    expect(threshold({ age: 'castle-age', popCap: 40 })).toBe(10);
    // The population in force is the one at the moment of asking, so the cap
    // is set well above it and the threshold read at that population.
    const atPopulation = (popCurrent: number, free: number, housesPending = 0) => houseWanted({
      ...base, age: 'castle-age', popCurrent, popCap: popCurrent + free, housesPending,
    });
    expect(atPopulation(41, 9)).toBe(true);
    expect(atPopulation(41, 10)).toBe(false);
    expect(atPopulation(42, 15)).toBe(true);
    expect(atPopulation(42, 16)).toBe(false);
    expect(atPopulation(63, 15)).toBe(true);
    expect(atPopulation(63, 16)).toBe(false);
    expect(atPopulation(64, 19)).toBe(true);
    expect(atPopulation(64, 20)).toBe(false);
    expect(atPopulation(42, 0, 1)).toBe(true);
    expect(atPopulation(42, 0, 2)).toBe(false);
  });

  it('Imperial Age: under 20, three at a time (1789-1801)', () => {
    expect(threshold({ age: 'imperial-age', popCap: 100 })).toBe(20);
    expect(wantedWithFree(0, { age: 'imperial-age', popCap: 100, housesPending: 2 })).toBe(true);
    expect(wantedWithFree(0, { age: 'imperial-age', popCap: 100, housesPending: 3 })).toBe(false);
  });

  it('never at the hard population limit, in any age', () => {
    for (const age of ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'] as const) {
      expect(houseWanted({ ...base, age, popCurrent: 200, popCap: 200, hardCap: 200 }), age).toBe(false);
      expect(houseWanted({ ...base, age, popCurrent: 199, popCap: 199, hardCap: 200 }), age).toBe(true);
    }
  });
});
