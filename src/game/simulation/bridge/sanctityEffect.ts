// Sanctity technology effect — applied to an owner's EXISTING monks when the
// research completes. Mirrors loomEffect (villager HP) for monks. The
// newly-trained-monk half lives in combatStateFactory (createCombatState); the
// option/cost wiring lives in optionsRules + monasteryTechOptions +
// prototypeEconomyRules + prototypeBuildingRules.
//
// The HP bump is FLAT on both current and max — an AoE2 Monk gains +15 HP from
// Sanctity. The caller (applyTechnology) guards against a double-bump via its
// already-researched check.

import { isMonasticUnit } from '../monasticUnits';
import type { UnitComponent } from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { combatStatesCodec } from './bridgeStateSerialize';

export const SANCTITY_BONUS_HP = 15;

// Apply Sanctity's flat +15 HP (current + max) to every monk owned by `owner`.
// Caller marks the combat-state slot dirty and triggers the render refresh.
export function applySanctityToOwnedMonks(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
): void {
  for (const id of world.query('unit')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    const combat = accessor.get(combatStatesCodec).get(id);
    if (!unit || !combat || unit.owner !== owner || !isMonasticUnit(unit.unitType)) {
      continue;
    }
    combat.maxHp += SANCTITY_BONUS_HP;
    combat.currentHp += SANCTITY_BONUS_HP;
  }
}
