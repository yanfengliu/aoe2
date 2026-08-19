import { describe, expect, it } from 'vitest';

import { TPS } from '../../src/game/simulation/prototypeScenario';
import type { UnitType } from '../../src/game/simulation/types';
import {
  PROJECTILE_HIT_TOLERANCE,
  firesProjectile,
  isAreaProjectile,
  projectileAimPoint,
  projectileFlightTicks,
  projectileHitsTarget,
  projectileLaunchDelayTicks,
  projectileMissAimPoint,
  projectileRoll,
  projectileSpeedTilesPerTick,
  unitAccuracy,
} from '../../src/game/simulation/projectileRules';

const RANGED: readonly UnitType[] = [
  'archer', 'crossbowman', 'arbalest', 'skirmisher', 'cavalry-archer',
  'heavy-cavalry-archer', 'longbowman', 'elite-longbowman', 'mangonel',
  'onager', 'scorpion', 'heavy-scorpion', 'bombard-cannon', 'trebuchet',
];

const MELEE: readonly UnitType[] = [
  'villager', 'scout', 'militia', 'spearman', 'knight', 'pikeman',
  'light-cavalry', 'camel', 'battering-ram', 'siege-ram', 'halberdier',
  'hussar', 'cavalier', 'champion', 'man-at-arms', 'long-swordsman',
  'two-handed-swordsman', 'paladin', 'heavy-camel', 'monk',
];

describe('projectile rules — who fires, and how accurately', () => {
  it('separates projectile attackers from melee attackers', () => {
    for (const unitType of RANGED) expect(firesProjectile(unitType)).toBe(true);
    for (const unitType of MELEE) expect(firesProjectile(unitType)).toBe(false);
  });

  it('carries the AoE2 accuracy percentages from units.csv', () => {
    // The signature values that drive AoE2 counter-play.
    expect(unitAccuracy('archer')).toBeCloseTo(0.8, 10);
    expect(unitAccuracy('crossbowman')).toBeCloseTo(0.85, 10);
    expect(unitAccuracy('arbalest')).toBeCloseTo(0.9, 10);
    expect(unitAccuracy('skirmisher')).toBeCloseTo(0.9, 10);
    // Cavalry archers are famously inaccurate; scorpions never miss.
    expect(unitAccuracy('cavalry-archer')).toBeCloseTo(0.5, 10);
    expect(unitAccuracy('heavy-cavalry-archer')).toBeCloseTo(0.5, 10);
    expect(unitAccuracy('scorpion')).toBeCloseTo(1, 10);
    expect(unitAccuracy('heavy-scorpion')).toBeCloseTo(1, 10);
    expect(unitAccuracy('longbowman')).toBeCloseTo(0.7, 10);
    expect(unitAccuracy('elite-longbowman')).toBeCloseTo(0.7, 10);
    expect(unitAccuracy('bombard-cannon')).toBeCloseTo(0.92, 10);
    // A trebuchet is a siege weapon, not an anti-unit weapon.
    expect(unitAccuracy('trebuchet')).toBeCloseTo(0.15, 10);
  });

  it('treats the mangonel line as area weapons that always land where aimed', () => {
    expect(isAreaProjectile('mangonel')).toBe(true);
    expect(isAreaProjectile('onager')).toBe(true);
    for (const unitType of ['archer', 'scorpion', 'bombard-cannon', 'trebuchet'] as const) {
      expect(isAreaProjectile(unitType)).toBe(false);
    }
    // An area weapon has no accuracy roll — its damage comes from the blast.
    expect(unitAccuracy('mangonel')).toBe(1);
    expect(unitAccuracy('onager')).toBe(1);
  });

  it('reports a positive accuracy for every projectile attacker', () => {
    for (const unitType of RANGED) {
      const accuracy = unitAccuracy(unitType);
      expect(accuracy).toBeGreaterThan(0);
      expect(accuracy).toBeLessThanOrEqual(1);
    }
  });
});

