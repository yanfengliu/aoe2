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

// Faith (AoE2 Monastery, Imperial Age): CONVERSION RESISTANCE. A unit whose
// OWNER has Faith accumulates enemy-monk conversion progress at HALF rate, so it
// takes twice as long to convert. Deterministic (a fixed 0.5 multiplier — no
// probability). Keyed on the TARGET's owner, read at the convert-progress site.
export const FAITH_CONVERT_PROGRESS_MULTIPLIER = 0.5;

// Multiplier applied to incoming conversion progress for a unit whose owner has
// the given researched set: 0.5 with Faith, 1 otherwise. See spec §10.9.
export function monkConvertProgressMultiplier(
  targetOwnerResearched: ReadonlySet<ResearchableTechnologyType>,
): number {
  return targetOwnerResearched.has('faith') ? FAITH_CONVERT_PROGRESS_MULTIPLIER : 1;
}

// Herbal Medicine (AoE2 Monastery, Castle Age — technologies.csv:65
// "Garrisoned Units 4x healing speed"): a unit whose OWNER has the tech heals
// 4× as fast while garrisoned. DERIVED — a flat multiplier on the passive
// garrison-heal rate (garrisonHealSystem), keyed on the garrisoned unit's
// owner, no per-unit state. 1× (byte-identical) without the tech.
export const HERBAL_MEDICINE_HEAL_MULTIPLIER = 4;

export function garrisonHealRateMultiplier(
  ownerResearched: ReadonlySet<ResearchableTechnologyType>,
): number {
  return ownerResearched.has('herbal-medicine') ? HERBAL_MEDICINE_HEAL_MULTIPLIER : 1;
}

// Heresy (AoE2 Monastery, Castle Age — technologies.csv:66 "Converted units
// die"): a unit whose OWNER has Heresy DIES rather than switching sides when an
// enemy monk's conversion completes. Keyed on the TARGET's owner, read at the
// conversion flip site (applyMonkConvert) — the same target-owner researched
// set that Faith uses.
export function convertedUnitDies(
  targetOwnerResearched: ReadonlySet<ResearchableTechnologyType>,
): boolean {
  return targetOwnerResearched.has('heresy');
}
