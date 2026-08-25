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
  ResearchableTechnologyType,
  ResourceKind,
  TrainableUnitType,
  UnitType,
} from './types';
import { trainingCost } from './prototypeEconomyRules';
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
export const MONGOLS_BOAR_GATHER_MULTIPLIER = 1.5;

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
