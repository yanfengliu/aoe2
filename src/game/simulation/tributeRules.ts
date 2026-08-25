// Tribute (spec §6.8): sending a resource to another player, paying a fee on
// top. Age of Empires II charges 30%, Coinage (Feudal) drops it to 20%, and
// Banking (Castle) to nothing — technologies.csv's "Tribute inefficiency"
// rows. Both are Market technologies because tribute itself needs a Market.

import type { ResearchableTechnologyType } from './technologyTypes';

export const TRIBUTE_FEE_RATE = 0.3;
export const COINAGE_TRIBUTE_FEE_RATE = 0.2;
export const BANKING_TRIBUTE_FEE_RATE = 0;

/** What one click of the tribute button sends — AoE2's own chunk. */
export const TRIBUTE_AMOUNT = 100;

export function tributeFeeRateFor(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  if (researchedTechnologies.has('banking')) return BANKING_TRIBUTE_FEE_RATE;
  if (researchedTechnologies.has('coinage')) return COINAGE_TRIBUTE_FEE_RATE;
  return TRIBUTE_FEE_RATE;
}

/** What the sender pays to deliver `amount`: the amount plus the fee, which
 *  rounds up so a sender can never underpay it. */
export function tributeCost(amount: number, feeRate: number): number {
  return amount + Math.ceil(amount * feeRate);
}
