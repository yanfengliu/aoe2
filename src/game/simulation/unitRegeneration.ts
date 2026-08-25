// Units that heal themselves, standing in a field, with nobody helping.
//
// Age of Empires II gives this to exactly one unit line: the Vikings' Berserk,
// which regenerates on its own and is the reason a Berserk army is worth more
// than the sum of its fights. It is also the mechanic Berserkergang doubles —
// technologies.csv, "Berserks regenerate 2x faster - 2 HP every 3 seconds" —
// which is why that technology sat on the deferred list with the note "no unit
// regenerates".
//
// Deterministic and rate-based like the garrison heal it sits beside: a fixed
// amount per tick, never reviving the dead, never over-healing the whole.

import type { ResearchableTechnologyType, UnitType } from './types';
import { UNIQUE_TECHNOLOGIES } from './uniqueTechnologies';

// The CSV's figure for the TECHED rate is "2 HP every 3 seconds", so the base
// is 1 HP every 3 seconds. At 10 ticks per second that is 1/30 HP per tick.
export const BERSERK_REGEN_HP_PER_TICK = 1 / 30;

const REGENERATING_UNITS: ReadonlySet<UnitType> = new Set(['berserk', 'elite-berserk']);

/** Whether this unit heals itself at all. */
export function regeneratesOnItsOwn(unitType: UnitType): boolean {
  return REGENERATING_UNITS.has(unitType);
}

/**
 * Hit points this unit regains per tick, for an owner with this researched set.
 * Zero for everything that does not regenerate, which is every unit but one
 * line — so the system that calls this can skip the rest.
 */
export function regenPerTick(
  unitType: UnitType,
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  if (!regeneratesOnItsOwn(unitType)) return 0;
  let rate = BERSERK_REGEN_HP_PER_TICK;
  for (const technology of UNIQUE_TECHNOLOGIES) {
    if (technology.regenMultiplier && researchedTechnologies.has(technology.id)) {
      rate *= technology.regenMultiplier;
    }
  }
  return rate;
}

/**
 * One tick of self-healing: unchanged when dead or already whole, otherwise
 * raised by `rate` and clamped to `maxHp`.
 */
export function regenStep(currentHp: number, maxHp: number, rate: number): number {
  if (rate <= 0 || currentHp <= 0 || currentHp >= maxHp) return currentHp;
  return Math.min(maxHp, currentHp + rate);
}
