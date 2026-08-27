// Line-of-sight tech effects (v0.1.80): Town Watch / Town Patrol (+4 building
// LoS each, stacking) and Tracking (+2 infantry LoS). Pure DERIVED helpers —
// consumed two ways, mirroring the Loom pattern:
//  - imperatively on research completion (`applyTechnology` bumps every owned
//    entity's `visionSource.radius` in place; the visibility system
//    fingerprints radius per tick, so the bump re-stamps fog automatically);
//  - derived at CREATION for future entities (entity-create ops add the bonus
//    for the owner's researched set when attaching the visionSource).
// No per-entity tech state and no save-format change: the bumped radius lives
// in the already-persisted visionSource component, and replay re-applies the
// research commands deterministically from tick 0.

import type { AgeType, ResearchableTechnologyType } from './types';

export const TOWN_WATCH_BUILDING_VISION_BONUS = 4;
export const TOWN_PATROL_BUILDING_VISION_BONUS = 4;

// The Outpost's whole purpose is to see, and structures.csv gives it
// "+2 Line of sight per age" on a base of 6 — so it stays worth its 25 wood and
// 10 stone in the Imperial Age instead of being out-seen by everything else.
// Applied the same two ways as the LoS technologies: bumped in place when the
// owner advances (technologyOps) and derived at the creation site for one built
// afterwards.
export const OUTPOST_VISION_PER_AGE = 2;
const AGE_ORDER: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

export function outpostVisionRadiusForAge(age: AgeType, baseRadius = 6): number {
  return baseRadius + OUTPOST_VISION_PER_AGE * Math.max(0, AGE_ORDER.indexOf(age));
}

// Total building LoS bonus for an owner's researched set (technologies.csv
// rows 88/92: Town Watch +4, Town Patrol +4 — Buildings;Towers).
export function buildingVisionBonus(
  researched: ReadonlySet<ResearchableTechnologyType>,
): number {
  let bonus = 0;
  if (researched.has('town-watch')) bonus += TOWN_WATCH_BUILDING_VISION_BONUS;
  if (researched.has('town-patrol')) bonus += TOWN_PATROL_BUILDING_VISION_BONUS;
  return bonus;
}

