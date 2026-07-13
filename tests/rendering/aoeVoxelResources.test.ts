import { describe, expect, it } from 'vitest';
import { MAX_ACTIVE_INSTANCE_ANIMATIONS_V1 } from 'voxel/core';

import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { makePartBatches } from '../../src/rendering/voxel/aoeVoxelResources';

function part(
  key: string,
  animated: boolean,
  surface: VoxelPart['surface'] = 'matte',
): VoxelPart {
  return {
    key,
    surface,
    tint: 0xffffff,
    centerX: 0,
    centerY: 0.5,
    centerZ: 0,
    width: 1,
    height: 1,
    depth: 1,
    ...(animated ? {
      animation: {
        periodMs: 1_000,
        phaseRadians: 0,
        translationAmplitude: { x: 0, y: 0.1, z: 0 },
        rotationAmplitude: { x: 0, y: 0, z: 0 },
        scaleAmplitude: { x: 0, y: 0, z: 0 },
      },
    } : {}),
  };
}

describe('AoE voxel instance batch lanes', () => {
  it('keeps large static populations out of the animated-batch slot ceiling', () => {
    const staticParts = Array.from({ length: 16_385 }, (_, index) => (
      part(`static:${String(index)}:part`, false)
    ));
    const batches = makePartBatches([...staticParts, part('unit:1:body', true)], 1);
    const staticBatch = batches.find((batch) => batch.key === 'aoe2:batch:matte-parts')!;
    const animatedBatch = batches.find(
      (batch) => batch.key === 'aoe2:batch:matte-animated-parts',
    )!;

    expect(staticBatch.instanceKeys).toHaveLength(16_385);
    expect(staticBatch.animation).toBeUndefined();
    expect(animatedBatch.instanceKeys).toEqual(['unit:1:body']);
    expect(animatedBatch.animation?.periodsMs[0]).toBe(1_000);
  });

  it('degrades whole overflow identities to static poses at the active-animation budget', () => {
    const parts = Array.from({ length: MAX_ACTIVE_INSTANCE_ANIMATIONS_V1 + 1 }, (_, index) => (
      part(`unit:${String(index)}:body`, true)
    ));
    const batches = makePartBatches(parts, 1);
    const animated = batches.find(
      (batch) => batch.key === 'aoe2:batch:matte-animated-parts',
    )!;
    const staticBatch = batches.find((batch) => batch.key === 'aoe2:batch:matte-parts')!;

    expect(animated.instanceKeys).toHaveLength(MAX_ACTIVE_INSTANCE_ANIMATIONS_V1);
    expect(staticBatch.instanceKeys).toHaveLength(1);
    expect(staticBatch.animation).toBeUndefined();
  });

  it('admits cutoff identities all-or-none in canonical order', () => {
    const admitted = Array.from(
      { length: MAX_ACTIVE_INSTANCE_ANIMATIONS_V1 - 1 },
      (_, index) => part(`unit:${String(index).padStart(4, '0')}:body`, true),
    );
    const cutoff = [
      part('unit:zzzz:body', true),
      part('unit:zzzz:tool', true),
    ];
    const input = [...admitted, ...cutoff];
    const forward = makePartBatches(input, 1);
    const reversed = makePartBatches([...input].reverse(), 1);
    const animated = forward.find(
      (batch) => batch.key === 'aoe2:batch:matte-animated-parts',
    )!;
    const staticBatch = forward.find((batch) => batch.key === 'aoe2:batch:matte-parts')!;

    expect(animated.instanceKeys).toHaveLength(MAX_ACTIVE_INSTANCE_ANIMATIONS_V1 - 1);
    expect(staticBatch.instanceKeys).toEqual(['unit:zzzz:body', 'unit:zzzz:tool']);
    expect(reversed.map((batch) => batch.instanceKeys)).toEqual(
      forward.map((batch) => batch.instanceKeys),
    );
  });

  it('degrades animation on unsupported shadow and memory surfaces without dropping parts', () => {
    const batches = makePartBatches([
      part('unit:1:shadow', true, 'shadow'),
      part('memory:unit:1:body', true, 'memory'),
    ], 1);
    const shadow = batches.find((batch) => batch.key === 'aoe2:batch:shadow-parts')!;
    const memory = batches.find((batch) => batch.key === 'aoe2:batch:memory-parts')!;

    expect(shadow.instanceKeys).toEqual(['unit:1:shadow']);
    expect(shadow.animation).toBeUndefined();
    expect(memory.instanceKeys).toEqual(['memory:unit:1:body']);
    expect(memory.animation).toBeUndefined();
  });
});
