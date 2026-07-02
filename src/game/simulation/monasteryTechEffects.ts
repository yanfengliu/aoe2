// Monastery monk-upgrade technology effects, DERIVED (pure) from an owner's
// researched-tech set at the monk's action site — no per-monk state, because
// `applyTechnology` already records every researched tech in
// `researchedTechnologiesCodec`. Mirrors towerTechEffects / economyTechEffects:
// the base monk action range is the profile, and these ADD the bonus.
//
// Block Printing (AoE2 Monastery, Castle Age) extends monk CONVERSION range.
// Modeled deterministically as a flat +2 to the monk action range for convert
// tasks (no probability — the sim is replay-deterministic). See spec §12.

import type { ResearchableTechnologyType } from './types';

// Cells added to a monk's conversion range per researched Monastery range tech.
const MONK_CONVERT_RANGE_TECH_BONUSES: Partial<Record<ResearchableTechnologyType, number>> = {
  'block-printing': 2,
};

// Sum of the conversion-range bonuses of every researched Monastery tech (0
// without Block Printing, +2 with). 0 when un-teched, so an un-teched owner's
// monks convert at the base range — behaviour-identical to before.
export function monkConvertRangeBonus(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  let bonus = 0;
  for (const tech of researchedTechnologies) {
    bonus += MONK_CONVERT_RANGE_TECH_BONUSES[tech] ?? 0;
  }
  return bonus;
}
