// Land trade (spec §6.7): a Trade Cart carries goods from your Market to
// another player's Market and brings back gold, worth more the farther the
// Markets stand apart. 0.46 gold per tile of straight-line distance is the
// community's measured figure for AoE2's relative-distance profit, and §4's
// size ladder means an eight-player map pays better routes than a 1v1 —
// exactly the incentive the real game has.

import type { Position } from 'civ-engine';

export const TRADE_GOLD_PER_TILE = 0.46;

/** Gold per completed round trip between Markets at these anchors. Never
 *  zero — even adjacent Markets pay something, so a route cannot be a no-op. */
export function tradeProfit(farMarket: Position, homeMarket: Position): number {
  const distance = Math.hypot(farMarket.x - homeMarket.x, farMarket.y - homeMarket.y);
  return Math.max(2, Math.round(distance * TRADE_GOLD_PER_TILE));
}