describe('projectile flight', () => {
  it('takes longer the further the shot travels, and never resolves same-tick', () => {
    const near = projectileFlightTicks('archer', { x: 0, y: 0 }, { x: 1, y: 0 });
    const far = projectileFlightTicks('archer', { x: 0, y: 0 }, { x: 6, y: 0 });
    expect(near).toBeGreaterThanOrEqual(1);
    expect(far).toBeGreaterThan(near);
    // A point-blank shot still takes at least one tick, so a projectile is
    // always observable in flight.
    expect(projectileFlightTicks('archer', { x: 3, y: 3 }, { x: 3, y: 3 }))
      .toBeGreaterThanOrEqual(1);
  });

  it('measures Euclidean distance, not axis distance', () => {
    const diagonal = projectileFlightTicks('archer', { x: 0, y: 0 }, { x: 3, y: 4 });
    const straight = projectileFlightTicks('archer', { x: 0, y: 0 }, { x: 5, y: 0 });
    expect(diagonal).toBe(straight);
  });

  it('flies siege shots slower than arrows and cannonballs fastest', () => {
    expect(projectileSpeedTilesPerTick('bombard-cannon'))
      .toBeGreaterThan(projectileSpeedTilesPerTick('archer'));
    expect(projectileSpeedTilesPerTick('archer'))
      .toBeGreaterThan(projectileSpeedTilesPerTick('mangonel'));
    expect(projectileSpeedTilesPerTick('mangonel'))
      .toBeGreaterThan(projectileSpeedTilesPerTick('trebuchet'));
    // Same span, slower weapon, longer flight.
    const from = { x: 0, y: 0 };
    const to = { x: 6, y: 0 };
    expect(projectileFlightTicks('trebuchet', from, to))
      .toBeGreaterThan(projectileFlightTicks('archer', from, to));
  });

  it('adds the per-unit wind-up delay from the attack_delay column', () => {
    // attack_delay seconds × TPS, rounded to whole ticks.
    expect(projectileLaunchDelayTicks('archer')).toBe(Math.round(0.35 * TPS));
    expect(projectileLaunchDelayTicks('scorpion')).toBe(Math.round(0.21 * TPS));
    expect(projectileLaunchDelayTicks('cavalry-archer')).toBe(Math.round(1 * TPS));
    expect(projectileLaunchDelayTicks('trebuchet')).toBe(Math.round(0.6 * TPS));
    for (const unitType of RANGED) {
      expect(projectileLaunchDelayTicks(unitType)).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(projectileLaunchDelayTicks(unitType))).toBe(true);
    }
  });
});

describe('projectile accuracy roll — deterministic without stored RNG state', () => {
  it('is a pure function of the shot identity, in [0,1)', () => {
    const roll = projectileRoll(120, 7, 9, 3);
    expect(roll).toBeGreaterThanOrEqual(0);
    expect(roll).toBeLessThan(1);
    expect(projectileRoll(120, 7, 9, 3)).toBe(roll);
  });

  it('varies across tick, attacker, target, and shot ordinal', () => {
    const base = projectileRoll(120, 7, 9, 3);
    expect(projectileRoll(121, 7, 9, 3)).not.toBe(base);
    expect(projectileRoll(120, 8, 9, 3)).not.toBe(base);
    expect(projectileRoll(120, 7, 10, 3)).not.toBe(base);
    expect(projectileRoll(120, 7, 9, 4)).not.toBe(base);
  });

  it('is uniform enough that an 80%-accuracy unit lands near 80% of its shots', () => {
    let hits = 0;
    const total = 4_000;
    for (let shot = 0; shot < total; shot += 1) {
      if (projectileRoll(shot, 7, 9, shot % 5) < 0.8) hits += 1;
    }
    expect(hits / total).toBeGreaterThan(0.76);
    expect(hits / total).toBeLessThan(0.84);
  });

  it('has no bias that would make one attacker permanently lucky', () => {
    // Averaging each attacker's own stream must stay near 0.5 — a per-attacker
    // bias would silently make some units far deadlier than their stat sheet.
    for (let attacker = 1; attacker <= 12; attacker += 1) {
      let sum = 0;
      const total = 600;
      for (let tick = 0; tick < total; tick += 1) sum += projectileRoll(tick, attacker, 44, 0);
      expect(sum / total).toBeGreaterThan(0.44);
      expect(sum / total).toBeLessThan(0.56);
    }
  });
});

