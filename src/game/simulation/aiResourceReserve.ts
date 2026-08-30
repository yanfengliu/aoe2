// What the AI keeps BACK from its stockpile so that discretionary spending
// cannot starve the next age-up. Extracted from ./ai.ts for the 500-LOC
// budget; all three functions answer the same question and nothing else in
// that file asks it.


import { agePrerequisiteBuildingTypes } from './prototypeBuildingRules';
import { canAfford, constructionCost } from './prototypeEconomyRules';
import { effectiveResearchCost } from './civBonusEffects';
import type { AgeType, BuildableBuildingType, PlayerResources, ResearchableTechnologyType } from './types';

// Resources-on-hand threshold for age-up "safety buffer". The AI
// prefers to age up only when it has enough extra resources to keep
// producing after the research commits — otherwise the production
// lines stall for the full research duration. Returns a minimum budget
// in food + gold (the two most-used costs); the bridge compares this
// to the current stockpile. Kept small so deterministic fixtures can
// reach Imperial Age within a reasonable tick budget — the main
// benefit of the buffer is "don't starve the economy", not "wait for
// a big cushion".
export function ageUpResourceBuffer(
  age: AgeType,
): Partial<PlayerResources> {
  switch (age) {
    case 'dark-age':
      return { food: 50 };
    case 'feudal-age':
      return { food: 50 };
    case 'castle-age':
      return { food: 100, gold: 50 };
    case 'imperial-age':
      return {};
  }
}

// campaign-11 finding (c): the next age-up's research cost, to be RESERVED
// from discretionary military spending so a freshly-trained unit's cost can't
// drain the stockpile below the age-up cost and starve the (FIFO-later) age-up
// research — the AI used to mass Dark-Age Militia on ~500 food and never
// advance. Empty unless the AI already QUALIFIES for the next age (its
// `canAdvanceTo*Age` prerequisite check passes), so a not-yet-eligible AI
// still trains military freely.
export function ageUpReserveCost(
  age: AgeType,
  canAdvanceToNextAge: boolean,
  /** v0.3.147: the reserve is the owner's OWN discounted price. */
  civilization?: string,
): Partial<PlayerResources> {
  const next: ResearchableTechnologyType | null =
    age === 'dark-age' ? 'feudal-age'
    : age === 'feudal-age' ? 'castle-age'
    : age === 'castle-age' ? 'imperial-age'
    : null;
  return next && canAdvanceToNextAge ? effectiveResearchCost(civilization, age, next) : {};
}

/** The Feudal buildings that qualify an owner for the Castle Age, cheapest
 *  first — the cheapest is the fastest route to qualifying, so it is the one
 *  worth saving for and the one that holds the army back for least time.
 *
 *  DERIVED from `agePrerequisiteBuildingTypes`, not restated: the same list
 *  already existed in `prototypeBuildingRules` (the rule the advance actually
 *  applies) and in the build order, and a reserve saving for something the
 *  advance does not count would hold the army back for nothing. */
export const QUALIFYING_FEUDAL_BUILDINGS: readonly BuildableBuildingType[] =
  [...agePrerequisiteBuildingTypes('castle-age')]
    .filter((type): type is BuildableBuildingType => type !== 'town-center')
    .sort((a, b) => (constructionCost(a).wood ?? 0) - (constructionCost(b).wood ?? 0));

/**
 * Wood to hold back from MILITARY so the age-up prerequisites can be built.
 *
 * The sibling `ageUpReserveCost` protects the age-up RESEARCH, but only once
 * the owner already qualifies — so nothing protected the cost of BECOMING
 * qualified, and that is the half that was actually blocking. The comment in
 * `aiSystemProductionPhase` assumed military and construction did not compete
 * ("military is the only pre-age-up food/gold spend; builds spend wood/stone")
 * and a SPEARMAN COSTS 25 WOOD, so they compete for the scarcest resource with
 * nothing arbitrating.
 *
 * Measured over 20,000 ticks before this existed: 715 wood reached buildings
 * and 525 went to 21 spearmen out of 1,240 total; the stockpile never cleared
 * 24, so the 150 for a first Blacksmith never accumulated, no AI ever
 * qualified, and — the reserve being empty until it does — each banked 980 to
 * 1,922 food it had no way to spend. No match reached the Castle Age on any
 * seed, and self-play exercised four unit types out of a 93-unit roster.
 *
 * Returns nothing once the owner qualifies, or outside the Feudal Age: this is
 * scoped to the transition it was measured on.
 */
/**
 * Units the AI keeps training even while saving for an age-up prerequisite.
 *
 * Deliberately below `attackGroupSize` (5): that is where
 * `militaryGrowthPausedForAgeUp` already stops GROWTH, so everything this
 * reserve competes with happens below it, in replacing losses. Measured at 5
 * the reserve does nothing at all.
 */
export const AGE_PREREQUISITE_MILITARY_FLOOR = 3;

export function agePrerequisiteWoodReserve(
  age: AgeType,
  qualifiesForNextAge: boolean,
  militaryCount: number,
  /** The army size below which the AI keeps training whatever the reserve
   *  wants. See `AGE_PREREQUISITE_MILITARY_FLOOR`. */
  militaryFloor: number,
  nextQualifyingWoodCost: number,
): number {
  if (age !== 'feudal-age') return 0;
  // The authoritative predicate, not a hand-count of buildings: it also
  // short-circuits true for the Khmer, who advance without prerequisites at
  // all and must not hold wood back for a building they do not need.
  if (qualifiesForNextAge) return 0;
  // A defensive floor, because without one this is a training BAN. Review
  // measured that version across 11 seeds: on every seed whose peak wood never
  // reached the reserve it blocked 100% of military training for the whole age
  // AND never afforded the building it was saving for — pure loss, with the
  // army pinned at 3 units against a baseline of 6-7, costing 21% of all peak
  // military. Below the floor the AI trains freely; above it, it can wait.
  //
  // The floor is NOT `attackGroupSize` (5), even though the sibling
  // `militaryGrowthPausedForAgeUp` uses that: that guard already stops growth
  // at 5, so the wood drain this reserve exists to stop happens entirely BELOW
  // it, in replacing losses. Measured at 5, the reserve is a no-op — zero
  // Castle Ages, byte-identical to baseline. Swept 0/2/3/4/5 over three seeds:
  //
  //     floor 0   2 castles   50 bldg types   25 unit types   military 32
  //     floor 2   2 castles   51              27              military 31
  //     floor 3   1 castle    50              26              military 37  <-
  //     floor 4   1 castle    48              27              military 35
  //     floor 5   0 castles   44              24              military 37
  //
  // 3 is the value that costs NOTHING: peak military identical to baseline's
  // 37, six more building types and two more unit types, and a Castle Age that
  // baseline never reached on any seed.
  if (militaryCount < militaryFloor) return 0;
  return nextQualifyingWoodCost;
}

// True when `stockpile` covers `cost` ON TOP OF `reserve` — i.e. the spend
// draws only from the surplus above the reserved age-up cost. Used to gate AI
// military training so a unit can't consume resources earmarked for an age-up.
export function canAffordWithReserve(
  stockpile: PlayerResources,
  cost: Partial<PlayerResources>,
  reserve: Partial<PlayerResources>,
): boolean {
  return canAfford(stockpile, {
    food: (cost.food ?? 0) + (reserve.food ?? 0),
    wood: (cost.wood ?? 0) + (reserve.wood ?? 0),
    gold: (cost.gold ?? 0) + (reserve.gold ?? 0),
    stone: (cost.stone ?? 0) + (reserve.stone ?? 0),
  });
}
