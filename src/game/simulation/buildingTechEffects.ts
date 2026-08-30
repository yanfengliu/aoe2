// University technologies that act on BUILDINGS rather than on a unit line
// (spec §8.4). All three are DERIVED from the owner's researched-tech set at
// the point of use — the same shape as economyTechEffects and
// movementTechEffects — so nothing new is persisted and a save carries the
// tech set it already carried.

import { isWaterUnit } from './unitDomain';
import { INCAS_TEAM_FARM_BUILD_MULTIPLIER } from './teamBonuses';
import type { BuildingType } from './types';
import type { ResearchableTechnologyType } from './technologyTypes';
import type { UnitType } from './unitTypes';

// Masonry (Castle) and Architecture (Imperial) each read "Hit points * 1.1"
// in technologies.csv, and they STACK, so both is x1.21. Their +1/+1 unit
// armour and +3 building armour halves are pending: buildings have no armour
// field at all (BuildingCombatState is attack/range/reload only), and adding
// one is a combat-model change rather than a technology.
export const MASONRY_HP_MULTIPLIER = 1.1;
export const ARCHITECTURE_HP_MULTIPLIER = 1.1;

/**
 * Technologies that toughen ONE kind of building rather than all of them:
 * Fortified Wall takes a Stone Wall from 1800 to 3000 hit points, and the tower
 * upgrades take a Watch Tower from 1020 to a Guard Tower's 1500 and on to a
 * Keep's. All from structures.csv.
 */
const PER_BUILDING_HP: ReadonlyArray<{
  readonly technology: ResearchableTechnologyType;
  readonly buildingType: BuildingType;
  readonly multiplier: number;
}> = [
  { technology: 'fortified-wall', buildingType: 'stone-wall', multiplier: 3000 / 1800 },
  { technology: 'guard-tower', buildingType: 'watch-tower', multiplier: 1500 / 1020 },
  { technology: 'keep', buildingType: 'watch-tower', multiplier: 2250 / 1500 },
  // Hoardings (technologies.csv "+21% HP"), the Castle's own toughening.
  { technology: 'hoardings', buildingType: 'castle', multiplier: 1.21 },
];

/**
 * How much tougher this owner's buildings are than their base hit points.
 *
 * `buildingType` is optional because the caller that raises everything already
 * standing walks one building at a time and knows it, while the pure test of
 * the general multipliers does not care.
 */
export function buildingHitPointMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  buildingType?: BuildingType,
): number {
  let multiplier = 1;
  if (researchedTechnologies.has('masonry')) multiplier *= MASONRY_HP_MULTIPLIER;
  if (researchedTechnologies.has('architecture')) multiplier *= ARCHITECTURE_HP_MULTIPLIER;
  if (buildingType === undefined) return multiplier;
  for (const entry of PER_BUILDING_HP) {
    if (entry.buildingType !== buildingType) continue;
    if (!researchedTechnologies.has(entry.technology)) continue;
    multiplier *= entry.multiplier;
  }
  return multiplier;
}

/** The per-building technologies, for the appliers that walk one at a time. */
export const PER_BUILDING_HP_TECHNOLOGIES: ReadonlySet<ResearchableTechnologyType> =
  new Set(PER_BUILDING_HP.map((entry) => entry.technology));

/** The multiplier ONE technology contributes to ONE building type. */
export function singleBuildingHpMultiplier(
  technology: ResearchableTechnologyType,
  buildingType: BuildingType,
): number {
  const entry = PER_BUILDING_HP.find(
    (candidate) => candidate.technology === technology && candidate.buildingType === buildingType,
  );
  return entry?.multiplier ?? 1;
}

/** A building's hit points under this owner's technologies. */
export function buildingMaxHpWithTechnologies(
  baseMaxHp: number,
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  buildingType?: BuildingType,
): number {
  return Math.round(baseMaxHp * buildingHitPointMultiplier(researchedTechnologies, buildingType));
}

// Treadmill Crane (Castle): "Builders work rate x 1.2".
export const TREADMILL_CRANE_BUILD_MULTIPLIER = 1.2;

// Spanish (sourced v0.3.149): "Builders work +30% faster" — composing with
// Treadmill Crane the way stacked rate techs do.
export const SPANISH_BUILDER_MULTIPLIER = 1.3;

/** What is being built, for bonuses scoped to one building rather than to the
 *  builder. Optional so every existing caller keeps its two-argument shape. */
export interface BuildRateContext {
  /** The owner's side carries the Incas team bonus. */
  readonly farmTeamBonus?: boolean;
  readonly buildingType?: BuildingType;
}

/** How much faster this owner's villagers put up a building. */
export function buildRateMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  civilization?: string,
  context?: BuildRateContext,
): number {
  // Incas: "Farms built 50% faster". Scoped to the FARM, which is why this
  // function needs to know what is under construction — the other two
  // multipliers here are properties of the builder and apply to everything.
  const incasFarm = context?.farmTeamBonus === true && context.buildingType === 'farm'
    ? INCAS_TEAM_FARM_BUILD_MULTIPLIER
    : 1;
  return (researchedTechnologies.has('treadmill-crane') ? TREADMILL_CRANE_BUILD_MULTIPLIER : 1)
    * (civilization === 'Spanish' ? SPANISH_BUILDER_MULTIPLIER : 1)
    * incasFarm;
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
