// Self-healing units (spec §10). One line has it — the Vikings' Berserk — and
// Berserkergang doubles the rate, which is why that technology could not exist
// until this system did.
//
// Sits beside the garrison heal and works the same way: a fixed amount per
// tick, read from the owner's researched set, never reviving the dead and
// never over-healing the whole. It walks the units that HAVE combat state
// rather than a world query, and does nothing at all when nobody on the map
// regenerates — which is every match without Vikings.

import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import type { ResearchableTechnologyType, UnitComponent } from '../../types';
import {
  combatStatesCodec,
  researchedTechnologiesCodec,
} from '../bridgeStateSerialize';
import { regenPerTick, regenStep, regeneratesOnItsOwn } from '../../unitRegeneration';

const NO_RESEARCHED_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();

export interface UnitRegenerationSystemDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  /**
   * The health bar is rendered from a snapshot the renderer only rebuilds when
   * something tells it to. Healing is the rare mutation that happens with no
   * command, no attack and no death behind it, so without this the bar sits at
   * the wounded value until the player clicks something — which is how the
   * browser test caught its absence.
   */
  markOutOfBandRenderChange: () => void;
}

export function registerUnitRegenerationSystem(deps: UnitRegenerationSystemDeps): void {
  const { world, accessor, markOutOfBandRenderChange } = deps;

  world.registerSystem({
    name: 'prototypeUnitRegeneration',
    phase: 'update',
    execute(activeWorld) {
      const combatStates = accessor.get(combatStatesCodec);
      if (combatStates.size === 0) return;
      const researched = accessor.get(researchedTechnologiesCodec);

      let healedAny = false;
      for (const [id, combat] of combatStates) {
        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!unit || !regeneratesOnItsOwn(unit.unitType)) continue;
        const rate = regenPerTick(
          unit.unitType,
          researched.get(unit.owner) ?? NO_RESEARCHED_TECHS,
        );
        const next = regenStep(combat.currentHp, combat.maxHp, rate);
        if (next === combat.currentHp) continue;
        combat.currentHp = next;
        healedAny = true;
      }
      if (!healedAny) return;
      accessor.markDirty(combatStatesCodec);
      markOutOfBandRenderChange();
    },
  });
}
