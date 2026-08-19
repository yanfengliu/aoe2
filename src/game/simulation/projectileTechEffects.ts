// Ballistics and Thumb Ring (spec §10.4) — the two technologies that act on
// the projectile system.
//
// Both are DERIVED from the owner's researched-tech set at the launch site:
// no per-unit state, nothing extra in saves, and an owner who has not
// researched them takes the exact pre-tech path. This is the
// economyTechEffects / towerTechEffects pattern.

import type { ResearchableTechnologyType, UnitType } from './types';

/**
 * Ballistics: shots lead a moving target instead of going where it stands.
 * technologies.csv scopes it to "Arrow/Bolt-firing units; Buildings; Bombard
 * Towers" — that is, everything the owner shoots with — so it is a per-OWNER
 * property rather than a per-unit one, and building arrows get it too.
 */
export function ballisticsLeadsShots(
  researched: ReadonlySet<ResearchableTechnologyType>,
): boolean {
  return researched.has('ballistics');
}

// Thumb Ring is scoped to "Archer;Cavalry Archer" in technologies.csv, which
// in AoE2 means both whole lines. Skirmishers are deliberately excluded (they
// are their own line), as are siege and gunpowder.
const THUMB_RING_UNITS = new Set<UnitType>([
  'archer',
  'crossbowman',
  'arbalest',
  'cavalry-archer',
  'heavy-cavalry-archer',
  'longbowman',
  'elite-longbowman',
]);

/**
 * Thumb Ring: 100% accuracy for the archer and cavalry-archer lines. Returns
 * the accuracy override, or `null` when the tech does not apply — so the
 * caller falls back to the unit's own accuracy rather than to a magic 1.
 */
export function thumbRingAccuracy(
  researched: ReadonlySet<ResearchableTechnologyType>,
  unitType: UnitType,
): number | null {
  if (!researched.has('thumb-ring')) return null;
  return THUMB_RING_UNITS.has(unitType) ? 1 : null;
}
