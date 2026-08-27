// Building-scoped civilization/team bonuses (spec §9.2), the building-side
// sibling of teamCombatBonuses: line of sight, the building's own weapon,
// garrison capacity, and monk healing range. Pure over (teams, civilizations,
// owner) so the creation, garrison, and behavior sites just apply the number.

import type { BuildingType } from './types';
import { teamHasCivilization } from './teamBonuses';

type Teams = ReadonlyMap<number, number>;
type Civs = ReadonlyMap<number, string>;

const EMPTY_TEAMS: Teams = new Map();

const TOWERS_AND_OUTPOSTS = new Set<BuildingType>([
  'watch-tower', 'bombard-tower', 'outpost',
]);
const TOWERS = new Set<BuildingType>(['watch-tower', 'bombard-tower']);

/**
 * Extra line of sight for a building at its creation (or completion) site.
 * Ethiopians team_bonus: "Towers and Outposts +3 LOS" — owner or ally.
 */
export function teamBuildingVisionBonus(
  teams: Teams | undefined,
  civilizations: Civs | undefined,
  owner: number,
  buildingType: BuildingType,
): number {
  // Tolerate absent slot state (minimal test harnesses) the way the tech
  // sites tolerate it with EMPTY_TECH_SET: no state, no bonus.
  if (!civilizations) return 0;
  const knownTeams = teams ?? EMPTY_TEAMS;
  let bonus = 0;
  if (
    TOWERS_AND_OUTPOSTS.has(buildingType)
    && teamHasCivilization(knownTeams, civilizations, owner, 'Ethiopians')
  ) {
    bonus += 3;
  }
  // (The old Teuton TC +5 LoS is DE-dead — sourced v0.3.144.)
  return bonus;
}

/** DE-dead since the sourced audit (v0.3.144): current DE gives Teuton Town
 *  Centers no attack bonus. The seam stays for the callers. */
export function civBuildingBaseAttackBonus(
  _civilization: string | undefined,
  _buildingType: BuildingType,
): number {
  return 0;
}

/** Teutons (sourced v0.3.144): "Town Centers +10 garrison capacity; Towers
 *  +5 garrison capacity" — flat adds, replacing the old ×2 tower rule. */
export function civGarrisonCapacityBonus(
  civilization: string | undefined,
  buildingType: BuildingType,
): number {
  if (civilization !== 'Teutons') return 0;
  if (buildingType === 'town-center') return 10;
  return TOWERS.has(buildingType) ? 5 : 0;
}

/** Khmer: houses hold five villagers; every other house holds nobody. */
export function civHouseGarrisonCapacity(
  civilization: string | undefined,
  buildingType: BuildingType,
): number {
  return civilization === 'Khmer' && buildingType === 'house' ? 5 : 0;
}

/** Teutons: "Monks have 2x healing range" — heal tasks only, never convert. */
export function civMonkHealRangeMultiplier(civilization: string | undefined): number {
  return civilization === 'Teutons' ? 2 : 1;
}
