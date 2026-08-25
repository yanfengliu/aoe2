// Unit stances (spec §12.8, M6 control). Before this, AoE2's stance behaviour
// was hardcoded per unit TYPE: military scanned its whole line of sight,
// villagers only their own cell. Those are still the defaults, but they are
// now a per-unit PROPERTY the player commands rather than a fact about the
// unit's type.
//
// Pure rules: the stance decides how far a unit looks for a fight, whether it
// may leave its post, and whether it starts fights with buildings. The
// auto-aggression system reads those three answers and nothing else.

import { gathersResources } from './unitDomain';
import type { UnitType } from './types';

export const UNIT_STANCES = [
  'aggressive',
  'defensive',
  'stand-ground',
  'no-attack',
] as const;

export type UnitStance = (typeof UNIT_STANCES)[number];

/**
 * AoE2's defaults: anything that fights starts Aggressive, anything that works
 * starts Defensive so it keeps working instead of chasing a scout across the
 * map.
 */
export function defaultStanceFor(unitType: UnitType): UnitStance {
  // A weaponless unit on AGGRESSIVE walks up to an enemy and stands there
  // "attacking" for zero forever — which is exactly what the first AI Trade
  // Cart did: the attack phase conscripted it, it pinned itself to the enemy
  // Market, and its route order never landed. AoE2 ships trade units on
  // No Attack for the same reason.
  if (unitType === 'trade-cart' || unitType === 'trade-cog') return 'no-attack';
  return gathersResources(unitType) ? 'defensive' : 'aggressive';
}

/**
 * How far this unit looks for something to engage, in tiles.
 *
 * - **aggressive** — the whole line of sight; it will go to the fight.
 * - **defensive** — exactly its weapon reach. It fights back against whatever
 *   comes at it and may pursue, but it does not go looking. For a villager
 *   (reach 1) this is "counter-attack whoever is adjacent", which is both
 *   AoE2's villager behaviour and what this game did before stances existed.
 * - **stand-ground** — exactly its weapon range. It never moves, so scanning
 *   further would only produce orders it cannot act on.
 * - **no-attack** — nothing at all.
 */
export function autoEngageRadius(
  stance: UnitStance,
  visionRadius: number,
  attackRange: number,
): number {
  switch (stance) {
    case 'aggressive':
      return visionRadius;
    case 'defensive':
      void visionRadius;
      return Math.max(1, attackRange);
    case 'stand-ground':
      return Math.max(1, attackRange);
    case 'no-attack':
      return 0;
  }
}

/** Stand Ground is the one stance that refuses to give up its cell. */
export function holdsPosition(stance: UnitStance): boolean {
  return stance === 'stand-ground';
}

/**
 * Whether the unit starts fights with BUILDINGS unprompted. Only Aggressive
 * does: a defending unit should not wander off to demolish a base, and an
 * explicit attack order always works regardless of stance.
 */
export function engagesBuildings(stance: UnitStance): boolean {
  return stance === 'aggressive';
}
