// Handler for `queue.train` command (DESIGN v17 §6.2 / §6.4 B2).
// Re-checks affordability + structural state authoritatively, then mutates.
// Silent no-op on stale-state miss (e.g., two queue.train commands in the
// same frame whose total cost exceeds the player's stockpile — the second
// handler hits the re-check and silently no-ops).

import type { World } from 'civ-engine';

import type { TrainableUnitType } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface QueueTrainHandlerDeps {
  // The pre-1B `enqueueTraining` body in `trainingMarketOps.ts`. Already
  // does structural + affordability checks + spendResources + queue
  // mutation atomically. Returns false on any check miss.
  enqueueTrainingDirect: (buildingId: number, unitType: TrainableUnitType) => boolean;
}

export type QueueTrainHandler = (
  data: GameCommands['queue.train'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeQueueTrainHandler(deps: QueueTrainHandlerDeps): QueueTrainHandler {
  return (data) => {
    deps.enqueueTrainingDirect(data.buildingId, data.unitType);
  };
}
