// Research options for the DERIVED defensive tower-upgrade techs, hosted at the
// Watch Tower (AoE2 hosts them at the University, which does not exist in this
// build yet). Extracted from optionsRules.ts to keep that file under the
// 500-LOC budget, mirroring economyTechOptions.ts. Pure: the age and tech
// predicates are passed in (the bridge owns the underlying side maps).
//
// A linear AoE2 prereq chain like the Mill farm chain: Guard Tower (Castle Age,
// no tech prereq) → Keep (Imperial Age, needs Guard Tower). Each drops from the
// options list once researched. Returns [] for any building other than the
// Watch Tower.

import type { BuildingType, ResearchableTechnologyType } from './types';

type AgePredicate = (
  owner: number,
  minAge: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age',
) => boolean;
type TechPredicate = (owner: number, tech: ResearchableTechnologyType) => boolean;

export function towerTechResearchOptions(
  buildingType: BuildingType,
  owner: number,
  isAtLeastAge: AgePredicate,
  hasTechnology: TechPredicate,
): ResearchableTechnologyType[] {
  if (buildingType !== 'watch-tower' || !isAtLeastAge(owner, 'castle-age')) {
    return [];
  }
  const options: ResearchableTechnologyType[] = [];
  if (!hasTechnology(owner, 'guard-tower')) {
    options.push('guard-tower');
  } else if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'keep')) {
    options.push('keep');
  }
  return options;
}
