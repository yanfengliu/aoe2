// Wonder countdown decrement. Each owner's completed Wonder ticks down a
// per-owner counter; when it hits zero the entry stamps `lastCompletedTick`.
// The combined `prototypeWinConditionResolver` downstream decides who
// actually wins (Wonder / Relic) so the "first to complete" rule is
// explicit instead of implicit system-registration order.

import type { BuildingComponent } from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { wonderCountdownsCodec } from '../bridgeStateSerialize';

export interface WonderCountdownSystemDeps {
  world: GameWorld;
  // Phase 2D: wonderCountdowns migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  isMatchRunning: () => boolean;
}

export function registerWonderCountdownSystem(deps: WonderCountdownSystemDeps): void {
  const { world, accessor, isMatchRunning } = deps;

  world.registerSystem({
    name: 'prototypeWonderCountdown',
    phase: 'postUpdate',
    execute() {
      if (!isMatchRunning()) {
        return;
      }
      const wonderCountdowns = accessor.get(wonderCountdownsCodec);
      let dirty = false;
      for (const [buildingId, entry] of [...wonderCountdowns.entries()]) {
        const building = world.getComponent<BuildingComponent>(buildingId, 'building');
        if (!building) {
          wonderCountdowns.delete(buildingId);
          dirty = true;
          continue;
        }
        if (entry.lastCompletedTick !== null) {
          continue;
        }
        entry.remainingTicks -= 1;
        if (entry.remainingTicks <= 0) {
          entry.lastCompletedTick = world.tick;
        }
        dirty = true;
      }
      if (dirty) {
        accessor.markDirty(wonderCountdownsCodec);
      }
    },
  });
}
