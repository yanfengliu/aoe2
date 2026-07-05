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
  PlayerResources,
  ResourceKind,
  TrainableUnitType,
  UnitType,
} from './types';
import { isInfantryUnit } from './prototypeUnitRules';
import { trainingCost } from './prototypeEconomyRules';

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
export const MONGOLS_BOAR_GATHER_MULTIPLIER = 1.5;

// Slavs farmers gather from farms 15% faster ("Farmers work 15% faster").
export const SLAVS_FARM_GATHER_MULTIPLIER = 1.15;

// Mongols Light Cavalry and Hussars have +30% HP.
export const MONGOLS_SCOUT_HP_MULTIPLIER = 1.3;

// The Knight LINE — the applies-to scope of the Franks HP bonus. Excludes the
// Scout line, Camels, and Cavalry Archers (which are also mounted).
const KNIGHT_LINE_UNITS = new Set<UnitType>(['knight', 'cavalier', 'paladin']);

// The upgraded Scout line — the applies-to scope of the Mongols HP bonus. Per
// the CSV ("Light Cavalry and Hussars") the base Scout Cavalry is excluded.
const MONGOLS_SCOUT_HP_UNITS = new Set<UnitType>(['light-cavalry', 'hussar']);

// The owner's civilization gather-rate multiplier for a concrete resource KIND.
// 1.0 (no bonus) unless a civ bonus matches both the civ and the kind.
export function civGatherRateMultiplier(
  civilization: string | undefined,
  kind: ResourceKind,
): number {
  if (civilization === 'Britons' && kind === 'sheep') {
    return BRITONS_SHEEP_GATHER_MULTIPLIER;
  }
  if (civilization === 'Mongols' && kind === 'boar') {
    return MONGOLS_BOAR_GATHER_MULTIPLIER;
  }
  if (civilization === 'Slavs' && kind === 'farm') {
    return SLAVS_FARM_GATHER_MULTIPLIER;
  }
  return 1;
}

// The owner's civilization max-HP multiplier for a unit type. 1.0 (no bonus)
// unless a civ bonus matches both the civ and the unit. Applied to the BASE HP
// at combat-state creation, before flat tech bonuses (Bloodlines, Loom) add.
export function civUnitHpMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
): number {
  if (civilization === 'Franks' && KNIGHT_LINE_UNITS.has(unitType)) {
    return FRANKS_KNIGHT_HP_MULTIPLIER;
  }
  if (civilization === 'Mongols' && MONGOLS_SCOUT_HP_UNITS.has(unitType)) {
    return MONGOLS_SCOUT_HP_MULTIPLIER;
  }
  return 1;
}

// The owner's civilization ADDITIVE attack bonus against buildings for an
// attacker unit. 0 unless a civ bonus matches. Read at the unit→building damage
// site alongside the Sappers tech bonus (which uses the same shape).
export function civBuildingAttackBonus(
  civilization: string | undefined,
  attackerType: UnitType,
): number {
  if (civilization === 'Goths' && isInfantryUnit(attackerType)) {
    return GOTHS_INFANTRY_BUILDING_ATTACK_BONUS;
  }
  return 0;
}

// The owner's civilization train-TIME multiplier for a unit type. 1.0 (no
// change) unless a civ bonus matches. Aztecs train MILITARY (every non-villager
// trainable) 15% faster; villagers are unaffected. Applied to the unit's total
// train ticks at the single enqueue site (trainingMarketOps).
export function civTrainTimeMultiplier(
  civilization: string | undefined,
  unitType: UnitType,
): number {
  if (civilization === 'Aztecs' && unitType !== 'villager') {
    return AZTECS_MILITARY_TRAIN_TIME_MULTIPLIER;
  }
  return 1;
}

// The owner's effective training cost for a unit, after civ cost bonuses.
// Goths infantry cost 35% less from the Feudal Age; otherwise the base cost.
// Returns a NEW object when discounted (the base table is never mutated), and
// the shared base reference otherwise. This MUST be used at every training-cost
// site — the charge AND every affordability/validation check — so they agree.
export function effectiveTrainingCost(
  civilization: string | undefined,
  age: AgeType,
  unitType: TrainableUnitType,
): Partial<PlayerResources> {
  const base = trainingCost(unitType);
  if (civilization === 'Goths' && age !== 'dark-age' && isInfantryUnit(unitType)) {
    const scaled: Partial<PlayerResources> = {};
    for (const key of Object.keys(base) as (keyof PlayerResources)[]) {
      scaled[key] = Math.round((base[key] ?? 0) * GOTHS_INFANTRY_COST_MULTIPLIER);
    }
    return scaled;
  }
  return base;
}
