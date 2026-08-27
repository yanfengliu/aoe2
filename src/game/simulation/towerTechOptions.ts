// Research options for the DERIVED defensive tower-upgrade techs, hosted at
// the UNIVERSITY exactly as technologies.csv places them (v0.3.131 — an
// earlier comment claimed the University "does not exist in this build yet"
// years after it shipped with Ballistics and Masonry; the absence-claim
// audit found it). Extracted from optionsRules.ts for the 500-LOC budget. Pure: the age and tech
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
  if (buildingType !== 'university' || !isAtLeastAge(owner, 'castle-age')) {
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
