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
import { firesProjectile, unitBlastRadius } from './prototypeUnitRules';

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
// cannonball is the fastest thing on the field. Every tier of a line flies the
// same shot: the Siege Onager was missing, so its stone flew at arrow speed
// (tests/simulation/upgradeKeepsLineMemberships.test.ts).
const PROJECTILE_SPEED: Partial<Record<UnitType, number>> = {
  mangonel: 0.5,
  onager: 0.5,
  'siege-onager': 0.5,
  trebuchet: 0.4,
  'bombard-cannon': 0.9,
};

// Base accuracy from units.csv, re-sourced from pinned DE update 185872
// (aoe2techtree 3bb43b14) for every supported ranged attacker. Missing entries
// are 100%; fire-ship flame accuracy is unused in DE and takes that default.
const UNIT_ACCURACY: Partial<Record<UnitType, number>> = {
  archer: 0.8,
  crossbowman: 0.85,
  arbalest: 0.9,
  skirmisher: 0.9,
  // Both tiers, as units.csv and DE give them (defect register, 2026-09-26).
  'elite-skirmisher': 0.9,
  'cavalry-archer': 0.5,
  'heavy-cavalry-archer': 0.8,
  longbowman: 0.7,
  'elite-longbowman': 0.8,
  scorpion: 1,
  'heavy-scorpion': 1,
  'bombard-cannon': 1,
  trebuchet: 0.15,
  // M4 unique units, from units.csv `accuracy`. The Janissary is the
  // outlier: a devastating hit that misses half the time.
  'chu-ko-nu': 0.85,
  'war-wagon': 1,
  'plumed-archer': 0.8,
  'mangudai': 0.95,
  'conquistador': 0.65,
  'janissary': 0.5,
  'longboat': 1,
  // Elite tier.
  'elite-chu-ko-nu': 0.85,
  'elite-war-wagon': 1,
  'elite-plumed-archer': 0.9,
  'elite-mangudai': 0.95,
  'elite-conquistador': 0.7,
  'elite-janissary': 0.65,
  'elite-longboat': 1,
  // Common gunpowder unit; it has no elite upgrade.
  'hand-cannoneer': 0.75,
};

// Wind-up before the projectile leaves, from the exact sourced units.csv
// attack_delay seconds. The executor rounds these decimals to whole ticks;
// Cavalry Archer 0.91 s and Heavy Cavalry Archer 0.897 s both round to nine.
const ATTACK_DELAY_SECONDS: Partial<Record<UnitType, number>> = {
  archer: 0.35,
  crossbowman: 0.35,
  arbalest: 0.342222,
  longbowman: 0.5,
  'elite-longbowman': 0.5,
  skirmisher: 0.506667,
  'elite-skirmisher': 0.506667,
  'cavalry-archer': 0.91,
  'heavy-cavalry-archer': 0.897,
  scorpion: 0.16,
  'heavy-scorpion': 0.16,
  'bombard-cannon': 0.21,
  trebuchet: 0.88,
  // Unique ranged units use the same sourced column, including Longboat 0.
  'chu-ko-nu': 0.221667,
  'throwing-axeman': 0.995556,
  'war-wagon': 0.995556,
  'plumed-archer': 0.5,
  'mangudai': 0.498333,
  'mameluke': 0.4,
  'conquistador': 0.404444,
  'janissary': 0.4,
  'longboat': 0,
  // Elite tier.
  'elite-jaguar-warrior': 0.0,
  'elite-cataphract': 0.0,
  'elite-woad-raider': 0.0,
  'elite-chu-ko-nu': 0.221667,
  'elite-throwing-axeman': 0.815111,
  'elite-huskarl': 0.0,
  'elite-tarkan': 0.0,
  'elite-samurai': 0.0,
  'elite-war-wagon': 0.995556,
  'elite-plumed-archer': 0.5,
  'elite-mangudai': 0.498333,
  'elite-war-elephant': 0.0,
  'elite-mameluke': 0.2,
  'elite-conquistador': 0.404444,
  'elite-teutonic-knight': 0.0,
  'elite-janissary': 0,
  'elite-berserk': 0.0,
  'elite-turtle-ship': 0.15,
  'elite-longboat': 0,
  // Common Hand Cannoneer and the base Turtle Ship.
  'hand-cannoneer': 0.35,
  'turtle-ship': 0.15,
};

