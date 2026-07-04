// Civilization-bonus DERIVED layer (v0.1.81). The per-civ analogue of the
// tech-effect modules (economyTechEffects, movementTechEffects,
// visionTechEffects): pure functions that take the owner's civilization (a
// string, read from playerCivilizationsCodec) plus the relevant context and
// return a multiplier/bonus applied at the use-site. No per-entity state and
// no save-format change — the civilization already lives in the persisted
// playerCivilizations map, and replay re-seeds it deterministically from tick 0.
//
// First consumer: Britons "Shepherds work 25% faster" (civilizations.csv) — a
// gather-rate multiplier that applies ONLY to villagers gathering sheep. It
// multiplies with the tech gather-rate multiplier at the villager gather-tick
// site (villagerEconomySystem). An unknown/undefined civilization is a no-op
// (multiplier 1), so non-Britons owners and un-seeded owners are byte-identical.

import type { ResourceKind } from './types';

// Britons shepherds gather sheep 25% faster.
export const BRITONS_SHEEP_GATHER_MULTIPLIER = 1.25;

// The owner's civilization gather-rate multiplier for a concrete resource KIND.
// 1.0 (no bonus) unless a civ bonus matches both the civ and the kind.
export function civGatherRateMultiplier(
  civilization: string | undefined,
  kind: ResourceKind,
): number {
  if (civilization === 'Britons' && kind === 'sheep') {
    return BRITONS_SHEEP_GATHER_MULTIPLIER;
  }
  return 1;
}
