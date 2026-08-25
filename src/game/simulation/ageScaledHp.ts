// The age-scaled HP family (civilizations.csv):
//  - Vikings: infantry +10% / +15% / +20% HP in Feudal / Castle / Imperial
//  - Vietnamese: Archery Range units, the same ladder ("Does not stack")
//  - Byzantines: buildings +10% / +20% / +30% / +40% from the DARK Age up
// Pure factors over (civilization, type, age). Creation sites multiply by the
// current age's factor; the age-up sweep multiplies stored HP by the factor
// RATIO — replacing the old step rather than compounding on it, which is
// exactly what the CSV's "does not stack" note means.

import type { AgeType, BuildingType, UnitType } from './types';
import { isInfantryUnit } from './prototypeUnitRules';

const AGE_INDEX: Record<AgeType, number> = {
  'dark-age': 0,
  'feudal-age': 1,
  'castle-age': 2,
  'imperial-age': 3,
};

// Feudal +10%, Castle +15%, Imperial +20% — nothing in the Dark Age.
const UNIT_LADDER = [1, 1.1, 1.15, 1.2] as const;

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
    return UNIT_LADDER[AGE_INDEX[age]]!;
  }
  if (civilization === 'Vietnamese' && ARCHERY_RANGE_UNITS.has(unitType)) {
    return UNIT_LADDER[AGE_INDEX[age]]!;
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
