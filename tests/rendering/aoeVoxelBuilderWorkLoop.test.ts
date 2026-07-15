// Builder hammer work loop (spec §14.5, user directive 2026-07-14): a
// villager standing at its build site swings its hammer overhead and smashes
// it toward the ground on a repeating loop. Deterministic, pause-frozen
// (equal injected display time = identical pose), presentation-only.

import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import type { AoeUnitAnimationState } from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';
import { matrixForPart, type VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { BUILDER_WORK_PERIOD_MS } from '../../src/rendering/voxel/aoeVoxelBuilderWorkPose';

function builder(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 4,
    y: 5,
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

function state(overrides: Partial<Record<string, unknown>> = {}): AoeUnitAnimationState {
  return {
    mode: 'idle',
    phaseRadians: 0,
    gaitPhaseRadians: 0,
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: 1,
    directionZ: 0,
    attackPhase: 0,
    attackWeight: 0,
    ambientSuppressionWeight: 0,
    workPhase: 0,
    workWeight: 0,
    ...overrides,
  } as unknown as AoeUnitAnimationState;
}

function partsAt(workPhase: number, workWeight = 1): VoxelPart[] {
  return createUnitParts(
    builder({ activeVerb: 'building' }),
    '7:3',
    0,
    state({ workPhase, workWeight }),
  );
}

function part(parts: readonly VoxelPart[], suffix: string): VoxelPart {
  const match = parts.find((candidate) => candidate.key.endsWith(`:${suffix}`));
  if (!match) throw new Error(`Missing part ${suffix}`);
  return match;
}

function toolHeight(workPhase: number): number {
  return part(partsAt(workPhase), 'villager-tool-head').centerY;
}

function sameMatrix(left: VoxelPart, right: VoxelPart): boolean {
  const a = matrixForPart(left);
  const b = matrixForPart(right);
  return a.every((value, index) => Math.abs(value - b[index]!) < 1e-9);
}

describe('builder hammer work loop (spec §14.5)', () => {
  it('raises the hammer overhead and smashes it down across the loop', () => {
    const raised = toolHeight(0.25);
    const smashed = toolHeight(0.62);
    expect(raised - smashed, 'the hammer must travel a readable arc')
      .toBeGreaterThan(0.35);
    // The smash drives toward the ground, not through the villager's head.
    expect(smashed).toBeLessThan(toolHeight(0));
  });

  it('keeps roots, boots, and the contact shadow planted through the swing', () => {
    const rest = partsAt(0, 0);
    for (const suffix of ['villager-boot-left', 'villager-boot-right', 'unit-shadow']) {
      for (const phase of [0.25, 0.5, 0.62, 0.9]) {
        expect(
          sameMatrix(part(partsAt(phase), suffix), part(rest, suffix)),
          `${suffix} must not move at phase ${String(phase)}`,
        ).toBe(true);
      }
    }
  });

  it('is a closed loop: phase 0 and phase 1 are the same pose', () => {
    for (const p of partsAt(0)) {
      expect(sameMatrix(p, part(partsAt(1), p.key.split(':').pop()!))).toBe(true);
    }
  });

  it('freezes at equal display time and is deterministic', () => {
    expect(partsAt(0.4)).toEqual(partsAt(0.4));
  });

  it('does nothing at zero weight (not building, or blending out)', () => {
    expect(partsAt(0.5, 0)).toEqual(createUnitParts(builder(), '7:3', 0, state()));
  });

  it('exposes a loop period long enough to read at default zoom', () => {
    expect(BUILDER_WORK_PERIOD_MS).toBeGreaterThanOrEqual(600);
    expect(BUILDER_WORK_PERIOD_MS).toBeLessThanOrEqual(1400);
  });
});
