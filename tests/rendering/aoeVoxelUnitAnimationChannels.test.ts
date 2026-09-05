// Animation CHANNELS: what a unit's parts get on top of baked locomotion.
//
// This half holds the cases that assert the separation between geometry baked
// straight into a part (a horse leg's pitch, a wheel's roll, the gait pose) and
// the independent channels layered over it — the role-readable ambient
// mechanisms, and the attack/strike blend that has to override, freeze, or blend
// out against locomotion. Its sibling `aoeVoxelUnitAnimation.test.ts` holds the
// locomotion sampling itself (gait phase, direction, speed, determinism).
//
// Split out of `aoeVoxelUnitAnimation.test.ts` on 2026-09-05, when that file hit
// the 500-line hard cap enforced by `tests/architecture/fileSizeBudget.test.ts`.
// Pure structural split — every case moved verbatim. Shared builders live in
// `./helpers/voxelUnitAnimationFixtures`.

import { describe, expect, it } from 'vitest';

import { resolveUnitAnimationState } from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { matrixForPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';
import {
  maxMatrixDelta,
  movingState,
  part,
  unit,
} from './helpers/voxelUnitAnimationFixtures';

describe('AoE voxel unit animation channels', () => {
  it('separates baked locomotion from role-readable ambient mechanisms', () => {
    const cavalry = createUnitParts(
      unit({ entityType: 'knight' }), '7:3', 0, movingState(),
    );
    expect(part(cavalry, 'cavalry-horse-leg-front-left').animation).toBeUndefined();
    expect(part(cavalry, 'cavalry-horse-leg-front-left').pitch).not.toBe(0);
    expect(part(cavalry, 'cavalry-horse-tail').animation?.periodMs).toBe(780);

    const siege = createUnitParts(
      unit({ entityType: 'mangonel' }), '7:3', 0, movingState(),
    );
    expect(part(siege, 'siege-wheel-left').animation).toBeUndefined();
    expect(part(siege, 'siege-wheel-left').pitch).not.toBe(0);
    expect(part(siege, 'siege-throwing-arm').animation?.periodMs).toBe(1_200);

    const monk = createUnitParts(unit({ entityType: 'monk' }), '7:3', 0, movingState());
    expect(part(monk, 'monk-sleeve-left').animation?.periodMs).toBe(1_100);
    expect(part(monk, 'monk-staff').animation?.periodMs).toBe(1_500);
  });

  it('freezes the last locomotion pose while a stationary strike recovers', () => {
    const initial = resolveUnitAnimationState(unit(), '7:3', undefined, 0);
    const moving = resolveUnitAnimationState(
      unit({ x: 0.2 }), '7:3', initial.history, 100,
    );
    const attacker = unit({
      x: 0.2,
      attackAnimation: {
        tick: 2,
        sourceX: 0.2,
        sourceY: 0,
        targetX: 0.2 + moving.state.directionX,
        targetY: moving.state.directionZ,
      },
    });
    const impact = resolveUnitAnimationState(attacker, '7:3', moving.history, 200);
    const recovery = resolveUnitAnimationState(attacker, '7:3', impact.history, 300);

    expect(impact.state.mode).toBe('attacking');
    expect(recovery.state.mode).toBe('attacking');
    expect(impact.state.locomotionWeight).toBe(moving.state.locomotionWeight);
    expect(recovery.state.locomotionWeight).toBe(moving.state.locomotionWeight);
    expect(matrixForPart(part(
      createUnitParts(attacker, '7:3', 0, impact.state),
      'villager-boot-left',
    ))).toEqual(matrixForPart(part(
      createUnitParts(attacker, '7:3', 0, recovery.state),
      'villager-boot-left',
    )));
  });

  it('makes the attack channel identical for warm and fresh impact history', () => {
    const identity = '7:3';
    const attacker = unit({
      attackAnimation: { tick: 2, sourceX: 0, sourceY: 0, targetX: 6, targetY: 0 },
    });
    const idle = resolveUnitAnimationState(unit(), identity, undefined, 550 / 3);
    const warmImpact = resolveUnitAnimationState(attacker, identity, idle.history, 200);
    const freshImpact = resolveUnitAnimationState(attacker, identity, undefined, 200);
    const warmRecovery = resolveUnitAnimationState(
      attacker, identity, warmImpact.history, 300,
    );
    const freshRecovery = resolveUnitAnimationState(attacker, identity, undefined, 300);

    for (const [warm, fresh] of [
      [warmImpact, freshImpact],
      [warmRecovery, freshRecovery],
    ] as const) {
      expect(warm.state.attackPhase).toBeCloseTo(fresh.state.attackPhase);
      expect(warm.state.attackWeight).toBe(1);
      expect(warm.state.attackWeight).toBe(fresh.state.attackWeight);
      expect(warm.state.directionX).toBeCloseTo(fresh.state.directionX);
      expect(warm.state.directionZ).toBeCloseTo(fresh.state.directionZ);
      expect(matrixForPart(part(
        createUnitParts(attacker, identity, 0, warm.state),
        'villager-tool-head',
      ))).toEqual(matrixForPart(part(
        createUnitParts(attacker, identity, 0, fresh.state),
        'villager-tool-head',
      )));
    }
  });

  it('isolates fresh-history geometry differences to disposable gait history', () => {
    const identity = '7:3';
    const initial = resolveUnitAnimationState(unit(), identity, undefined, 0);
    const moving = resolveUnitAnimationState(
      unit({ x: 0.2 }), identity, initial.history, 100,
    );
    const attacker = unit({
      x: 0.2,
      attackAnimation: {
        tick: 2,
        sourceX: 0.2,
        sourceY: 0,
        targetX: 0.2 + moving.state.directionX,
        targetY: moving.state.directionZ,
      },
    });
    const warm = resolveUnitAnimationState(attacker, identity, moving.history, 200);
    const fresh = resolveUnitAnimationState(attacker, identity, undefined, 200);
    const warmParts = createUnitParts(attacker, identity, 0, warm.state);
    const freshParts = createUnitParts(attacker, identity, 0, fresh.state);
    const withoutGaitHistory = createUnitParts(attacker, identity, 0, {
      ...warm.state,
      gaitPhaseRadians: fresh.state.gaitPhaseRadians,
      locomotionWeight: fresh.state.locomotionWeight,
    });

    expect(warm.state.attackPhase).toBeCloseTo(fresh.state.attackPhase);
    expect(warm.state.attackWeight).toBe(fresh.state.attackWeight);
    expect(warm.state.directionX).toBeCloseTo(fresh.state.directionX);
    expect(warm.state.directionZ).toBeCloseTo(fresh.state.directionZ);
    expect(maxMatrixDelta(
      part(warmParts, 'villager-tool-head'),
      part(freshParts, 'villager-tool-head'),
    )).toBeGreaterThan(0.001);
    expect(maxMatrixDelta(
      part(warmParts, 'villager-boot-left'),
      part(freshParts, 'villager-boot-left'),
    )).toBeGreaterThan(0.001);
    expect(matrixForPart(part(
      withoutGaitHistory, 'villager-tool-head',
    ))).toEqual(matrixForPart(part(
      freshParts, 'villager-tool-head',
    )));
  });

  it('keeps movement authoritative while the strike pose blends out', () => {
    const attacker = unit({
      attackAnimation: {
        tick: 0, cancelTick: 1, sourceX: 0, sourceY: 0, targetX: 1, targetY: 0,
      },
    });
    const impact = resolveUnitAnimationState(attacker, '7:3', undefined, 0);
    const moving = resolveUnitAnimationState(
      unit({ ...attacker, x: 0.2 }),
      '7:3',
      impact.history,
      150,
    );
    const withoutAttack = { ...moving.state, attackWeight: 0 };

    expect(moving.state.mode).toBe('moving');
    expect(moving.state.attackWeight).toBe(0.5);
    expect(matrixForPart(part(
      createUnitParts(unit({ ...attacker, x: 0.2 }), '7:3', 0, moving.state),
      'villager-tool-head',
    ))).not.toEqual(matrixForPart(part(
      createUnitParts(unit({ ...attacker, x: 0.2 }), '7:3', 0, withoutAttack),
      'villager-tool-head',
    )));
  });
});