describe('aiming and leading', () => {
  const target = { x: 10, y: 10 };
  const movingEast = { x: 0.5, y: 0 };

  it('aims at where the target is now when the attacker cannot lead', () => {
    expect(projectileAimPoint(target, movingEast, 6, false)).toEqual(target);
  });

  it('leads a moving target by its velocity over the flight when Ballistics applies', () => {
    const aim = projectileAimPoint(target, movingEast, 6, true);
    expect(aim.x).toBeCloseTo(10 + 0.5 * 6, 10);
    expect(aim.y).toBeCloseTo(10, 10);
  });

  it('leads nowhere for a stationary target, with or without Ballistics', () => {
    const still = { x: 0, y: 0 };
    expect(projectileAimPoint(target, still, 6, true)).toEqual(target);
    expect(projectileAimPoint(target, still, 6, false)).toEqual(target);
  });

  it('counts a shot as connecting only when the target is near the aim point', () => {
    expect(projectileHitsTarget({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(true);
    const justInside = { x: 10 + PROJECTILE_HIT_TOLERANCE * 0.9, y: 10 };
    const wellOutside = { x: 10 + PROJECTILE_HIT_TOLERANCE * 3, y: 10 };
    expect(projectileHitsTarget({ x: 10, y: 10 }, justInside)).toBe(true);
    expect(projectileHitsTarget({ x: 10, y: 10 }, wellOutside)).toBe(false);
  });

  it('makes an un-led shot at a moving target land behind it', () => {
    // The core AoE2 consequence: without Ballistics, arrows trail the target.
    const flightTicks = 6;
    const aim = projectileAimPoint(target, movingEast, flightTicks, false);
    const whereItWillBe = {
      x: target.x + movingEast.x * flightTicks,
      y: target.y + movingEast.y * flightTicks,
    };
    expect(projectileHitsTarget(aim, whereItWillBe)).toBe(false);
    // With Ballistics the same shot connects.
    const led = projectileAimPoint(target, movingEast, flightTicks, true);
    expect(projectileHitsTarget(led, whereItWillBe)).toBe(true);
  });
});

describe('missed shots land elsewhere', () => {
  it('offsets the aim point off the target but keeps it nearby', () => {
    const target = { x: 20, y: 20 };
    const miss = projectileMissAimPoint(target, 42, 7, 9, 1);
    const offset = Math.hypot(miss.x - target.x, miss.y - target.y);
    expect(offset).toBeGreaterThan(PROJECTILE_HIT_TOLERANCE);
    expect(offset).toBeLessThanOrEqual(2.5);
    expect(projectileHitsTarget(miss, target)).toBe(false);
  });

  it('scatters misses in different directions rather than always the same way', () => {
    const target = { x: 20, y: 20 };
    const angles = new Set<number>();
    for (let shot = 0; shot < 40; shot += 1) {
      const miss = projectileMissAimPoint(target, shot, 7, 9, shot % 3);
      angles.add(Math.round(Math.atan2(miss.y - target.y, miss.x - target.x) * 4));
    }
    expect(angles.size).toBeGreaterThanOrEqual(6);
  });

  it('is deterministic for the same shot', () => {
    const target = { x: 20, y: 20 };
    expect(projectileMissAimPoint(target, 42, 7, 9, 1))
      .toEqual(projectileMissAimPoint(target, 42, 7, 9, 1));
  });
});
