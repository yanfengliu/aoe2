import { describe, expect, it } from 'vitest';

import { MAP_HEIGHT, MAP_WIDTH } from '../../src/game/simulation/mapGeneration/constants';

// These tests are about the map's EDGES, so they name the map they are on.
const MAP = { width: MAP_WIDTH, height: MAP_HEIGHT };
import { projectileMissAimPoint } from '../../src/game/simulation/projectileRules';
import { launchProjectile } from '../../src/game/simulation/bridge/projectileOps';
import { createEmptyProjectileSlot } from '../../src/game/simulation/bridge/projectileTypes';
import { visibleProjectiles } from '../../src/game/simulation/bridge/projectileProjection';
import type { ProjectileState } from '../../src/game/simulation/bridge/projectileTypes';

// A 40000-tick AI-versus-AI match crashed at tick 24173 with the engine's
// `visibility_out_of_bounds` for grid (33, -1): a shot fired at a target on the
// map's top edge scattered off the map, and the render projection asked the
// visibility map whether that cell could be seen. The engine THROWS on an
// out-of-range coordinate rather than answering false, so one stray arrow ended
// the match.
//
// Two rules, because either alone leaves a hole: a shot is never AIMED off the
// map, and the projection never ASKS about a cell that is off it.

describe('a miss never scatters off the map', () => {
  function aimFor(target: { x: number; y: number }, ordinal: number) {
    const slot = createEmptyProjectileSlot();
    return launchProjectile({
      slot,
      tick: 0,
      attacker: {
        id: 1,
        owner: 1,
        unitType: 'archer',
        position: { x: target.x, y: Math.min(MAP_HEIGHT - 1, target.y + 4) },
        baseDamage: 4,
      },
      target: {
        id: 2 + ordinal,
        kind: 'unit',
        position: target,
        destination: null,
      },
      accuracy: 0,
      leads: false,
      mapSize: MAP,
    });
  }

  it('keeps the aim inside the map for a target on any edge', () => {
    const edges = [
      { x: 33, y: 0 },
      { x: 0, y: 17 },
      { x: MAP_WIDTH - 1, y: 22 },
      { x: 14, y: MAP_HEIGHT - 1 },
      { x: 0, y: 0 },
      { x: MAP_WIDTH - 1, y: MAP_HEIGHT - 1 },
    ];
    for (const target of edges) {
      // Many ordinals, because the scatter direction is a hash of the shot's
      // identity: one sample would prove nothing about the ones that miss
      // outward.
      for (let ordinal = 0; ordinal < 40; ordinal += 1) {
        const shot = aimFor(target, ordinal);
        expect(shot.aimX).toBeGreaterThanOrEqual(0);
        expect(shot.aimY).toBeGreaterThanOrEqual(0);
        expect(shot.aimX).toBeLessThanOrEqual(MAP_WIDTH - 1);
        expect(shot.aimY).toBeLessThanOrEqual(MAP_HEIGHT - 1);
      }
    }
  });

  it('still scatters — clamping must not turn every miss into a bullseye', () => {
    // A target well inside the map is unaffected by the clamp, so the miss
    // still lands away from it. Without this the first test could be satisfied
    // by aiming every miss at the target.
    const target = { x: 20, y: 20 };
    const distances = new Set<string>();
    for (let ordinal = 0; ordinal < 20; ordinal += 1) {
      const point = projectileMissAimPoint(target, 0, 1, 2 + ordinal, ordinal);
      distances.add(`${Math.round(point.x * 10)}:${Math.round(point.y * 10)}`);
      expect(Math.hypot(point.x - target.x, point.y - target.y)).toBeGreaterThan(0.1);
    }
    expect(distances.size).toBeGreaterThan(5);
  });
});

describe('the projection never asks about a cell off the map', () => {
  function shotAt(x: number, y: number): ProjectileState {
    return {
      id: 1, attackerId: 1, attackerOwner: 1, attackerUnitType: 'archer',
      targetId: 2, targetKind: 'unit',
      originX: x, originY: y, aimX: x, aimY: y,
      launchTick: 0, impactTick: 10,
      baseDamage: 4, buildingDamage: null, attackType: 'pierce',
      willHit: false, isArea: false,
    };
  }

  // The engine's own contract: an out-of-range coordinate throws rather than
  // answering false. Anything that asks has to check first.
  const strictIsVisible = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) {
      throw new Error(`Grid coordinate (${x}, ${y}) is out of bounds`);
    }
    return true;
  };

  it('omits a shot that is off the map instead of throwing', () => {
    for (const off of [shotAt(33, -1), shotAt(-1, 10), shotAt(MAP_WIDTH, 5), shotAt(5, MAP_HEIGHT)]) {
      expect(() => visibleProjectiles([off], 5, strictIsVisible, MAP)).not.toThrow();
      expect(visibleProjectiles([off], 5, strictIsVisible, MAP)).toEqual([]);
    }
  });

  it('still shows a shot that is on the map', () => {
    expect(visibleProjectiles([shotAt(10, 10)], 5, strictIsVisible, MAP)).toHaveLength(1);
  });
});
