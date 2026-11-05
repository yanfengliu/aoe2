// The computer holds back from its army what DE's escrow flags (work 141 M2a,
// `aiEscrow.ts`): the first Monk while two relics lie on the map, and
// Conscription once the Imperial Age has a Castle. And DE's other first Monk,
// for an enemy that owns a Monastery, has first claim over the army.
//
// Three layers. The flags on their inputs. The settlement and the decision's
// budget on hand-made purses: what is bought, what is held and for whom, and
// what the purchases after the escrow may still spend, resource by resource.
// And single decisions on fixtures whose purse pays for the flagged purchase
// or a soldier, never both (`fixtures/aiEscrow.ts` gives the arithmetic).
//
// BOUND: the rule, the arithmetic, and one or two decisions on seven fixtures
// with nothing to gather. What the escrow does over a match is measured in
// self-play (plan 141's Outcome), not here.

import { describe, expect, it } from 'vitest';

import {
  conscriptionOffered,
  DecisionBudget,
  flaggedPurchases,
  settleEscrow,
  type EscrowInputs,
  type EscrowPurchase,
} from '../../src/game/simulation/aiEscrow';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { marketExchangeRatesCodec, playerResourcesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { PlayerResources } from '../../src/game/simulation/types';

const NOTHING: EscrowInputs = {
  age: 'castle-age',
  monastery: false,
  monks: 0,
  relicsOnMap: 0,
  housingHeadroom: true,
  enemyMonks: false,
  castle: false,
  conscriptionOffered: false,
};
const flagged = (inputs: Partial<EscrowInputs>) =>
  flaggedPurchases({ ...NOTHING, ...inputs }).map(({ purchase, holds }) =>
    `${purchase.kind === 'train' ? purchase.unit : purchase.technology}${holds ? ' held' : ' first'}`);

describe("DE's escrow flags (work 141 M2a)", () => {
  it('holds the first Monk with two relics on the map, a Monastery and room, in the Castle and Imperial Ages', () => {
    expect(flagged({ monastery: true, relicsOnMap: 2 })).toEqual(['monk held']);
    expect(flagged({ age: 'imperial-age', monastery: true, relicsOnMap: 3 })).toEqual(['monk held']);
    expect(flagged({ age: 'feudal-age', monastery: true, relicsOnMap: 2 })).toEqual([]);
    expect(flagged({ monastery: false, relicsOnMap: 2 })).toEqual([]);
    expect(flagged({ monastery: true, relicsOnMap: 2, monks: 1 })).toEqual([]);
    expect(flagged({ monastery: true, relicsOnMap: 1 })).toEqual([]);
    // DE skips its Monk escrow with no housing headroom (escrow.per 3064).
    expect(flagged({ monastery: true, relicsOnMap: 2, housingHeadroom: false })).toEqual([]);
  });

  it('gives the first Monk first claim, holding nothing, once an enemy owns a Monastery or Monks', () => {
    expect(flagged({ monastery: true, enemyMonks: true })).toEqual(['monk first']);
    expect(flagged({ monastery: true, enemyMonks: true, relicsOnMap: 2 })).toEqual(['monk held']);
    expect(flagged({ monastery: true, enemyMonks: true, monks: 1 })).toEqual([]);
  });

  it('holds Conscription in the Imperial Age with a Castle that offers it', () => {
    expect(flagged({ age: 'imperial-age', castle: true, conscriptionOffered: true })).toEqual(['conscription held']);
    expect(flagged({ castle: true, conscriptionOffered: true })).toEqual([]);
    expect(flagged({ age: 'imperial-age', castle: false, conscriptionOffered: true })).toEqual([]);
    expect(flagged({ age: 'imperial-age', castle: true, conscriptionOffered: false })).toEqual([]);
  });

  it('offers Conscription only while it is neither in flight nor asked for', () => {
    const base = { castle: true, listed: true, inFlight: false, asked: false };
    expect(conscriptionOffered(base)).toBe(true);
    // The Castle's list keeps a queued Conscription; held again, it took 150 food
    // and 150 gold from the army every decision until the research finished.
    expect(conscriptionOffered({ ...base, inFlight: true })).toBe(false);
    expect(conscriptionOffered({ ...base, asked: true })).toBe(false);
    expect(conscriptionOffered({ ...base, castle: false })).toBe(false);
    expect(conscriptionOffered({ ...base, listed: false })).toBe(false);
  });

  it("puts the held purchases first, in DE's buy order (escrow.per 639-674)", () => {
    expect(flagged({ age: 'imperial-age', monastery: true, relicsOnMap: 2, castle: true, conscriptionOffered: true }))
      .toEqual(['monk held', 'conscription held']);
    expect(flagged({ age: 'imperial-age', monastery: true, enemyMonks: true, castle: true, conscriptionOffered: true }))
      .toEqual(['conscription held', 'monk first']);
  });
});

const MONK: EscrowPurchase = { kind: 'train', producer: 'monastery', unit: 'monk' };
const CONSCRIPTION: EscrowPurchase = { kind: 'research', producer: 'castle', technology: 'conscription' };
const PRICE = (purchase: EscrowPurchase): Partial<PlayerResources> =>
  (purchase.kind === 'train' ? { gold: 100 } : { food: 150, gold: 150 });
const purse = (food: number, wood: number, gold: number): PlayerResources => ({ food, wood, gold, stone: 0 });
const idle = () => true;

describe("the escrow's settlement (work 141 M2a)", () => {
  it('buys a held purchase it can pay for, and counts its price as spent for the rest of the decision', () => {
    const settled = settleEscrow(purse(0, 0, 100), [{ purchase: MONK, holds: true }], PRICE, idle, {});
    expect(settled.buy).toEqual([MONK]);
    expect(settled.bought).toMatchObject({ gold: 100 });
    expect(settled.held.gold ?? 0).toBe(0);
    expect(settled.unpaid).toEqual([]);
  });

  it('holds what it cannot pay for, and hands the Market the budget the check used', () => {
    // The Monk is held (its Monastery busy), so Conscription's check had 100 gold
    // less to spend: the Market must see 250 gold, not Conscription's bare 150.
    const busyMonastery = (purchase: EscrowPurchase) => purchase.kind !== 'train';
    const settled = settleEscrow(
      purse(200, 0, 200),
      [{ purchase: MONK, holds: true }, { purchase: CONSCRIPTION, holds: true }],
      PRICE, busyMonastery, {},
    );
    expect(settled.buy).toEqual([]);
    expect(settled.held).toMatchObject({ food: 150, gold: 250 });
    expect(settled.unpaid).toEqual([{ food: 150, wood: 0, gold: 250, stone: 0 }]);
  });

  it('buys after the age-up, as DE buys its age-ups first', () => {
    const settled = settleEscrow(purse(1000, 0, 800), [{ purchase: MONK, holds: true }], PRICE, idle, { food: 1000, gold: 800 });
    expect(settled.buy).toEqual([]);
    expect(settled.held).toMatchObject({ gold: 100 });
  });

  it('buys a first-claim purchase only from what nothing holds, and holds nothing for it unbought', () => {
    const notEnough = settleEscrow(
      purse(100, 0, 200),
      [{ purchase: CONSCRIPTION, holds: true }, { purchase: MONK, holds: false }],
      PRICE, idle, {},
    );
    expect(notEnough.buy).toEqual([]);
    expect(notEnough.held).toMatchObject({ food: 150, gold: 150 });
    const enough = settleEscrow(purse(100, 0, 260), [{ purchase: CONSCRIPTION, holds: true }, { purchase: MONK, holds: false }], PRICE, idle, {});
    expect(enough.buy).toEqual([MONK]);
    expect(enough.held).toMatchObject({ food: 150, gold: 150 });
    expect(enough.bought).toMatchObject({ gold: 100 });
  });
});

describe("the decision's budget after the escrow (work 141 M2a)", () => {
  it('lets a purchase spend what is not held, resource by resource', () => {
    const budget = new DecisionBudget(purse(200, 1000, 50), { gold: 100 });
    expect(budget.holding).toBe(true);
    expect(budget.affords({ food: 35, wood: 25 }), 'a gold hold stopped a gold-free Spearman').toBe(true);
    expect(budget.affords({ wood: 25, gold: 45 }), 'an Archer spent held gold').toBe(false);
  });

  it('counts the purchases of one decision together', () => {
    const budget = new DecisionBudget(purse(0, 0, 300), { gold: 150 });
    expect(budget.affords({ gold: 100 })).toBe(true);
    budget.ask({ gold: 100 });
    expect(budget.affords({ gold: 100 }), 'two purchases that each fit alone spent the hold together').toBe(false);
    expect(budget.affords({ gold: 50 })).toBe(true);
  });

  it('holds nothing when nothing is flagged or bought', () => {
    expect(new DecisionBudget(purse(0, 0, 0), {}).holding).toBe(false);
    expect(new DecisionBudget(purse(0, 0, 100), {}, { gold: 100 }).holding).toBe(true);
  });

  it("checks the purchase's own reserves on what the decision has not spent", () => {
    // The escrow bought a Monk (100 gold) above an Imperial reserve of 1,000
    // food and 800 gold; an Archer's 45 gold would then eat into the age-up.
    const budget = new DecisionBudget(purse(1050, 100, 900), {}, { gold: 100 });
    expect(budget.affords({ wood: 25, gold: 45 }, { food: 1000, gold: 800 })).toBe(false);
    expect(budget.affords({ wood: 25, gold: 45 })).toBe(true);
  });
});

type Bridge = ReturnType<typeof createSimulationBridge>;

/** Long enough for the AI's first decision and the handlers that charge it. */
const FIRST_DECISION_TICKS = 5;

function queueOf(bridge: Bridge, buildingType: string): string[] {
  const building = bridge.getEconomyState().buildings.find((b) => b.owner === 2 && b.buildingType === buildingType);
  expect(building, `owner 2 has no ${buildingType}`).toBeDefined();
  return building!.queue.map((entry) => entry.unitType ?? entry.technologyType ?? '?');
}

function play(seed: string, ticks: number): Bridge {
  const bridge = createSimulationBridge(seed);
  for (let tick = 0; tick < ticks; tick += 1) bridge.step(100);
  return bridge;
}

describe('the computer holds back from its army what DE escrows (work 141 M2a)', () => {
  it('trains its first Monk before an Archer takes the gold, while two relics lie on the map', () => {
    const bridge = play('ai-escrow-monk-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'monastery')).toEqual(['monk']);
    expect(queueOf(bridge, 'archery-range')).toEqual([]);
  });

  it('holds nothing for a Monk with one relic on the map, so the Archer takes the gold', () => {
    const bridge = play('ai-escrow-monk-one-relic-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'archery-range')).toEqual(['archer']);
    expect(queueOf(bridge, 'monastery')).toEqual([]);
  });

  it('gives its first Monk first claim once an enemy owns a Monastery, with no relic on the map', () => {
    const bridge = play('ai-escrow-monk-enemy-monastery-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'monastery')).toEqual(['monk']);
    expect(queueOf(bridge, 'archery-range')).toEqual([]);
  });

  it('short of a held Monk, keeps its gold from the Archer and still trains the gold-free Spearman', () => {
    const bridge = play('ai-escrow-monk-short-gold-fixture', FIRST_DECISION_TICKS);
    // The Barracks may research after (Squires is priced in food); what it trains is the Spearman.
    expect(queueOf(bridge, 'barracks')[0]).toBe('spearman');
    expect(queueOf(bridge, 'archery-range')).toEqual([]);
    expect(queueOf(bridge, 'monastery')).toEqual([]);
    expect(bridge.getEconomyState().playerResources[2]!.gold).toBe(50);
  });

  it("holds Conscription's price from its army in the Imperial Age, short of it", () => {
    const bridge = play('ai-escrow-conscription-fixture', FIRST_DECISION_TICKS);
    expect(bridge.getEconomyState().playerResources[2]!.gold, 'the Archer was refused, so the gold stays for Conscription').toBe(100);
    expect(queueOf(bridge, 'archery-range')).toEqual([]);
    expect(queueOf(bridge, 'castle')).toEqual([]);
  });

  it('buys Conscription at its first decision once it can pay', () => {
    expect(queueOf(play('ai-escrow-conscription-queued-fixture', FIRST_DECISION_TICKS), 'castle')[0]).toBe('conscription');
  });

  it('keeps an unpaid hold whole across two soldiers that each fit alone', () => {
    // 260 gold, 150 held for Conscription (short of food): the Archer takes 45
    // of the 110 left, and the Ram's 75 no longer fits in the 65 after it.
    const bridge = play('ai-escrow-spend-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'archery-range')).toEqual(['archer']);
    expect(queueOf(bridge, 'siege-workshop')).toEqual([]);
    expect(bridge.getEconomyState().playerResources[2]!.gold, 'the hold for Conscription was spent').toBeGreaterThanOrEqual(150);
  });

  it('leaves the next villager its food after the escrow buys Conscription', () => {
    // 200 food: Conscription takes 150, and a Spearman's 35 would leave the
    // villager due 15 of its 50; checked on what the decision has not spent,
    // the Spearman waits.
    const bridge = play('ai-escrow-villager-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'castle')[0]).toBe('conscription');
    expect(queueOf(bridge, 'barracks')).toEqual([]);
    expect(queueOf(bridge, 'town-center')).toContain('villager');
  });

  it("keeps an unpaid hold whole across the Market's trade and a later Monk", () => {
    // 400 gold, 150 held for Conscription (50 food short). The first-claim Monk
    // takes 100 and the Market buys food toward Conscription for 130; a second
    // Monk's 100 would then eat into the hold, so it waits.
    const bridge = play('ai-escrow-market-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'monastery')).toEqual(['monk']);
    const purse = bridge.getEconomyState().playerResources[2]!;
    expect(purse.food, 'the Market bought food toward Conscription').toBeGreaterThan(100);
    expect(purse.gold, 'the hold for Conscription was spent').toBeGreaterThanOrEqual(150);
  });

  it('makes no Market trade that would spend an unpaid hold', () => {
    // 350 gold: after the first-claim Monk's 100, the 130-gold food buy the
    // Market picks would leave Conscription 120 of its 150, so it waits.
    const bridge = play('ai-escrow-market-guard-fixture', FIRST_DECISION_TICKS);
    const purse = bridge.getEconomyState().playerResources[2]!;
    expect(purse.food, 'the Market bought food out of the hold').toBeLessThanOrEqual(100);
    expect(purse.gold, 'the hold for Conscription was spent').toBeGreaterThanOrEqual(150);
  });

  it('trains no Trade Cart out of an unpaid hold', () => {
    // 200 gold, 150 held for Conscription (50 food short), and a Market at each
    // end: the Archer takes 45, and the cart's 50 no longer fits in the 5 left.
    const bridge = play('ai-escrow-trade-cart-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'archery-range')).toEqual(['archer']);
    expect(queueOf(bridge, 'market')).toEqual([]);
    expect(bridge.getEconomyState().playerResources[2]!.gold, 'the hold for Conscription was spent').toBeGreaterThanOrEqual(150);
  });

  it("sends no tribute out of an unpaid hold, counting the villager's food", () => {
    // 1,000 food, 150 held for Conscription (50 gold short). The villager,
    // Hoardings, Squires, a Spearman and Husbandry leave 265; a 100-food
    // tribute and its 30 fee to the starving ally would leave the hold 135.
    const bridge = play('ai-escrow-tribute-fixture', FIRST_DECISION_TICKS);
    const purses = bridge.getEconomyState().playerResources;
    expect(purses[3]!.food, 'the ally was sent food out of the hold').toBe(0);
    expect(purses[2]!.food, 'the hold for Conscription was spent').toBeGreaterThanOrEqual(150);
  });

  it('asks for no Market trade it cannot pay for while a hold stands, so income before its handler cannot spend the hold', () => {
    // 350 gold, 150 held for Conscription (no food), and the food price raised
    // to 353 (rate 271). A save at the command boundary, after the decision and
    // before the handler, carries what the AI asked for; 10 gold credited there
    // is income in that window, as a villager's delivery late in the decision's
    // tick is (review round 9). A 353-gold buy asked for would now go through
    // and leave 7 of the 150 held.
    const seed = 'ai-escrow-income-fixture';
    type SavedState = { worldSnapshot: { state: Record<string, unknown> } };
    const save = (bridge: Bridge): SavedState => JSON.parse(JSON.stringify(bridge.saveGame())) as SavedState;
    const start = save(createSimulationBridge(seed));
    start.worldSnapshot.state[marketExchangeRatesCodec.slot] = marketExchangeRatesCodec.serialize({ food: 271, wood: 100, stone: 100 } as never);
    const decided = createSimulationBridge(seed, { savedGame: start as never });
    decided.step(100);
    const boundary = save(decided);
    const purses = playerResourcesCodec.deserialize(boundary.worldSnapshot.state[playerResourcesCodec.slot] as never);
    purses.get(2)!.gold += 10;
    boundary.worldSnapshot.state[playerResourcesCodec.slot] = playerResourcesCodec.serialize(purses);
    const resumed = createSimulationBridge(seed, { savedGame: boundary as never });
    expect(resumed.getEconomyState().playerResources[2]!.gold, 'the income at the boundary').toBe(360);
    resumed.step(100);
    expect(resumed.getEconomyState().playerResources[2]!.gold, 'the hold for Conscription was spent').toBeGreaterThanOrEqual(150);
  });

  it('buys its next age before a held Monk that would leave the age short', () => {
    // 1,050 food and 850 gold with the Imperial Age available (1,000 food, 800
    // gold): the Monk's 100 gold would leave the age 50 short, so it waits.
    const bridge = play('ai-escrow-monk-age-up-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'town-center')).toContain('imperial-age');
    expect(queueOf(bridge, 'monastery')).toEqual([]);
  });

  it('keeps its next age whole after it buys a held Monk', () => {
    // 900 gold: the Monk's 100 leaves the Imperial Age's 800, so the escrow buys
    // it; an Archer's 45 would then leave the age short, so the Archer waits.
    const bridge = play('ai-escrow-monk-age-up-spend-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'monastery')).toEqual(['monk']);
    expect(queueOf(bridge, 'town-center')).toContain('imperial-age');
    expect(queueOf(bridge, 'archery-range')).toEqual([]);
  });

  it('buys no held Monk while the age-up latch holds the army and research', () => {
    // 700 food and 600 gold: past 60% of the Imperial Age's price and short of
    // it, with no second Castle Age building to qualify, so no reserve applies.
    const bridge = play('ai-escrow-monk-latch-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'monastery')).toEqual([]);
    expect(bridge.getEconomyState().playerResources[2]!.gold).toBe(600);
  });

  it('buys no Monk out of a held Conscription, by first claim or by the Monk queue after the army', () => {
    // 200 gold, 150 of it held for Conscription (short of food). The Archer may
    // take 45 of the 50 left; the 100-gold Monk may not, whichever rule asks.
    const bridge = play('ai-escrow-held-monk-fixture', FIRST_DECISION_TICKS);
    expect(queueOf(bridge, 'monastery')).toEqual([]);
    expect(bridge.getEconomyState().playerResources[2]!.gold, 'the hold for Conscription was spent').toBeGreaterThanOrEqual(150);
  });
});
