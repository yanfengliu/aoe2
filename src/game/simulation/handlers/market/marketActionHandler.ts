// Handler for `market.action` command (DESIGN v17 §6.2 / §6.4 B2).
// Delegates to executeMarketActionDirect which authoritatively re-checks
// market ownership + affordability + applies the trade atomically. Silent
// no-op on stale-state miss (e.g., two same-frame buy commands when only
// one is affordable).

import type { World } from 'civ-engine';

import type { MarketActionType } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';

export interface MarketActionHandlerDeps {
  executeMarketActionDirect: (playerId: number, actionType: MarketActionType) => boolean;
}

export type MarketActionHandler = (
  data: GameCommands['market.action'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => void;

export function makeMarketActionHandler(deps: MarketActionHandlerDeps): MarketActionHandler {
  return (data) => {
    deps.executeMarketActionDirect(data.playerId, data.actionType);
  };
}
