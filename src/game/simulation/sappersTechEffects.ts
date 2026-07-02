// Sappers tech applied to INFANTRY attacks on BUILDINGS, DERIVED (pure) from an
// owner's researched-tech set at the unit->building damage site. In AoE2,
// Sappers grants infantry units +15 attack against buildings. This mirrors the
// building-arrow tech effects (buildingArrowTechEffects) — no per-unit state,
// read fresh at the damage site (playerCommandsSystem), which applies no armor
// reduction, so the +15 lands raw.

import type { ResearchableTechnologyType, UnitType } from './types';
import { isInfantryUnit } from './prototypeUnitRules';

// AoE2 Sappers: +15 attack vs buildings for infantry.
export const SAPPERS_BUILDING_ATTACK_BONUS = 15;

// +15 building attack for an INFANTRY attacker whose owner has researched
// Sappers; 0 otherwise (no tech, or a non-infantry attacker). Only ever called
// at the unit->building damage branch, so the target is always a building.
export function sappersBuildingAttackBonus(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  attackerType: UnitType,
): number {
  if (!researchedTechnologies.has('sappers') || !isInfantryUnit(attackerType)) {
    return 0;
  }
  return SAPPERS_BUILDING_ATTACK_BONUS;
}
