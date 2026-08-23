// The systems that END a match: the Wonder and relic countdowns, and the three
// resolvers (win condition, conquest, score timer). Split out of
// `registerAllSystems` for the 500-line budget — they share one shape, take the
// same handful of deps, and none of them touches the per-tick simulation.

import { registerConquestOutcomeSystem } from './systems/conquestOutcomeSystem';
import { registerRelicCountdownSystem } from './systems/relicCountdownSystem';
import { registerScoreTimerSystem } from './systems/scoreTimerSystem';
import { registerWinConditionResolverSystem } from './systems/winConditionResolverSystem';
import { registerWonderCountdownSystem } from './systems/wonderCountdownSystem';
import type { RegisterAllSystemsDeps } from './registerAllSystemsTypes';

export function registerMatchResolutionSystems(deps: {
  world: RegisterAllSystemsDeps['world'];
  humanPlayerId: number;
  accessor: RegisterAllSystemsDeps['accessor'];
  isMatchRunning: RegisterAllSystemsDeps['isMatchRunning'];
  finalizeMatchEnd: RegisterAllSystemsDeps['finalizeMatchEnd'];
  currentRelicHoldingOwner: RegisterAllSystemsDeps['currentRelicHoldingOwner'];
  defaultRelicCountdownTicks: number;
  computePlayerScore: RegisterAllSystemsDeps['computePlayerScore'];
  gameLength: RegisterAllSystemsDeps['gameLength'];
}): void {
  const {
    world,
    humanPlayerId,
    accessor,
    isMatchRunning,
    finalizeMatchEnd,
    currentRelicHoldingOwner,
    defaultRelicCountdownTicks,
    computePlayerScore,
    gameLength,
  } = deps;

  registerWonderCountdownSystem({ world, accessor, isMatchRunning });

  registerRelicCountdownSystem({
    world,
    accessor,
    currentRelicHoldingOwner,
    defaultRelicCountdownTicks,
    isMatchRunning,
  });

  registerWinConditionResolverSystem({
    world,
    humanPlayerId,
    accessor,
    isMatchRunning,
    finalizeMatchEnd,
  });

  registerConquestOutcomeSystem({
    world,
    humanPlayerId,
    accessor,
    isMatchRunning,
    finalizeMatchEnd,
  });

  registerScoreTimerSystem({
    world,
    humanPlayerId,
    accessor,
    isMatchRunning,
    computePlayerScore,
    finalizeMatchEnd,
    gameLength,
  });
}
