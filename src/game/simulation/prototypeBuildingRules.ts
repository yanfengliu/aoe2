import { HUMAN_PLAYER_ID } from './prototypeScenario';
import { isArcherLineUnit } from './prototypeUnitRules';
import type {
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

interface BuildingTintPalette {
  humanComplete: number;
  humanIncomplete: number;
  enemyComplete: number;
  enemyIncomplete: number;
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
  farm: 0,
  dock: 0,
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
  // M1 Farms: structures.csv build_time 15 seconds × 10 TPS = 150 ticks.
  farm: 150,
  dock: 350, // structures.csv: 35 s x 10 TPS.
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
  // M1 Farms: a 1x1 footprint; size 1 fills its single cell like the walls.
  farm: 1,
  dock: 1.2,
};

const BUILDING_TINTS: Record<BuildingType, BuildingTintPalette> = {
  'town-center': {
    humanComplete: 0xd8b36c,
    humanIncomplete: 0x7d6545,
    enemyComplete: 0xa15c5c,
    enemyIncomplete: 0x674040,
  },
  house: {
    humanComplete: 0xc8a15e,
    humanIncomplete: 0x6d593d,
    enemyComplete: 0xa66b6b,
    enemyIncomplete: 0x6a4747,
  },
  mill: {
    humanComplete: 0xb18f54,
    humanIncomplete: 0x625033,
    enemyComplete: 0x9e7161,
    enemyIncomplete: 0x654540,
  },
  'lumber-camp': {
    humanComplete: 0x6c9154,
    humanIncomplete: 0x43573a,
    enemyComplete: 0x826c63,
    enemyIncomplete: 0x564642,
  },
  'mining-camp': {
    humanComplete: 0x7f8f9f,
    humanIncomplete: 0x4c5661,
    enemyComplete: 0x8a7582,
    enemyIncomplete: 0x5b4b54,
  },
  barracks: {
    humanComplete: 0x9b7351,
    humanIncomplete: 0x5b4636,
    enemyComplete: 0x8e6257,
    enemyIncomplete: 0x5c403b,
  },
  'watch-tower': {
    humanComplete: 0x8d9aa7,
    humanIncomplete: 0x56606a,
    enemyComplete: 0xa3848f,
    enemyIncomplete: 0x654e58,
  },
  // Darker stone than a Watch Tower, so the two read apart in a base that has
  // both — the barrel is the other half of the difference.
  'bombard-tower': {
    humanComplete: 0x6f7c88,
    humanIncomplete: 0x454e56,
    enemyComplete: 0x846a74,
    enemyIncomplete: 0x513f47,
  },
  stable: {
    humanComplete: 0xa07b4f,
    humanIncomplete: 0x624b34,
    enemyComplete: 0x996763,
    enemyIncomplete: 0x604340,
  },
  'archery-range': {
    humanComplete: 0x7f6855,
    humanIncomplete: 0x4f4034,
    enemyComplete: 0x8b6660,
    enemyIncomplete: 0x5a433d,
  },
  dock: {
    humanComplete: 0x8d7a5c,
    humanIncomplete: 0x574c39,
    enemyComplete: 0x8a6a63,
    enemyIncomplete: 0x56423e,
  },
  university: {
    humanComplete: 0x8a8467,
    humanIncomplete: 0x565341,
    enemyComplete: 0x8b7566,
    enemyIncomplete: 0x594b42,
  },
  blacksmith: {
    humanComplete: 0x6f7682,
    humanIncomplete: 0x434a54,
    enemyComplete: 0x8b6670,
    enemyIncomplete: 0x5a434b,
  },
  market: {
    humanComplete: 0xb68f52,
    humanIncomplete: 0x6c5637,
    enemyComplete: 0xb07a66,
    enemyIncomplete: 0x6d4d43,
  },
  'siege-workshop': {
    humanComplete: 0x8e7352,
    humanIncomplete: 0x57462f,
    enemyComplete: 0x8b6a55,
    enemyIncomplete: 0x57413a,
  },
  monastery: {
    humanComplete: 0xcfc3a8,
    humanIncomplete: 0x6f6757,
    enemyComplete: 0xc3a8b6,
    enemyIncomplete: 0x6e5862,
  },
  castle: {
    humanComplete: 0xa09f9c,
    humanIncomplete: 0x605d59,
    enemyComplete: 0xaa7a7a,
    enemyIncomplete: 0x604545,
  },
  wonder: {
    humanComplete: 0xe6c36a,
    humanIncomplete: 0x8a7340,
    enemyComplete: 0xb9585f,
    enemyIncomplete: 0x6b3438,
  },
  'stone-wall': {
    humanComplete: 0x9aa0a8,
    humanIncomplete: 0x5d606a,
    enemyComplete: 0xa57272,
    enemyIncomplete: 0x5d4242,
  },
  'palisade-wall': {
    humanComplete: 0xa88555,
    humanIncomplete: 0x655138,
    enemyComplete: 0xa17066,
    enemyIncomplete: 0x604540,
  },
  // M1 Farms: golden wheat tones for a complete farm; muddy tilled-soil
  // tones while under construction.
  farm: {
    humanComplete: 0xd9b84a,
    humanIncomplete: 0x7a6a3a,
    enemyComplete: 0xc09a55,
    enemyIncomplete: 0x6f5a3a,
  },
};

const BUILDING_MAX_HP: Record<BuildingType, number> = {
  'town-center': 2400,
  house: 75,
  mill: 100,
  'lumber-camp': 100,
  'mining-camp': 100,
  barracks: 175,
  'watch-tower': 175,
  'bombard-tower': 2220, // structures.csv hit_points
  stable: 175,
  'archery-range': 175,
  blacksmith: 175,
  market: 175,
  'siege-workshop': 2000,
  monastery: 2100,
  university: 2100,
  castle: 4800,
  wonder: 4800,
  'stone-wall': 2000,
  'palisade-wall': 250,
  // M1 Farms: structures.csv hit_points 480.
  farm: 480,
  dock: 1800,
};

const BUILDING_VISION_RADIUS = new Map<BuildingType, number>([
  ['dock', 5], // structures.csv line_of_sight.
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
  ['town-center', 5],
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
  const isHuman = owner === HUMAN_PLAYER_ID;
  if (isHuman) {
    return isComplete ? palette.humanComplete : palette.humanIncomplete;
  }
  return isComplete ? palette.enemyComplete : palette.enemyIncomplete;
}

export function buildingMaxHp(buildingType: BuildingType): number {
  return BUILDING_MAX_HP[buildingType];
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

export function canGarrisonAt(buildingType: BuildingType, unitType: UnitType): boolean {
  if (buildingGarrisonCapacity(buildingType) <= 0) {
    return false;
  }
  if (unitType === 'villager') {
    return true;
  }
  return buildingType === 'castle' && isArcherLineUnit(unitType);
}

export function buildingArrowCount(
  buildingType: BuildingType,
  garrisonedUnitsTotal: number,
  garrisonedArchers: number,
): number {
  switch (buildingType) {
    case 'town-center':
      // Spec §10.8: a completed Town Center provides a base attack even when
      // empty (1 arrow), plus one per garrisoned unit up to 4 — mirroring the
      // Castle's empty-fire of 1. Gives a TC passive economy-phase defense.
      return 1 + Math.min(garrisonedUnitsTotal, 4);
    case 'watch-tower':
    case 'bombard-tower':
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
