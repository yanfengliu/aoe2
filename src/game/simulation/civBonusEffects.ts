// Civilization-bonus DERIVED layer (v0.1.81). The per-civ analogue of the
// tech-effect modules (economyTechEffects, movementTechEffects,
// visionTechEffects): pure functions that take the owner's civilization (a
// string, read from playerCivilizationsCodec) plus the relevant context and
// return a multiplier/bonus applied at the use-site. No per-entity state and
// no save-format change — the civilization already lives in the persisted
// playerCivilizations map, and replay re-seeds it deterministically from tick 0.
//
// First consumer: Britons "Shepherds work 25% faster" (civilizations.csv) — a
// gather-rate multiplier that applies ONLY to villagers gathering sheep. It
// multiplies with the tech gather-rate multiplier at the villager gather-tick
// site (villagerEconomySystem). An unknown/undefined civilization is a no-op
// (multiplier 1), so non-Britons owners and un-seeded owners are byte-identical.

import type {
  AgeType,
  BuildingType,
  PlayerResources,
  ResearchableTechnologyType,
  ResourceKind,
  TrainableUnitType,
  UnitType,
} from './types';
import { constructionCost, trainingCost } from './prototypeEconomyRules';
import { civBonusesFor } from './civBonusTable';
import { shipwrightWoodCost } from './dockTechEffects';

// Britons shepherds gather sheep 25% faster.
export const BRITONS_SHEEP_GATHER_MULTIPLIER = 1.25;

// Franks Knight line (Knight → Cavalier → Paladin) has +20% HP.
export const FRANKS_KNIGHT_HP_MULTIPLIER = 1.2;

// Goths infantry deal +1 attack against buildings (from game start).
export const GOTHS_INFANTRY_BUILDING_ATTACK_BONUS = 1;

// Aztecs military units train 15% faster (×0.85 train time).
export const AZTECS_MILITARY_TRAIN_TIME_MULTIPLIER = 0.85;

// Goths infantry cost 35% less (×0.65) from the Feudal Age.
export const GOTHS_INFANTRY_COST_MULTIPLIER = 0.65;

// Mongols hunters gather boar 50% faster ("Hunters work 50% faster").
export const MONGOLS_BOAR_GATHER_MULTIPLIER = 1.4; // DE: hunters +40%.

// Mongols Light Cavalry and Hussars have +30% HP.
export const MONGOLS_SCOUT_HP_MULTIPLIER = 1.3;

// Every seam below reads the declared table (civBonusTable.ts) — the if-chain
// era ended at five civilizations, and the table now carries every CSV line
// these seams can express. An unknown/undefined civilization reads neutral.

export function civGatherRateMultiplier(
  civilization: string | undefined,
  kind: ResourceKind,
): number {
  return civBonusesFor(civilization)?.gatherRate?.[kind] ?? 1;
}

// Applied to the BASE HP at combat-state creation, before flat tech bonuses
// (Bloodlines, Loom) add.
export function civUnitHpMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
): number {
  for (const rule of civBonusesFor(civilization)?.unitHp ?? []) {
    if (rule.applies(unitType)) return rule.multiplier;
  }
  return 1;
}

// ADDITIVE attack bonus against buildings, read at the unit→building damage
// site alongside the Sappers tech bonus (which uses the same shape).
export function civBuildingAttackBonus(
  civilization: string | undefined,
  attackerType: UnitType,
): number {
  for (const rule of civBonusesFor(civilization)?.buildingAttack ?? []) {
    if (rule.applies(attackerType)) return rule.bonus;
  }
  return 0;
}

// Train-TIME multiplier, applied to the unit's total train ticks at the single
// enqueue site (trainingMarketOps).
export function civTrainTimeMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
): number {
  for (const rule of civBonusesFor(civilization)?.trainTime ?? []) {
    if (rule.applies(unitType)) return rule.multiplier;
  }
  return 1;
}

// Movement-speed multiplier, applied in the movement tech seam so it composes
// with Squires/Husbandry/Caravan exactly as a technology would.
export function civSpeedMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
): number {
  for (const rule of civBonusesFor(civilization)?.speed ?? []) {
    if (rule.applies(unitType)) return rule.multiplier;
  }
  return 1;
}

// Flat carry bonus for a villager gathering THIS resource kind. Adds to the
// base carry BEFORE the Wheelbarrow multiplier, matching AoE2's math.
export function civCarryBonus(
  civilization: string | undefined,
  kind: ResourceKind,
): number {
  let bonus = 0;
  for (const rule of civBonusesFor(civilization)?.carryBonus ?? []) {
    if (rule.kind === undefined || rule.kind === kind) bonus += rule.bonus;
  }
  return bonus;
}

// Extra population a building of this type supports for this civilization
// (Chinese Town Centers, Inca houses). Adds to the base table at BOTH raw-
// supply sites, so the cap math never disagrees with itself.
export function civPopulationProvidedBonus(
  civilization: string | undefined,
  buildingType: string,
): number {
  return civBonusesFor(civilization)?.populationProvided?.[buildingType] ?? 0;
}

