import { describe, it, expect } from 'vitest';

import {
  createOptionsRules,
  type OptionsRulesDeps,
} from '../../src/game/simulation/bridge/optionsRules';
import type { TrainableUnitType } from '../../src/game/simulation/types';

type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
const AGE_ORDER: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

function rulesAt(age: AgeType, hasBarracks = true) {
  const deps: OptionsRulesDeps = {
    latestResearchedInChain: () => 'villager' as TrainableUnitType,
    hasTechnology: () => false,
    getPlayerAge: () => age,
    isAtLeastAge: (_owner, min) => AGE_ORDER.indexOf(age) >= AGE_ORDER.indexOf(min),
    getPlayerCivilization: () => 'Franks',
    canAdvanceToFeudalAge: () => false,
    canAdvanceToCastleAge: () => false,
    canAdvanceToImperialAge: () => false,
    hasCompletedBuilding: () => hasBarracks,
    hasOwnedWonder: () => false,
    nomadFirstTownCenter: () => false,
  };
  return createOptionsRules(deps);
}

// campaign-7: the LLM agent was rushed and wiped out in the Dark Age with no
// walling option (palisade walls were gated to Feudal+barracks). In AoE2 the
// Palisade Wall is a Dark-Age building with no prerequisite.
describe('getBuildOptions — Dark-Age palisade wall', () => {
  it('offers palisade-wall in the Dark Age, with no barracks prerequisite', () => {
    const dark = rulesAt('dark-age', false).getBuildOptions(1, 'villager');
    expect(dark).toContain('palisade-wall');
    expect(dark).toEqual(
      expect.arrayContaining(['house', 'mill', 'lumber-camp', 'mining-camp', 'barracks']),
    );
    // Feudal+barracks-gated buildings remain unavailable in the Dark Age.
    expect(dark).not.toContain('stable');
    expect(dark).not.toContain('watch-tower');
    expect(dark).not.toContain('market');
  });

  it('keeps palisade-wall available in later ages', () => {
    expect(rulesAt('feudal-age').getBuildOptions(1, 'villager')).toContain('palisade-wall');
    expect(rulesAt('castle-age').getBuildOptions(1, 'villager')).toContain('palisade-wall');
  });

  it('lists palisade-wall exactly once once Feudal buildings unlock (no duplicate)', () => {
    const feudal = rulesAt('feudal-age').getBuildOptions(1, 'villager');
    expect(feudal.filter((b) => b === 'palisade-wall')).toHaveLength(1);
  });

  it('returns no build options for non-villagers', () => {
    expect(rulesAt('dark-age').getBuildOptions(1, 'militia' as TrainableUnitType)).toEqual([]);
  });
});
