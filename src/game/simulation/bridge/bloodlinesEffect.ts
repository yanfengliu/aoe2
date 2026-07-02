// Bloodlines technology effect — applied to an owner's EXISTING mounted units
// when the research completes. Mirrors loomEffect (villager HP) and
// sanctityEffect (monk HP). The newly-trained half lives in combatStateFactory
// (createCombatState); the option/cost wiring lives in optionsRules +
// prototypeEconomyRules + prototypeBuildingRules.
//
// The HP bump is FLAT on both current and max — an AoE2 MOUNTED unit (cavalry
// + cavalry archers, technologies.csv:78 applies-to; the cavalry-only scope was
// a v0.1.65 divergence fixed in v0.1.67) gains +20 HP from Bloodlines. The
// caller (applyTechnology) guards against a double-bump via its
// already-researched check.

import type { UnitComponent } from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { combatStatesCodec } from './bridgeStateSerialize';
import { isMountedUnit } from '../prototypeUnitRules';

export const BLOODLINES_BONUS_HP = 20;

// Apply Bloodlines' flat +20 HP (current + max) to every mounted unit owned by
// `owner`. Caller marks the combat-state slot dirty and triggers the render
// refresh.
export function applyBloodlinesToOwnedCavalry(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
): void {
  for (const id of world.query('unit')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    const combat = accessor.get(combatStatesCodec).get(id);
    if (!unit || !combat || unit.owner !== owner || !isMountedUnit(unit.unitType)) {
      continue;
    }
    combat.maxHp += BLOODLINES_BONUS_HP;
    combat.currentHp += BLOODLINES_BONUS_HP;
  }
}