// The owner's effective BUILDING cost (Franks castles, Japanese camps,
// Teutons farms, Inca stone, Malian wood). Must be used at every construction
// charge/afford/display site so they agree — the effectiveTrainingCost rule.
export function effectiveConstructionCost(
  civilization: string | undefined,
  buildingType: BuildingType,
): Partial<PlayerResources> {
  const base = constructionCost(buildingType);
  const rules = civBonusesFor(civilization)?.buildingCost ?? [];
  let cost: Partial<PlayerResources> | null = null;
  const writable = (): Partial<PlayerResources> => {
    if (!cost) cost = { ...base };
    return cost;
  };
  for (const rule of rules) {
    if (!rule.applies(buildingType)) continue;
    if (rule.multiplier !== undefined) {
      const target = writable();
      for (const key of Object.keys(target) as (keyof PlayerResources)[]) {
        target[key] = Math.round((target[key] ?? 0) * rule.multiplier);
      }
    }
    if (rule.woodMultiplier !== undefined) {
      const target = writable();
      if (target.wood !== undefined) target.wood = Math.round(target.wood * rule.woodMultiplier);
    }
    if (rule.stoneMultiplier !== undefined) {
      const target = writable();
      if (target.stone !== undefined) target.stone = Math.round(target.stone * rule.stoneMultiplier);
    }
  }
  return cost ?? base;
}

// Building max-HP multiplier (Persians' Town Centers and Docks), applied at
// the building combat-state factory beside the tech HP multipliers.
export function civBuildingHpMultiplier(
  civilization: string | undefined,
  buildingType: BuildingType,
): number {
  for (const rule of civBonusesFor(civilization)?.buildingHp ?? []) {
    if (rule.applies(buildingType)) return rule.multiplier;
  }
  return 1;
}

/** Huns: population is never limited by housing. */
export function civIgnoresHousing(civilization: string | undefined): boolean {
  return civBonusesFor(civilization)?.houselessPopulation === true;
}

/**
 * Ethiopians: "+100 gold and +100 food when advancing to the next age" —
 * paid into the stockpile when an age advance completes. Null for everyone
 * else so the age cases skip the mutation entirely.
 */
/** Incas: "Villagers affected by Blacksmith upgrades" — the infantry ARMOR
 *  line reaches villagers (the melee ATTACK line already reaches every civ's
 *  villagers, matching AoE2, because villagers are melee units). */
export function civVillagersTakeInfantryArmor(civilization: string | undefined): boolean {
  return civilization === 'Incas';
}

/** Goths: "+10 to population limit in Imperial Age" — raises the HARD cap. */
export function civImperialPopulationBonus(
  civilization: string | undefined,
  age: AgeType,
): number {
  if (age !== 'imperial-age') return 0;
  return civBonusesFor(civilization)?.imperialPopulationBonus ?? 0;
}

/**
 * Koreans: "Towers (except bombard towers) have +1 range in Castle Age /
 * +2 in Imperial Age" — derived at the tower's fire site like the tech ladder.
 */
export function koreanTowerRangeBonus(
  civilization: string | undefined,
  buildingType: BuildingType,
  age: AgeType,
): number {
  if (civilization !== 'Koreans' || buildingType !== 'watch-tower') return 0;
  if (age === 'imperial-age') return 2;
  if (age === 'castle-age') return 1;
  return 0;
}

/**
 * Japanese: "Fishing Ships work +5% faster in Dark Age / +10% in Feudal Age /
 * +15% in Castle Age / +20% in Imperial Age" — the ship's gather multiplier.
 * Villagers shore-fishing are NOT Fishing Ships and read 1.
 */
export function civFishingShipRateMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
  age: AgeType,
): number {
  if (civilization !== 'Japanese' || unitType !== 'fishing-ship') return 1;
  return { 'dark-age': 1.05, 'feudal-age': 1.1, 'castle-age': 1.15, 'imperial-age': 1.2 }[age];
}

export function civAgeAdvanceGrant(
  civilization: string | undefined,
): Readonly<Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>>> | null {
  return civBonusesFor(civilization)?.ageAdvanceResourceGrant ?? null;
}

// The owner's effective training cost for a unit, after civ cost bonuses and
// the Shipwright discount. Returns a NEW object when discounted (the base
// table is never mutated), and the shared base reference otherwise. This MUST
// be used at every training-cost site — the charge AND every affordability or
// validation check — so they agree.
export function effectiveTrainingCost(
  civilization: string | undefined,
  age: AgeType,
  unitType: TrainableUnitType,
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): Partial<PlayerResources> {
  // Shipwright discounts a ship's wood 20%. It is a TECHNOLOGY rather than a
  // civilization bonus, but every site that charges or checks a training cost
  // comes through here, so it belongs at this seam.
  const base = shipwrightWoodCost(researchedTechnologies, unitType, trainingCost(unitType));
  const rules = civBonusesFor(civilization)?.cost ?? [];
  let cost: Partial<PlayerResources> | null = null;
  const writable = (): Partial<PlayerResources> => {
    if (!cost) cost = { ...base };
    return cost;
  };
  for (const rule of rules) {
    if (!rule.applies(unitType)) continue;
    const multiplier = rule.multiplier ?? rule.multiplierByAge?.[age];
    if (multiplier !== undefined && multiplier !== 1) {
      const target = writable();
      for (const key of Object.keys(target) as (keyof PlayerResources)[]) {
        target[key] = Math.round((target[key] ?? 0) * multiplier);
      }
    }
    if (rule.goldMultiplier !== undefined) {
      const target = writable();
      if (target.gold !== undefined) {
        target.gold = Math.round(target.gold * rule.goldMultiplier);
      }
    }
    if (rule.woodDelta !== undefined) {
      const target = writable();
      if (target.wood !== undefined) {
        target.wood = Math.max(0, target.wood + rule.woodDelta);
      }
    }
  }
  return cost ?? base;
}
