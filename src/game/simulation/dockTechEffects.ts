// The three Dock technologies (technologies.csv, `develops_in: Dock`), all of
// them acting on SHIPS rather than on one line: Careening armours them, Dry
// Dock makes them faster, Shipwright makes them cheaper and quicker to build.
// Each is DERIVED (pure) from an owner's researched set at the site that needs
// it, the sappersTechEffects pattern — except Careening's armour, which is
// per-unit combat state like every other armour technology.
//
// The scope is the WATER domain (`isWaterUnit`), not a hand-written ship list,
// so a ship added later is covered the day it exists.

import type { PlayerResources, ResearchableTechnologyType, UnitType } from './types';
import { isWaterUnit } from './unitDomain';

// Careening: "+0/+1 armor" — pierce only. Every other armour technology in the
// game gives at least +1 melee, so this one does not go through applyArmorTech.
export const CAREENING_SHIP_PIERCE_ARMOR = 1;
// Dry Dock: "Movement rate * 1.15".
export const DRY_DOCK_SPEED_PERCENT = 115;
// Shipwright: "Wood cost * 0.8 (-20%) and build time * 0.65 (-35%)".
export const SHIPWRIGHT_WOOD_COST_MULTIPLIER = 0.8;
export const SHIPWRIGHT_TRAIN_TIME_MULTIPLIER = 0.65;
// units.csv Transport Ship: "Garrison inside 5 (10 with careening and 20 with
// dry dock)" — the two bonuses ADD to the base 5.
export const CAREENING_TRANSPORT_BONUS = 5;
export const DRY_DOCK_TRANSPORT_BONUS = 10;

/** Careening's pierce-only armour bonus for a ship: +1, or 0 for anything on
 *  land or without the technology. */
export function careeningPierceArmor(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  unitType: UnitType,
): number {
  if (!researchedTechnologies.has('careening') || !isWaterUnit(unitType)) return 0;
  return CAREENING_SHIP_PIERCE_ARMOR;
}

/** Whether Dry Dock's speed bonus applies to this unit. */
export function dryDockSpeedsUp(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  unitType: UnitType,
): boolean {
  return researchedTechnologies.has('dry-dock') && isWaterUnit(unitType);
}

/**
 * The cost after Shipwright: a ship's WOOD is discounted 20%, every other
 * resource on the row is untouched (a Galley's 30 gold stays 30). Returns the
 * base object unchanged when the technology does not apply, so callers can pass
 * it straight through.
 */
export function shipwrightWoodCost(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  unitType: UnitType,
  base: Partial<PlayerResources>,
): Partial<PlayerResources> {
  if (!researchedTechnologies.has('shipwright') || !isWaterUnit(unitType)) return base;
  if (base.wood === undefined) return base;
  return { ...base, wood: Math.round(base.wood * SHIPWRIGHT_WOOD_COST_MULTIPLIER) };
}

/** Shipwright's build-time multiplier for a ship: 0.65, or 1 otherwise. */
export function shipwrightTrainTimeMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  unitType: UnitType,
): number {
  if (!researchedTechnologies.has('shipwright') || !isWaterUnit(unitType)) return 1;
  return SHIPWRIGHT_TRAIN_TIME_MULTIPLIER;
}
