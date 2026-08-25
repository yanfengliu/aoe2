// The age-up half of the age-scaled HP family (ageScaledHp.ts): when an owner
// advances, every standing unit/building whose ladder factor changes has its
// stored HP multiplied by the factor RATIO — new step over old — so the ladder
// replaces rather than compounds ("does not stack"), and every other bonus
// already baked into the stored value (Masonry, Loom-style flats, civ
// multipliers) rides along untouched. Damage is kept absolute and a full unit
// stays full: the Hoardings rule — an upgrade, not a heal.

import type { AgeType, BuildingComponent, UnitComponent } from '../types';
import {
  ageScaledBuildingHpFactor,
  ageScaledUnitHpFactor,
} from '../ageScaledHp';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  buildingHealthStatesCodec,
  combatStatesCodec,
  playerCivilizationsCodec,
} from './bridgeStateSerialize';
import type { GameWorld } from './pureHelpers';

export function applyAgeScaledHpSweep(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
  fromAge: AgeType,
  toAge: AgeType,
): void {
  const civilization = accessor.get(playerCivilizationsCodec).get(owner);
  if (!civilization) return;

  const combatStates = accessor.get(combatStatesCodec);
  let unitsTouched = false;
  for (const id of world.query('unit')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (!unit || unit.owner !== owner) continue;
    const from = ageScaledUnitHpFactor(civilization, unit.unitType, fromAge);
    const to = ageScaledUnitHpFactor(civilization, unit.unitType, toAge);
    if (from === to) continue;
    const combat = combatStates.get(id);
    if (!combat || combat.maxHp <= 0) continue;
    const wasFull = combat.currentHp >= combat.maxHp;
    combat.maxHp = Math.round((combat.maxHp * to) / from);
    combat.currentHp = wasFull
      ? combat.maxHp
      : Math.min(combat.currentHp, combat.maxHp);
    unitsTouched = true;
  }
  if (unitsTouched) accessor.markDirty(combatStatesCodec);

  accessor.mutate(buildingHealthStatesCodec, (healths) => {
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== owner) continue;
      const from = ageScaledBuildingHpFactor(civilization, building.buildingType, fromAge);
      const to = ageScaledBuildingHpFactor(civilization, building.buildingType, toAge);
      if (from === to) continue;
      const health = healths.get(id);
      if (!health) continue;
      const wasFull = health.currentHp >= health.maxHp;
      const maxHp = Math.round((health.maxHp * to) / from);
      healths.set(id, {
        ...health,
        maxHp,
        currentHp: wasFull ? maxHp : Math.min(health.currentHp, maxHp),
      });
    }
  });
}
