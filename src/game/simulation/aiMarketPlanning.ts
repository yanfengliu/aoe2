// v0.1.91: AI market planning — cover an age-up shortfall by trading at the
// Market. Grounded across the v0.1.89-91 replays: the AI banks one age-up
// resource but runs short of the other (gold 75 < the Castle's 200, or food 17
// < 800), and gather-allocation tuning cannot reliably fix it because the
// AI-vs-AI outcome is chaotically sensitive to the gather weights (v0.1.91 FIND
// + lessons.md). A market trade is the robust, self-correcting alternative: it
// converts whichever resource the AI over-gathered into whichever it is short
// of, regardless of the game's trajectory. Pure + deterministic so it is
// unit-testable directly (unlike the reverted allocation tuning).
//
// v0.3.222 widened this module from "which trade" to "what the AI's late game
// spends on first". `AI_SURPLUS_TRADE` is the one tuning object for that whole
// rule, and `researchOutranksQueue` lives here rather than in `ai.ts` because it
// is one of its three knobs — a reader looking for why the Imperial AI spent as
// it did should find all three in one place.

import type { AgeType, MarketActionType, PlayerResources } from './types';

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

/**
 * The Market's second job: convert an idle surplus into the resource that is
 * actually gating the army. Same trade as the age-up path above, aimed at the
 * UNIT the AI is trying to train instead of at the next age.
 *
 * WHY THIS EXISTS. `marketActionForAgeUpShortfall` has exactly one trigger —
 * qualifies for the next age, cannot afford it — and `nextAgeTech` is null in
 * the Imperial age, so that trigger is structurally dead for the whole of it.
 * Measured on the coverage lab's own configuration (`aoe2-prototype`, 45,000
 * ticks, both seats Imperial) on `b929d07d`, both seats owned a completed
 * Market from ticks 12,000 and 6,750 and both still ended the match wedged:
 *
 *     o1  food  731  wood   10  gold    23  stone 1093   army 93, 46 of them SPEARMEN
 *     o2  food   58  wood   18  gold  4681  stone  315   army 53
 *
 * o1 is gold-starved sitting on 1,093 stone; its infantry is still at base tier
 * because the Pikeman upgrade is priced in gold. o2 holds 4,681 gold — its own
 * peak for the whole match, so it never spent any of it — and cannot train a
 * 35-food/25-wood Halberdier because it has 18 wood. The map had ZERO gold left
 * in the ground at that horizon — 831 stone was still there, but not one nugget
 * of gold — which is why moving villagers onto gold cannot answer the gold half
 * and the Market has to: there is none left to mine.
 *
 * IT IS SCOPED TO THE IMPERIAL AGE, and that scope was measured rather than
 * assumed. The `age` parameter is the scope, checked here rather than at the
 * call site so it is unit-testable: the Imperial Age is exactly where the age-up
 * rule above goes dead, so the two partition the match between them and never
 * bid for the same stockpile.
 *
 * A first version ran in every age. In the Feudal Age, on a seat holding 764
 * gold and 27 food, it bought food with the gold that seat's own Castle Age
 * needed, then sold stone to put the gold back — 30% lost at the Market on each
 * leg. Traced on the coverage lab between ticks 5,000 and 7,500 it turned 400
 * stone and 73 gold into 50 food, and over the full 45,000 it pinned owner 2 in
 * the CASTLE age where the baseline reached Imperial, taking it from 38
 * villagers to 1. In the Imperial Age there is no next age to save for, nothing
 * left to mine on the map, and a unit mix where only the Halberdier is free of
 * gold — so the same rule that was destructive at tick 5,000 is the right one at
 * tick 35,000. The restriction is what separates the two.
 *
 * `keep` is the working capital a SALE leaves behind, on top of the want's own
 * cost. It is not a purchase target and it does not apply to stone — see
 * `workingReserve` in the function below for why both of those corrections had
 * to be made.
 *
 * Returns null when the owner has no idle surplus worth converting — including
 * when it wanted nothing in the first place.
 */
export const AI_SURPLUS_TRADE = {
  /** Off restores the pre-fix behaviour exactly — the A/B's control arm, flipped
   *  between arms inside ONE process, the way `scripts/ai-dark-age-sweep.mjs`
   *  flips `DARK_AGE_TUNING`. (The probe that does it lives under the ignored
   *  `tmp/probes/`, so it is described rather than named: a comment must not
   *  point at a path that is not in the repository a reader checked out.) */
  enabled: true,
  /** Aim the trade at the owner's blocked BUILD PLAN before its unit queue.
   *  Off restores the queue-only aim that closed the hoard and cost the AI a
   *  Siege Workshop, a Monastery and five technologies — the arm this knob
   *  exists to keep measurable. */
  planFirst: true,
  /** Buy an affordable upgrade BEFORE the next unit rather than after it — see
   *  `researchOutranksQueue`, which carries the scope and the measurement.
   *  Separately switchable from `planFirst` because the two were measured
   *  separately. */
  researchFirst: true,
  /** The working capital a sale leaves behind, on top of the want's own cost.
   *  Four Market batches of food and of wood: eight villagers, or two buildings.
   *  It does NOT apply to stone or to gold — nothing the AI trains costs stone,
   *  so a stone keep is only a hoard with a smaller number on it, and gold is
   *  the medium the trade works in rather than something to hold back. */
  keep: 400,
};

