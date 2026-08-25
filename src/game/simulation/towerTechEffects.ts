// Defensive tower-upgrade technology effects, DERIVED (pure) from an owner's
// researched-tech set at the tower's fire site — no per-building state, because
// `applyTechnology` already records every researched tech in
// `researchedTechnologiesCodec`. Mirrors economyTechEffects: the Watch Tower's
// combat profile is the base, and these ADD the Guard Tower / Keep bonuses.
//
// AoE2 ladder is Watch Tower → Guard Tower → Keep (each +2 attack, Keep also
// +1 range). Both stack ADDITIVELY on top of the base combat profile. The
// The tower-upgrade HP halves live in buildingTechEffects (guard-tower
// 1020→1500, keep →2250 — CSV absolutes, not the folk +25%); this module
// keeps only the attack/range halves.

import type { ResearchableTechnologyType } from './types';

// Flat attack added per researched tower-upgrade tech (Guard Tower +2, Keep +2
// more). Additive so a set with both yields +4.
const TOWER_ATTACK_TECH_BONUSES: Partial<Record<ResearchableTechnologyType, number>> = {
  'guard-tower': 2,
  keep: 2,
};

// Sum of the attack bonuses of every researched tower-upgrade tech (0 / 2 / 4
// across none / Guard Tower / Keep). 0 when none are researched, so an
// un-teched owner's towers fire at the base rate.
export function towerAttackBonus(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  let bonus = 0;
  for (const tech of researchedTechnologies) {
    bonus += TOWER_ATTACK_TECH_BONUSES[tech] ?? 0;
  }
  return bonus;
}

// Range added by the top-tier upgrade: +1 with Keep, 0 otherwise. Guard Tower
// does not extend range (only Keep does, matching AoE2). 0 when un-teched, so
// the tower's target search is unchanged.
export function towerRangeBonus(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  return researchedTechnologies.has('keep') ? 1 : 0;
}
