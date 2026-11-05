// The AI's escrow, run first in the production phase (work 141 M2a; DE's rules
// and their citations are in `aiEscrow.ts`). It gathers what DE's flags read,
// settles the escrow (`settleEscrow`), asks for what it can buy now, and hands
// the rest of the decision a `DecisionBudget` that keeps the held prices whole.

import type { BuildingComponent, PlayerResources, ResourceComponent } from '../../types';
import { trainingCost } from '../../prototypeEconomyRules';
import {
  conscriptionOffered,
  DecisionBudget,
  flaggedPurchases,
  settleEscrow,
  type EscrowPurchase,
} from '../../aiEscrow';
import { isEnemyOwner } from '../../alliances';
import { ownerMarketBuyCost, ownerResearchCost } from '../ownerCosts';
import type { MarketActionType } from '../../types';
import { isBuyMarketAction, marketCommodityForAction } from '../../prototypeEconomyRules';
import { MARKET_TRANSACTION_AMOUNT } from '../bridgeConstants';
import {
  constructionStatesCodec,
  inFlightTechByOwnerCodec,
  monkCarriedRelicCodec,
  playerTeamsCodec,
} from '../bridgeStateSerialize';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

/** What a Market trade spends, as the decision's budget counts it: a buy, the
 *  owner's price in gold when the AI decides; a sell, one batch of the commodity. */
export function marketTradeCost(
  accessor: AiSystemDeps['accessor'],
  owner: number,
  trade: MarketActionType,
): Partial<PlayerResources> {
  const commodity = marketCommodityForAction(trade);
  return isBuyMarketAction(trade)
    ? { gold: ownerMarketBuyCost(accessor, owner, commodity) }
    : { [commodity]: MARKET_TRANSACTION_AMOUNT };
}

/**
 * The trade's cost, when its handler will charge it: the owner has a completed
 * Market and the stockpile covers the cost (`trainingMarketOps.ts`). Otherwise
 * null, and the budget counts nothing, as the handler refuses the trade.
 */
export function chargedTradeCost(
  deps: AiSystemDeps,
  owner: number,
  trade: MarketActionType,
  stockpile: PlayerResources,
): Partial<PlayerResources> | null {
  const constructions = deps.accessor.get(constructionStatesCodec);
  let market = false;
  for (const id of deps.world.query('building')) {
    const building = deps.world.getComponent<BuildingComponent>(id, 'building');
    if (building?.owner !== owner || building.buildingType !== 'market') continue;
    const construction = constructions.get(id);
    if (!construction || construction.isComplete) { market = true; break; }
  }
  if (!market) return null;
  const cost = marketTradeCost(deps.accessor, owner, trade);
  const kinds = ['food', 'wood', 'gold', 'stone'] as const;
  return kinds.every((kind) => stockpile[kind] >= (cost[kind] ?? 0)) ? cost : null;
}

export interface EscrowResult {
  /** What the rest of the decision may spend: the stockpile less every hold. */
  budget: DecisionBudget;
  /** Held purchases not bought yet, each as the budget its check used; the Market aims at these. */
  unpaid: Array<Partial<PlayerResources>>;
}

export function runEscrowPhase(
  deps: AiSystemDeps,
  ctx: AiOwnerContext,
  /** What the next age-up needs; DE buys its age-ups ahead of its flags. */
  ageUpReserve: Partial<PlayerResources>,
  /** The age-up latch holds soldiers and research, so it holds these too. */
  savingForAgeUp: boolean,
): EscrowResult | null {
  const {
    accessor, monksByOwner, countQueuedUnits, getResearchOptions,
    pushQueueTrainIntention, pushQueueResearchIntention,
  } = deps;
  const {
    activeWorld, owner, currentAge, stockpile, populationBlocked,
    findIdleProducerLocal, pendingTrainsByBuilding, pendingResearchByBuilding, pendingResearchKeys,
  } = ctx;
  if (!stockpile || savingForAgeUp || (currentAge !== 'castle-age' && currentAge !== 'imperial-age')) return null;

  const complete = (id: number): boolean => accessor.get(constructionStatesCodec).get(id)?.isComplete !== false;
  const teams = accessor.get(playerTeamsCodec);
  let monasteryStands = false;
  let castleStands = false;
  let monks = monksByOwner.get(owner)?.size ?? 0;
  let enemyMonks = false;
  for (const [other, ids] of monksByOwner) {
    if (ids.size > 0 && other !== owner && isEnemyOwner(teams, owner, other)) enemyMonks = true;
  }
  for (const id of activeWorld.query('building')) {
    const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
    if (!building) continue;
    if (building.owner !== owner) {
      if (building.buildingType === 'monastery' && isEnemyOwner(teams, owner, building.owner)) enemyMonks = true;
      continue;
    }
    if (building.buildingType === 'monastery') {
      if (complete(id)) monasteryStands = true;
      monks += countQueuedUnits(id, 'monk') + (pendingTrainsByBuilding.get(id) ?? 0);
    } else if (building.buildingType === 'castle' && complete(id)) {
      castleStands = true;
    }
  }
  const carried = new Set<number>(accessor.get(monkCarriedRelicCodec).values());
  let relicsOnMap = 0;
  for (const id of activeWorld.query('resource', 'position')) {
    const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
    if (resource?.resourceType === 'relic' && resource.owner === null && !carried.has(id)) relicsOnMap += 1;
  }
  const flagged = flaggedPurchases({
    age: currentAge,
    monastery: monasteryStands,
    monks,
    relicsOnMap,
    housingHeadroom: !populationBlocked,
    enemyMonks,
    castle: castleStands,
    conscriptionOffered: conscriptionOffered({
      castle: castleStands,
      listed: castleStands && getResearchOptions(owner, 'castle').includes('conscription'),
      inFlight: accessor.get(inFlightTechByOwnerCodec).get(owner)?.has('conscription') ?? false,
      asked: pendingResearchKeys.has(`${owner}:conscription`),
    }),
  });

  const priceOf = (purchase: EscrowPurchase): Partial<PlayerResources> => (
    purchase.kind === 'train'
      ? trainingCost(purchase.unit)
      : ownerResearchCost(activeWorld, accessor, owner, purchase.technology)
  );
  const settled = settleEscrow(
    stockpile, flagged, priceOf, (purchase) => findIdleProducerLocal(purchase.producer) !== null, ageUpReserve,
  );
  for (const purchase of settled.buy) {
    const producerId = findIdleProducerLocal(purchase.producer);
    if (producerId === null) continue;
    if (purchase.kind === 'train') {
      pushQueueTrainIntention(producerId, purchase.unit);
      pendingTrainsByBuilding.set(producerId, (pendingTrainsByBuilding.get(producerId) ?? 0) + 1);
    } else {
      pushQueueResearchIntention(producerId, purchase.technology);
      pendingResearchByBuilding.set(producerId, (pendingResearchByBuilding.get(producerId) ?? 0) + 1);
      pendingResearchKeys.add(`${owner}:${purchase.technology}`);
    }
  }
  return { budget: new DecisionBudget(stockpile, settled.held, settled.bought), unpaid: settled.unpaid };
}