export function marketActionForUnaffordableWant(
  /** The owner's age. The rule DECLINES outside the Imperial Age — its own
   *  scope, stated here rather than left to the caller, so it is unit-testable
   *  and cannot be widened by accident. */
  age: AgeType,
  stockpile: PlayerResources,
  /**
   * THE PLAN: costs of the building the owner's build order is stuck on and of
   * the technologies standing unbought at its idle producers. These OUTRANK the
   * unit queue below, and that priority is the whole of the v0.3.222 correction.
   *
   * Aimed only at units, this rule fixed the hoard and cost the AI its content.
   * Measured on the coverage lab at 45,000 ticks against the same tree with the
   * rule off: owner 1 lost its Monastery and its Siege Workshop outright, its
   * researched technologies fell 19 to 14, and the union across both seats lost
   * `battering-ram`, `conscription`, `plate-barding` and `plate-mail-armor`,
   * gaining NOTHING in either direction. The mechanism is arithmetic: the unit
   * queue runs every decision tick and buys in 45-gold bites, so a stockpile it
   * is drinking from never reaches the 220 food and 120 gold an `iron-casting`
   * costs, or the 200 wood a Siege Workshop costs, in one place at one time —
   * owner 1's peak wood fell 1,005 to 725 and
   * its peak gold 1,428 to 841 on unchanged income. An opponent that converts
   * its whole economy into the cheapest unit on the list is not the opponent
   * Definitive Edition gives you; it cannot break a building, so it cannot win.
   */
  planCosts: readonly Partial<PlayerResources>[],
  /** THE QUEUE: costs of the units this owner wants and cannot pay for, each
   *  with an idle producer standing ready. Aimed at only when the plan is not
   *  blocked — a fed build order is what makes the queue the right target. */
  unitCosts: readonly Partial<PlayerResources>[],
  /** Resources already earmarked. Empty in the Imperial Age, which is the only
   *  age this runs in — a parameter so the invariant is visible here rather than
   *  assumed, and so the rule stays correct if the scope is ever widened. */
  reserve: Partial<PlayerResources>,
  transactionAmount: number,
): MarketActionType | null {
  if (age !== 'imperial-age') return null;
  if (!AI_SURPLUS_TRADE.enabled) return null;
  // WHICH LIST IS AIMED AT IS NOT A CLOSE CALL, and that was measured rather
  // than assumed (2026-09-10). Counted inside this function over two played
  // matches, the queue branch below is reached ZERO times: 799 calls on
  // `ai-idle-surplus-fixture` at 12,000 ticks with both seats Imperial, and 360
  // on the coverage lab at 20,000 ticks, all 1,159 of them aimed at the plan,
  // with the plan holding 5 to 7 wants on every single call. The six research
  // producers each contribute their first unaffordable technology, and in the
  // Imperial Age there is always at least one, so `planCosts` is never empty
  // while `planFirst` is on. Anything that hopes to change what the UNIT QUEUE
  // trades for has to change THIS line first — see the ram note below.
  const aimingAtPlan = AI_SURPLUS_TRADE.planFirst && planCosts.length > 0;
  const wantedCosts = aimingAtPlan ? planCosts : unitCosts;
  if (wantedCosts.length === 0) return null;
  const RESOURCES = ['food', 'wood', 'gold', 'stone'] as const;
  const COMMODITIES = ['food', 'wood', 'stone'] as const;
  const have = (r: (typeof RESOURCES)[number]): number => stockpile[r] ?? 0;
  const shortfall = (cost: Partial<PlayerResources>): number =>
    RESOURCES.reduce((sum, r) => sum + Math.max(0, (cost[r] ?? 0) - have(r)), 0);
  // The want it is CLOSEST to affording — the cheapest gap to close, so the
  // fewest trades stand between the AI and the next thing it can actually buy.
  //
  // THE RAM COST, AND THE A/B THAT REFUTED ITS SUSPECTED CAUSE (2026-09-10).
  // Both seats stopped training `battering-ram`/`capped-ram` when this rule
  // shipped although both still own a Siege Workshop, and the suspected cause
  // was this line: nearest-first systematically favours the cheapest want, and
  // the Imperial ram at 160 wood + 75 gold is the dearest thing in the mix. So
  // the opposite aim was BUILT AND RUN as a third arm of the coverage lab's A/B
  // — the unit queue aimed at what it is FURTHEST from affording — and it is a
  // PURE NO-OP: every figure byte-identical to the shipped arm across 45,000
  // ticks and both seats (o1 610/59/34/93 army 110, o2 28/185/22/7 army 75,
  // identical ages, identical villager curves), and the census diffs to ZERO
  // between the two arms. The counter above says why: the queue branch is never
  // reached, so the aim it uses cannot be what costs the rams. What costs them
  // is that the queue never gets the Market at all. The arm was deleted rather
  // than kept as an off-by-default knob, because a branch that provably changes
  // nothing is a path with no gate.
  let target = wantedCosts[0]!;
  let best = shortfall(target);
  for (const cost of wantedCosts) {
    const gap = shortfall(cost);
    if (gap < best) {
      best = gap;
      target = cost;
    }
  }
  // What the want costs once anything already earmarked is added to it.
  const need = (r: (typeof RESOURCES)[number]): number =>
    (target[r] ?? 0) + (reserve[r] ?? 0);
  // The working reserve a SALE may not dip into, on top of the want's own cost.
  // It is per-resource, and that is the correction to the first version of this
  // rule (v0.3.222): applied flat to all four it put a permanent 400-STONE
  // FLOOR under every seat, which is the hoard this whole entry is about wearing
  // another name — nothing the AI trains costs stone, so there is no working
  // capital to protect there. Food feeds villagers and wood is in every unit,
  // every farm and every building, so both keep theirs.
  const workingReserve = (r: (typeof COMMODITIES)[number]): number =>
    (r === 'stone' ? 0 : AI_SURPLUS_TRADE.keep);
  // The commodity the want is actually short of. Buying tops it up to the cost
  // and no further — the keep above is a floor on SELLING, not a target to buy
  // toward, or the rule would spend a fortune overshooting every purchase.
  const shortOf = COMMODITIES.find((c) => have(c) < need(c));
  // Gold the owner must hold before it can buy: the want's own gold, plus a
  // purchase's worth on top when there is something to buy. Selling runs up to
  // exactly this line and buying starts at exactly this line, so there is no
  // band between them where NEITHER fires. The first version left one —
  // `[cost + keep, cost + keep + 2 batches)` — and a seat whose military was
  // paused for the plan sat inside it, unable to sell or buy, for the rest of
  // the match.
  const goldLine = need('gold') + (shortOf === undefined ? 0 : 2 * transactionAmount);
  if (have('gold') < goldLine) {
    // The fattest pile above its own working reserve, and at least a full batch
    // of it — below one batch a commodity cannot be sold at all. A commodity the
    // want is SHORT of can never be picked here, so the two branches cannot
    // undo each other.
    let fattest: (typeof COMMODITIES)[number] | null = null;
    let fattestSurplus = transactionAmount;
    for (const c of COMMODITIES) {
      const surplus = have(c) - need(c) - workingReserve(c);
      if (surplus >= fattestSurplus) {
        fattestSurplus = surplus;
        fattest = c;
      }
    }
    return fattest ? (`sell-${fattest}` as MarketActionType) : null;
  }
  if (shortOf !== undefined) return `buy-${shortOf}` as MarketActionType;
  return null;
}


