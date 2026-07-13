import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  animateUnitParts,
  phaseForUnitIdentity,
  type AoeUnitAnimationState,
} from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';
import { makePartBatches } from '../../src/rendering/voxel/aoeVoxelResources';

function unit(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 7,
    generation: 2,
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

function state(mode: AoeUnitAnimationState['mode']): AoeUnitAnimationState {
  return { mode, phaseRadians: 0.4 };
}

function part(parts: readonly VoxelPart[], suffix: string): VoxelPart {
  const match = parts.find((candidate) => candidate.key.endsWith(`:${suffix}`));
  if (!match) throw new Error(`Missing unit part ${suffix}`);
  return match;
}

describe('AoE voxel unit animation profiles', () => {
  it('derives a stable identity phase without synchronizing distinct units', () => {
    const first = phaseForUnitIdentity('7:2');
    expect(phaseForUnitIdentity('7:2')).toBe(first);
    expect(phaseForUnitIdentity('8:2')).not.toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(Math.PI * 2);
  });

  it('gives moving humanoids opposing limb gait and stronger bob than idle units', () => {
    const base = createUnitParts(unit(), '7:2', 0);
    const idle = animateUnitParts(base, unit(), state('idle'));
    const moving = animateUnitParts(base, unit(), state('moving'));
    const idleTunic = part(idle, 'villager-tunic').animation!;
    const movingTunic = part(moving, 'villager-tunic').animation!;
    const leftLeg = part(moving, 'villager-leg-left').animation!;
    const rightLeg = part(moving, 'villager-leg-right').animation!;
    const leftArm = part(moving, 'villager-arm-left').animation!;

    expect(movingTunic.translationAmplitude.y).toBeGreaterThan(
      idleTunic.translationAmplitude.y,
    );
    expect(Math.abs(leftLeg.rotationAmplitude.x)).toBeGreaterThan(0.2);
    expect(rightLeg.phaseRadians - leftLeg.phaseRadians).toBeCloseTo(Math.PI, 5);
    expect(leftArm.phaseRadians - leftLeg.phaseRadians).toBeCloseTo(Math.PI, 5);
    expect(part(moving, 'unit-shadow').animation).toBeUndefined();
  });

  it('keeps fog-memory units completely static', () => {
    const memory = unit({ isMemory: true });
    const animated = animateUnitParts(
      createUnitParts(memory, '7:memory', 0),
      memory,
      state('moving'),
    );
    expect(animated.every((candidate) => candidate.animation === undefined)).toBe(true);
  });

  it.each([
    ['knight', 'cavalry-horse-leg-front-left', 'cavalry-horse-tail'],
    ['mangonel', 'siege-wheel-left', 'siege-throwing-arm'],
    ['monk', 'monk-sleeve-left', 'monk-staff'],
  ] as const)('animates role-readable %s mechanisms', (entityType, primary, secondary) => {
    const candidate = unit({ entityType });
    const animated = animateUnitParts(
      createUnitParts(candidate, '7:2', 0),
      candidate,
      state('moving'),
    );
    expect(part(animated, primary).animation?.periodMs).toBeGreaterThan(0);
    expect(part(animated, secondary).animation?.periodMs).toBeGreaterThan(0);
  });

  it('packs motion in canonical instance order and omits the lane for static-only parts', () => {
    const candidate = unit();
    const animated = animateUnitParts(
      createUnitParts(candidate, '7:2', 0),
      candidate,
      state('moving'),
    );
    const batches = makePartBatches(animated, 3);
    const matte = batches.find((batch) => batch.key === 'aoe2:batch:matte-parts')!;
    expect(matte.animation?.periodsMs).toHaveLength(matte.instanceKeys.length);
    expect([...matte.animation!.periodsMs].filter((period) => period > 0).length)
      .toBeGreaterThan(8);

    const staticPart: VoxelPart = {
      key: 'static:one',
      surface: 'matte',
      tint: 0xffffff,
      centerX: 0,
      centerY: 0,
      centerZ: 0,
      width: 1,
      height: 1,
      depth: 1,
    };
    expect(makePartBatches([staticPart], 1)[0]?.animation).toBeUndefined();
  });
});
