// The three combat numbers the selection panel shows: attack, melee armor and
// pierce armor. Extracted from ./selectionStateOps.ts for the 500-LOC budget;
// each reads the same three component shapes and answers null for anything
// that has no such number, so they group naturally.
//
// The armor rows are the TOTAL armor, base plus upgrades, as DE's panel shows
// it (work 140): a unit's base melee and pierce armor and its armor-technology
// accumulators, exactly what its damage path subtracts, and a building's armor
// under its owner's age and technologies, from the same seam every hit on a
// building reads. Until work 140 they showed only the armor-technology bonus,
// and 0/0 for every building.

import { pierceArmorTechBonus } from '../armorTechBonuses';
import {
  effectiveMeleeArmor,
  effectivePierceArmor,
  unitAttackDamage,
} from '../prototypeUnitRules';
import type {
  BuildingComponent,
  ResourceComponent,
  UnitComponent,
} from '../types';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  buildingCombatStatesCodec,
  combatStatesCodec,
  wildlifeStatesCodec,
} from './bridgeStateSerialize';
import { currentBuildingArmor } from './buildingHitDamage';

export function getSelectionAttack(
  accessor: BridgeStateAccessor,
  id: number,
  unit: UnitComponent | undefined,
  building: BuildingComponent | undefined,
  resource: ResourceComponent | undefined,
): number | null {
  if (unit) {
    return accessor.get(combatStatesCodec).get(id)?.attackDamage ?? unitAttackDamage(unit.unitType);
  }
  if (building) {
    return accessor.get(buildingCombatStatesCodec).get(id)?.attackDamage ?? null;
  }
  if (resource) {
    const wildlife = accessor.get(wildlifeStatesCodec).get(id);
    return wildlife?.isAlive ? wildlife.attackDamage : null;
  }
  return null;
}

export function getSelectionArmor(
  accessor: BridgeStateAccessor,
  unit: UnitComponent | undefined,
  building: BuildingComponent | undefined,
  resource: ResourceComponent | undefined,
  id: number,
): number | null {
  if (unit) {
    return effectiveMeleeArmor(unit.unitType, accessor.get(combatStatesCodec).get(id)?.armor ?? 0);
  }
  if (building) {
    return currentBuildingArmor(accessor, building).melee;
  }
  if (resource) {
    // An animal carries no armor here: a blow on one lands whole (spec §10.7).
    return accessor.get(wildlifeStatesCodec).get(id)?.isAlive ? 0 : null;
  }
  return null;
}

// Pierce armor: base pierce plus the symmetric armor-tech bonus plus the
// asymmetric pierce-only one (spec §11.8), the figure a pierce hit meets.
export function getSelectionPierceArmor(
  accessor: BridgeStateAccessor,
  unit: UnitComponent | undefined,
  building: BuildingComponent | undefined,
  resource: ResourceComponent | undefined,
  id: number,
): number | null {
  if (unit) {
    const combat = accessor.get(combatStatesCodec).get(id);
    return effectivePierceArmor(unit.unitType, combat ? pierceArmorTechBonus(combat) : 0);
  }
  if (building) {
    return currentBuildingArmor(accessor, building).pierce;
  }
  if (resource) {
    return accessor.get(wildlifeStatesCodec).get(id)?.isAlive ? 0 : null;
  }
  return null;
}
