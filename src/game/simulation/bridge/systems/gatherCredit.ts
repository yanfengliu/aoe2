// What a gather swing pays into its owner's stockpile there and then, with no
// trip to a drop-off (work 120 M4, spec §11.11):
//  - a Khmer farmer's food, DE's "Farmers don't require Mills or Town Centers
//    to drop off food": DE's farmers no longer drop off (update 34699), the
//    gather task "auto-collection" (185872). Food the farmer already holds
//    goes in with it, because the farmer stands where it would drop it off;
//    another resource in its hands stays there until it walks it home.
//  - a Portuguese forager's wood, DE's "Foragers generate wood in addition to
//    food": "a trickle of wood (33%)" (update 73855), 33.33% of what it gathers
//    in DE's data, paid as it gathers, not at the drop-off.
// A deposit pays whole units, so what falls short of one waits on the gatherer
// in ten-thousandths (`creditTenThousandths`), an integer, exact across a save
// and a replay. The AI difficulty's deposit multiplier scales these the way it
// scales a load dropped off (dropOffStep.ts).

import { gatherMultiplier, type AiState } from '../../ai';
import { civCollectsWithoutDropOff, civGatherSideIncome } from '../../civGatherBonuses';
import { resourceKindToEconomyResource } from '../../prototypeEconomyRules';
import type { EconomyResourceKind, GathererComponent, PlayerResources, ResourceKind } from '../../types';
import type { BridgeStateAccessor } from '../bridgeStateAccessor';
import { playerResourcesCodec } from '../bridgeStateSerialize';

const PARTS_PER_UNIT = 10_000;

export interface GatherSwing {
  readonly gatherer: GathererComponent;
  /** The node's kind. */
  readonly kind: ResourceKind;
  /** What this swing took from the node. */
  readonly amount: number;
  readonly civilization: string | undefined;
  /** The owner's stockpile; undefined pays nothing and keeps nothing. */
  readonly stockpile: PlayerResources | undefined;
  /** The AI difficulty's scaling of a deposit; 1 for a human. */
  readonly depositMultiplier: number;
}

/** Pays this swing's in-place earnings. `paid` is the whole units added to the
 *  stockpile; `collected` says the swing's own resource went in, so the caller
 *  must not also put it in the gatherer's hands. */
export function creditGatherSwing(swing: GatherSwing): { paid: number; collected: boolean } {
  const { gatherer, kind, amount, civilization, depositMultiplier } = swing;
  let paid = 0;
  let collected = false;
  const resource = resourceKindToEconomyResource(kind);
  if (resource !== null && civCollectsWithoutDropOff(civilization, kind)) {
    let owed = amount;
    if (gatherer.carriedResource === resource) {
      owed += gatherer.carriedAmount;
      gatherer.carriedAmount = 0;
      gatherer.carriedResource = null;
    }
    paid += payWhole(swing, resource, owed * depositMultiplier);
    collected = true;
  }
  const side = civGatherSideIncome(civilization, kind);
  if (side) paid += payWhole(swing, side.resource, amount * side.perUnit * depositMultiplier);
  return { paid, collected };
}

function payWhole(swing: GatherSwing, resource: EconomyResourceKind, amount: number): number {
  const { gatherer, stockpile } = swing;
  if (!stockpile) return 0;
  const owed = (gatherer.creditTenThousandths?.[resource] ?? 0) + Math.round(amount * PARTS_PER_UNIT);
  const whole = Math.floor(owed / PARTS_PER_UNIT);
  const rest = owed - whole * PARTS_PER_UNIT;
  // Written only once there is a part to keep, so a gatherer that pays whole
  // units every swing (a Khmer farmer of a human) never grows the field.
  if (rest !== 0 || gatherer.creditTenThousandths) {
    gatherer.creditTenThousandths = { ...gatherer.creditTenThousandths, [resource]: rest };
  }
  stockpile[resource] += whole;
  return whole;
}

export interface GatherCreditDeps {
  readonly accessor: BridgeStateAccessor;
  readonly aiStates: ReadonlyMap<number, AiState>;
  readonly civilizations: ReadonlyMap<number, string>;
  readonly ensurePlayerScoreCounters: (owner: number) => { resourcesGathered: number };
}

/** The gather loop's call: pays the swing for `owner` and counts it as
 *  gathered, the way a drop-off does. True when the swing's own resource went
 *  into the stockpile rather than into the gatherer's hands. */
export function payGatherSwing(
  deps: GatherCreditDeps,
  owner: number,
  gatherer: GathererComponent,
  kind: ResourceKind,
  amount: number,
): boolean {
  const aiState = deps.aiStates.get(owner);
  const { paid, collected } = creditGatherSwing({
    gatherer,
    kind,
    amount,
    civilization: deps.civilizations.get(owner),
    stockpile: deps.accessor.get(playerResourcesCodec).get(owner),
    depositMultiplier: aiState ? gatherMultiplier(aiState.difficulty) : 1,
  });
  if (paid > 0) {
    deps.accessor.markDirty(playerResourcesCodec);
    deps.ensurePlayerScoreCounters(owner).resourcesGathered += paid;
  }
  return collected;
}
