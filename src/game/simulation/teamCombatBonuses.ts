// Combat-stat bonuses from the civilization and team_bonus columns (spec
// §9.2): line-of-sight, weapon range, and class-attack bonuses that land on a
// unit's stats. Pure over (teams, civilizations, owner) so the creation and
// damage sites just add the returned number.

import type { UnitType } from './types';
import { teamHasCivilization } from './teamBonuses';

type Teams = ReadonlyMap<number, number>;
type Civs = ReadonlyMap<number, string>;

const KNIGHT_LINE = new Set<UnitType>(['knight', 'cavalier', 'paladin']);
const SCOUT_LINE = new Set<UnitType>(['scout', 'light-cavalry', 'hussar']);
const FOOT_ARCHERS = new Set<UnitType>([
  'archer', 'crossbowman', 'arbalest', 'skirmisher', 'elite-skirmisher',
  'longbowman', 'elite-longbowman',
]);
const GALLEY_LINE = new Set<UnitType>(['galley', 'war-galley', 'galleon']);
const MANGONEL_LINE = new Set<UnitType>(['mangonel', 'onager', 'siege-onager']);
const SCORPION_LINE = new Set<UnitType>(['scorpion', 'heavy-scorpion']);
const ARCHER_CLASS_TARGETS = new Set<UnitType>([
  'archer', 'crossbowman', 'arbalest', 'skirmisher', 'elite-skirmisher',
  'cavalry-archer', 'heavy-cavalry-archer', 'hand-cannoneer',
  'longbowman', 'elite-longbowman',
]);
const CAMEL_LINE = new Set<UnitType>(['camel', 'heavy-camel', 'mameluke', 'elite-mameluke']);

/** Extra line of sight for a freshly created (or upgraded) unit. */
export function bonusVisionRadius(
  teams: Teams,
  civilizations: Civs,
  owner: number,
  unitType: UnitType,
  baseRadius: number,
): number {
  let bonus = 0;
  // Koreans (civilization bonus): villagers +3 line of sight.
  if (civilizations.get(owner) === 'Koreans' && unitType === 'villager') bonus += 3;
  if (KNIGHT_LINE.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Franks')) {
    bonus += 2;
  }
  if (SCOUT_LINE.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Mongols')) {
    bonus += 2;
  }
  if (FOOT_ARCHERS.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Magyars')) {
    bonus += 2;
  }
  // Japanese team bonus: galleys see 50% farther.
  if (GALLEY_LINE.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Japanese')) {
    bonus += Math.round(baseRadius * 0.5);
  }
  return bonus;
}

/** Extra weapon range for the mangonel and scorpion lines. */
export function bonusAttackRange(
  teams: Teams,
  civilizations: Civs,
  owner: number,
  unitType: UnitType,
): number {
  let bonus = 0;
  if (MANGONEL_LINE.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Koreans')) {
    bonus += 1;
  }
  if (SCORPION_LINE.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Khmer')) {
    bonus += 1;
  }
  return bonus;
}

/** Extra attack against BUILDINGS (Saracen foot archers, Indian camels). */
export function teamBuildingAttackBonus(
  teams: Teams,
  civilizations: Civs,
  owner: number,
  unitType: UnitType,
): number {
  let bonus = 0;
  if (FOOT_ARCHERS.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Saracens')) {
    bonus += 2;
  }
  if (CAMEL_LINE.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Indians')) {
    bonus += 5;
  }
  return bonus;
}

/** Extra attack against ARCHER-class units (Persian team knights). */
export function teamAntiArcherBonus(
  teams: Teams,
  civilizations: Civs,
  owner: number,
  attackerType: UnitType,
  targetType: UnitType,
): number {
  if (
    KNIGHT_LINE.has(attackerType)
    && ARCHER_CLASS_TARGETS.has(targetType)
    && teamHasCivilization(teams, civilizations, owner, 'Persians')
  ) {
    return 2;
  }
  return 0;
}
