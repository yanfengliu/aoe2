// v0.1.91: AI market planning — cover an age-up shortfall by trading at the
// Market. Grounded across the v0.1.89-91 replays: the AI banks one age-up
// resource but runs short of the other (gold 75 < the Castle's 200, or food 17
// < 800), and gather-allocation tuning cannot reliably fix it because the
// AI-vs-AI outcome is chaotically sensitive to the gather weights (v0.1.91 FIND
// + lessons.md). A market trade is the robust, self-correcting alternative: it
// converts whichever resource the AI over-gathered into whichever it is short
// of, regardless of the game's trajectory. Pure + deterministic so it is
// unit-testable directly (unlike the reverted allocation tuning).

import type { MarketActionType, PlayerResources } from './types';

// Pick the single market trade that best closes an age-up shortfall, or null
// when the age-up is already affordable or no safe trade helps. The caller
// gates on "the AI qualifies for the age-up, cannot afford it, and owns a
// completed Market", then emits ONE trade per decision tick; the stockpile
// crosses the cost over a few ticks. `transactionAmount` is the Market's batch
// size (MARKET_TRANSACTION_AMOUNT) — the unit in which commodities trade.
export function marketActionForAgeUpShortfall(
  stockpile: PlayerResources,
  ageUpCost: Partial<PlayerResources>,
  transactionAmount: number,
): MarketActionType | null {
  const have = (r: keyof PlayerResources): number => stockpile[r] ?? 0;
  const need = (r: keyof PlayerResources): number => ageUpCost[r] ?? 0;
  const COMMODITIES = ['food', 'wood', 'stone'] as const;
  // Short on gold → sell the commodity with the largest surplus above its own
  // age-up need, requiring at least one full batch of surplus so the sale never
  // dips the stockpile below what the age-up itself needs of that commodity.
  // (This is monotonic toward the goal + never oscillates, but with only a thin
  // surplus it can plateau one batch short of a large gold gap; the abundant-gold
  // buy path below is what closes big gaps, so in practice the AI still advances.)
  if (have('gold') < need('gold')) {
    let best: (typeof COMMODITIES)[number] | null = null;
    let bestSurplus = transactionAmount;
    for (const c of COMMODITIES) {
      const surplus = have(c) - need(c);
      if (surplus >= bestSurplus) {
        bestSurplus = surplus;
        best = c;
      }
    }
    return best ? (`sell-${best}` as MarketActionType) : null;
  }
  // Gold is covered → if a commodity is short, buy it, but only from a
  // comfortable gold headroom (two batches above the age-up's own gold need) so
  // the purchase cannot push gold back under the cost and oscillate.
  if (have('gold') - need('gold') >= 2 * transactionAmount) {
    for (const c of COMMODITIES) {
      if (have(c) < need(c)) {
        return `buy-${c}` as MarketActionType;
      }
    }
  }
  return null;
}
