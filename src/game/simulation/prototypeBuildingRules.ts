import {
  isInfantryUnit,
  isMeleeUnit,
  isMountedUnit,
  isSiegeUnit,
  unitAttackRange,
} from './prototypeUnitRules';
import { isMonasticUnit } from './monasticUnits';
import { isWaterUnit } from './unitDomain';
import type {
  AgeType,
  BuildingType,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitType,
} from './types';

interface BuildingCombatProfile {
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
}

// Population headroom supplied per completed building (spec §6.10).
// AoE2 values: Town Center +5, House +5, Castle +20. The cap is fully
// building-derived (base STANDARD_POPULATION_CAP = 0); the player's
// starting Town Center contributes the initial +5 through the normal
// completion path, and houses, extra TCs, and Castles add from there.
const BUILDING_POPULATION_PROVIDED: Record<BuildingType, number> = {
  'town-center': 5,
  house: 5,
  mill: 0,
  'lumber-camp': 0,
  'mining-camp': 0,
  barracks: 0,
  'watch-tower': 0,
  'bombard-tower': 0,
  stable: 0,
  'archery-range': 0,
  blacksmith: 0,
  market: 0,
  'siege-workshop': 0,
  monastery: 0,
  university: 0,
  castle: 20,
  wonder: 0,
  'stone-wall': 0,
  'palisade-wall': 0,
  'stone-gate': 0,
  'palisade-gate': 0,
  farm: 0,
  dock: 0,
  outpost: 0,
  'fish-trap': 0,
};

const BUILDING_BUILD_TIME_TICKS: Record<BuildingType, number> = {
  'town-center': 300,
  house: 120,
  mill: 180,
  'lumber-camp': 180,
  'mining-camp': 180,
  barracks: 240,
  'watch-tower': 220,
  'bombard-tower': 800, // structures.csv build_time 80s
  stable: 240,
  'archery-range': 240,
  blacksmith: 200,
  market: 200,
  'siege-workshop': 260,
  monastery: 280,
  university: 600,
  castle: 560,
  wonder: 1200,
  'stone-wall': 80,
  'palisade-wall': 40,
  // structures.csv "Gate": 70 s. The Palisade Gate matches its own wall's
  // pace, scaled for a far larger structure.
  'stone-gate': 700,
  'palisade-gate': 200,
  // M1 Farms: structures.csv build_time 15 seconds × 10 TPS = 150 ticks.
  farm: 150,
  dock: 350, // structures.csv: 35 s x 10 TPS.
  outpost: 150, // structures.csv: 15 s x 10 TPS.
  'fish-trap': 530, // structures.csv: 53 s x 10 TPS.
};

const BUILDING_SIZES: Record<BuildingType, number> = {
  'town-center': 1.4,
  house: 1.1,
  mill: 1.15,
  'lumber-camp': 1.15,
  'mining-camp': 1.15,
  barracks: 1.2,
  'watch-tower': 1.2,
  'bombard-tower': 1.35,
  stable: 1.2,
  'archery-range': 1.2,
  blacksmith: 1.2,
  market: 1.2,
  'siege-workshop': 1.2,
  monastery: 1.2,
  university: 1.2,
  castle: 1.5,
  wonder: 1.6,
  'stone-wall': 1,
  'palisade-wall': 1,
  // A gate reads slightly taller than its wall — it is the thing you aim at.
  'stone-gate': 1.15,
  'palisade-gate': 1.05,
  // M1 Farms: a 1x1 footprint; size 1 fills its single cell like the walls.
  farm: 1,
  dock: 1.2,
  outpost: 0.5,
  'fish-trap': 0.55,
};

import { BUILDING_TINTS } from './buildingTintTable';

export type { BuildingTintPalette } from './buildingTintTable';

// structures.csv hit_points at each building's FIRST age (v0.3.97 — until
// then houses had 75 HP and towers 175, prototype-era placeholders a damage
// fixture finally tripped over). The CSV's later-age rows raise military
// buildings further (1200/1500/1800/2100 for a Barracks) — that per-age
// ladder is a follow-up; the base values below are the CSV's debut rows.
const BUILDING_MAX_HP: Record<BuildingType, number> = {
  'town-center': 2400,
  house: 900,
  mill: 1000,
  'lumber-camp': 1000,
  'mining-camp': 1000,
  barracks: 1200,
  'watch-tower': 1020,
  'bombard-tower': 2220, // structures.csv hit_points
  stable: 1500,
  'archery-range': 1500,
  blacksmith: 2100,
  market: 2100,
  'siege-workshop': 2100,
  monastery: 2100,
  university: 2100,
  castle: 4800,
  wonder: 4800,
  'stone-wall': 1800,
  'palisade-wall': 250,
  // structures.csv "Gate": 2750 HP — tougher than the wall it stands in,
  // because it is the obvious place to attack.
  'stone-gate': 2750,
  'palisade-gate': 250,
  // M1 Farms: structures.csv hit_points 480.
  farm: 480,
  dock: 1800,
  outpost: 500, // structures.csv: Outpost hit points.
  'fish-trap': 50, // structures.csv: Fish Trap hit points.
};

