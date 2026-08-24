// Armor-tech bonuses, split into symmetric + asymmetric parts (spec §11.8).
//
// AoE2 armor techs add +1 MELEE armor each. Most also add +1 pierce (symmetric,
// +1/+1), but FOUR add +2 pierce (asymmetric, +1 melee / +2 pierce): the three
// top-tier blacksmith armor techs (Plate Mail Armor, Plate Barding, Ring Archer
// Armor) and Loom. We model this with two accumulators on the combat state:
//   `armor`            — the symmetric bonus, added to BOTH melee and pierce.
//   `pierceArmorBonus` — the EXTRA pierce-only bonus (the asymmetric +1).
// so effective pierce armor = base + armor + pierceArmorBonus, and effective
// melee armor = base + armor. Keeping `armor` as the symmetric part means its
// meaning (and its serialized value) is unchanged, so pre-split saves — which
// have no `pierceArmorBonus` — load correctly as fully symmetric (`?? 0`).

import type { ResearchableTechnologyType } from './types';

// The armor techs whose pierce bonus is +2 (vs the default +1). Single source
// of truth shared by the combat-state factory (new units) and technologyOps
// (existing units on research), so the two application paths cannot drift.
export const EXTRA_PIERCE_ARMOR_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set([
  'loom',
  'plate-mail-armor',
  'plate-barding',
  'ring-archer-armor',
  // Parthian Tactics is the cavalry archer's own armor tech, and technologies
  // .csv gives it the same asymmetric "+1/+2 AR" as the top-tier armor lines.
  'parthian-tactics',
]);

export interface ArmorTechState {
  armor: number;
  // Optional at this boundary: a combat state restored from a pre-split save can
  // reach here with the field absent (see hydrateFromWorldState migration). The
  // `?? 0` below keeps `+= 1` from producing NaN even if normalization is missed.
  pierceArmorBonus?: number;
}

// Apply one armor tech's bonus: +1 symmetric armor for every armor tech, plus
// an extra +1 pierce for the four asymmetric techs.
export function applyArmorTech(state: ArmorTechState, tech: ResearchableTechnologyType): void {
  state.armor += 1;
  if (EXTRA_PIERCE_ARMOR_TECHS.has(tech)) {
    state.pierceArmorBonus = (state.pierceArmorBonus ?? 0) + 1;
  }
}

// Total pierce-armor tech bonus for a combat state: the symmetric `armor` plus
// the extra pierce-only bonus. `?? 0` migrates pre-split saved combat states,
// whose `armor` already carried the (then-symmetric) pierce value.
export function pierceArmorTechBonus(state: { armor: number; pierceArmorBonus?: number }): number {
  return state.armor + (state.pierceArmorBonus ?? 0);
}
