// How the AI spends its VILLAGERS: the per-age split across food, wood, gold
// and stone, the villager count each age grows to, how many of them farm, and
// the comparison the decision loop uses to notice a split has changed.
//
// Split out of `ai.ts`, which the Feudal stone allocation pushed past its
// 500-LOC budget. These four are one role — the economy plan — and they are
// the numbers most often revisited when an AI-vs-AI run stalls, so they are
// easier to find together than scattered among unit mixes and attack groups.

import type { AgeType, EconomyResourceKind } from './types';

// Baseline villager allocation target for a given age. FU4 rebalanced
// these toward a Dark-Age food-first opening (match canonical AoE2
// early-game), a Feudal lean on food + wood for military production,
// a Castle Age gold + stone pivot so age-up funds can actually
// accumulate, and an Imperial Age tilt toward gold for the unit mix.
// These targets were picked to reach Castle Age within roughly 5000
// ticks on the `ai-planner-fixture` (see `tests/simulation/aiPlayer.test.ts`).
// Feudal keeps at least two villagers on gold so military production
// (archer / skirmisher cost gold) doesn't stall waiting on a single
// gold villager.
// The Dark-Age knobs, named rather than buried in the switches below, because
// they are the pair that decides when the AI reaches Feudal and they can only
// be understood together. `scripts/ai-dark-age-sweep.mjs` sweeps them.
//
// THE VALUES ARE UNCHANGED. A 2026-08-29 attempt to tune them for a faster
// Feudal was measured, adopted, and then withdrawn, and the reason is the
// useful part: a sixteen-row sweep on `default-seed` said food weight
// dominates and 6:3 improved both owners there (9,400/12,100 against
// 10,100/12,200) — but on `aoe2-prototype`, which is DEFAULT_SEED and the map
// a player actually boots, the same row is 800 ticks WORSE (13,300 against
// 12,500). Across five seeds it helps two and hurts two. The stated mechanisms
// were seed-local too: on one seed a HIGHER cap beat 10 for both owners, and
// on another a food-heavier split was worse than 4:3 outright.
//
// So the finding is not a number, it is a shape: these knobs interact with a
// map's resource layout, and any future adoption needs a row that does not
// regress `aoe2-prototype`, ranked on the WORST owner across several seeds
// rather than the best owner on one. Two further traps found the same day —
// 6:2 (75% food) wins the ranking and starves the AI of the wood for its
// 60-wood farms, caught by `gatherDomain.test.ts`; and 7:1 starves the
// Barracks, a Feudal PREREQUISITE, so the extra food cannot be spent.
export const DARK_AGE_TUNING = {
  villagerCap: 10,
  weights: { food: 4, wood: 3, gold: 0, stone: 0 } as Partial<Record<EconomyResourceKind, number>>,
};

export function villagerTargetsForAge(age: AgeType): Partial<Record<EconomyResourceKind, number>> {
  switch (age) {
    case 'dark-age':
      return { ...DARK_AGE_TUNING.weights };
    case 'feudal-age':
      // Food-dominant: the Castle age-up costs 800 food : 200 gold (4:1).
      // Grounded 2026-07-04 by replaying the default-seed corpus — the old
      // {food:5,gold:2} split mined gold the AI never spent (hoarded to ~1551)
      // while food stayed pinned at ~20-76 and it never banked the 800 food to
      // leave Feudal. Weighting food 7 : gold 1 makes food income outpace spend
      // so the age-up reserve can accumulate; gold 1 still supplies the Feudal
      // gold sink (only archers cost gold, 45 each) + the Castle's 200-gold half
      // comfortably — the old weight-2 split over-mined gold ~8x over.
      // Stone 1 (v0.3.47): the split allocated ZERO stone here, so a Feudal
      // AI's stockpile stayed at 0 for the whole age and everything Feudal
      // stone buys was unreachable. The Watch Tower is the AI's only
      // defensive building and its build path is gated on affording 125
      // stone, so that path ran every decision tick and could never fire;
      // the AI also reached Castle Age with nothing banked toward the
      // 650-stone Castle it wants immediately. At the Feudal cap of 22
      // villagers a weight of 1 in 13 puts one or two on stone, which is
      // what a Feudal build order going for a tower or a Castle does. Food
      // stays dominant — the 800-food age-up is still what Feudal is for.
      return { food: 7, wood: 4, gold: 1, stone: 1 };
    case 'castle-age':
      return { food: 4, wood: 4, gold: 3, stone: 1 };
    case 'imperial-age':
      return { food: 4, wood: 3, gold: 5, stone: 1 };
  }
}

