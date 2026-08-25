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
 * Teutons civilization bonus: "Town Centers have ... +5 line of sight" —
 * the owner's own civilization only.
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
  if (buildingType === 'town-center' && civilizations.get(owner) === 'Teutons') {
    bonus += 5;
  }
  return bonus;
}

/** Teutons: "Town Centers have +1 attack" — added to the combat-state factory. */
export function civBuildingBaseAttackBonus(
  civilization: string | undefined,
  buildingType: BuildingType,
): number {
  return civilization === 'Teutons' && buildingType === 'town-center' ? 1 : 0;
}

/** Teutons: "Towers can garrison 2x units" — multiplies the capacity table. */
export function civGarrisonCapacityMultiplier(
  civilization: string | undefined,
  buildingType: BuildingType,
): number {
  return civilization === 'Teutons' && TOWERS.has(buildingType) ? 2 : 1;
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