// Who fires a projectile is decided in prototypeUnitRules.ts (see there for
// why) and re-exported here with the rest of the projectile rules.
export { firesProjectile };

/**
 * Whether the shot damages by blast at the impact point instead of on a hit:
 * every projectile attacker with a blast radius, which is the mangonel line.
 * It has no to-hit roll at all — the stone lands where it was aimed and
 * everything nearby suffers; units.csv records the line's sourced 100%
 * accuracy. Read from the blast table itself: a hand list of its own named
 * the Mangonel and the Onager and not the Siege Onager, so the Imperial
 * upgrade fired direct hits with no splash (defect register, "The Siege
 * Onager fired direct hits with no splash", 2026-09-24).
 */
export function isAreaProjectile(unitType: UnitType): boolean {
  return firesProjectile(unitType) && unitBlastRadius(unitType) > 0;
}

/**
 * Whether this unit may be ordered to attack the ground (spec §10.7): a unit
 * whose shot blasts where it lands. The Demolition Ship line has a blast too,
 * but it is its own detonation against a target, not a shot, and DE does not
 * give it the order. DE also lets the Trebuchet, the Bombard Cannon and the
 * Cannon Galleon and Turtle Ship lines attack the ground; their shots have no
 * blast here, so a ground order would do nothing and they are refused.
 */
export function canAttackGround(unitType: UnitType): boolean {
  return isAreaProjectile(unitType);
}

/**
 * Whether this unit's blast spares its own side, its owner's units and its
 * allies' (spec §10.7): a blast a unit delivers in person, the demolition
 * line's charge, does, and a shot's blast, the mangonel line's stone, hurts
 * every unit in its radius. A reversible default. The sources on the ship say
 * its blast "does not harm friendly units" (the AoE2 wiki) and that "petards
 * and demolition ships do not injure friendlies" where the Onager's blast
 * "hits all units regardless of their owner" (openage's notes); DE's data
 * reads the other way, giving the line blast level 2 ("Damage nearby and
 * allied units") with neither flag DE uses to spare a side (4 or 8). The
 * Battle Elephant's trample has the same level and no flag, and the DE
 * modding guide says it hurts "All enemy units", though in the words it uses
 * for every blast's width, the Mangonel's included.
 */
export function blastSparesOwnSide(unitType: UnitType): boolean {
  return unitBlastRadius(unitType) > 0 && !firesProjectile(unitType);
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

/**
 * The velocity to lead a target by, derived from where it is walking rather
 * than from a stored last-position. technologies.csv describes Ballistics as
 * "aim at the spot an enemy unit is moving towards", which is exactly this:
 * head along the target's path at its movement speed, but never further than
 * the destination it is actually walking to — leading past a unit that is
 * about to stop is how a "smart" shot misses a stationary target.
 *
 * `destination` is null for a target with no move order, which yields a zero
 * velocity and therefore an un-led shot.
 */
export function targetLeadVelocity(
  target: Position,
  destination: Position | null,
  speedTilesPerTick: number,
  flightTicks: number,
): { x: number; y: number } {
  if (!destination || flightTicks <= 0) return { x: 0, y: 0 };
  const deltaX = destination.x - target.x;
  const deltaY = destination.y - target.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= 0) return { x: 0, y: 0 };
  // Cap the lead at the destination: travel no further than the target can,
  // and no further than it intends to.
  const travel = Math.min(speedTilesPerTick * flightTicks, distance);
  const perTick = travel / flightTicks;
  return { x: (deltaX / distance) * perTick, y: (deltaY / distance) * perTick };
}
