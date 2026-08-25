// Villager repair of MECHANICAL units (spec §8.1, v0.3.107): AoE2 lets a
// villager mend what a Monk cannot — siege engines and ships — while Monks
// heal what a villager cannot. "Mechanical" is derived from the armor-class
// taxonomy (the honest class source): anything carrying the siege or ship
// class. The economics mirror building repair's slice-1 model exactly: half
// the training cost, pro-rata the missing hit points, charged up front.

import { UNIT_ARMOR_CLASSES } from './prototypeUnitRules/armorClasses';
import { trainingCost, trainingTimeTicks } from './prototypeEconomyRules';
import type { PlayerResources } from './types';
import type { TrainableUnitType, UnitType } from './types';

const REPAIR_COST_FRACTION = 0.5;

/** Whether a villager can repair this unit — siege engines and ships. */
export function isRepairableUnitType(unitType: UnitType): boolean {
  const classes = UNIT_ARMOR_CLASSES[unitType];
  return classes.has('siege') || classes.has('ship');
}

/** Half the training cost, scaled by the missing fraction — the building
 *  repair formula applied to the unit's own cost table. */
export function unitRepairCost(
  unitType: TrainableUnitType,
  missingHp: number,
  maxHp: number,
): Partial<PlayerResources> {
  const train = trainingCost(unitType);
  const fraction = maxHp > 0 ? REPAIR_COST_FRACTION * (Math.max(0, missingHp) / maxHp) : 0;
  const cost: Partial<PlayerResources> = {};
  for (const key of ['food', 'wood', 'gold', 'stone'] as const) {
    const amount = Math.ceil((train[key] ?? 0) * fraction);
    if (amount > 0) cost[key] = amount;
  }
  return cost;
}

/** HP restored per adjacent tick: the unit rebuilds at its own training
 *  rate, exactly as a building repairs at its build rate. */
export function unitRepairRatePerTick(unitType: TrainableUnitType, maxHp: number): number {
  return maxHp / Math.max(1, trainingTimeTicks(unitType));
}
