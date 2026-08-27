// The age-scaled HP family (sourced against current DE, v0.3.148):
//  - Vikings: infantry +20% HP FLAT from the Feudal Age
//  - Vietnamese: Archery Range units +20% HP, every age
//  - Franks: MOUNTED units +20% HP from the Feudal Age
//  - Mongols: scout line +20/30% HP in Castle/Imperial
//  - Portuguese: ships +10/15/20% HP in Feudal/Castle/Imperial
//  - Byzantines: buildings +10% / +20% / +30% / +40% from the DARK Age up
// Pure factors over (civilization, type, age). Creation sites multiply by the
// current age's factor; the age-up sweep multiplies stored HP by the factor
// RATIO — replacing the old step rather than compounding on it, which is
// exactly what the CSV's "does not stack" note means.

import type { AgeType, BuildingType, UnitType } from './types';
import { isInfantryUnit, isMountedUnit } from './prototypeUnitRules';

const AGE_INDEX: Record<AgeType, number> = {
  'dark-age': 0,
  'feudal-age': 1,
  'castle-age': 2,
  'imperial-age': 3,
};

// +20% flat from the Feudal Age (Vikings infantry, Franks mounted).
const FEUDAL_FLAT_20 = [1, 1.2, 1.2, 1.2] as const;
// Mongols scout line: +20/30% in Castle/Imperial.
const MONGOL_SCOUT_LADDER = [1, 1, 1.2, 1.3] as const;
// Portuguese ships: +10/15/20% in Feudal/Castle/Imperial.
const PORTUGUESE_SHIP_LADDER = [1, 1.1, 1.15, 1.2] as const;
const SCOUT_LINE = new Set<UnitType>(['scout', 'light-cavalry', 'hussar']);
const SHIPS = new Set<UnitType>([
  'galley', 'war-galley', 'galleon', 'fire-ship', 'fast-fire-ship',
  'demolition-ship', 'heavy-demolition-ship', 'cannon-galleon',
  'elite-cannon-galleon', 'turtle-ship', 'elite-turtle-ship',
  'longboat', 'elite-longboat', 'fishing-ship', 'transport-ship', 'trade-cog',
]);

// Everything trained at the Archery Range (the Vietnamese scope). The
// Longbowman and other castle units are NOT Archery Range units.
const ARCHERY_RANGE_UNITS = new Set<UnitType>([
  'archer', 'crossbowman', 'arbalest',
  'skirmisher', 'elite-skirmisher',
  'cavalry-archer', 'heavy-cavalry-archer',
  'hand-cannoneer',
]);

export function ageScaledUnitHpFactor(
  civilization: string | undefined,
  unitType: UnitType,
  age: AgeType,
): number {
  // isInfantryUnit derives from the armor-class taxonomy (v0.3.93), so the
  // Berserk and every other unique infantry ride the ladder with the lines.
  if (civilization === 'Vikings' && isInfantryUnit(unitType)) {
    return FEUDAL_FLAT_20[AGE_INDEX[age]]!;
  }
  if (civilization === 'Franks' && isMountedUnit(unitType)) {
    return FEUDAL_FLAT_20[AGE_INDEX[age]]!;
  }
  if (civilization === 'Vietnamese' && ARCHERY_RANGE_UNITS.has(unitType)) {
    return 1.2; // flat, every age (current DE).
  }
  if (civilization === 'Mongols' && SCOUT_LINE.has(unitType)) {
    return MONGOL_SCOUT_LADDER[AGE_INDEX[age]]!;
  }
  if (civilization === 'Portuguese' && SHIPS.has(unitType)) {
    return PORTUGUESE_SHIP_LADDER[AGE_INDEX[age]]!;
  }
  return 1;
}

export function ageScaledBuildingHpFactor(
  civilization: string | undefined,
  buildingType: BuildingType,
  age: AgeType,
): number {
  // "except gates" needs no carve-out: gates are not a BuildingType here.
  void buildingType;
  if (civilization === 'Byzantines') {
    return 1 + 0.1 * (AGE_INDEX[age] + 1);
  }
  return 1;
}

// The Scout Cavalry's hidden Feudal buff (units.csv rows 65/66, v0.3.136):
// the SAME unit attacks for 3 in the Dark Age and 5 from Feudal on — AoE2's
// own quiet upgrade, and the reason an early scout cannot bully a boar line.
// The scout ONLY: light cavalry and hussar are separate units with their own
// rows. Same replace-not-compound contract as the HP ladders.
export function ageScaledUnitAttack(unitType: UnitType, age: AgeType): number | null {
  if (unitType !== 'scout') return null;
  return age === 'dark-age' ? 3 : 5;
}
