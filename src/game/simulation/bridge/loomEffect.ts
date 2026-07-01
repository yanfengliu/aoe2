// Loom technology effect — applied to an owner's EXISTING villagers when the
// research completes. Factored out of technologyOps' `applyTechnology` switch to
// keep that file under the 500-LOC budget; the newly-trained-villager half of
// Loom lives in combatStateFactory (createCombatState), and the option/cost
// wiring lives in optionsRules + prototypeEconomyRules + prototypeBuildingRules.
//
// The HP bump is FLAT on both current and max — a 10/25 villager becomes 25/40,
// matching AoE2's "buffer added to current HP too". This is deliberately NOT
// routed through upgradeOwnedUnits, which preserves HP *ratio* (the
// unit-type-change model) and would scale current HP wrongly for a flat buff.
// The caller (applyTechnology) guards against a double-bump via its
// already-researched check, so two Town Centers race-queueing Loom apply it
// once. AoE2 Loom is +1 melee / +2 pierce; applyArmorTech routes the asymmetric
// pierce bonus (spec §11.8).

import type { UnitComponent } from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { applyArmorTech } from '../armorTechBonuses';
import { combatStatesCodec } from './bridgeStateSerialize';

export const LOOM_BONUS_HP = 15;

// Apply Loom's flat +15 HP (current + max) and +1 melee / +2 pierce armor to
// every villager owned by `owner`. Caller marks the combat-state slot dirty and
// triggers the out-of-band render refresh.
export function applyLoomToOwnedVillagers(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  owner: number,
): void {
  for (const id of world.query('unit')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    const combat = accessor.get(combatStatesCodec).get(id);
    if (!unit || !combat || unit.owner !== owner || unit.unitType !== 'villager') {
      continue;
    }
    combat.maxHp += LOOM_BONUS_HP;
    combat.currentHp += LOOM_BONUS_HP;
    applyArmorTech(combat, 'loom');
  }
}
