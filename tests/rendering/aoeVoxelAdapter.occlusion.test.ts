import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';

function view(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 1,
    generation: 0,
    kind: 'tile',
    layer: 'terrain',
    entityType: 'grass',
    owner: null,
    x: 0,
    y: 0,
    elevation: 0,
    tint: 0x587f4e,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
    ...overrides,
  };
}

const townCenter = (overrides: Partial<ProjectedEntityView> = {}) => view({
  id: 20,
  generation: 1,
  kind: 'building',
  layer: 'building',
  entityType: 'town-center',
  owner: 2,
  x: 8,
  y: 8,
  tint: 0xcc3333,
  footprintWidth: 4,
  footprintHeight: 4,
  currentHp: 2400,
  maxHp: 2400,
  ...overrides,
});

const hiddenVillager = view({
  id: 7,
  generation: 3,
  kind: 'unit',
  layer: 'unit',
  entityType: 'villager',
  owner: 1,
  x: 7,
  y: 7,
  tint: 0x3f6fd0,
  size: 0.8,
  currentHp: 25,
  maxHp: 25,
});

describe('AoeVoxelAdapter occlusion silhouettes', () => {
  it('emits white silhouette instances for units behind buildings without adding batches', () => {
    const adapter = new AoeVoxelAdapter();
    const snapshot = adapter.createSnapshot([view(), hiddenVillager, townCenter()], 1_000);

    const keys = snapshot.batches.flatMap((batch) => batch.instanceKeys);
    const occlusionKeys = keys.filter((key) => key.startsWith('ui:occlusion:7:3:'));
    expect(occlusionKeys.length).toBeGreaterThan(0);

    const uiBatch = snapshot.batches.find((batch) => batch.key === 'aoe2:batch:ui-parts');
    expect(uiBatch).toBeDefined();
    expect(occlusionKeys.every((key) => uiBatch!.instanceKeys.includes(key))).toBe(true);

    expect(snapshot.batches.length).toBeLessThanOrEqual(7);
    expect(adapter.latestOccludedUnits()).toEqual([
      { id: 7, x: 7, y: 7, entityType: 'villager' },
    ]);
  });

  it('clears the retained occluded list on bridge swap (review iter-1)', () => {
    const adapter = new AoeVoxelAdapter();
    adapter.createSnapshot([view(), hiddenVillager, townCenter()], 1_000);
    expect(adapter.latestOccludedUnits()).toHaveLength(1);
    adapter.resetForBridgeSwap();
    expect(adapter.latestOccludedUnits()).toEqual([]);
  });

  it('emits nothing for memory-ghost buildings and clears retained state', () => {
    const adapter = new AoeVoxelAdapter();
    const covered = adapter.createSnapshot([view(), hiddenVillager, townCenter()], 1_000);
    expect(covered.batches.flatMap((b) => b.instanceKeys)
      .some((key) => key.startsWith('ui:occlusion:'))).toBe(true);

    const ghosted = adapter.createSnapshot(
      [view(), hiddenVillager, townCenter({ isMemory: true })],
      1_100,
    );
    expect(ghosted.batches.flatMap((b) => b.instanceKeys)
      .some((key) => key.startsWith('ui:occlusion:'))).toBe(false);
    expect(adapter.latestOccludedUnits()).toEqual([]);
  });
});
