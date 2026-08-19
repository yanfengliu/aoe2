// Blacksmith research options — the sixteen armour/attack upgrades plus
// Sappers. Extracted from optionsRules.ts so that file stays under its 500-LOC
// budget as new buildings gain research branches (the losTechOptions
// precedent). Pure: the age and tech predicates are passed in.

import type { AgeType, ResearchableTechnologyType } from '../types';

type TechPredicate = (owner: number, tech: ResearchableTechnologyType) => boolean;

/** Blacksmith options for this owner, or an empty list outside the Dark Age gate. */
export function blacksmithResearchOptions(
  owner: number,
  getPlayerAge: (owner: number) => AgeType,
  isAtLeastAge: (
    owner: number,
    minAge: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age',
  ) => boolean,
  hasTechnology: TechPredicate,
): ResearchableTechnologyType[] {
  if (getPlayerAge(owner) === 'dark-age') return [];
  const options: ResearchableTechnologyType[] = [];
  if (!hasTechnology(owner, 'fletching')) {
    options.push('fletching');
  }
  if (!hasTechnology(owner, 'forging')) {
    options.push('forging');
  }
  if (!hasTechnology(owner, 'scale-mail-armor')) {
    options.push('scale-mail-armor');
  }
  if (!hasTechnology(owner, 'scale-barding-armor')) {
    options.push('scale-barding-armor');
  }
  if (!hasTechnology(owner, 'padded-archer-armor')) {
    options.push('padded-archer-armor');
  }
  if (isAtLeastAge(owner, 'castle-age')) {
    if (!hasTechnology(owner, 'iron-casting')) {
      options.push('iron-casting');
    }
    if (!hasTechnology(owner, 'chain-mail-armor')) {
      options.push('chain-mail-armor');
    }
    if (!hasTechnology(owner, 'chain-barding-armor')) {
      options.push('chain-barding-armor');
    }
    if (!hasTechnology(owner, 'leather-archer-armor')) {
      options.push('leather-archer-armor');
    }
    if (!hasTechnology(owner, 'bodkin-arrow')) {
      options.push('bodkin-arrow');
    }
  }
  if (isAtLeastAge(owner, 'imperial-age')) {
    if (!hasTechnology(owner, 'bracer')) {
      options.push('bracer');
    }
    if (!hasTechnology(owner, 'blast-furnace')) {
      options.push('blast-furnace');
    }
    if (!hasTechnology(owner, 'plate-mail-armor')) {
      options.push('plate-mail-armor');
    }
    if (!hasTechnology(owner, 'plate-barding')) {
      options.push('plate-barding');
    }
    if (!hasTechnology(owner, 'ring-archer-armor')) {
      options.push('ring-archer-armor');
    }
    if (!hasTechnology(owner, 'chemistry')) {
      options.push('chemistry');
    }
    // Sappers: +15 infantry attack vs buildings (AoE2 University; hosted at the Blacksmith here); Imperial, drops once researched.
    if (!hasTechnology(owner, 'sappers')) {
      options.push('sappers');
    }
  }
  return options;
}
