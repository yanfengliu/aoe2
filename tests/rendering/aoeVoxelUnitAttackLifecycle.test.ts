import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { unitAmbientAnimation } from '../../src/rendering/voxel/aoeVoxelUnitAmbientAnimation';
import { resolveUnitAnimationState } from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';
import { matrixForPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

function unit(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 0,
    y: 0,
    elevation: 0,
    tint: 0x3568c0,
    size: 0.72,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
    ...overrides,
  };
}

function attackEvent(
  tick = 0,
  overrides: Record<string, number> = {},
): ProjectedEntityView['attackAnimation'] {
  return {
    tick,
    sourceX: 0,
    sourceY: 0,
    targetX: 6,
    targetY: 0,
    ...overrides,
  } as ProjectedEntityView['attackAnimation'];
}

function ambientSuppression(state: unknown): number {
  return (state as { ambientSuppressionWeight: number }).ambientSuppressionWeight;
}

describe('AoE voxel unit attack lifecycle', () => {
  it('does not invent a retained strike when a fresh checkpoint opens after the attacker moved', () => {
    const event = attackEvent(0, { cancelTick: 1 });
    const impactEntity = unit({ attackAnimation: event });
    const impact = resolveUnitAnimationState(impactEntity, '7:3', undefined, 0);
    const movedEntity = unit({ y: 0.2, attackAnimation: event });
    const warm = resolveUnitAnimationState(movedEntity, '7:3', impact.history, 200);
    const fresh = resolveUnitAnimationState(movedEntity, '7:3', undefined, 200);

    expect(warm.state.mode).toBe('moving');
    expect(warm.state.attackWeight).toBe(0);
    expect(fresh.state.mode).not.toBe('attacking');
    expect(fresh.state.attackWeight).toBe(0);
    expect(ambientSuppression(fresh.state)).toBeCloseTo(
      ambientSuppression(warm.state),
    );
  });

  it('blends the strike pose into locomotion without a micro-movement snap', () => {
    const event = attackEvent(0, { cancelTick: 1 });
    const source = unit({ attackAnimation: event });
    const impact = resolveUnitAnimationState(source, '7:3', undefined, 99);
    const moved = unit({ x: 0.000_002, attackAnimation: event });
    const handoff = resolveUnitAnimationState(moved, '7:3', impact.history, 100);
    const before = createUnitParts(source, '7:3', 0, impact.state);
    const after = createUnitParts(moved, '7:3', 0, handoff.state);
    const beforeTool = before.find((part) => part.key.endsWith('villager-tool-handle'))!;
    const afterTool = after.find((part) => part.key.endsWith('villager-tool-handle'))!;
    const maxMatrixDelta = Math.max(
      ...matrixForPart(beforeTool).map((value, index) => (
        Math.abs(value - matrixForPart(afterTool)[index]!)
      )),
    );

    expect(handoff.state.mode).toBe('moving');
    expect(handoff.state.attackWeight).toBeGreaterThan(0.99);
    expect(maxMatrixDelta).toBeLessThan(0.01);
  });

  it('never resurrects a movement-cancelled strike after returning to its source', () => {
    const event = attackEvent(0, { cancelTick: 1 });
    const impact = resolveUnitAnimationState(
      unit({ attackAnimation: event }),
      '7:3',
      undefined,
      0,
    );
    const away = resolveUnitAnimationState(
      unit({ x: 0.25, attackAnimation: event }),
      '7:3',
      impact.history,
      150,
    );
    const returned = resolveUnitAnimationState(
      unit({ attackAnimation: event }),
      '7:3',
      away.history,
      200,
    );

    expect(away.state.attackWeight).toBeGreaterThan(0);
    expect(returned.state.attackWeight).toBe(0);
    expect(returned.state.mode).not.toBe('attacking');
  });

  it('uses a deterministic smoothstep handoff across the cancellation tick', () => {
    const entity = unit({ attackAnimation: attackEvent(0, { cancelTick: 1 }) });
    const weights = [100, 125, 150, 175, 200].map((sampleTimeMs) => (
      resolveUnitAnimationState(entity, '7:3', undefined, sampleTimeMs).state.attackWeight
    ));

    expect(weights).toEqual([1, 0.84375, 0.5, 0.15625, 0]);
  });

  it('reconstructs the same moving handoff from a fresh cancellation checkpoint', () => {
    const event = attackEvent(0, { cancelTick: 1, targetX: 0, targetY: 1 });
    const source = unit({ attackAnimation: event });
    const start = resolveUnitAnimationState(source, '7:3', undefined, 100);
    const displayed = unit({ x: 0.2, attackAnimation: event });
    const warm = resolveUnitAnimationState(displayed, '7:3', start.history, 150);
    const fresh = resolveUnitAnimationState(displayed, '7:3', undefined, 150);
    const warmTool = createUnitParts(displayed, '7:3', 0, warm.state)
      .find((part) => part.key.endsWith('villager-tool-head'))!;
    const freshTool = createUnitParts(displayed, '7:3', 0, fresh.state)
      .find((part) => part.key.endsWith('villager-tool-head'))!;

    expect(fresh.state.mode).toBe('moving');
    expect(fresh.state.locomotionWeight).toBeCloseTo(warm.state.locomotionWeight);
    expect(fresh.state.directionX).toBeCloseTo(warm.state.directionX);
    expect(fresh.state.directionZ).toBeCloseTo(warm.state.directionZ);
    expect(fresh.state.attackWeight).toBe(warm.state.attackWeight);
    expect(matrixForPart(freshTool)).toEqual(matrixForPart(warmTool));
  });

  it('makes a retained post-pose checkpoint restore the same attack channel', () => {
    const entity = unit({ attackAnimation: attackEvent() });
    const impact = resolveUnitAnimationState(entity, '7:3', undefined, 0);
    const recovering = resolveUnitAnimationState(entity, '7:3', impact.history, 600);
    const warm = resolveUnitAnimationState(entity, '7:3', recovering.history, 700);
    const fresh = resolveUnitAnimationState(entity, '7:3', undefined, 700);

    expect(warm.state.attackPhase).toBe(fresh.state.attackPhase);
    expect(warm.state.attackWeight).toBe(fresh.state.attackWeight);
    expect(warm.state.directionX).toBeCloseTo(fresh.state.directionX);
    expect(warm.state.directionZ).toBeCloseTo(fresh.state.directionZ);
    expect(ambientSuppression(warm.state)).toBeCloseTo(
      ambientSuppression(fresh.state),
    );
    expect(warm.state.attackWeight).toBe(0);
    expect(ambientSuppression(warm.state)).toBeGreaterThan(0);
  });

  it('hands attack-controlled ambient motion back continuously', () => {
    const rotationAt = (ambientSuppressionWeight: number): number => {
      const animation = unitAmbientAnimation(
        'siege-throwing-arm',
        'siege',
        { phaseRadians: 0, attackWeight: 0, ambientSuppressionWeight } as never,
        1,
      );
      expect(animation).toBeDefined();
      return animation!.rotationAmplitude.z;
    };

    expect(rotationAt(1)).toBe(0);
    expect(rotationAt(0.5)).toBeCloseTo(0.09);
    expect(rotationAt(0)).toBeCloseTo(0.18);
    expect(rotationAt(0.001)).toBeCloseTo(0.18 * 0.999);
  });
});
