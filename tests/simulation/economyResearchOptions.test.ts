import { describe, it, expect } from 'vitest';

import {
  createOptionsRules,
  type OptionsRulesDeps,
} from '../../src/game/simulation/bridge/optionsRules';
import type {
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../src/game/simulation/types';

type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
const AGE_ORDER: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

function optionsAt(age: AgeType, researched: ResearchableTechnologyType[] = []) {
  const have = new Set(researched);
  const deps: OptionsRulesDeps = {
    latestResearchedInChain: () => 'villager' as TrainableUnitType,
    hasTechnology: (_owner, tech) => have.has(tech),
    getPlayerAge: () => age,
    isAtLeastAge: (_owner, min) => AGE_ORDER.indexOf(age) >= AGE_ORDER.indexOf(min),
    getPlayerCivilization: () => 'Franks',
    canAdvanceToFeudalAge: () => false,
    canAdvanceToCastleAge: () => false,
    canAdvanceToImperialAge: () => false,
    hasCompletedBuilding: () => true,
    hasOwnedWonder: () => false,
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
