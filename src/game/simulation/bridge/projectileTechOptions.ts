// Research options for the University and Archery Range: the two projectile
// technologies (spec §10.4) plus the University's building-defence set:
// Ballistics at the University and Thumb Ring at the Archery Range, both
// Castle Age. Extracted from optionsRules.ts to keep that file under the
// 500-LOC budget, following the losTechOptions precedent. Pure: the age and
// tech predicates are passed in (the bridge owns the underlying maps).

import type { BuildingType, ResearchableTechnologyType } from '../types';

type AgePredicate = (
  owner: number,
  minAge: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age',
) => boolean;
type TechPredicate = (owner: number, tech: ResearchableTechnologyType) => boolean;

/**
 * The projectile-tech options this building offers, or an empty list. Both
 * technologies are Castle Age and neither has a prerequisite beyond its
 * building, so researchable and visible options are the same list — unlike
 * the LoS techs, where Town Patrol shows before Town Watch is done.
 */
export function projectileTechOptions(
  buildingType: BuildingType,
  owner: number,
  isAtLeastAge: AgePredicate,
  hasTechnology: TechPredicate,
): ResearchableTechnologyType[] {
  if (!isAtLeastAge(owner, 'castle-age')) return [];
  if (buildingType === 'university') {
    const options: ResearchableTechnologyType[] = [];
    if (!hasTechnology(owner, 'ballistics')) options.push('ballistics');
    if (!hasTechnology(owner, 'masonry')) options.push('masonry');
    if (!hasTechnology(owner, 'treadmill-crane')) options.push('treadmill-crane');
    if (!hasTechnology(owner, 'heated-shot')) options.push('heated-shot');
    // Architecture is the Imperial half of Masonry and needs it first, which
    // is why it is not simply a second entry in the list above.
    if (
      isAtLeastAge(owner, 'imperial-age')
      && hasTechnology(owner, 'masonry')
      && !hasTechnology(owner, 'architecture')
    ) {
      options.push('architecture');
    }
    return options;
  }
  if (buildingType === 'archery-range' && !hasTechnology(owner, 'thumb-ring')) {
    return ['thumb-ring'];
  }
  return [];
}
