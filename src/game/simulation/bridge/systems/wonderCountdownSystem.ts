// Wonder countdown decrement. Each owner's completed Wonder ticks down a
// per-owner counter; when it hits zero the entry stamps `lastCompletedTick`.
// The combined `prototypeWinConditionResolver` downstream decides who
// actually wins (Wonder / Relic) so the "first to complete" rule is
// explicit instead of implicit system-registration order.

import type { BuildingComponent } from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { WonderCountdownEntry } from '../countdownTypes';

export interface WonderCountdownSystemDeps {
  world: GameWorld;
  wonderCountdowns: Map<number, WonderCountdownEntry>;
  isMatchRunning: () => boolean;
}

export function registerWonderCountdownSystem(deps: WonderCountdownSystemDeps): void {
  const { world, wonderCountdowns, isMatchRunning } = deps;

  world.registerSystem({
    name: 'prototypeWonderCountdown',
    phase: 'postUpdate',
    execute() {
      if (!isMatchRunning()) {
        return;
      }
      for (const [buildingId, entry] of [...wonderCountdowns.entries()]) {
        const building = world.getComponent<BuildingComponent>(buildingId, 'building');
        if (!building) {
          wonderCountdowns.delete(buildingId);
          continue;
        }
        if (entry.lastCompletedTick !== null) {
          continue;
        }
        entry.remainingTicks -= 1;
        if (entry.remainingTicks <= 0) {
          entry.lastCompletedTick = world.tick;
        }
      }
    },
  });
}
