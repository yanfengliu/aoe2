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

/**
 * The technology `technology` waits on, when the thing blocking it is
 * another RESEARCH rather than an age or a building.
 *
 * It lives beside the rule it names — the `hasTechnology(owner,
 * 'town-watch')` gate two functions up — so the two cannot drift: an
 * option list that gains a technology-on-technology gate has to answer
 * here as well. Town Patrol is the only such gate the command card ever
 * draws as a LOCKED button today (every other one simply keeps the
 * option out of the menu), which is why the reason engine only has to
 * ask about these. Without it the card said "needs a later age or an
 * earlier upgrade" and left the player to guess which upgrade.
 */
export function researchPrerequisiteTechnology(
  technology: ResearchableTechnologyType,
): ResearchableTechnologyType | undefined {
  return technology === 'town-patrol' ? 'town-watch' : undefined;
}

// Tracking was removed with DE (v0.3.140): its +2 infantry line of sight is
// folded into the infantry line itself (visionTechEffects), so the Barracks
// no longer offers a LoS research.
