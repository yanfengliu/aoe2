// Projectile combat rules (spec §10.4). Pure functions only — no world, no
// stored RNG. Ranged attacks stop being instant HP subtraction: an attacker
// launches a projectile that travels for a number of ticks and resolves on
// impact, so a target can move out from under a shot.
//
// Determinism: the accuracy roll is a HASH of the shot's identity (launch
// tick, attacker id, target id, shot ordinal) rather than draws from a stored
// RNG stream. Nothing extra has to be serialized, save/load mid-flight
// reproduces the same outcome, and replays match by construction — a stateful
// stream would instead break the moment the number or order of rolls changed.

import type { Position } from 'civ-engine';

import { TPS } from './prototypeScenario';
import type { UnitType } from './types';
import { isMeleeUnit, unitAttackRange } from './prototypeUnitRules';

/**
 * How close a projectile must land to a unit to connect, in tiles. A shot
 * aimed at where the target no longer is misses — this is the distance that
 * decides "no longer is".
 */
export const PROJECTILE_HIT_TOLERANCE = 0.5;

/** Fallback flight speed (tiles per tick) for a ranged unit without an entry. */
const DEFAULT_PROJECTILE_SPEED = 0.7;

// Flight speed in tiles per tick, at 10 TPS. Arrows fly at AoE2's ~7 tiles per
// second; siege stones arc slower, a trebuchet boulder slower still, and a
// cannonball is the fastest thing on the field.
const PROJECTILE_SPEED: Partial<Record<UnitType, number>> = {
  mangonel: 0.5,
  onager: 0.5,
  trebuchet: 0.4,
  'bombard-cannon': 0.9,
};

// Accuracy percentages from design/stats/units.csv. These are the numbers that
// drive AoE2 counter-play: cavalry archers spray at 50%, scorpions never miss,
// and a trebuchet is nearly useless against anything that moves.
const UNIT_ACCURACY: Partial<Record<UnitType, number>> = {
  archer: 0.8,
  crossbowman: 0.85,
  arbalest: 0.9,
  skirmisher: 0.9,
  'cavalry-archer': 0.5,
  'heavy-cavalry-archer': 0.5,
  longbowman: 0.7,
  'elite-longbowman': 0.7,
  scorpion: 1,
  'heavy-scorpion': 1,
  'bombard-cannon': 0.92,
  trebuchet: 0.15,
};

// Wind-up before the projectile actually leaves the attacker, in seconds
// (units.csv `attack_delay`). A cavalry archer's full second of wind-up is why
// it feels sluggish despite a short reload.
const ATTACK_DELAY_SECONDS: Partial<Record<UnitType, number>> = {
  archer: 0.35,
  crossbowman: 0.35,
  arbalest: 0.35,
  longbowman: 0.35,
  'elite-longbowman': 0.35,
  skirmisher: 0.5,
  'cavalry-archer': 1,
  'heavy-cavalry-archer': 1,
  scorpion: 0.21,
  'heavy-scorpion': 0.21,
  'bombard-cannon': 0.21,
  trebuchet: 0.6,
};

// The mangonel line does its damage with a blast at the impact point, so it
// has no to-hit roll at all — the stone lands where it was aimed and everything
// nearby suffers. units.csv leaves their accuracy column empty for this reason.
const AREA_PROJECTILE_UNITS = new Set<UnitType>(['mangonel', 'onager']);

/**
 * Whether this unit's attack flies as a projectile rather than landing
 * instantly. Ranged, non-melee attackers only: a battering ram has siege
 * damage but swings at contact range, and a monk's range is conversion, not an
 * attack.
 */
export function firesProjectile(unitType: UnitType): boolean {
  return !isMeleeUnit(unitType) && unitAttackRange(unitType) > 1;
}

/** Whether the shot damages by blast at the impact point instead of on a hit. */
export function isAreaProjectile(unitType: UnitType): boolean {
  return AREA_PROJECTILE_UNITS.has(unitType);
}

/**
 * Chance in (0,1] that a shot is aimed truly. Area weapons report 1: they
 * always land where aimed, and their damage comes from the blast radius.
 */
export function unitAccuracy(unitType: UnitType): number {
  if (isAreaProjectile(unitType)) return 1;
  return UNIT_ACCURACY[unitType] ?? 1;
}

/** Flight speed in tiles per tick for this attacker's projectile. */
export function projectileSpeedTilesPerTick(unitType: UnitType): number {
  return PROJECTILE_SPEED[unitType] ?? DEFAULT_PROJECTILE_SPEED;
}

/** Whole ticks of wind-up before the projectile leaves the attacker. */
export function projectileLaunchDelayTicks(unitType: UnitType): number {
  return Math.round((ATTACK_DELAY_SECONDS[unitType] ?? 0) * TPS);
}

/**
 * Whole ticks a projectile spends in flight over this span. Always at least 1
 * so every shot is observable in the air rather than resolving on its own
 * launch tick.
 */
export function projectileFlightTicks(
  unitType: UnitType,
  from: Position,
  to: Position,
): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.max(1, Math.ceil(distance / projectileSpeedTilesPerTick(unitType)));
}

/**
 * The to-hit roll for one shot, in [0,1). Pure hash of the shot's identity —
 * see the determinism note at the top of this file.
 */
export function projectileRoll(
  launchTick: number,
  attackerId: number,
  targetId: number,
  ordinal: number,
): number {
  let hash = Math.imul(launchTick | 0, 668_265_263)
    ^ Math.imul(attackerId | 0, 374_761_393)
    ^ Math.imul(targetId | 0, -1_640_531_527)
    ^ Math.imul(ordinal | 0, 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 15), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4_294_967_296;
}

/**
 * Where to aim. `leads` (Ballistics) predicts the target's position at impact
 * from its current velocity; without it the shot goes to where the target
 * stands at launch, which is why un-led arrows trail a moving target.
 */
export function projectileAimPoint(
  target: Position,
  velocityPerTick: { readonly x: number; readonly y: number },
  flightTicks: number,
  leads: boolean,
): Position {
  if (!leads) return { x: target.x, y: target.y };
  return {
    x: target.x + velocityPerTick.x * flightTicks,
    y: target.y + velocityPerTick.y * flightTicks,
  };
}

/** Whether a projectile landing at `aim` connects with a unit standing at `target`. */
export function projectileHitsTarget(aim: Position, target: Position): boolean {
  return Math.hypot(target.x - aim.x, target.y - aim.y) <= PROJECTILE_HIT_TOLERANCE;
}

/**
 * Where a shot that failed its accuracy roll lands: past the hit tolerance but
 * still in the target's neighbourhood, scattered by direction so misses do not
 * all fall on the same side. Deterministic for a given shot.
 */
export function projectileMissAimPoint(
  target: Position,
  launchTick: number,
  attackerId: number,
  targetId: number,
  ordinal: number,
): Position {
  const angle = projectileRoll(launchTick, attackerId, targetId, ordinal + 977) * Math.PI * 2;
  const spread = projectileRoll(launchTick, attackerId, targetId, ordinal + 3_313);
  const distance = PROJECTILE_HIT_TOLERANCE * 1.6 + spread * 1.2;
  return {
    x: target.x + Math.cos(angle) * distance,
    y: target.y + Math.sin(angle) * distance,
  };
}
