// A shot that destroys a building reports it, so the projectile system
// refreshes sight that same pass (2026-09-24, found by the review of the
// building-sight change). Every building sees since that change, and
// `resolveDueProjectiles` returned true only for a unit killed: a building an
// arrow or a stone destroyed kept its owner's sight until the next sync, in
// which the output phase, the attack-cue suppression and the next tick's AI
// read the dead building's circle.
//
// BOUND: the contract of the pass's return value. That the system refreshes
// on it is one line (`projectileSystem.ts`, `if (somethingDied)`).

import { describe, expect, it } from 'vitest';

import { resolveDueProjectiles } from '../../src/game/simulation/bridge/projectileOps';
import { createEmptyProjectileSlot } from '../../src/game/simulation/bridge/projectileTypes';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';

function passAgainstABuilding(destroys: boolean): boolean {
  const slot = createEmptyProjectileSlot();
  slot.inFlight.push({
    id: 1, attackerId: 1, attackerOwner: 2, attackerUnitType: 'archer',
    targetId: 9, targetKind: 'building',
    originX: 0, originY: 10, aimX: 10, aimY: 10,
    launchTick: 0, impactTick: 5,
    baseDamage: 4, buildingDamage: 4, attackType: 'pierce',
    willHit: true, isArea: false,
  });
  const world = { getComponent: () => undefined, query: () => [] } as unknown as GameWorld;
  return resolveDueProjectiles({
    world, slot, tick: 5,
    combatStates: new Map(),
    teams: new Map(),
    animals: { states: new Map(), kill: () => {}, markDirty: () => {} },
    technologiesFor: () => new Set(),
    damageBuilding: () => destroys,
    destroyUnit: () => {},
    addKill: () => {},
    markCombatDirty: () => {},
    markRender: () => {},
    recordPlayerHit: () => {},
  });
}

describe('resolveDueProjectiles', () => {
  it('reports a building a shot destroys, so sight is refreshed that pass', () => {
    expect(passAgainstABuilding(true)).toBe(true);
  });

  it('reports nothing when the building survives the shot', () => {
    expect(passAgainstABuilding(false)).toBe(false);
  });
});