const BUILDING_VISION_RADIUS = new Map<BuildingType, number>([
  ['dock', 5], // structures.csv line_of_sight.
  ['outpost', 6], // structures.csv line_of_sight — its entire reason to exist.
  ['town-center', 7],
  ['watch-tower', 8],
  ['bombard-tower', 10], // structures.csv line_of_sight
  ['castle', 11],
  ['wonder', 7],
]);

const BUILDING_COMBAT_STATES = new Map<BuildingType, BuildingCombatProfile>([
  ['town-center', { attackDamage: 5, attackRange: 6, reloadTicks: 12, cooldownTicks: 0 }],
  ['watch-tower', { attackDamage: 5, attackRange: 7, reloadTicks: 12, cooldownTicks: 0 }],
  // structures.csv: attack 120, range 8, reload 6.0s. One shot, enormous.
  ['bombard-tower', { attackDamage: 120, attackRange: 8, reloadTicks: 60, cooldownTicks: 0 }],
  ['castle', { attackDamage: 11, attackRange: 8, reloadTicks: 20, cooldownTicks: 0 }],
]);

const BUILDING_GARRISON_CAPACITY = new Map<BuildingType, number>([
  ['dock', 10], // structures.csv: "Garrison: 10 created units".
  ['town-center', 15], // structures.csv: "15 units (supports 5 population)".
  ['watch-tower', 5],
  ['bombard-tower', 5],
  ['castle', 20],
]);

// The production tables live in ./buildingProductionTables (extracted for the
// 500-LOC budget).
import {
  RESEARCHES_BY_BUILDING,
  TRAINABLE_UNITS_BY_BUILDING,
} from './buildingProductionTables';
import { ownerTint } from './playerColors';

const DARK_AGE_PREREQUISITE_BUILDINGS = new Set<BuildingType>([
  'mill',
  'lumber-camp',
  'mining-camp',
  'barracks',
]);

const FEUDAL_AGE_PREREQUISITE_BUILDINGS = new Set<BuildingType>([
  'stable',
  'archery-range',
  'blacksmith',
  'market',
]);

const CASTLE_AGE_PREREQUISITE_BUILDINGS = new Set<BuildingType>([
  'university',
  'siege-workshop',
  'monastery',
  'castle',
]);

export function buildingPopulationProvided(buildingType: BuildingType): number {
  return BUILDING_POPULATION_PROVIDED[buildingType];
}

export function buildingBuildTimeTicks(buildingType: BuildingType): number {
  return BUILDING_BUILD_TIME_TICKS[buildingType];
}

export function buildingSize(buildingType: BuildingType): number {
  return BUILDING_SIZES[buildingType];
}

export function buildingTint(
  buildingType: BuildingType,
  owner: number,
  isComplete: boolean,
): number {
  const palette = BUILDING_TINTS[buildingType];
  // Owners 1 and 2 take their authored shades untouched; every later owner
  // takes the enemy shade under its own hue (playerColors), so a three-player
  // skirmish has three readable sides rather than two identical ones.
  return ownerTint(
    {
      human: isComplete ? palette.humanComplete : palette.humanIncomplete,
      enemy: isComplete ? palette.enemyComplete : palette.enemyIncomplete,
    },
    owner,
  );
}

export function buildingMaxHp(buildingType: BuildingType): number {
  return BUILDING_MAX_HP[buildingType];
}

// The three land military production buildings gain hit points per age
// (structures.csv rows by age — Barracks 1200/1500/1800/2100; Stable and
// Archery Range from their Feudal debut). Everything else reads its flat
// table value. Creation derives the owner's current age; the age-up sweep
// (ageScaledHpSweep) moves standing buildings by the ratio.
const BUILDING_HP_BY_AGE: Partial<Record<BuildingType, Partial<Record<AgeType, number>>>> = {
  barracks: { 'dark-age': 1200, 'feudal-age': 1500, 'castle-age': 1800, 'imperial-age': 2100 },
  stable: { 'feudal-age': 1500, 'castle-age': 1800, 'imperial-age': 2100 },
  'archery-range': { 'feudal-age': 1500, 'castle-age': 1800, 'imperial-age': 2100 },
};

export function buildingMaxHpForAge(buildingType: BuildingType, age: AgeType): number {
  return BUILDING_HP_BY_AGE[buildingType]?.[age] ?? BUILDING_MAX_HP[buildingType];
}

export function buildingVisionRadius(buildingType: BuildingType): number | null {
  return BUILDING_VISION_RADIUS.get(buildingType) ?? null;
}

export function createBuildingCombatState(
  buildingType: BuildingType,
): BuildingCombatProfile | null {
  const profile = BUILDING_COMBAT_STATES.get(buildingType);
  return profile ? { ...profile } : null;
}

export function buildingGarrisonCapacity(buildingType: BuildingType): number {
  return BUILDING_GARRISON_CAPACITY.get(buildingType) ?? 0;
}

