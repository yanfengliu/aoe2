// Research options for the DERIVED Monastery monk-upgrade techs. Extracted from
// optionsRules.ts to keep that file under the 500-LOC budget, mirroring
// economyTechOptions.ts / towerTechOptions.ts. Pure: the age and tech
// predicates are passed in (the bridge owns the underlying side maps).
//
// Block Printing (+2 monk conversion range) and Sanctity (+15 monk HP), both
// Castle Age with no tech prereq. Each drops from the options list once
// researched. Returns [] for any non-Monastery building.

import type { BuildingType, ResearchableTechnologyType } from './types';

type AgePredicate = (
  owner: number,
  minAge: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age',
) => boolean;
type TechPredicate = (owner: number, tech: ResearchableTechnologyType) => boolean;

export function monasteryTechResearchOptions(
  buildingType: BuildingType,
  owner: number,
  isAtLeastAge: AgePredicate,
  hasTechnology: TechPredicate,
): ResearchableTechnologyType[] {
  if (buildingType !== 'monastery' || !isAtLeastAge(owner, 'castle-age')) {
    return [];
  }
  const options: ResearchableTechnologyType[] = [];
  if (!hasTechnology(owner, 'block-printing')) {
    options.push('block-printing');
  }
  if (!hasTechnology(owner, 'sanctity')) {
    options.push('sanctity');
  }
  // Herbal Medicine (Castle): garrisoned units heal 4× faster.
  if (!hasTechnology(owner, 'herbal-medicine')) {
    options.push('herbal-medicine');
  }
  // Faith is an Imperial-Age tech (conversion resistance).
  if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'faith')) {
    options.push('faith');
  }
  return options;
}