/**
 * Whether an affordable upgrade is bought BEFORE the next unit this decision
 * tick, instead of after it.
 *
 * WHY THE ORDER DECIDES ANYTHING. The research loop and the military loop both
 * push intentions against the same unspent stockpile, and the handler charges
 * them in push order, so whichever runs second gets only what the first left.
 * The unit loop asks every decision tick and an upgrade is bought once, so with
 * military first the upgrade loses that race for the whole match: measured on
 * the coverage lab at 45,000 ticks, owner 1 could pay for `iron-casting`,
 * `bodkin-arrow`, `chain-mail-armor`, `chain-barding-armor` and `plate-barding`
 * in FIVE of its 122 Imperial samples each and bought none of them, while its
 * army grew.
 *
 * SCOPED TO THE IMPERIAL AGE, and that scope was MEASURED, not assumed. Run in
 * every age it also outranks the age-up push and the build order, because those
 * are charged from the same stockpile too: `aiPlayerMonksAndWonder.test.ts` ::
 * "builds a Monastery in Castle Age on the ai-monk-fixture" went red, the AI
 * having spent on an upgrade the 175 wood its Monastery needed inside a
 * 3,000-tick budget. In the Imperial Age there is no age-up left to outrank, the
 * build order is fed by the Market rule above, and upgrades are bounded —
 * roughly thirty exist — so putting them first costs at most thirty units. It is
 * the same age bound the surplus trade carries, for the same reason: the late
 * game is where a lump can form, and the early game is where taking one hurts.
 */
export function researchOutranksQueue(age: AgeType): boolean {
  return AI_SURPLUS_TRADE.researchFirst && age === 'imperial-age';
}
