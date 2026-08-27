// What the AI keeps BACK from its stockpile so that discretionary spending
// cannot starve the next age-up. Extracted from ./ai.ts for the 500-LOC
// budget; all three functions answer the same question and nothing else in
// that file asks it.

import { canAfford } from './prototypeEconomyRules';
import { effectiveResearchCost } from './civBonusEffects';
import type { AgeType, PlayerResources, ResearchableTechnologyType } from './types';

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
