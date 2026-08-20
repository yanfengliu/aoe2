// University technologies that act on BUILDINGS rather than on a unit line
// (spec §8.4). All three are DERIVED from the owner's researched-tech set at
// the point of use — the same shape as economyTechEffects and
// movementTechEffects — so nothing new is persisted and a save carries the
// tech set it already carried.

import { isWaterUnit } from './unitDomain';
import type { ResearchableTechnologyType } from './technologyTypes';
import type { UnitType } from './unitTypes';

// Masonry (Castle) and Architecture (Imperial) each read "Hit points * 1.1"
// in technologies.csv, and they STACK, so both is x1.21. Their +1/+1 unit
// armour and +3 building armour halves are pending: buildings have no armour
// field at all (BuildingCombatState is attack/range/reload only), and adding
// one is a combat-model change rather than a technology.
export const MASONRY_HP_MULTIPLIER = 1.1;
export const ARCHITECTURE_HP_MULTIPLIER = 1.1;

/** How much tougher this owner's buildings are than their base hit points. */
export function buildingHitPointMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  let multiplier = 1;
  if (researchedTechnologies.has('masonry')) multiplier *= MASONRY_HP_MULTIPLIER;
  if (researchedTechnologies.has('architecture')) multiplier *= ARCHITECTURE_HP_MULTIPLIER;
  return multiplier;
}

/** A building's hit points under this owner's technologies. */
export function buildingMaxHpWithTechnologies(
  baseMaxHp: number,
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  return Math.round(baseMaxHp * buildingHitPointMultiplier(researchedTechnologies));
}

// Treadmill Crane (Castle): "Builders work rate x 1.2".
export const TREADMILL_CRANE_BUILD_MULTIPLIER = 1.2;

/** How much faster this owner's villagers put up a building. */
export function buildRateMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  return researchedTechnologies.has('treadmill-crane') ? TREADMILL_CRANE_BUILD_MULTIPLIER : 1;
}

// Heated Shot (Castle): "Towers do 2.25 * attack bonus vs ships/camels".
export const HEATED_SHOT_MULTIPLIER = 2.25;

const CAMEL_UNITS = new Set<UnitType>(['camel', 'heavy-camel', 'mameluke', 'elite-mameluke']);

/**
 * A defensive building's damage multiplier against this target.
 *
 * Ships are the point of it — a tower on a shoreline is otherwise a poor
 * answer to a warship that outranges nothing and simply parks. Camels come
 * along because the CSV groups them, and both are cheap to name exactly.
 */
export function heatedShotMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  targetUnitType: UnitType,
): number {
  if (!researchedTechnologies.has('heated-shot')) return 1;
  if (isWaterUnit(targetUnitType) || CAMEL_UNITS.has(targetUnitType)) {
    return HEATED_SHOT_MULTIPLIER;
  }
  return 1;
}
