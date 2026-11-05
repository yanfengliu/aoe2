// The computer's one purchase point (work 141 M2a-2a). Every purchase the AI
// asks for passes through `AiPurchases.buy`: a unit trained, a technology
// researched, a building placed, a Market trade and a tribute. This file is the
// only AI code that names the five purchase commands (`AI_PURCHASE_COMMANDS`):
// the phases get the AI's dependencies without them and without the pending
// queue (`AiPhaseDeps`, split off in `aiSystem.ts`), and
// `tests/architecture/aiPurchaseChokePoint.test.ts` refuses any other file
// under `src/` that names one, the bridge's wiring aside, and any AI file that
// submits a command to the world or names a purchase command's type outside a
// comparison. It is not a sandbox: a phase holds the world and the accessor, so
// it could still write state directly, which is no purchase command and which
// that gate does not see (review round 11).
//
// Why one point. M2a-1's decision budget (`aiEscrow.ts`, `DecisionBudget`) was a
// check each purchase path had to remember to consult, and review rounds 6 to 9
// each found another path that skipped it: the Trade Cart, the tribute, the Town
// Center's next age, its Market trade and its villager, an in-flight age-up and
// a refused trade counted as spent, and a trade asked for uncounted that income
// before its handler let through (plan 141). Here the budget is consulted and
// counted for every purchase, and a path states in its request only what is its
// own: the reserve it keeps, and whether a hold may refuse it at all.
//
// What `buy` does. Until DE's escrow opens the decision's budget, and for the
// whole of a decision whose escrow neither holds nor buys anything, it asks for
// the purchase and nothing more: each path's own rule against the stockpile is
// the whole check, and handlers charge the affordable subset (DESIGN v17 §6.4).
// Once the escrow holds or has bought anything (`openBudget`), it checks the
// purchase against what the decision has not spent, its reserve included, and
// against the holds resource by resource (`DecisionBudget.affords`), unless the
// request is `countOnly`; and it counts the purchase, never less than its
// handler will charge. A unit, a building and a tribute count the price their
// path supplies: a soldier's is the base price, where the handler charges the
// owner's, which no civilization raises, so it may count more, as M2a-1 did.
// A technology already in flight is refused uncharged, so it counts nothing,
// and a Market trade counts what its handler charges, with a completed Market
// and a stockpile that covers it, which is also what a trade must show to be
// asked for while the budget stands (review rounds 8 and 9).
//
// Open bounds (plan 141, M2a-2a): the ferry and building phases run before the
// escrow, so what they ask for is not in the budget it opens, and a Wonder's
// gold can take a hold; and a trade is priced when the AI decides and charged
// when its handler runs, the next tick (plan 106's card).

