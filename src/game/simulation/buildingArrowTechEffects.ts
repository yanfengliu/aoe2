// Blacksmith archer-attack techs applied to BUILDING arrow fire, DERIVED (pure)
// from an owner's researched-tech set at the building's fire site. In AoE2,
// Fletching / Bodkin Arrow / Bracer each grant +1 attack and +1 range to
// archers AND to arrow-firing buildings (Town Center, Watch Tower line, Castle).
// This mirrors the archer bonuses already applied in combatStateFactory, but for
// buildings — no per-building state, read at the fire site like the tower techs.

import type { ResearchableTechnologyType } from './types';

// The three Blacksmith techs that each add +1 attack / +1 range to building
// arrows (same set that boosts the archer line).
const BUILDING_ARROW_TECHS: readonly ResearchableTechnologyType[] = [
  'fletching',
  'bodkin-arrow',
  'bracer',
];

function countBuildingArrowTechs(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  let n = 0;
  for (const tech of BUILDING_ARROW_TECHS) {
    if (researchedTechnologies.has(tech)) n += 1;
  }
  return n;
}

// +1 attack per researched Blacksmith arrow tech (0-3 across none/Fletching/
// +Bodkin/+Bracer). 0 when un-teched → building fire is unchanged.
export function buildingArrowAttackBonus(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  return countBuildingArrowTechs(researchedTechnologies);
}

// +1 range per researched Blacksmith arrow tech (0-3). 0 when un-teched.
export function buildingArrowRangeBonus(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  return countBuildingArrowTechs(researchedTechnologies);
}
