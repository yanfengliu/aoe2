// Validator for `market.action` command (DESIGN v17 §6.2 / §6.4 B2).
// Best-effort affordability + structural checks. Handler re-checks
// authoritatively at start of next step's processCommands.

import type { World } from 'civ-engine';

import type { BuildingType, MarketActionType } from '../../types';
import type { GameCommands, GameEvents, GameComponents } from '../../bridge/pureHelpers';
import {
  isBuyMarketAction,
  marketCommodityForAction,
} from '../../prototypeEconomyRules';
import type { BridgeStateAccessor } from '../../bridge/bridgeStateAccessor';
import { playerResourcesCodec } from '../../bridge/bridgeStateSerialize';
import { ownerMarketBuyCost } from '../../bridge/ownerCosts';

export interface MarketActionValidatorDeps {
  // Phase 2D: marketExchangeRates + playerResources migrated to
  // world.state.aoe2.* via accessor.
  accessor: BridgeStateAccessor;
  getMarketOptions: (owner: number, buildingType: BuildingType) => readonly MarketActionType[];
  playerOwnsCompletedMarket: (playerId: number) => boolean;
  // Threaded as a dep (NOT imported from bridgeConstants) so the validator
  // and handler always agree on the transaction amount — Claude impl-11
  // review F3. The buy PRICE is not a dep: it is the owner's (Guilds halves
  // the fee), from ownerCosts.ts, which the handler and the quote also read.
  marketTransactionAmount: number;
}

export type MarketActionValidator = (
  data: GameCommands['market.action'],
  world: World<GameEvents, GameCommands, GameComponents>,
) => true | { code: string; message: string };

export function makeMarketActionValidator(deps: MarketActionValidatorDeps): MarketActionValidator {
  return (data) => {
    if (!Number.isInteger(data.playerId)) {
      return { code: 'invalid_player_id', message: 'Player id must be an integer.' };
    }
    if (!deps.playerOwnsCompletedMarket(data.playerId)) {
      return { code: 'no_market', message: 'Player does not own a completed market.' };
    }
    if (!deps.getMarketOptions(data.playerId, 'market').includes(data.actionType)) {
      return { code: 'cannot_trade', message: 'Cannot trade with that action.' };
    }
    const stockpile = deps.accessor.get(playerResourcesCodec).get(data.playerId);
    if (!stockpile) {
      return { code: 'no_stockpile', message: 'No resource stockpile for the player.' };
    }
    const commodity = marketCommodityForAction(data.actionType);
    if (isBuyMarketAction(data.actionType)) {
      if (stockpile.gold < ownerMarketBuyCost(deps.accessor, data.playerId, commodity)) {
        return { code: 'insufficient_resources', message: 'Not enough gold to buy.' };
      }
    } else if (stockpile[commodity] < deps.marketTransactionAmount) {
      return { code: 'insufficient_resources', message: 'Not enough resources to sell.' };
    }
    return true;
  };
}