import type { Position } from 'civ-engine';
import type {
  BuildableBuildingType,
  BuildingComponent,
  EconomyResourceKind,
  MarketActionType,
  PlayerResources,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../types';
import type { DecisionBudget } from '../../aiEscrow';
import { isBuyMarketAction, marketCommodityForAction } from '../../prototypeEconomyRules';
import { MARKET_TRANSACTION_AMOUNT } from '../bridgeConstants';
import { constructionStatesCodec, inFlightTechByOwnerCodec } from '../bridgeStateSerialize';
import { ownerMarketBuyCost } from '../ownerCosts';
import type { AiPhaseDeps, AiSystemDeps } from './aiSystemTypes';

type Cost = Partial<PlayerResources>;

/** One purchase request, priced as its path checks it (a trade is priced here). */
export type AiPurchase =
  | { kind: 'train'; buildingId: number; unit: TrainableUnitType; price: Cost }
  | { kind: 'research'; buildingId: number; technology: ResearchableTechnologyType; price: Cost }
  | { kind: 'place'; builderId: number; building: BuildableBuildingType; anchor: Position; price: Cost }
  | { kind: 'trade'; action: MarketActionType }
  | { kind: 'tribute'; to: number; resource: EconomyResourceKind; amount: number; price: Cost };

/** The commands that spend: the dispatcher submits each between ticks, and its handler charges. */
export interface AiPurchaseCommands {
  pushQueueTrainIntention: (buildingId: number, unitType: TrainableUnitType) => void;
  pushQueueResearchIntention: (buildingId: number, technologyType: ResearchableTechnologyType) => void;
  pushBuildingPlaceConfirmIntention: (builderId: number, buildingType: BuildableBuildingType, anchor: Position) => void;
  pushMarketActionIntention: (playerId: number, actionType: MarketActionType) => void;
  pushTributeIntention: (playerId: number, toPlayerId: number, resource: EconomyResourceKind, amount: number) => void;
}

export const AI_PURCHASE_COMMANDS = [
  'pushQueueTrainIntention',
  'pushQueueResearchIntention',
  'pushBuildingPlaceConfirmIntention',
  'pushMarketActionIntention',
  'pushTributeIntention',
] as const satisfies ReadonlyArray<keyof AiPurchaseCommands>;

/**
 * Takes the purchase commands and the pending queue out of the AI's
 * dependencies, so no phase can reach either: a queued command could be
 * rewritten in place into a purchase.
 */
export function splitPurchaseCommands(all: AiSystemDeps): {
  commands: AiPurchaseCommands;
  pendingCommands: AiSystemDeps['pendingCommands'];
  deps: AiPhaseDeps;
} {
  const {
    pushQueueTrainIntention,
    pushQueueResearchIntention,
    pushBuildingPlaceConfirmIntention,
    pushMarketActionIntention,
    pushTributeIntention,
    pendingCommands,
    ...deps
  } = all;
  return {
    commands: {
      pushQueueTrainIntention,
      pushQueueResearchIntention,
      pushBuildingPlaceConfirmIntention,
      pushMarketActionIntention,
      pushTributeIntention,
    },
    pendingCommands,
    deps,
  };
}

/** What a Market trade spends, as the decision's budget counts it: a buy, the
 *  owner's price in gold when the AI decides; a sell, one batch of the commodity. */
export function marketTradeCost(accessor: AiPhaseDeps['accessor'], owner: number, trade: MarketActionType): Cost {
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
  deps: Pick<AiPhaseDeps, 'world' | 'accessor'>,
  owner: number,
  trade: MarketActionType,
  stockpile: PlayerResources,
): Cost | null {
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

export interface BuyOptions {
  /** What the purchase must leave unspent, as its path keeps it (the next age's, the next villager's). */
  reserve?: Cost;
  /** Counted, never refused by the budget: the Town Center's purchases, as DE buys its
   *  age-ups ahead of its escrow and lets its villagers spend escrow (work 141 review round 7). */
  countOnly?: boolean;
}

/**
 * One owner's purchases for one decision. Everything but `buy` and
 * `openBudget` is held in ES private members, which neither a cast nor
 * TypeScript's bracket access to `private` members reaches (review round 12:
 * `purchases['ask']` asked for a purchase past the budget, with no cast), and
 * the instance and its prototype are frozen, so no phase can put its own
 * method in place of either (round 13). This is aimed at a purchase path that
 * does not know of the point; it is no defence against code written to defeat
 * it, such as a patched `DecisionBudget.prototype`.
 */
export class AiPurchases {
  #budget: DecisionBudget | null = null;
  #opened = false;
  readonly #commands: AiPurchaseCommands;
  readonly #deps: Pick<AiPhaseDeps, 'world' | 'accessor'>;
  readonly #owner: number;
  readonly #stockpile: PlayerResources | undefined;

  constructor(
    commands: AiPurchaseCommands,
    deps: Pick<AiPhaseDeps, 'world' | 'accessor'>,
    owner: number,
    stockpile: PlayerResources | undefined,
  ) {
    this.#commands = commands;
    this.#deps = deps;
    this.#owner = owner;
    this.#stockpile = stockpile;
    // No phase can shadow `buy` or `openBudget` with its own (review round 13).
    Object.freeze(this);
  }

  /** DE's escrow, once settled, hands over the decision's budget. It binds the
   *  rest of the decision only while it holds or has bought anything. It opens
   *  once a decision, so no later call can unbind it. */
  openBudget(budget: DecisionBudget): void {
    if (this.#opened) throw new Error('A decision opens its purchase budget once, in the escrow phase (aiEscrowPhase.ts).');
    this.#opened = true;
    this.#budget = budget.holding ? budget : null;
  }

  /** Asks for `purchase` if the decision's budget allows it, and counts it. Returns whether it was asked for. */
  buy(purchase: AiPurchase, options: BuyOptions = {}): boolean {
    const budget = this.#budget;
    if (budget === null) {
      this.#ask(purchase);
      return true;
    }
    const charged = this.#charged(purchase);
    if (!options.countOnly) {
      const checked = purchase.kind === 'trade' ? charged : purchase.price;
      if (checked === null || !budget.affords(checked, options.reserve)) return false;
    }
    this.#ask(purchase);
    if (charged !== null) budget.ask(charged);
    return true;
  }

  /**
   * What the budget counts for `purchase`, or null when its handler will refuse
   * it: the price its path supplies, which for a soldier is the base price and
   * may exceed the owner's charge; nothing for a technology in flight; and a
   * trade's charge as its handler takes it.
   */
  #charged(purchase: AiPurchase): Cost | null {
    switch (purchase.kind) {
      case 'research':
        return this.#deps.accessor.get(inFlightTechByOwnerCodec).get(this.#owner)?.has(purchase.technology)
          ? null
          : purchase.price;
      case 'trade':
        return this.#stockpile ? chargedTradeCost(this.#deps, this.#owner, purchase.action, this.#stockpile) : null;
      default:
        return purchase.price;
    }
  }

  #ask(purchase: AiPurchase): void {
    switch (purchase.kind) {
      case 'train':
        this.#commands.pushQueueTrainIntention(purchase.buildingId, purchase.unit);
        return;
      case 'research':
        this.#commands.pushQueueResearchIntention(purchase.buildingId, purchase.technology);
        return;
      case 'place':
        this.#commands.pushBuildingPlaceConfirmIntention(purchase.builderId, purchase.building, purchase.anchor);
        return;
      case 'trade':
        this.#commands.pushMarketActionIntention(this.#owner, purchase.action);
        return;
      case 'tribute':
        this.#commands.pushTributeIntention(this.#owner, purchase.to, purchase.resource, purchase.amount);
        return;
    }
  }
}

// Nor replace them for every decision.
Object.freeze(AiPurchases.prototype);
