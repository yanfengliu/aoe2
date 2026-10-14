// Civilization bonuses that change WHERE a gatherer's earnings go, rather than
// how fast it gathers or how much it carries (those are civBonusEffects.ts):
// a resource paid into the stockpile as the gatherer works, with no trip to a
// drop-off (work 120 M4, spec §11.11). Both read the declared table
// (civBonusTable.ts) and are applied by the gather loop through
// bridge/systems/gatherCredit.ts. An unknown or unbonused civilization reads
// neutral, so every other owner's gathering is byte-identical.

import { civBonusesFor } from './civBonusTable';
import type { EconomyResourceKind, ResourceKind } from './types';

/** What a gatherer of `kind` earns beside the resource it takes: `perUnit` of
 *  `resource` for each unit it takes. Portuguese foragers: wood, 0.3333 per
 *  food, DE's "Foragers generate wood in addition to food". Null otherwise. */
export function civGatherSideIncome(
  civilization: string | undefined,
  kind: ResourceKind,
): { readonly resource: EconomyResourceKind; readonly perUnit: number } | null {
  const rule = civBonusesFor(civilization)?.gatherSideIncome?.find((income) => income.kind === kind);
  return rule ? { resource: rule.resource, perUnit: rule.perUnit } : null;
}

/** Whether a gatherer of `kind` pays what it takes into the stockpile as it
 *  works and never walks it to a drop-off. Khmer farmers, DE's "Farmers don't
 *  require Mills or Town Centers to drop off food". */
export function civCollectsWithoutDropOff(
  civilization: string | undefined,
  kind: ResourceKind,
): boolean {
  return civBonusesFor(civilization)?.collectsWithoutDropOff?.includes(kind) ?? false;
}
