import { describe, expect, it } from 'vitest';

import {
  AI_SURPLUS_TRADE,
  marketActionForUnaffordableWant,
  researchOutranksQueue,
} from '../../src/game/simulation/aiMarketPlanning';
import { MARKET_TRANSACTION_AMOUNT } from '../../src/game/simulation/bridge/bridgeConstants';
import type { PlayerResources } from '../../src/game/simulation/types';

// The CONTRACT half of the v0.3.222 surplus-trade rule: what the two pure
// functions answer for a given stockpile, with no world and no match.
// `aiIdleSurplusTrade.test.ts` is the other half — the played-match properties
// these decisions are supposed to produce — and the two live apart because they
// fail for different reasons and cost different amounts to run (milliseconds
// here, two minutes there).
//
// BOUND — what a green run does NOT prove. Every case here is a hand-written
// stockpile, so nothing in this file says a real match ever reaches one of them,
// or that the trade it picks is the right one to have picked. Each case names
// the measurement it was taken from; the end-to-end claim is the fixture gate
// and the coverage lab's census.

describe('marketActionForUnaffordableWant', () => {
  const stock = (over: Partial<PlayerResources>): PlayerResources =>
    ({ food: 0, wood: 0, gold: 0, stone: 0, ...over });
  const CROSSBOWMAN = { wood: 25, gold: 45 };
  const HALBERDIER = { food: 35, wood: 25 };
  const TXN = MARKET_TRANSACTION_AMOUNT;
  const IMP = 'imperial-age';

  it('sells the biggest idle pile when gold is what gates the unit', () => {
    // The lab's owner 1, rounded: stone is the fattest pile, so stone is sold.
    expect(marketActionForUnaffordableWant(
      IMP, stock({ food: 731, wood: 600, gold: 23, stone: 1093 }), [], [CROSSBOWMAN], {}, TXN,
    )).toBe('sell-stone');
  });

  it('buys the commodity it is starved of when gold is the idle pile', () => {
    // The lab's owner 2: 4,681 gold and 18 wood, unable to train a Halberdier.
    // WOOD and not food, because wood is the half it is actually short of — it
    // has 58 food against the Halberdier's 35 and 18 wood against its 25. The
    // first version of this rule answered `buy-food` here, because it treated
    // the 400 working reserve as a purchase TARGET and so bought every commodity
    // up to `cost + 400` whether the want needed it or not.
    expect(marketActionForUnaffordableWant(
      IMP, stock({ food: 58, wood: 18, gold: 4681, stone: 315 }), [], [HALBERDIER], {}, TXN,
    )).toBe('buy-wood');
  });

  it('aims at the PLAN before the queue, and they are opposite trades', () => {
    // The whole of v0.3.222 in one assertion, at the coverage lab's owner 1
    // rounded: 490 stone it cannot spend, a Crossbowman it wants, and a 200-wood
    // Siege Workshop its build order is stuck on.
    //
    // 60 wood is the state that separates them. It covers the Crossbowman's 25
    // outright, so aimed at the QUEUE the rule is satisfied and stops — which is
    // the defect: the seat trains its Crossbowman, the wood goes with it, and the
    // 200 never forms. Aimed at the PLAN the same stockpile keeps converting
    // until the building is payable.
    const SIEGE_WORKSHOP = { wood: 200 };
    const rich = stock({ food: 467, wood: 60, gold: 250, stone: 490 });
    expect(marketActionForUnaffordableWant(IMP, rich, [], [CROSSBOWMAN], {}, TXN))
      .toBeNull();
    expect(marketActionForUnaffordableWant(IMP, rich, [SIEGE_WORKSHOP], [CROSSBOWMAN], {}, TXN))
      .toBe('buy-wood');
    // The same separation from the other side: with the gold spent, the plan
    // sells the dead stone pile toward the building and the queue does nothing
    // at all, because a Crossbowman is already affordable.
    const broke = stock({ food: 467, wood: 60, gold: 50, stone: 490 });
    expect(marketActionForUnaffordableWant(IMP, broke, [], [CROSSBOWMAN], {}, TXN))
      .toBeNull();
    expect(marketActionForUnaffordableWant(IMP, broke, [SIEGE_WORKSHOP], [CROSSBOWMAN], {}, TXN))
      .toBe('sell-stone');
    // …and the queue is what it aims at once the plan is unblocked, which is what
    // makes the lines above a priority rather than a replacement.
    const shortOfAUnit = stock({ food: 467, wood: 10, gold: 50, stone: 490 });
    expect(marketActionForUnaffordableWant(IMP, shortOfAUnit, [], [CROSSBOWMAN], {}, TXN))
      .toBe('sell-stone');
  });

  it('does not hold a working reserve of STONE, because nothing is priced in it', () => {
    // 450 stone and nothing else to sell. The first version kept a flat 400 of
    // every resource back from a sale, which put a permanent 400-stone floor
    // under every seat — the hoard this whole gate is about, wearing a smaller
    // number. Measured: the coverage lab's owner 1 stopped draining at 490 stone
    // and the fixture's at 450, both of them the floor rather than a decision.
    expect(marketActionForUnaffordableWant(
      IMP, stock({ food: 30, wood: 5, gold: 3, stone: 450 }), [], [CROSSBOWMAN], {}, TXN,
    )).toBe('sell-stone');
    // Food keeps its reserve, because villagers eat it: the same 450 in food is
    // left alone.
    expect(marketActionForUnaffordableWant(
      IMP, stock({ food: 450, wood: 5, gold: 3, stone: 0 }), [], [CROSSBOWMAN], {}, TXN,
    )).toBeNull();
  });

  it('leaves no band where it can neither sell nor buy', () => {
    // THE DEADLOCK, at the state it was measured at. The first version sold
    // while `gold < cost + 400` and bought only at `gold >= cost + 400 + 2
    // batches`, so a seat holding between 400 and 600 gold could do NEITHER.
    // Played on the fixture with the military queue paused for the plan, owner 1
    // sat at exactly that — 436 gold, 425 stone — and did nothing for the rest of
    // the match. Every gold level from empty to abundant must now produce an
    // action while a want is unaffordable.
    const SIEGE_WORKSHOP = { wood: 200 };
    for (let gold = 0; gold <= 900; gold += 25) {
      expect(
        marketActionForUnaffordableWant(
          IMP, stock({ food: 500, wood: 5, gold, stone: 425 }), [SIEGE_WORKSHOP], [], {}, TXN,
        ),
        `${String(gold)} gold with 425 stone, 5 wood and a 200-wood building wanted: no trade offered`,
      ).not.toBeNull();
    }
  });

  it('DECLINES outside the Imperial Age, which is what the scope is for', () => {
    // THE REGRESSION THIS SCOPE EXISTS FOR, at the exact state it was traced at.
    // Coverage lab, owner 2, tick 5,000, FEUDAL Age: 27 food, 102 wood, 764
    // gold, 800 stone, 8 food short of a Spearman. Unscoped, this rule bought
    // food with that 764 gold — the Castle Age's own age-up money — and then
    // sold stone to put the gold back, losing 30% at the Market each way. Over
    // 45,000 ticks that pinned the seat in the CASTLE age where the baseline
    // reached Imperial, and took it from 38 villagers to 1.
    const feudalOwnerTwoAtTick5000 = stock({ food: 27, wood: 102, gold: 764, stone: 800 });
    const SPEARMAN = { food: 35, wood: 25 };
    for (const age of ['dark-age', 'feudal-age', 'castle-age'] as const) {
      expect(
        marketActionForUnaffordableWant(age, feudalOwnerTwoAtTick5000, [], [SPEARMAN], {}, TXN),
        `${age} must decline: the age-up path owns the Market until Imperial`,
      ).toBeNull();
    }
    // The SAME stockpile in the Imperial Age is a legitimate trade — which is
    // what makes the three nulls above a scope rather than a no-op.
    expect(marketActionForUnaffordableWant(IMP, feudalOwnerTwoAtTick5000, [], [SPEARMAN], {}, TXN))
      .toBe('buy-food');
  });

  it('never sells into a reserve it was handed', () => {
    // Empty in the Imperial Age today, so this pins the contract rather than a
    // live path: 900 food looks like a surplus until an 800 reserve is
    // subtracted, and 900 - (0 + 800 + keep) is far below a batch. Wood and
    // stone are deliberately under a batch so food is the only pile the rule
    // could reach either way.
    const s = stock({ food: 900, wood: 30, gold: 10, stone: 90 });
    expect(marketActionForUnaffordableWant(IMP, s, [], [CROSSBOWMAN], { food: 800, gold: 200 }, TXN))
      .toBeNull();
    expect(marketActionForUnaffordableWant(IMP, s, [], [CROSSBOWMAN], {}, TXN)).toBe('sell-food');
  });

  it('does nothing when there is no surplus to convert, or nothing wanted', () => {
    expect(marketActionForUnaffordableWant(IMP, stock({ food: 40, wood: 30, gold: 0, stone: 0 }), [], [CROSSBOWMAN], {}, TXN))
      .toBeNull();
    expect(marketActionForUnaffordableWant(IMP, stock({ food: 5000, wood: 5000, gold: 0, stone: 5000 }), [], [], {}, TXN))
      .toBeNull();
  });

  it('aims at the unit it is CLOSEST to affording', () => {
    // Same stockpile, two different targets, opposite answers — which is the
    // whole of what "closest" buys. The Crossbowman's 25 wood is already covered
    // by the 30 in hand, so with it in the list there is nothing to trade for;
    // aimed at the Onager alone the rule sees 130 wood missing and buys.
    const s = stock({ food: 2000, wood: 30, gold: 500, stone: 30 });
    const ONAGER = { wood: 160, gold: 135 };
    expect(marketActionForUnaffordableWant(IMP, s, [], [CROSSBOWMAN, ONAGER], {}, TXN))
      .toBeNull();
    expect(marketActionForUnaffordableWant(IMP, s, [], [ONAGER], {}, TXN)).toBe('buy-wood');
  });

  it('buys an upgrade before the next unit in the Imperial Age ONLY', () => {
    // Run in every age, the same ordering also outranks the age-up push and the
    // build order, which are charged from that one stockpile too:
    // `aiPlayerMonksAndWonder.test.ts` :: "builds a Monastery in Castle Age on
    // the ai-monk-fixture" went red, the AI having spent on an upgrade the 175
    // wood its Monastery needed inside that test's 3,000-tick budget.
    expect(researchOutranksQueue(IMP)).toBe(true);
    for (const age of ['dark-age', 'feudal-age', 'castle-age'] as const) {
      expect(researchOutranksQueue(age), `${age} must still buy its units first`).toBe(false);
    }
    AI_SURPLUS_TRADE.researchFirst = false;
    expect(researchOutranksQueue(IMP)).toBe(false);
    AI_SURPLUS_TRADE.researchFirst = true;
  });

  it('is off when the knob is off, byte for byte', () => {
    AI_SURPLUS_TRADE.enabled = false;
    expect(marketActionForUnaffordableWant(
      IMP, stock({ food: 731, wood: 600, gold: 23, stone: 1093 }), [], [CROSSBOWMAN], {}, TXN,
    )).toBeNull();
    AI_SURPLUS_TRADE.enabled = true;
  });
});
