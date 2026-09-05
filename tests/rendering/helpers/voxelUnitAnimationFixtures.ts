// Shared fixtures for the AoE voxel unit animation suites.
//
// Split out of `tests/rendering/aoeVoxelUnitAnimation.test.ts` on 2026-09-05:
// that file sat at exactly the 500-line hard cap, so its cases were split by
// role into `aoeVoxelUnitAnimation.test.ts` (locomotion sampling) and
// `aoeVoxelUnitAnimationChannels.test.ts` (baked locomotion vs the independent
// ambient and attack channels). Both halves build the same projections and
// states, so the builders live here instead of being duplicated.
//
// Deliberately NOT a `*.test.ts` file: vitest's `include` is
// `tests/**/*.test.ts`, so this module is imported by the suites and never
// collected as one itself.

import type { ProjectedEntityView } from '../../../src/game/simulation/types';
import type { AoeUnitAnimationState } from '../../../src/rendering/voxel/aoeVoxelUnitAnimation';
import type { VoxelPart } from '../../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { matrixForPart } from '../../../src/rendering/voxel/aoeVoxelRecipeTypes';

export function unit(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
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

export function forwardRadians(from: number, to: number): number {
  const tau = Math.PI * 2;
  return ((to - from) % tau + tau) % tau;
}

export function signedAngleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function movingState(
  overrides: Partial<AoeUnitAnimationState> = {},
): AoeUnitAnimationState {
  return {
    mode: 'moving',
    phaseRadians: 0.4,
    gaitPhaseRadians: Math.PI / 2,
    locomotionWeight: 1,
    speedWorldUnitsPerSecond: 2,
    directionX: 1,
    directionZ: 0,
    attackPhase: 0,
    attackWeight: 0,
    ambientSuppressionWeight: 0,
    workPhase: 0,
    workWeight: 0,
    targetDistance: 0,
    ...overrides,
  };
}

export function part(parts: readonly VoxelPart[], suffix: string): VoxelPart {
  const match = parts.find((candidate) => candidate.key.endsWith(`:${suffix}`));
  if (!match) throw new Error(`Missing unit part ${suffix}`);
  return match;
}

export function maxMatrixDelta(left: VoxelPart, right: VoxelPart): number {
  const leftMatrix = matrixForPart(left);
  const rightMatrix = matrixForPart(right);
  return Math.max(...leftMatrix.map((value, index) => (
    Math.abs(value - rightMatrix[index]!)
  )));
}

export const ORIGIN_HISTORY_FIELDS = {
  x: 0, y: 0, sampleTimeMs: 0,
  anchorX: 0, anchorY: 0, anchorTimeMs: 0,
  youngAnchorX: 0, youngAnchorY: 0, youngAnchorTimeMs: 0,
} as const;
