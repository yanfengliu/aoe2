import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { marketActionForAgeUpShortfall } from '../../src/game/simulation/aiMarketPlanning';

// v0.1.91: the robust fix for the AI stalling one age-up short on a RESOURCE
// IMBALANCE (grounded across the v0.1.89-91 replays: the AI banks one resource
// but runs short of the other — gold 75 < the Castle's 200, or food 17 < 800 —
// and gather-allocation tuning can't fix it because the outcome is chaotic).
// When the AI qualifies for an age-up it can't quite afford AND owns a Market,
// this pure helper decides which single market trade closes the gap: sell the
// commodity it has most surplus of for gold, or buy the short commodity with
// spare gold. The caller emits ONE trade per decision tick; over a few ticks
// the stockpile crosses the age-up cost. Deterministic → unit-testable (unlike
// the reverted allocation tuning). Transaction batch = 100 (MARKET_TRANSACTION_AMOUNT).

const CASTLE = { food: 800, gold: 200 } as const;
const TXN = 100;
const stock = (o: Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>>) => ({
  food: 0, wood: 0, gold: 0, stone: 0, ...o,
});

describe('marketActionForAgeUpShortfall — cover an age-up shortfall via the Market', () => {
  it('sells the surplus commodity when short on gold (the v0.1.90 case: food 1084, gold 75)', () => {
    // Needs 200 gold, has 75 → gold-short; food surplus 1084-800=284 ≥ 100 → sell food.
    expect(marketActionForAgeUpShortfall(stock({ food: 1084, gold: 75 }), CASTLE, TXN)).toBe('sell-food');
  });

  it('buys the short commodity from spare gold (the v0.1.91 case: food 17, gold 1704)', () => {
    // Food-short (17 < 800), gold headroom 1704-200=1504 ≥ 200 → buy food.
    expect(marketActionForAgeUpShortfall(stock({ food: 17, gold: 1704 }), CASTLE, TXN)).toBe('buy-food');
  });

  it('returns null when the age-up is already affordable (no trade needed)', () => {
    expect(marketActionForAgeUpShortfall(stock({ food: 900, gold: 300 }), CASTLE, TXN)).toBeNull();
  });

  it('picks the commodity with the MOST sellable surplus when short on gold', () => {
    // Both food and wood are surplus (wood has no age-up need → 1000 surplus > food 200).
    const s = stock({ food: 1000, wood: 1000, gold: 0 });
    expect(marketActionForAgeUpShortfall(s, CASTLE, TXN)).toBe('sell-wood');
  });

  it('returns null when short on gold but no commodity has a sellable surplus (≥ one batch above its need)', () => {
    // Food 850 (surplus 50 < 100 batch), gold 0 → nothing safe to sell.
    expect(marketActionForAgeUpShortfall(stock({ food: 850, gold: 0 }), CASTLE, TXN)).toBeNull();
  });

  it('does NOT buy without a comfortable gold headroom (avoids creating a fresh gold deficit / oscillation)', () => {
    // Food-short but gold headroom 250-200=50 < 200 (2 batches) → hold, don't buy.
    expect(marketActionForAgeUpShortfall(stock({ food: 100, gold: 250 }), CASTLE, TXN)).toBeNull();
  });
});

describe('AI market-for-age-up — advances by trading at the Market (v0.1.91 E2E)', () => {
  it('buys food with spare gold to reach CASTLE when it can never gather the 800 food', () => {
    // ai-market-ageup-fixture: owner 2 ages Dark→Feudal on its own (520 food),
    // then — with a Market + blacksmith (the Castle prereqs), a big gold pile, and
    // NO food resource on the map — can never GATHER the 800 food a Castle costs.
    // Without the market-trade fix it is stranded in Feudal; with it, it buys food
    // with spare gold each decision tick until it affords Castle. This is the real
    // stall the v0.1.89-91 arc surfaced (markets can only trade from Feudal up).
    const bridge = createSimulationBridge('ai-market-ageup-fixture');
    let reachedCastle = false;
    for (let i = 0; i < 6_000; i += 1) {
      bridge.step(100);
      if (bridge.getEconomyState().ages[2] === 'castle-age') {
        reachedCastle = true;
        break;
      }
    }
    const eco = bridge.getEconomyState();
    const diag = `age=${eco.ages[2]} food=${eco.playerResources[2]?.food} gold=${eco.playerResources[2]?.gold}`;
    expect(reachedCastle, diag).toBe(true);
  }, 180_000);
});
