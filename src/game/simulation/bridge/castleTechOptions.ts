// What a Castle can research: the elite unique-unit upgrades, Conscription,
// and this civilization's unique technologies. Extracted from ./optionsRules.ts
// for the 500-LOC budget.
//
// The whole branch opens in CASTLE age rather than Imperial, because the Goths'
// Anarchy is a Castle-age unique technology; every entry still carries its own
// age, so nothing else moved earlier.

import type { ResearchableTechnologyType } from '../types';
import { uniqueTechnologiesFor } from '../uniqueTechnologies';

type AgePredicate = (
  owner: number,
  minAge: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age',
) => boolean;
type TechPredicate = (owner: number, tech: ResearchableTechnologyType) => boolean;

export interface CastleTechOptionsDeps {
  owner: number;
  civilization: string;
  isAtLeastAge: AgePredicate;
  hasTechnology: TechPredicate;
  /** The elite upgrades this civilization may research AT THE CASTLE. */
  eliteUpgradeOptions: () => ResearchableTechnologyType[];
}

export function castleResearchOptions(deps: CastleTechOptionsDeps): ResearchableTechnologyType[] {
  const { owner, civilization, isAtLeastAge, hasTechnology, eliteUpgradeOptions } = deps;
  const options: ResearchableTechnologyType[] = [];

  if (isAtLeastAge(owner, 'imperial-age')) {
    // An elite upgrade is researched where its unit is TRAINED, so the two
    // naval unique units upgrade at the Dock and never appear here.
    options.push(...eliteUpgradeOptions());
    if (!hasTechnology(owner, 'conscription')) {
      // Conscription: military +25% train speed (any civ, Imperial Castle).
      options.push('conscription');
    }
  }

  // Civilization unique technologies, gated exactly like the unique units: one
  // table decides which civilization sees which, so nothing here knows a
  // civilization by name.
  for (const technology of uniqueTechnologiesFor(civilization)) {
    if (hasTechnology(owner, technology.id)) continue;
    if (!isAtLeastAge(owner, technology.age)) continue;
    options.push(technology.id);
  }

  return options;
}
