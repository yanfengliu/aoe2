// Sappers tech applied to VILLAGER attacks on BUILDINGS, DERIVED (pure) from
// an owner's researched-tech set at the unit->building damage site.
// technologies.csv (the spec of record) applies Sappers to VILLAGERS — the
// siege-crew reading of the tech — and hosts it at the Castle; an earlier
// slice had read it as an infantry tech at the Blacksmith (v0.3.132 audit).
// Mirrors buildingArrowTechEffects: no per-unit state, read fresh at the
// damage site, which applies no armor reduction, so the +15 lands raw.

import type { ResearchableTechnologyType, UnitType } from './types';

// technologies.csv Sappers: villagers +15 attack vs buildings.
export const SAPPERS_BUILDING_ATTACK_BONUS = 15;

// +15 building attack for a VILLAGER attacker whose owner has researched
// Sappers; 0 otherwise (no tech, or a non-villager attacker). Only ever
// called at the unit->building damage branch, so the target is a building.
export function sappersBuildingAttackBonus(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  attackerType: UnitType,
): number {
  if (!researchedTechnologies.has('sappers') || attackerType !== 'villager') {
    return 0;
  }
  return SAPPERS_BUILDING_ATTACK_BONUS;
}
