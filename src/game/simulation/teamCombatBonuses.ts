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
  _baseRadius: number,
): number {
  let bonus = 0;
  // Koreans TEAM bonus (sourced v0.3.144): villagers +3 line of sight for
  // the whole side, not just the Korean player.
  if (unitType === 'villager' && teamHasCivilization(teams, civilizations, owner, 'Koreans')) bonus += 3;
  if (KNIGHT_LINE.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Franks')) {
    bonus += 2;
  }
  if (SCOUT_LINE.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Mongols')) {
    bonus += 2;
  }
  // Japanese team bonus (sourced v0.3.144): galleys +4 line of sight, flat.
  if (GALLEY_LINE.has(unitType) && teamHasCivilization(teams, civilizations, owner, 'Japanese')) {
    bonus += 4;
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
  // Hindustanis (sourced v0.3.144): scout line AND camels, +2 vs buildings.
  if ((CAMEL_LINE.has(unitType) || SCOUT_LINE.has(unitType)) && teamHasCivilization(teams, civilizations, owner, 'Indians')) {
    bonus += 2;
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
  let bonus = 0;
  if (
    KNIGHT_LINE.has(attackerType)
    && ARCHER_CLASS_TARGETS.has(targetType)
    && teamHasCivilization(teams, civilizations, owner, 'Persians')
  ) {
    bonus += 2;
  }
  // Japanese CIV bonus (sourced v0.3.153): "Cavalry Archers +2 attack vs.
  // Ranged Soldiers (except Skirmishers)" — the owner alone, not the team.
  if (
    (attackerType === 'cavalry-archer' || attackerType === 'heavy-cavalry-archer')
    && ARCHER_CLASS_TARGETS.has(targetType)
    && targetType !== 'skirmisher' && targetType !== 'elite-skirmisher'
    && civilizations.get(owner) === 'Japanese'
  ) {
    bonus += 2;
  }
  return bonus;
}
