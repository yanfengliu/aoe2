// The AI's trade line (spec §6.7 "AI ally trading" — and enemy trading, as in
// AoE2, since a free-for-all has no allies to trade with). Once a Market
// stands and any OTHER player's completed Market exists, the AI keeps a small
// pool of Trade Carts running: train up to the cap when affordable, and route
// every idle cart at the nearest other-player Market through the same
// right-click channel a human uses — recorded, validated, replayed.

import type { Position } from 'civ-engine';
import type { BuildingComponent, UnitComponent } from '../../types';
import { canAfford, trainingCost } from '../../prototypeEconomyRules';
import { constructionStatesCodec, unitCommandsCodec } from '../bridgeStateSerialize';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

// Two carts keep a route visibly alive without starving military spending —
// the same "presence over optimum" scale as the monk cap.
export const AI_TRADE_CART_CAP = 2;

export function runTradePhase(deps: AiSystemDeps, ctx: AiOwnerContext): void {
  const { world, accessor, pushQueueTrainIntention, pushUnitContextAtEntityIntention, getTrainOptions, countQueuedUnits } = deps;
  const { owner, stockpile, findIdleProducerLocal } = ctx;

  // The far end must exist before anything is worth training.
  const constructions = accessor.get(constructionStatesCodec);
  const otherMarkets: Array<{ id: number; position: Position }> = [];
  let ownMarketExists = false;
  for (const id of world.query('building', 'position')) {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (!building || building.buildingType !== 'market') continue;
    const construction = constructions.get(id);
    if (construction && !construction.isComplete) continue;
    if (building.owner === owner) {
      ownMarketExists = true;
      continue;
    }
    const position = world.getComponent<Position>(id, 'position');
    if (position) otherMarkets.push({ id, position });
  }
  if (!ownMarketExists || otherMarkets.length === 0) return;

  // Route every idle cart before training more: an unrouted cart is the
  // cheaper fix. A cart is idle when it carries no unit command at all.
  const unitCommands = accessor.get(unitCommandsCodec);
  let cartCount = 0;
  for (const id of world.query('unit', 'position')) {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (!unit || unit.owner !== owner || unit.unitType !== 'trade-cart') continue;
    cartCount += 1;
    if (unitCommands.has(id)) continue;
    const position = world.getComponent<Position>(id, 'position')!;
    let nearest = otherMarkets[0]!;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const market of otherMarkets) {
      const distance = Math.hypot(market.position.x - position.x, market.position.y - position.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = market;
      }
    }
    pushUnitContextAtEntityIntention(id, nearest.id, false);
  }

  if (cartCount >= AI_TRADE_CART_CAP) return;
  const marketId = findIdleProducerLocal('market');
  if (marketId === null) return;
  if (cartCount + countQueuedUnits(marketId, 'trade-cart') >= AI_TRADE_CART_CAP) return;
  if (!stockpile || !canAfford(stockpile, trainingCost('trade-cart'))) return;
  if (!getTrainOptions(owner, 'market').includes('trade-cart')) return;
  pushQueueTrainIntention(marketId, 'trade-cart');
}
