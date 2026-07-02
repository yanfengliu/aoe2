// Research options for the DERIVED Monastery monk-upgrade techs. Extracted from
// optionsRules.ts to keep that file under the 500-LOC budget, mirroring
// economyTechOptions.ts / towerTechOptions.ts. Pure: the age and tech
// predicates are passed in (the bridge owns the underlying side maps).
//
// Block Printing (Castle Age, no tech prereq) — +2 monk conversion range. Drops
// from the options list once researched. Returns [] for any non-Monastery
// building.

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
  return options;
}
