// Research options for the camp/mill DERIVED economy-tech buildings — gather-rate
// (Lumber/Mining Camp) and farm-food (Mill). Extracted from optionsRules.ts to
// keep that file under the 500-LOC budget. The three buildingType branches are
// mutually exclusive, so this returns the matching building's options (empty when
// all its techs are researched), or [] for any other building. Pure: the age and
// tech predicates are passed in (the bridge owns the underlying side maps).

import type { BuildingType, ResearchableTechnologyType } from '../types';

type AgePredicate = (
  owner: number,
  minAge: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age',
) => boolean;
type TechPredicate = (owner: number, tech: ResearchableTechnologyType) => boolean;

export function economyTechResearchOptions(
  buildingType: BuildingType,
  owner: number,
  isAtLeastAge: AgePredicate,
  hasTechnology: TechPredicate,
): ResearchableTechnologyType[] {
  // Gather-rate techs: Lumber Camp wood from Feudal (+Bow Saw/Two-Man Saw later).
  if (buildingType === 'lumber-camp' && isAtLeastAge(owner, 'feudal-age')) {
    const options: ResearchableTechnologyType[] = [];
    if (!hasTechnology(owner, 'double-bit-axe')) {
      options.push('double-bit-axe');
    }
    if (isAtLeastAge(owner, 'castle-age') && !hasTechnology(owner, 'bow-saw')) {
      options.push('bow-saw');
    }
    if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'two-man-saw')) {
      options.push('two-man-saw');
    }
    return options;
  }

  // Mining Camp (gold + stone) from Feudal; Shaft upgrades add in Castle. Per
  // technologies.csv these stack with no base-tech prereq, so age is the only
  // gate (AoE2's linear prereq chains are a deferred fidelity refinement).
  if (buildingType === 'mining-camp' && isAtLeastAge(owner, 'feudal-age')) {
    const options: ResearchableTechnologyType[] = [];
    if (!hasTechnology(owner, 'gold-mining')) {
      options.push('gold-mining');
    }
    if (!hasTechnology(owner, 'stone-mining')) {
      options.push('stone-mining');
    }
    if (isAtLeastAge(owner, 'castle-age')) {
      if (!hasTechnology(owner, 'gold-shaft-mining')) {
        options.push('gold-shaft-mining');
      }
      if (!hasTechnology(owner, 'stone-shaft-mining')) {
        options.push('stone-shaft-mining');
      }
    }
    return options;
  }

  // Farm-food techs (Mill): a linear AoE2 prereq chain — Horse Collar (Feudal,
  // no prereq) → Heavy Plow (Castle, needs Horse Collar) → Crop Rotation
  // (Imperial, needs Heavy Plow). Each drops once researched.
  if (buildingType === 'mill' && isAtLeastAge(owner, 'feudal-age')) {
    const options: ResearchableTechnologyType[] = [];
    if (!hasTechnology(owner, 'horse-collar')) {
      options.push('horse-collar');
    } else if (isAtLeastAge(owner, 'castle-age') && !hasTechnology(owner, 'heavy-plow')) {
      options.push('heavy-plow');
    } else if (
      hasTechnology(owner, 'heavy-plow')
      && isAtLeastAge(owner, 'imperial-age')
      && !hasTechnology(owner, 'crop-rotation')
    ) {
      options.push('crop-rotation');
    }
    return options;
  }

  return [];
}
