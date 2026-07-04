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

import type { ResearchableTechnologyType, UnitType } from './types';
import { isInfantryUnit } from './prototypeUnitRules';

export const TOWN_WATCH_BUILDING_VISION_BONUS = 4;
export const TOWN_PATROL_BUILDING_VISION_BONUS = 4;
export const TRACKING_INFANTRY_VISION_BONUS = 2;

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

// Unit LoS bonus: Tracking grants +2 to INFANTRY only (technologies.csv row 9).
export function unitVisionBonus(
  researched: ReadonlySet<ResearchableTechnologyType>,
  unitType: UnitType,
): number {
  return isInfantryUnit(unitType) && researched.has('tracking')
    ? TRACKING_INFANTRY_VISION_BONUS
    : 0;
}
