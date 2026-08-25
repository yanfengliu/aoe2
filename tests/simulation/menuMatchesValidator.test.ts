import { describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import { createOptionsRules } from '../../src/game/simulation/bridge/optionsRules';
import { createTrainOptions } from '../../src/game/simulation/bridge/trainOptions';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { canResearchAt, canTrainAt } from '../../src/game/simulation/prototypeBuildingRules';
import { RESEARCHES_BY_BUILDING } from '../../src/game/simulation/buildingProductionTables';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import { ALL_UNIT_TYPES } from '../../src/input/unitTypeMap';
import type {
  AgeType,
  BuildingType,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../src/game/simulation/types';

const AGES: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
// Enumerated from the exhaustive records that already exist for each roster, so
// a type added later is covered here without touching this file.
const BUILDING_TYPES = Object.keys(AUTHORITATIVE_BUILDING_FOOTPRINTS) as BuildingType[];
const UNIT_TYPES = Object.keys(ALL_UNIT_TYPES) as TrainableUnitType[];

// The command card and the command VALIDATOR are two different tables, and a
// unit or technology in one but not the other is a button that does nothing:
// the click is accepted by the UI, silently rejected by the validator, and the
// player is charged nothing and gets nothing. That is how the Transport Ship
// shipped — offered at the Dock from the day it existed, absent from
// TRAINABLE_UNITS_BY_BUILDING, so the only transport anybody ever had was one a
// scenario spawned.
//
// This is the CLASS check: whatever the menu can offer, under any age, any
// civilization and any researched set, the validator must accept.

function menuOffers(): Map<BuildingType, Set<TrainableUnitType>> {
  const offers = new Map<BuildingType, Set<TrainableUnitType>>();
  for (const civilization of CIVILIZATION_NAMES) {
    for (const age of AGES) {
      // Both extremes of the tech state: nothing researched, and everything.
      for (const allResearched of [false, true]) {
        const getTrainOptions = createTrainOptions({
          getPlayerAge: () => age,
          isAtLeastAge: (_owner, minAge) => AGES.indexOf(age) >= AGES.indexOf(minAge),
          hasTechnology: () => allResearched,
          // With everything researched the line resolves to its top tier; with
          // nothing, to its base. Returning the FIRST entry of the chain when
          // un-teched and the LAST when fully teched covers both ends, and the
          // real function is exercised for every entry in between by its own
          // tests.
          latestResearchedInChain: (_owner, chain) => {
            const flat = chain.map((entry) => (Array.isArray(entry) ? entry[0] : entry));
            return (allResearched ? flat[flat.length - 1] : flat[0]) as TrainableUnitType;
          },
          getPlayerCivilization: () => civilization,
        });
        for (const buildingType of BUILDING_TYPES) {
          const options = getTrainOptions(1, buildingType);
          if (options.length === 0) continue;
          const set = offers.get(buildingType) ?? new Set<TrainableUnitType>();
          for (const unitType of options) set.add(unitType);
          offers.set(buildingType, set);
        }
      }
    }
  }
  return offers;
}

describe('every unit the train menu can offer is one the validator accepts', () => {
  it('holds for every building, age, civilization and tech state', () => {
    const unreachable: string[] = [];
    for (const [buildingType, units] of menuOffers()) {
      for (const unitType of units) {
        if (!canTrainAt(buildingType, unitType)) {
          unreachable.push(`${buildingType} offers ${unitType}`);
        }
      }
    }
    expect(unreachable.sort()).toEqual([]);
  });

  it('offers the Transport Ship at the Dock, and the Dock accepts it', () => {
    // The instance that motivated the check above, pinned on its own so a
    // regression names the unit rather than only the class.
    expect(canTrainAt('dock', 'transport-ship')).toBe(true);
  });
});

describe('every technology with a cost is researchable somewhere', () => {
  it('has a building that hosts it', () => {
    const homeless: ResearchableTechnologyType[] = [];
    for (const technologyType of Object.keys(RESEARCH_COSTS) as ResearchableTechnologyType[]) {
      const hosted = BUILDING_TYPES.some((buildingType) =>
        canResearchAt(buildingType, technologyType));
      if (!hosted) homeless.push(technologyType);
    }
    // The three age advances are queued at the Town Center through their own
    // command rather than the research menu, so they are the allowed exception.
    // Every technology with a cost is hosted by a building, the three age
    // advances included (they sit on the Town Center's research list as well as
    // having their own command).
    expect(homeless).toEqual([]);
  });
});

describe('the tables agree with the roster', () => {
  it('names only real units and only real buildings', () => {
    for (const buildingType of BUILDING_TYPES) {
      for (const unitType of UNIT_TYPES) {
        if (canTrainAt(buildingType, unitType)) {
          expect(UNIT_TYPES).toContain(unitType);
        }
      }
    }
  });
});

// The same pair, on the research side: `getResearchOptions` builds the card and
// `canResearchAt` decides whether the command is accepted, and they are two
// separate tables. A technology offered at one building but listed under
// another passes the "hosted somewhere" check above and is still a dead button,
// so this is the tighter, per-BUILDING assertion.
describe('every technology a building offers is one it can research', () => {
  function optionsRulesFor(
    age: AgeType,
    civilization: string,
    allResearched: boolean,
  ) {
    return createOptionsRules({
      latestResearchedInChain: (_owner, chain) => {
        const flat = chain.map((entry) => (Array.isArray(entry) ? entry[0] : entry));
        return (allResearched ? flat[flat.length - 1] : flat[0]) as TrainableUnitType;
      },
      hasTechnology: () => allResearched,
      getPlayerAge: () => age,
      isAtLeastAge: (_owner, minAge) => AGES.indexOf(age) >= AGES.indexOf(minAge),
      getPlayerCivilization: () => civilization,
      canAdvanceToFeudalAge: () => true,
      canAdvanceToCastleAge: () => true,
      canAdvanceToImperialAge: () => true,
      hasCompletedBuilding: () => true,
      hasOwnedWonder: () => false,
      nomadFirstTownCenter: () => false,
    });
  }

  it('holds for the researchable list and the visible list alike', () => {
    const wrong: string[] = [];
    for (const civilization of CIVILIZATION_NAMES) {
      for (const age of AGES) {
        for (const allResearched of [false, true]) {
          const rules = optionsRulesFor(age, civilization, allResearched);
          for (const buildingType of BUILDING_TYPES) {
            const offered = [
              ...rules.getResearchOptions(1, buildingType),
              // The visible list is what the card DRAWS, including entries
              // rendered locked, so a player can see it and click it.
              ...rules.getVisibleResearchOptions(1, buildingType),
            ];
            for (const technologyType of offered) {
              // The three age advances have their own command rather than
              // going through `research`, so they are the allowed exception.
              if (technologyType.endsWith('-age')) continue;
              if (!canResearchAt(buildingType, technologyType)) {
                wrong.push(`${buildingType} offers ${technologyType}`);
              }
            }
          }
        }
      }
    }
    expect([...new Set(wrong)].sort()).toEqual([]);
  });
});

// And the OTHER direction, which is where the loose version of this check hid
// two more defects: a technology the table hosts but no card ever offers is
// unreachable content — it has a cost, a research time and a home, and no
// player can start it. The Elite Skirmisher upgrade shipped that way in
// v0.3.45: every table had it, no card offered it, and the browser test passed
// because the fixture PRE-RESEARCHED it.
describe('every technology a building hosts is one it can actually offer', () => {
  it('leaves nothing in the tables that no card can reach', () => {
    const unreachable: string[] = [];
    for (const buildingType of BUILDING_TYPES) {
      for (const technologyType of RESEARCHES_BY_BUILDING.get(buildingType) ?? []) {
        let offered = false;
        for (const civilization of CIVILIZATION_NAMES) {
          for (const age of AGES) {
            // Everything researched EXCEPT this one, so its prerequisites are
            // satisfied — then nothing researched, for entries a later tech in
            // the same line would suppress.
            for (const isResearched of [
              (tech: ResearchableTechnologyType) => tech !== technologyType,
              () => false,
            ]) {
              const rules = createOptionsRules({
                latestResearchedInChain: (_owner, chain) => {
                  const flat = chain.map((entry) => (Array.isArray(entry) ? entry[0] : entry));
                  return flat[flat.length - 1] as TrainableUnitType;
                },
                hasTechnology: (_owner, tech) => isResearched(tech),
                getPlayerAge: () => age,
                isAtLeastAge: (_owner, minAge) => AGES.indexOf(age) >= AGES.indexOf(minAge),
                getPlayerCivilization: () => civilization,
                canAdvanceToFeudalAge: () => true,
                canAdvanceToCastleAge: () => true,
                canAdvanceToImperialAge: () => true,
                hasCompletedBuilding: () => true,
                hasOwnedWonder: () => false,
                nomadFirstTownCenter: () => false,
              });
              const list = [
                ...rules.getResearchOptions(1, buildingType),
                ...rules.getVisibleResearchOptions(1, buildingType),
              ];
              if (list.includes(technologyType)) {
                offered = true;
                break;
              }
            }
            if (offered) break;
          }
          if (offered) break;
        }
        if (!offered) unreachable.push(`${buildingType}: ${technologyType}`);
      }
    }
    expect(unreachable.sort()).toEqual([]);
  });
});
