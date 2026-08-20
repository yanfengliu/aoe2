// Land vs water domains (spec §13, M5 naval).
//
// Before ships existed, "passable terrain" was one hardcoded predicate:
// anything that is not water and not forest. A ship needs the complement, so
// passability became a function of the unit's DOMAIN. Everything else about
// naval play falls out of this one rule — a ship cannot be reached by land
// units, a land unit cannot chase one, and a shoreline is a real boundary —
// without any of those being special-cased.

import type { TerrainKind, UnitType } from './types';

export type UnitDomain = 'land' | 'water';

// Every ship. A new unit is LAND unless it is named here, which is the safe
// default: a mistakenly-land ship fails loudly at scenario validation, whereas
// a mistakenly-water land unit would be silently unable to leave the coast.
const WATER_UNITS = new Set<UnitType>([
  'fishing-ship',
  // Carries land units, but is itself a ship: it paths over water only.
  'transport-ship',
  'galley',
  'war-galley',
  'galleon',
  'fire-ship',
  'fast-fire-ship',
  'demolition-ship',
  'heavy-demolition-ship',
  'cannon-galleon',
  'elite-cannon-galleon',
  // M4: the naval unique units are ships like any other.
  'turtle-ship',
  'longboat',
  'elite-turtle-ship',
  'elite-longboat',
]);

export function unitDomain(unitType: UnitType): UnitDomain {
  return WATER_UNITS.has(unitType) ? 'water' : 'land';
}

export function isWaterUnit(unitType: UnitType): boolean {
  return WATER_UNITS.has(unitType);
}

/**
 * Whether a unit of this domain can occupy this terrain. The two domains are
 * complementary: no cell admits both, and water admits only ships.
 */
export function terrainPassableForDomain(
  kind: TerrainKind,
  domain: UnitDomain,
): boolean {
  if (domain === 'water') return kind === 'water';
  return kind !== 'water' && kind !== 'forest';
}

/**
 * Whether this unit runs the gather -> carry -> deposit economy loop.
 * Villagers on land, Fishing Ships on water; both key off the same `gatherer`
 * component, so the loop itself needs no other unit-type knowledge.
 */
export function gathersResources(unitType: UnitType): boolean {
  return unitType === 'villager' || unitType === 'fishing-ship';
}
