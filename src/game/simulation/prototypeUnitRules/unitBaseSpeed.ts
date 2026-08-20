// Per-unit BASE movement speed, as a percent of a villager, from the
// `movement_rate` column of design/stats/units.csv.
//
// Until this table existed every unit moved at exactly the same rate: a
// Mangonel kept pace with a Hussar, and speed was not part of a unit's
// identity at all. The values ride the movement-speed seam that Husbandry
// shipped (movementTechEffects.movementSpeedPercent -> the per-unit fractional
// carry in the step executor), so nothing new is needed to make a fractional
// rate real.
//
// The REFERENCE is the villager (units.csv 0.8), not 1.0. Two reasons: a
// villager is the unit every player watches most, so "how fast is this
// relative to a villager" is the useful reading; and it keeps the entire
// economy on the executor's speed-percent-100 fast path, which never touches
// the carry field.
//
// Two entries the CSV cannot decide:
// - `scout` has no row at all; AoE2's Scout Cavalry is 1.2.
// - `trebuchet` reads 0.0, which is an UNPACKED trebuchet — it genuinely
//   cannot move. We have no pack/unpack cycle, so it takes the packed 0.8.

import type { UnitType } from '../unitTypes';

/** A villager's movement_rate. Every percent below is relative to this. */
export const REFERENCE_MOVEMENT_RATE = 0.8;

export const UNIT_BASE_SPEED_PERCENT: Record<UnitType, number> = {
  'villager': 100, // 0.8
  'scout': 150, // 1.2
  'militia': 112, // 0.9
  'spearman': 125, // 1.0
  'archer': 120, // 0.96
  'skirmisher': 120, // 0.96
  'knight': 169, // 1.35
  'crossbowman': 120, // 0.96
  'pikeman': 125, // 1.0
  'light-cavalry': 188, // 1.5
  'camel': 181, // 1.45
  'cavalry-archer': 175, // 1.4
  'mangonel': 75, // 0.6
  'scorpion': 81, // 0.65
  'battering-ram': 62, // 0.5
  'monk': 87, // 0.7
  'longbowman': 120, // 0.96
  'arbalest': 120, // 0.96
  'halberdier': 125, // 1.0
  'hussar': 188, // 1.5
  'heavy-cavalry-archer': 175, // 1.4
  'cavalier': 169, // 1.35
  'champion': 112, // 0.9
  'elite-longbowman': 120, // 0.96
  'onager': 75, // 0.6
  'heavy-scorpion': 81, // 0.65
  'siege-ram': 75, // 0.6
  'bombard-cannon': 87, // 0.7
  'trebuchet': 100, // 0.8
  'man-at-arms': 112, // 0.9
  'long-swordsman': 112, // 0.9
  'two-handed-swordsman': 112, // 0.9
  'paladin': 169, // 1.35
  'heavy-camel': 181, // 1.45
  'fishing-ship': 158, // 1.26
  'galley': 179, // 1.43
  'war-galley': 179, // 1.43
  'galleon': 179, // 1.43
  'fire-ship': 169, // 1.35
  'fast-fire-ship': 179, // 1.43
  'demolition-ship': 200, // 1.6
  'heavy-demolition-ship': 200, // 1.6
  'cannon-galleon': 138, // 1.1
  'elite-cannon-galleon': 138, // 1.1
  'jaguar-warrior': 125, // 1.0
  'cataphract': 169, // 1.35
  'woad-raider': 172, // 1.38
  'chu-ko-nu': 120, // 0.96
  'throwing-axeman': 112, // 0.9
  'huskarl': 131, // 1.05
  'tarkan': 169, // 1.35
  'samurai': 125, // 1.0
  'war-wagon': 150, // 1.2
  'plumed-archer': 150, // 1.2
  'mangudai': 181, // 1.45
  'war-elephant': 75, // 0.6
  'mameluke': 175, // 1.4
  'conquistador': 162, // 1.3
  'teutonic-knight': 81, // 0.65
  'janissary': 120, // 0.96
  'berserk': 131, // 1.05
  'turtle-ship': 112, // 0.9
  'longboat': 192, // 1.54
};

/** This unit's base speed as a percent of a villager's. */
export function unitBaseSpeedPercent(unitType: UnitType): number {
  return UNIT_BASE_SPEED_PERCENT[unitType];
}
