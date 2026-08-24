// Market technologies that change what the Market takes for itself.
//
// technologies.csv, Guilds: "Commodity trading fee - 15% (from 30%)". The fee
// is the spread between what a buy costs and what a sell returns, so halving it
// is worth more the more a player trades — which is why AoE2 puts it in the
// Imperial Age rather than beside the Market itself.

import type { ResearchableTechnologyType } from './types';
import { MARKET_FEE_RATE } from './bridge/bridgeConstants';

export const GUILDS_MARKET_FEE_RATE = 0.15;

/** What the Market takes on a transaction for this owner. */
export function marketFeeRateFor(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  return researchedTechnologies.has('guilds') ? GUILDS_MARKET_FEE_RATE : MARKET_FEE_RATE;
}
