// Research/visible options for the line-of-sight techs (visionTechEffects):
// Town Watch (TC, Feudal, +4 building LoS), Town Patrol (TC, Castle, requires
// Town Watch, +4 more), Tracking (Barracks, Feudal, +2 infantry LoS).
// Extracted from optionsRules.ts to keep that file under the 500-LOC budget,
// following the economy/tower/monastery tech-options precedent. Pure: the age
// and tech predicates are passed in (the bridge owns the underlying maps).

import type { ResearchableTechnologyType } from '../types';

type AgePredicate = (
  owner: number,
  minAge: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age',
) => boolean;
type TechPredicate = (owner: number, tech: ResearchableTechnologyType) => boolean;

// Researchable-now LoS options at the Town Center: Town Watch from Feudal;
// Town Patrol from Castle AND only once Town Watch is researched (prereq).
export function townCenterLosResearchOptions(
  owner: number,
  isAtLeastAge: AgePredicate,
  hasTechnology: TechPredicate,
): ResearchableTechnologyType[] {
  const options: ResearchableTechnologyType[] = [];
  if (isAtLeastAge(owner, 'feudal-age') && !hasTechnology(owner, 'town-watch')) {
    options.push('town-watch');
  }
  if (
    isAtLeastAge(owner, 'castle-age')
    && hasTechnology(owner, 'town-watch')
    && !hasTechnology(owner, 'town-patrol')
  ) {
    options.push('town-patrol');
  }
  return options;
}

// Visible (possibly locked) LoS options at the Town Center: each shows from
// its age onward until researched — Town Patrol appears greyed before Town
// Watch is done (the research list above carries availability).
export function townCenterLosVisibleOptions(
  owner: number,
  isAtLeastAge: AgePredicate,
  hasTechnology: TechPredicate,
): ResearchableTechnologyType[] {
  const options: ResearchableTechnologyType[] = [];
  if (isAtLeastAge(owner, 'feudal-age') && !hasTechnology(owner, 'town-watch')) {
    options.push('town-watch');
  }
  if (isAtLeastAge(owner, 'castle-age') && !hasTechnology(owner, 'town-patrol')) {
    options.push('town-patrol');
  }
  return options;
}

// Tracking at the Barracks: Feudal onward (the barracks research branch is
// already gated to non-Dark ages by its caller) until researched.
export function barracksLosResearchOptions(
  owner: number,
  hasTechnology: TechPredicate,
): ResearchableTechnologyType[] {
  return hasTechnology(owner, 'tracking') ? [] : ['tracking'];
}
