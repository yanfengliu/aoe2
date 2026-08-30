// The wood held back from military so the age-up PREREQUISITES can be built.
//
// Its sibling `ageUpReserveCost` protects the age-up research, but only once
// the owner already qualifies — so nothing protected the cost of BECOMING
// qualified, which is the half that was blocking every AI in the Feudal Age.
// See `aiReachesCastleAge.test.ts` for the end-to-end contract.
//
// Every case here is a BRANCH, deliberately. An earlier version opened with
// `agePrerequisiteWoodReserve('feudal-age', false, 9, 5, 150) === 150`, which
// asserts `return nextQualifyingWoodCost` — an identity on an argument, and
// unfailable short of deleting the return statement.

import { describe, expect, it } from 'vitest';

import {
  agePrerequisiteWoodReserve,
  QUALIFYING_FEUDAL_BUILDINGS,
} from '../../src/game/simulation/aiResourceReserve';
import { attackGroupSize } from '../../src/game/simulation/ai';
import {
  agePrerequisiteBuildingTypes,
} from '../../src/game/simulation/prototypeBuildingRules';
import { constructionCost } from '../../src/game/simulation/prototypeEconomyRules';

const FLOOR = attackGroupSize('feudal-age');

describe('agePrerequisiteWoodReserve', () => {
  it('holds the wood back once the army is at its defensive floor', () => {
    expect(agePrerequisiteWoodReserve('feudal-age', false, FLOOR, FLOOR, 150)).toBe(150);
  });

  it('trains freely below that floor, whatever it is saving for', () => {
    // Without this the reserve is a total training ban on any map whose wood
    // never reaches it: review measured the army pinned at 3 units against a
    // baseline of 6-7, on seeds where the building was never affordable
    // either — pure loss. It is the same floor `militaryGrowthPausedForAgeUp`
    // keeps, for the reason its own comment gives.
    expect(agePrerequisiteWoodReserve('feudal-age', false, FLOOR - 1, FLOOR, 150)).toBe(0);
    expect(agePrerequisiteWoodReserve('feudal-age', false, 0, FLOOR, 150)).toBe(0);
  });

  it('stops the moment the owner qualifies', () => {
    // Takes the AUTHORITATIVE predicate rather than counting buildings: it
    // short-circuits true for the Khmer, who advance with no prerequisites at
    // all and must not hold wood back for a building they do not need.
    expect(agePrerequisiteWoodReserve('feudal-age', true, FLOOR, FLOOR, 175)).toBe(0);
  });

  it('is scoped to the transition it was measured on', () => {
    // Dark-Age prerequisites are the camps, which the build order handles
    // ahead of everything; and no match had reached the Castle Age for the
    // next transition's behaviour to be observed, so it is left alone rather
    // than generalised on an assumption.
    for (const age of ['dark-age', 'castle-age', 'imperial-age'] as const) {
      expect(agePrerequisiteWoodReserve(age, false, FLOOR, FLOOR, 150)).toBe(0);
    }
  });

  it('reserves for a building the age-advance rule actually accepts', () => {
    // The drift this guards: the qualifying list is maintained here AND in
    // `prototypeBuildingRules`, and a reserve saving for something the
    // advance does not count would hold the army back for nothing. Pinning
    // the two against each other is what ties them together.
    expect(new Set(QUALIFYING_FEUDAL_BUILDINGS))
      .toEqual(new Set(agePrerequisiteBuildingTypes('castle-age')));
    // And cheapest-first, which is what makes the reserve as small and as
    // short-lived as it can be.
    const costs = QUALIFYING_FEUDAL_BUILDINGS.map((b) => constructionCost(b).wood ?? 0);
    expect(costs, `not cheapest-first: ${costs.join(',')}`)
      .toEqual([...costs].sort((a, b) => a - b));
  });
});
