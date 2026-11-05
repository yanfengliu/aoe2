// The computer's one purchase point (work 141 M2a-2a, `aiPurchases.ts`). Each
// rule review rounds 6 to 9 found missing on one purchase path now lives in
// `AiPurchases.buy`, so each is pinned here once, for every kind of purchase:
// nothing is checked before DE's escrow opens the decision's budget or while it
// binds nothing; once it binds, a purchase that would spend a hold or what the
// decision has asked for is refused and not asked; the reserve is kept on top;
// a Town Center purchase (`countOnly`) is never refused and always counted; a
// technology in flight counts nothing; and a Market trade is priced as its
// handler charges it, so a trade with no Market is refused while the budget
// binds and counts nothing when it may not be refused.
//
// BOUND: the rules on a hand-made purse with fake commands and world. That the
// AI's phases buy through this point is `tests/architecture/
// aiPurchaseChokePoint.test.ts`; what the budget does in play is
// `aiEscrow.test.ts`, on fixtures.

import { describe, expect, it } from 'vitest';

import { DecisionBudget } from '../../src/game/simulation/aiEscrow';
import {
  constructionStatesCodec,
  inFlightTechByOwnerCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  productionQueuesCodec,
  researchedTechnologiesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { AiPurchases, type AiPurchaseCommands } from '../../src/game/simulation/bridge/systems/aiPurchases';
import type { AiOwnerContext, AiPhaseDeps } from '../../src/game/simulation/bridge/systems/aiSystemTypes';
import { runTownCenterPhase } from '../../src/game/simulation/bridge/systems/aiTownCenterPhase';
import type { PlayerResources } from '../../src/game/simulation/types';

const OWNER = 2;
const purse = (food: number, wood: number, gold: number, stone = 0): PlayerResources => ({ food, wood, gold, stone });

function harness(stockpile: PlayerResources, options: { market?: boolean; inFlight?: string[] } = {}) {
  const asked: string[] = [];
  const commands: AiPurchaseCommands = {
    pushQueueTrainIntention: (id, unit) => { asked.push(`train ${unit} at ${id}`); },
    pushQueueResearchIntention: (id, tech) => { asked.push(`research ${tech} at ${id}`); },
    pushBuildingPlaceConfirmIntention: (builder, building) => { asked.push(`place ${building} by ${builder}`); },
    pushMarketActionIntention: (player, action) => { asked.push(`${action} for ${player}`); },
    pushTributeIntention: (player, to, resource, amount) => { asked.push(`tribute ${amount} ${resource} from ${player} to ${to}`); },
  };
  const MARKET = 900;
  const world = {
    query: () => (options.market ? [MARKET] : []),
    getComponent: (id: number) => (id === MARKET ? { owner: OWNER, buildingType: 'market' } : undefined),
  };
  const accessor = {
    get: (codec: unknown) => {
      if (codec === inFlightTechByOwnerCodec) return new Map([[OWNER, new Set(options.inFlight ?? [])]]);
      if (codec === constructionStatesCodec) return new Map();
      throw new Error('unexpected codec read by the purchase point');
    },
  };
  const purchases = new AiPurchases(commands, { world, accessor } as never, OWNER, stockpile);
  return { purchases, asked };
}

const archer = { kind: 'train', buildingId: 10, unit: 'archer', price: { wood: 25, gold: 45 } } as const;
const monk = { kind: 'train', buildingId: 11, unit: 'monk', price: { gold: 100 } } as const;
const spearman = { kind: 'train', buildingId: 12, unit: 'spearman', price: { food: 35, wood: 25 } } as const;

describe("the AI's purchase point (work 141 M2a-2a)", () => {
  it('asks for anything before the budget opens: each path checks the stockpile itself', () => {
    const { purchases, asked } = harness(purse(0, 0, 0));
    expect(purchases.buy({ kind: 'research', buildingId: 5, technology: 'spies', price: { gold: 5000 } })).toBe(true);
    expect(purchases.buy({ kind: 'place', builderId: 7, building: 'wonder', anchor: { x: 1, y: 1 }, price: { stone: 1000 } })).toBe(true);
    expect(asked).toEqual(['research spies at 5', 'place wonder by 7']);
  });

  it('opens its budget once a decision, so no later call can unbind it', () => {
    const stockpile = purse(0, 0, 200);
    const { purchases } = harness(stockpile);
    purchases.openBudget(new DecisionBudget(stockpile, { gold: 150 }));
    expect(() => purchases.openBudget(new DecisionBudget(stockpile, {}, {}))).toThrow(/opens its purchase budget once/);
    expect(purchases.buy(monk), 'the hold was dropped').toBe(false);
  });

  it('binds nothing when the escrow neither holds nor bought anything', () => {
    const { purchases, asked } = harness(purse(0, 0, 50));
    purchases.openBudget(new DecisionBudget(purse(0, 0, 50), {}, {}));
    expect(purchases.buy(monk)).toBe(true);
    expect(asked).toEqual(['train monk at 11']);
  });

  it('refuses what would spend a hold, and counts what it asks for', () => {
    // 200 gold, 150 held: the Archer's 45 fits, and the Monk's 100 does not.
    const stockpile = purse(100, 100, 200);
    const { purchases, asked } = harness(stockpile);
    purchases.openBudget(new DecisionBudget(stockpile, { gold: 150 }));
    expect(purchases.buy(monk)).toBe(false);
    expect(purchases.buy(archer)).toBe(true);
    // A second Archer fits the stockpile alone but not the 5 gold the first left.
    expect(purchases.buy({ ...archer, buildingId: 13 })).toBe(false);
    // Holds bind resource by resource: the gold-free Spearman is not stopped.
    expect(purchases.buy(spearman)).toBe(true);
    expect(asked).toEqual(['train archer at 10', 'train spearman at 12']);
  });

  it('keeps the reserve on top of what the decision has spent', () => {
    // The escrow bought 150 food; a Spearman leaving the villager's 50 needs 235.
    const stockpile = purse(230, 100, 0);
    const { purchases, asked } = harness(stockpile);
    purchases.openBudget(new DecisionBudget(stockpile, {}, { food: 150 }));
    expect(purchases.buy(spearman, { reserve: { food: 50 } })).toBe(false);
    expect(purchases.buy(spearman)).toBe(true);
    expect(asked).toEqual(['train spearman at 12']);
  });

  it("never refuses the Town Center's purchases, and counts them", () => {
    // 100 gold, all held: the villager is asked for anyway, and its 50 food
    // counted, so the Spearman's 35 no longer fits in the 30 left.
    const stockpile = purse(80, 100, 100);
    const { purchases, asked } = harness(stockpile);
    purchases.openBudget(new DecisionBudget(stockpile, { gold: 100 }));
    expect(purchases.buy({ kind: 'train', buildingId: 1, unit: 'villager', price: { food: 50 } }, { countOnly: true })).toBe(true);
    expect(purchases.buy(spearman), 'the villager was not counted').toBe(false);
    expect(asked).toEqual(['train villager at 1']);
  });

  it('counts nothing for a technology already in flight, which its handler refuses', () => {
    const stockpile = purse(400, 0, 300);
    const { purchases, asked } = harness(stockpile, { inFlight: ['imperial-age'] });
    purchases.openBudget(new DecisionBudget(stockpile, {}, { gold: 1 }));
    expect(purchases.buy({ kind: 'research', buildingId: 1, technology: 'imperial-age', price: { food: 1000, gold: 800 } }, { countOnly: true })).toBe(true);
    expect(purchases.buy({ kind: 'research', buildingId: 6, technology: 'conscription', price: { food: 150, gold: 150 } })).toBe(true);
    expect(asked).toEqual(['research imperial-age at 1', 'research conscription at 6']);
  });

  it('prices a trade as its handler charges it: with no Market it is refused while the budget binds', () => {
    const stockpile = purse(300, 0, 200);
    const unbound = harness(stockpile);
    expect(unbound.purchases.buy({ kind: 'trade', action: 'buy-food' })).toBe(true);

    const bound = harness(stockpile);
    bound.purchases.openBudget(new DecisionBudget(stockpile, { gold: 150 }));
    expect(bound.purchases.buy({ kind: 'trade', action: 'buy-food' })).toBe(false);
    expect(bound.purchases.buy({ kind: 'trade', action: 'sell-food' }, { countOnly: true })).toBe(true);
    // Uncharged, the Town Center's trade counts nothing: the food is still there.
    expect(bound.purchases.buy({ kind: 'train', buildingId: 12, unit: 'spearman', price: { food: 300 } })).toBe(true);
    expect(bound.asked).toEqual(['sell-food for 2', 'train spearman at 12']);
  });

  it('counts a sale its handler will charge, with a Market and the commodity in hand', () => {
    const stockpile = purse(300, 0, 200);
    const { purchases, asked } = harness(stockpile, { market: true });
    purchases.openBudget(new DecisionBudget(stockpile, { gold: 150 }));
    expect(purchases.buy({ kind: 'trade', action: 'sell-food' })).toBe(true);
    expect(purchases.buy({ kind: 'train', buildingId: 12, unit: 'spearman', price: { food: 250 } }), 'the 100 food sold was not counted').toBe(false);
    expect(asked).toEqual(['sell-food for 2']);
  });

  it('sends a tribute through its own command, priced with its fee', () => {
    const stockpile = purse(1000, 0, 0);
    const { purchases, asked } = harness(stockpile);
    purchases.openBudget(new DecisionBudget(stockpile, { food: 900 }));
    expect(purchases.buy({ kind: 'tribute', to: 3, resource: 'food', amount: 100, price: { food: 130 } })).toBe(false);
    expect(purchases.buy({ kind: 'tribute', to: 3, resource: 'food', amount: 70, price: { food: 91 } })).toBe(true);
    expect(asked).toEqual(['tribute 70 food from 2 to 3']);
  });
});

describe("the Town Center's villager is counted at its owner's price (review rounds 8 and 11)", () => {
  it('counts an Indian Imperial villager at 39 food, so what follows may spend the 11 it saves', () => {
    // DE's Indian villagers cost 23% less in the Imperial Age (civBonusTable.ts):
    // round(50 x 0.77) = 39 food. With 200 food and 100 held, the villager
    // leaves 61 for the purchases after it; counted at the base 50, it leaves 50.
    const stockpile = purse(200, 0, 0);
    const { purchases, asked } = harness(stockpile);
    purchases.openBudget(new DecisionBudget(stockpile, { food: 100 }));
    const slots = new Map<unknown, unknown>([
      [constructionStatesCodec, new Map()],
      [productionQueuesCodec, new Map()],
      [playerCivilizationsCodec, new Map([[OWNER, 'Indians']])],
      [playerAgesCodec, new Map([[OWNER, 'imperial-age']])],
      [researchedTechnologiesCodec, new Map()],
    ]);
    const accessor = {
      get: (codec: unknown) => {
        if (!slots.has(codec)) throw new Error('unexpected codec read by the Town Center phase');
        return slots.get(codec);
      },
    };
    const deps = {
      accessor,
      canAdvanceToFeudalAge: () => false,
      canAdvanceToCastleAge: () => false,
      canAdvanceToImperialAge: () => false,
      countOwnedUnits: () => 3,
      countQueuedUnits: () => 0,
    } as unknown as AiPhaseDeps;
    const TOWN_CENTER = 1;
    const ctx = {
      owner: OWNER,
      ownerTownCenterId: TOWN_CENTER,
      currentAge: 'imperial-age',
      stockpile,
      populationBlocked: false,
      pendingTrainsByBuilding: new Map(),
      pendingResearchByBuilding: new Map(),
      pendingResearchKeys: new Set(),
      purchases,
    } as unknown as AiOwnerContext;
    runTownCenterPhase(deps, ctx, null, false);
    expect(asked).toEqual([`train villager at ${TOWN_CENTER}`]);
    expect(purchases.buy({ kind: 'train', buildingId: 12, unit: 'spearman', price: { food: 61 } }), 'the villager was counted at 50').toBe(true);
  });
});
