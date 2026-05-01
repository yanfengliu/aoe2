// Handler for `queue.research` command (DESIGN v17 §6.2 / §6.4 B2).
// Delegates to the existing enqueueResearch body which already does
// authoritative re-checks (structural + in-flight tech + affordability)
// + spendResources + queue mutation atomically.

import type { World } from 'civ-engine';

import type { ResearchableTechnologyType } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface QueueResearchHandlerDeps {
  enqueueResearchDirect: (
    buildingId: number,
    technologyType: ResearchableTechnologyType,
  ) => boolean;
}

export type QueueResearchHandler = (
  data: GameCommands['queue.research'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeQueueResearchHandler(deps: QueueResearchHandlerDeps): QueueResearchHandler {
  return (data) => {
    deps.enqueueResearchDirect(data.buildingId, data.technologyType);
  };
}