// AoE2 DE garrison rules: villagers shelter anywhere that garrisons; foot
// soldiers (infantry, foot ranged units, monks) also fit Town Centers, towers,
// and Castles; a Castle additionally takes mounted units. Siege, ships, and
// trade carts never garrison. (Until v0.3.84 only villagers and castle
// archers could - the Teuton "towers garrison 2x" line forced the honest
// widening.)
export function canGarrisonAt(
  buildingType: BuildingType,
  unitType: UnitType,
  civilization?: string,
): boolean {
  // Khmer only: "Villagers can garrison in Houses" — villagers alone, and
  // BEFORE the capacity gate, because a house's base capacity is zero.
  if (buildingType === 'house') {
    return civilization === 'Khmer' && unitType === 'villager';
  }
  if (buildingGarrisonCapacity(buildingType) <= 0) {
    return false;
  }
  if (unitType === 'villager') {
    return true;
  }
  if (isSiegeUnit(unitType) || isWaterUnit(unitType) || unitType === 'trade-cart') {
    return false;
  }
  if (buildingType === 'castle') {
    return true;
  }
  const isFootSoldier = isInfantryUnit(unitType)
    || isMonasticUnit(unitType)
    || (!isMountedUnit(unitType) && !isMeleeUnit(unitType) && unitAttackRange(unitType) > 1);
  return (
    buildingType === 'town-center'
    || buildingType === 'watch-tower'
    || buildingType === 'bombard-tower'
  ) && isFootSoldier;
}

export function buildingArrowCount(
  buildingType: BuildingType,
  garrisonedUnitsTotal: number,
  garrisonedArchers: number,
  garrisonedVillagers = 0,
): number {
  switch (buildingType) {
    case 'town-center':
      // Spec §10.8: a completed Town Center provides a base attack even when
      // empty (1 arrow) — this game's deliberate departure, which gives a
      // Town Center passive economy-phase defence. Every sheltered unit adds
      // one more, to structures.csv's ceiling of "max 10 arrows".
      return Math.min(10, 1 + garrisonedUnitsTotal);
    case 'watch-tower':
      // structures.csv "Max 5 arrows" (v0.3.96): archers and villagers each
      // add an arrow to the base one; sheltering infantry add none — which is
      // what makes the Teuton doubled garrison "(more arrows)" real.
      return Math.min(5, 1 + garrisonedArchers + garrisonedVillagers);
    case 'bombard-tower':
      // One cannon, whoever shelters inside.
      return 1;
    case 'castle':
      return Math.min(5, 1 + garrisonedArchers);
    default:
      return 0;
  }
}

export function canTrainAt(buildingType: BuildingType, unitType: TrainableUnitType): boolean {
  return TRAINABLE_UNITS_BY_BUILDING.get(buildingType)?.includes(unitType) ?? false;
}

export function canResearchAt(
  buildingType: BuildingType,
  technologyType: ResearchableTechnologyType,
): boolean {
  return RESEARCHES_BY_BUILDING.get(buildingType)?.includes(technologyType) ?? false;
}

// agent-affordances A1: the three age-up techs gate on completed
// prerequisite buildings from the era being left behind. Exposed as
// data (not just predicates) so rejection messages and the agent
// snapshot can NAME the rule instead of hiding it behind a boolean.
export type AgeUpTechnologyType = 'feudal-age' | 'castle-age' | 'imperial-age';

export const AGE_ADVANCE_REQUIRED_COUNT = 2;

export function isAgeUpTechnology(
  technologyType: ResearchableTechnologyType,
): technologyType is AgeUpTechnologyType {
  return (
    technologyType === 'feudal-age'
    || technologyType === 'castle-age'
    || technologyType === 'imperial-age'
  );
}

export function agePrerequisiteBuildingTypes(
  forTech: AgeUpTechnologyType,
): readonly BuildingType[] {
  switch (forTech) {
    case 'feudal-age':
      return [...DARK_AGE_PREREQUISITE_BUILDINGS];
    case 'castle-age':
      return [...FEUDAL_AGE_PREREQUISITE_BUILDINGS];
    case 'imperial-age':
      return [...CASTLE_AGE_PREREQUISITE_BUILDINGS];
  }
}

export function buildingsThatResearch(
  technologyType: ResearchableTechnologyType,
): BuildingType[] {
  const out: BuildingType[] = [];
  for (const [buildingType, techs] of RESEARCHES_BY_BUILDING) {
    if (techs.includes(technologyType)) out.push(buildingType);
  }
  return out;
}

export function isDarkAgePrerequisiteBuilding(buildingType: BuildingType): boolean {
  return DARK_AGE_PREREQUISITE_BUILDINGS.has(buildingType);
}

export function isFeudalAgePrerequisiteBuilding(buildingType: BuildingType): boolean {
  return FEUDAL_AGE_PREREQUISITE_BUILDINGS.has(buildingType);
}

export function isCastleAgePrerequisiteBuilding(buildingType: BuildingType): boolean {
  return CASTLE_AGE_PREREQUISITE_BUILDINGS.has(buildingType);
}
