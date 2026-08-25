// Research options for the DERIVED Monastery monk-upgrade techs. Extracted from
// optionsRules.ts to keep that file under the 500-LOC budget, mirroring
// economyTechOptions.ts / towerTechOptions.ts. Pure: the age and tech
// predicates are passed in (the bridge owns the underlying side maps).
//
// Sanctity (+15 monk HP) and friends are Castle Age with no tech prereq;
// Block Printing (+3 monk conversion range) is IMPERIAL per technologies.csv.
// Each drops from the options list once researched. Returns [] for any
// non-Monastery building.

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
  if (!hasTechnology(owner, 'sanctity')) {
    options.push('sanctity');
  }
  // Herbal Medicine (Castle): garrisoned units heal 4× faster.
  if (!hasTechnology(owner, 'herbal-medicine')) {
    options.push('herbal-medicine');
  }
  // Heresy (Castle): your units die instead of being converted.
  if (!hasTechnology(owner, 'heresy')) {
    options.push('heresy');
  }
  // Redemption (Castle): monks may convert buildings and siege engines.
  if (!hasTechnology(owner, 'redemption')) {
    options.push('redemption');
  }
  // Atonement (Castle): monks may convert enemy MONKS. Without it they
  // cannot, which is why the rule lives in monasteryTechEffects rather than
  // being assumed at the target-picking site.
  if (!hasTechnology(owner, 'atonement')) {
    options.push('atonement');
  }
  // Fervor (Castle): monks move faster, on the ordinary speed seam.
  if (!hasTechnology(owner, 'fervor')) {
    options.push('fervor');
  }
  // Block Printing is IMPERIAL (technologies.csv:69) — +3 conversion range.
  if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'block-printing')) {
    options.push('block-printing');
  }
  // Faith is an Imperial-Age tech (conversion resistance).
  if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'faith')) {
    options.push('faith');
  }
  // The two Imperial faith technologies: Illumination speeds the rest a monk
  // owes after a conversion, Theocracy makes a GROUP owe it once.
  if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'illumination')) {
    options.push('illumination');
  }
  if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'theocracy')) {
    options.push('theocracy');
  }
  return options;
}
