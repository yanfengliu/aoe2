// The three combat numbers the selection panel shows: attack, melee armor, and
// the pierce-armor tech bonus. Extracted from ./selectionStateOps.ts for the
// 500-LOC budget; each reads the same three component shapes and answers null
// for anything that has no such number, so they group naturally.

import { pierceArmorTechBonus } from '../armorTechBonuses';
import { unitAttackDamage } from '../prototypeUnitRules';
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
    return accessor.get(combatStatesCodec).get(id)?.armor ?? 0;
  }
  if (building) {
    return 0;
  }
  if (resource) {
    return accessor.get(wildlifeStatesCodec).get(id)?.isAlive ? 0 : null;
  }
  return null;
}

// Pierce armor-tech bonus (= melee `armor` + the asymmetric pierce-only
// bonus). Mirrors getSelectionArmor so the panel can show the melee/pierce
// split (spec §11.8) — same value semantics as the melee side (tech bonus,
// not base+bonus effective armor).
export function getSelectionPierceArmor(
  accessor: BridgeStateAccessor,
  unit: UnitComponent | undefined,
  building: BuildingComponent | undefined,
  resource: ResourceComponent | undefined,
  id: number,
): number | null {
  if (unit) {
    const combat = accessor.get(combatStatesCodec).get(id);
    return combat ? pierceArmorTechBonus(combat) : 0;
  }
  if (building) {
    return 0;
  }
  if (resource) {
    return accessor.get(wildlifeStatesCodec).get(id)?.isAlive ? 0 : null;
  }
  return null;
}