// Total villager count the AI grows its economy to in each age (the HARD cap on
// TC villager production; the per-resource `villagerTargetsForAge` distribution
// then spreads them proportionally). The previous inline caps (Dark 6 / Feudal
// + Castle 14 / Imperial 50) starved the AI's economy: with ~14 villagers
// through Castle Age it could not fund a real army or age up efficiently and
// plateaued (found by AI-vs-AI grounding). These scale toward AoE2-realistic
// counts — still conservative (military trains BEFORE villagers each decision
// tick and from a reserve above the age-up cost, so a higher cap grows the
// economy without starving military or age-up). Monotonic increasing across
// ages. Food supply from natural resources bounds this in very long games until
// the AI builds farms (a separate follow-up).
export function villagerCapForAge(age: AgeType): number {
  switch (age) {
    case 'dark-age':
      return DARK_AGE_TUNING.villagerCap;
    case 'feudal-age':
      return 22;
    case 'castle-age':
      return 40;
    case 'imperial-age':
      return 60;
  }
}

// Priority-ordered build targets the AI should pursue. The bridge walks
// this list, finds the first one it is missing, and sends an idle
// villager to place it. Order encodes the AoE2 "Barracks rush" opening
// — Barracks goes up FIRST so the AI has a military presence before
// committing wood to drop-off camps. Rush fixtures with no resources
// nearby still lay down a Barracks and train Militia, which the
// baseline AI-rush browser test depends on. After the Barracks, gather
// drop-offs and the Feudal / Castle prerequisites go up in the usual
// order. The bridge filters by age / research gate before picking.
//
// Once the AI has advanced past Dark Age, the remaining Dark-Age drop-
// off builds (lumber / mining camp) are skipped — they aren't Feudal
// prerequisites and their absence shouldn't delay the Castle-Age gate.
// Feudal-prereq buildings (Blacksmith / Archery Range / Stable / Market)
// are always a priority for age-up gating.
/**
 * How many farms an AI of this age should be keeping, given its villager count.
 *
 * Berries, sheep, and boar are FINITE. Without farms the AI's food income falls
 * to zero the moment its opening patch is eaten, and it can then never afford
 * the 800 food for Castle Age — which is exactly where every observed match
 * stalled: Feudal Age, food 14, forever, with a Barracks it could not use.
 *
 * Roughly a third of the villager force on farms is the AoE2 shape, floored so
 * that a small early economy still puts two down and capped so the AI does not
 * spend its whole wood income on soil.
 */
export function targetFarmCount(age: AgeType, villagerCount: number): number {
  if (age === 'dark-age') return 0;
  return Math.max(2, Math.min(8, Math.floor(villagerCount / 3)));
}

// Shallow-equal check used by the bridge when deciding whether to
// rewrite the stored villagerTargets entry on this tick. Avoids an
// otherwise-constant re-allocation churn during long simulations.
export function villagerTargetsEqual(
  a: Partial<Record<EconomyResourceKind, number>>,
  b: Partial<Record<EconomyResourceKind, number>>,
): boolean {
  const kinds: EconomyResourceKind[] = ['food', 'wood', 'gold', 'stone'];
  for (const kind of kinds) {
    if ((a[kind] ?? 0) !== (b[kind] ?? 0)) {
      return false;
    }
  }
  return true;
}
