import { describe, expect, it } from 'vitest';

import {
  applyUnitBlast,
  computeBlastDamage,
  type BlastCandidate,
} from '../../src/game/simulation/bridge/blastDamage';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { CombatState } from '../../src/game/simulation/bridge/systems/systemTypes';

// Blast/splash (spec §10.7): the pure damage-selection core. A mangonel's blast
// radius is 1 (Euclidean), so it reaches the four ORTHOGONAL neighbours of the
// impact cell (distance 1) but NOT diagonals (√2 ≈ 1.41). Splash damage uses the
// same melee/pierce + class-bonus + armor formula as the primary hit.

const c = (id: number, unitType: BlastCandidate['unitType'], x: number, y: number, armor = 0): BlastCandidate => ({
  id,
  unitType,
  position: { x, y },
  armor,
});

describe('computeBlastDamage — mangonel-line splash', () => {
  const impact = { x: 10, y: 10 };

  it('hits orthogonal neighbours (not diagonals), excludes the attacker + primary, sorted by id', () => {
    const candidates = [
      c(5, 'spearman', 10, 11), // dist 1 — IN
      c(3, 'militia', 11, 10), // dist 1 — IN (pierce armor 1)
      c(8, 'spearman', 11, 11), // dist √2 — OUT
      c(2, 'knight', 10, 10), // the primary target — EXCLUDED
      c(9, 'spearman', 9, 10), // the attacker's cell — EXCLUDED
    ];
    // Mangonel base 40 PIERCE; no anti-infantry bonus. Spearman pierce armor 0
    // → 40; Militia pierce armor 1 → 39.
    const result = computeBlastDamage('mangonel', 40, impact, candidates, new Set([2, 9]));
    expect(result).toEqual([
      { id: 3, damage: 39 },
      { id: 5, damage: 40 },
    ]);
  });

  it('is a no-op for a non-blast attacker', () => {
    const candidates = [c(5, 'spearman', 10, 11)];
    expect(computeBlastDamage('knight', 8, impact, candidates, new Set())).toEqual([]);
    expect(computeBlastDamage('archer', 6, impact, candidates, new Set())).toEqual([]);
  });

  it('floors a splashed hit at 1 damage', () => {
    // A ram has 180 pierce armor; mangonel base 40 pierce → floored to 1.
    const result = computeBlastDamage('mangonel', 40, impact, [c(4, 'battering-ram', 10, 11)], new Set());
    expect(result).toEqual([{ id: 4, damage: 1 }]);
  });

  it('is owner-agnostic (friendly fire) — the caller decides scoring', () => {
    // computeBlastDamage returns every in-radius unit regardless of owner; the
    // BlastCandidate carries no owner, so friendly units are included here.
    const result = computeBlastDamage('mangonel', 40, impact, [c(7, 'villager', 10, 9)], new Set());
    expect(result).toEqual([{ id: 7, damage: 40 }]);
  });
});

describe('applyUnitBlast — scoring + friendly fire', () => {
  const combat = (hp: number): CombatState => ({
    currentHp: hp,
    maxHp: hp,
    attackDamage: 0,
    attackRange: 1,
    reloadTicks: 20,
    cooldownTicks: 0,
    armor: 0,
  });

  it('credits an enemy blast-kill but NOT a friendly-fire kill', () => {
    // Enemy (owner 2) + friendly (owner 1), both adjacent and at 5 HP, both
    // killed by a mangonel's 40 base blast. Only the enemy kill scores.
    const units: Record<number, { unitType: string; owner: number; position: { x: number; y: number } }> = {
      2: { unitType: 'militia', owner: 2, position: { x: 10, y: 11 } }, // enemy, dist 1
      3: { unitType: 'villager', owner: 1, position: { x: 11, y: 10 } }, // friendly, dist 1
    };
    const combatStates = new Map<number, CombatState>([
      [2, combat(5)],
      [3, combat(5)],
    ]);
    const fakeWorld = {
      query: () => [2, 3][Symbol.iterator](),
      getComponent: (id: number, key: string) =>
        key === 'unit' ? { unitType: units[id].unitType, owner: units[id].owner } : units[id].position,
    } as unknown as GameWorld;

    const kills: number[] = [];
    const destroyed: number[] = [];
    applyUnitBlast({
      world: fakeWorld,
      combatStates,
      attacker: { id: 99, unitType: 'mangonel', owner: 1, baseDamage: 40 },
      impact: { x: 10, y: 10 },
      primaryTargetId: 0,
      destroyUnit: (id) => destroyed.push(id),
      addKill: (owner) => kills.push(owner),
      markDirty: () => {},
    });

    expect(destroyed.sort((a, b) => a - b)).toEqual([2, 3]); // both die
    expect(kills).toEqual([1]); // ONLY the enemy kill scores, credited to owner 1
  });
});
