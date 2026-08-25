import { describe, it, expect } from 'vitest';

import {
  createOptionsRules,
  type OptionsRulesDeps,
} from '../../src/game/simulation/bridge/optionsRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import type {
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../src/game/simulation/types';

type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
const AGE_ORDER: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

function optionsAt(
  age: AgeType,
  researched: ResearchableTechnologyType[] = [],
  canAdvanceTo?: AgeType,
) {
  const have = new Set(researched);
  const deps: OptionsRulesDeps = {
    latestResearchedInChain: () => 'villager' as TrainableUnitType,
    hasTechnology: (_owner, tech) => have.has(tech),
    getPlayerAge: () => age,
    isAtLeastAge: (_owner, min) => AGE_ORDER.indexOf(age) >= AGE_ORDER.indexOf(min),
    getPlayerCivilization: () => 'Franks',
    canAdvanceToFeudalAge: () => canAdvanceTo === 'feudal-age',
    canAdvanceToCastleAge: () => canAdvanceTo === 'castle-age',
    canAdvanceToImperialAge: () => canAdvanceTo === 'imperial-age',
    hasCompletedBuilding: () => true,
    hasOwnedWonder: () => false,
    nomadFirstTownCenter: () => false,
  };
  return createOptionsRules(deps);
}

describe('getResearchOptions — economy gather-rate techs', () => {
  it('offers no Lumber Camp tech in the Dark Age', () => {
    expect(optionsAt('dark-age').getResearchOptions(1, 'lumber-camp')).toEqual([]);
  });

  it('ramps Lumber Camp: Double-Bit Axe (Feudal) → Bow Saw (Castle) → Two-Man Saw (Imperial)', () => {
    expect(optionsAt('feudal-age').getResearchOptions(1, 'lumber-camp')).toEqual(['double-bit-axe']);
    expect(optionsAt('castle-age').getResearchOptions(1, 'lumber-camp')).toEqual([
      'double-bit-axe',
      'bow-saw',
    ]);
    expect(optionsAt('imperial-age').getResearchOptions(1, 'lumber-camp')).toEqual([
      'double-bit-axe',
      'bow-saw',
      'two-man-saw',
    ]);
  });

  it('drops a researched wood tech from the Lumber Camp list', () => {
    expect(
      optionsAt('imperial-age', ['double-bit-axe', 'bow-saw']).getResearchOptions(1, 'lumber-camp'),
    ).toEqual(['two-man-saw']);
  });

  it('offers Mining Camp Gold/Stone Mining (Feudal) and adds the Shaft upgrades in Castle (independent, age-gated)', () => {
    expect(optionsAt('feudal-age').getResearchOptions(1, 'mining-camp')).toEqual([
      'gold-mining',
      'stone-mining',
    ]);
    // Castle adds the shaft upgrades; per the dataset they stack but carry no
    // base-tech prerequisite, so all four are offered when none are researched.
    expect(optionsAt('castle-age').getResearchOptions(1, 'mining-camp')).toEqual([
      'gold-mining',
      'stone-mining',
      'gold-shaft-mining',
      'stone-shaft-mining',
    ]);
    // researched techs drop out of the list
    expect(
      optionsAt('castle-age', ['gold-mining', 'stone-mining']).getResearchOptions(1, 'mining-camp'),
    ).toEqual(['gold-shaft-mining', 'stone-shaft-mining']);
  });
});

// These cases isolate the CARRY-tech behaviour, so they pre-research Loom
// (which the TC now also offers in every age — covered by loomTech.test.ts) to
// keep the asserted lists focused on Wheelbarrow / Hand Cart.
describe('getResearchOptions — Town Center carry techs', () => {
  it('offers no carry tech in the Dark Age', () => {
    expect(optionsAt('dark-age', ['loom']).getResearchOptions(1, 'town-center')).toEqual([]);
  });

  it('offers Wheelbarrow (Feudal) then adds Hand Cart (Castle)', () => {
    // Town Watch (Feudal+) rides alongside the carry techs; Town Patrol needs
    // Town Watch researched, which this `have` set lacks.
    expect(optionsAt('feudal-age', ['loom']).getResearchOptions(1, 'town-center')).toEqual([
      'wheelbarrow',
      'town-watch',
    ]);
    expect(optionsAt('castle-age', ['loom']).getResearchOptions(1, 'town-center')).toEqual([
      'wheelbarrow',
      'hand-cart',
      'town-watch',
    ]);
  });

  it('drops a researched carry tech', () => {
    expect(
      optionsAt('castle-age', ['wheelbarrow', 'loom']).getResearchOptions(1, 'town-center'),
    ).toEqual(['hand-cart', 'town-watch']);
  });

  it('offers the age-up alongside carry techs (age-up still comes first)', () => {
    expect(
      optionsAt('feudal-age', ['loom'], 'castle-age').getResearchOptions(1, 'town-center'),
    ).toEqual(['castle-age', 'wheelbarrow', 'town-watch']);
  });

  it('getVisibleResearchOptions surfaces the next age-up + carry techs', () => {
    expect(
      optionsAt('feudal-age', ['loom']).getVisibleResearchOptions(1, 'town-center'),
    ).toEqual(['castle-age', 'wheelbarrow', 'town-watch']);
  });
});

// Validator-side gating (RESEARCHES_BY_BUILDING via canResearchAt). The
// queueResearch validator requires this to AGREE with getResearchOptions, so
// this guards the building→tech map for every economy tech (a regression that
// dropped a tech from the map while options still exposed it would be caught).
describe('canResearchAt — economy tech building gating', () => {
  it('gates each economy tech to its correct building', () => {
    expect(canResearchAt('town-center', 'wheelbarrow')).toBe(true);
    expect(canResearchAt('town-center', 'hand-cart')).toBe(true);
    expect(canResearchAt('lumber-camp', 'double-bit-axe')).toBe(true);
    expect(canResearchAt('lumber-camp', 'two-man-saw')).toBe(true);
    expect(canResearchAt('mining-camp', 'gold-mining')).toBe(true);
    expect(canResearchAt('mining-camp', 'stone-shaft-mining')).toBe(true);
  });

  it('rejects economy techs at the wrong building', () => {
    expect(canResearchAt('lumber-camp', 'wheelbarrow')).toBe(false);
    expect(canResearchAt('town-center', 'double-bit-axe')).toBe(false);
    expect(canResearchAt('blacksmith', 'gold-mining')).toBe(false);
    expect(canResearchAt('mining-camp', 'double-bit-axe')).toBe(false);
  });
});
