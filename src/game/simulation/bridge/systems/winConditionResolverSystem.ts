// FU7: resolves Wonder vs Relic outcomes with an explicit
// `lastCompletedTick`-based tie-break. Previously the outcome was implicit
// in system-registration order (Wonder runs before Relic, so Wonder won on
// simultaneous completion). Rule:
//   1. Whichever countdown's `lastCompletedTick` is smaller wins (the one
//      that actually hit zero first in simulation time).
//   2. On the same tick, Wonder beats Relic (stable, documented).

import type { BuildingComponent } from '../../types';
import type { GameWorld } from '../pureHelpers';
import type { RelicCountdownEntry } from '../countdownTypes';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { wonderCountdownsCodec } from '../bridgeStateSerialize';

export interface WinConditionResolverSystemDeps {
  world: GameWorld;
  humanPlayerId: number;
  // Phase 2D: wonderCountdowns migrated to world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  relicCountdowns: Map<number, RelicCountdownEntry>;
  isMatchRunning: () => boolean;
  finalizeMatchEnd: (
    outcome: 'victory' | 'defeat' | 'draw',
    winCondition: 'conquest' | 'wonder' | 'relic',
    summary: string,
  ) => void;
}

export function registerWinConditionResolverSystem(deps: WinConditionResolverSystemDeps): void {
  const {
    world,
    humanPlayerId,
    accessor,
    relicCountdowns,
    isMatchRunning,
    finalizeMatchEnd,
  } = deps;

  world.registerSystem({
    name: 'prototypeWinConditionResolver',
    phase: 'postUpdate',
    after: ['prototypeRelicCountdown'],
    execute() {
      if (!isMatchRunning()) {
        return;
      }
      const wonderCountdowns = accessor.get(wonderCountdownsCodec);
      let earliestWonderTick: number | null = null;
      let earliestWonderOwner: number | null = null;
      for (const [buildingId, entry] of wonderCountdowns.entries()) {
        if (entry.lastCompletedTick === null) {
          continue;
        }
        const building = world.getComponent<BuildingComponent>(buildingId, 'building');
        if (!building) {
          continue;
        }
        if (earliestWonderTick === null || entry.lastCompletedTick < earliestWonderTick) {
          earliestWonderTick = entry.lastCompletedTick;
          earliestWonderOwner = building.owner;
        }
      }
      let earliestRelicTick: number | null = null;
      let earliestRelicOwner: number | null = null;
      for (const [owner, entry] of relicCountdowns.entries()) {
        if (entry.lastCompletedTick === null) {
          continue;
        }
        if (earliestRelicTick === null || entry.lastCompletedTick < earliestRelicTick) {
          earliestRelicTick = entry.lastCompletedTick;
          earliestRelicOwner = owner;
        }
      }
      if (earliestWonderTick === null && earliestRelicTick === null) {
        return;
      }
      const wonderWins =
        earliestWonderTick !== null
        && (earliestRelicTick === null || earliestWonderTick <= earliestRelicTick);
      if (wonderWins && earliestWonderOwner !== null) {
        const winnerIsHuman = earliestWonderOwner === humanPlayerId;
        finalizeMatchEnd(
          winnerIsHuman ? 'victory' : 'defeat',
          'wonder',
          winnerIsHuman
            ? 'Wonder Victory! Your Wonder endured the countdown.'
            : 'Wonder Defeat: an enemy Wonder endured the countdown.',
        );
        return;
      }
      if (earliestRelicOwner !== null) {
        const winnerIsHuman = earliestRelicOwner === humanPlayerId;
        finalizeMatchEnd(
          winnerIsHuman ? 'victory' : 'defeat',
          'relic',
          winnerIsHuman
            ? 'Relic Victory! You held every relic for the full countdown.'
            : 'Relic Defeat: an opponent held every relic for the full countdown.',
        );
      }
    },
  });
}
