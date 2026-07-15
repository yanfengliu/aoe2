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

  it('holds a boar facing across later snapshots that carry no strike', () => {
    // The reported bug: the boar turned back and forth. Facing was weighted by
    // the decaying gore pose, so it rotated home between bites. It must now
    // persist across snapshots exactly like unit gait history — and reset on
    // bridge swap, since it is disposable render state.
    const adapter = new AoeVoxelAdapter();
    const boar = view({
      id: 90,
      generation: 2,
      kind: 'resource',
      layer: 'resource',
      entityType: 'boar',
      x: 12,
      y: 8,
      tint: 0x6b4a2f,
      size: 0.9,
      currentHp: 69,
      maxHp: 75,
    });
    const striking = {
      ...boar,
      attackAnimation: { tick: 0, sourceX: 12, sourceY: 8, targetX: 11, targetY: 8 },
    } as ProjectedEntityView;

    const headX = (snapshot: ReturnType<AoeVoxelAdapter['createSnapshot']>): number => {
      const batch = snapshot.batches.find((candidate) => candidate.instanceKeys
        .some((key) => key.endsWith(':boar-head')))!;
      const index = batch.instanceKeys.findIndex((key) => key.endsWith(':boar-head'));
      return batch.matrices[index * 16 + 12]!;
    };

    const duringGore = headX(adapter.createSnapshot([view(), striking], 50));
    // Long after the strike window: no live attack on this view at all.
    const settled = headX(adapter.createSnapshot([view(), boar], 4_000));
    const rootX = boar.x + 0.5;
    expect(duringGore).toBeLessThan(rootX);
    expect(settled, 'the boar turned back to authored facing after the gore')
      .toBeLessThan(rootX);
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
