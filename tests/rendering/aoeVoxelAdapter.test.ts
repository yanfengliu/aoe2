import { describe, expect, it } from 'vitest';
import { validateAndCopySnapshotV1 } from 'voxel/core';
import { DensePaletteChunk, meshVisibleFaces } from 'voxel/meshing';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  AOE_TERRAIN_CHUNK_SIZE,
  AoeVoxelAdapter,
} from '../../src/rendering/voxel/aoeVoxelAdapter';

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

function terrain(
  id: number,
  x: number,
  y: number,
  overrides: Partial<ProjectedEntityView> = {},
): ProjectedEntityView {
  return view({ id, x, y, ...overrides });
}

function chunkSampler(chunks: ReturnType<AoeVoxelAdapter['createSnapshot']>['chunks']) {
  const records = chunks.map((resource) => ({
    resource,
    chunk: new DensePaletteChunk({
      origin: resource.origin,
      size: resource.size,
      voxels: resource.voxels,
    }),
  }));

  return {
    records,
    sample(worldX: number, worldY: number, worldZ: number): number | undefined {
      for (const { chunk } of records) {
        const localX = worldX - chunk.origin.x;
        const localY = worldY - chunk.origin.y;
        const localZ = worldZ - chunk.origin.z;
        if (chunk.containsLocal(localX, localY, localZ)) {
          return chunk.getLocal(localX, localY, localZ);
        }
      }
      return undefined;
    },
  };
}

describe('AoeVoxelAdapter terrain projection', () => {
  it('builds flat palette-indexed 16-cell chunks while the composed host retains ground-plane input', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      terrain(1, 0, 0, { tint: 0x112233 }),
      terrain(2, AOE_TERRAIN_CHUNK_SIZE - 1, 0, { tint: 0x445566 }),
      terrain(3, AOE_TERRAIN_CHUNK_SIZE, 0, {
        entityType: 'hill',
        elevation: 1,
        tint: 0x778899,
      }),
    ]);

    expect(snapshot.chunks).toHaveLength(2);
    const left = snapshot.chunks.find((chunk) => chunk.origin.x === 0);
    const right = snapshot.chunks.find(
      (chunk) => chunk.origin.x === AOE_TERRAIN_CHUNK_SIZE,
    );
    expect(left?.origin).toEqual({ x: 0, y: -1, z: 0 });
    expect(left?.size).toEqual({ x: 16, y: 1, z: 16 });
    expect(right?.origin).toEqual({ x: 16, y: -1, z: 0 });
    expect(right?.size).toEqual({ x: 16, y: 1, z: 16 });

    const palette = snapshot.resources.find((resource) => resource.kind === 'palette');
    expect(palette?.entries.map((entry) => entry.color)).toEqual([
      { r: 0, g: 0, b: 0, a: 0 },
      { r: 0x11, g: 0x22, b: 0x33, a: 255 },
      { r: 0x44, g: 0x55, b: 0x66, a: 255 },
      { r: 0x77, g: 0x88, b: 0x99, a: 255 },
    ]);

    const rightChunk = new DensePaletteChunk({
      origin: right!.origin,
      size: right!.size,
      voxels: right!.voxels,
    });
    expect(rightChunk.getLocal(0, 0, 0)).toBe(3);
  });

  it('allows the mesher to cull a shared face across a chunk boundary', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      terrain(1, AOE_TERRAIN_CHUNK_SIZE - 1, 0),
      terrain(2, AOE_TERRAIN_CHUNK_SIZE, 0),
    ]);
    const { records, sample } = chunkSampler(snapshot.chunks);
    const faces = records.reduce(
      (sum, { chunk }) => sum + meshVisibleFaces(chunk, { sampleNeighbor: sample }).faceCount,
      0,
    );

    expect(faces).toBe(10);
  });

  it('uses floor-based chunks for negative cells and culls cross-boundary seams', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      terrain(1, -1, -1),
      terrain(2, 0, -1, { elevation: 1, entityType: 'hill' }),
    ]);
    expect(snapshot.chunks.map((chunk) => chunk.origin)).toEqual([
      { x: -16, y: -1, z: -16 },
      { x: 0, y: -1, z: -16 },
    ]);
    const { records, sample } = chunkSampler(snapshot.chunks);
    const faces = records.reduce(
      (sum, { chunk }) => sum + meshVisibleFaces(chunk, { sampleNeighbor: sample }).faceCount,
      0,
    );
    expect(faces).toBe(10);
  });
});

describe('AoeVoxelAdapter instance projection', () => {
  it('uses generation-aware keys and emits recognisable block archetype parts', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      terrain(1, 0, 0),
      view({
        id: 7,
        generation: 3,
        kind: 'unit',
        layer: 'unit',
        entityType: 'villager',
        owner: 1,
        x: 2,
        y: 3,
        size: 0.7,
        tint: 0x3366cc,
      }),
      view({
        id: 8,
        generation: 2,
        kind: 'resource',
        layer: 'resource',
        entityType: 'tree',
        x: 4,
        y: 5,
        size: 0.58,
        tint: 0x2f5e34,
      }),
      view({
        id: 9,
        generation: undefined,
        kind: 'building',
        layer: 'building',
        entityType: 'house',
        owner: 2,
        x: 6,
        y: 7,
        footprintWidth: 2,
        footprintHeight: 2,
        visualVariant: 'complete',
        isMemory: true,
        tint: 0x9b5b45,
      }),
    ]);

    expect(snapshot.batches).toHaveLength(1);
    const keys = snapshot.batches[0]!.instanceKeys;
    expect(keys).toEqual(expect.arrayContaining([
      '7:3:unit-body',
      '7:3:unit-head',
      '8:2:tree-trunk',
      '8:2:tree-crown',
      '9:memory:building-base',
      '9:memory:building-roof',
    ]));
    expect(new Set(keys).size).toBe(keys.length);
    expect(snapshot.batches[0]!.matrices).toHaveLength(keys.length * 16);
    expect(snapshot.batches[0]!.colors).toHaveLength(keys.length * 4);
    const partsMaterial = snapshot.resources.find(
      (resource) => resource.kind === 'material' && resource.key.endsWith(':parts'),
    );
    expect(partsMaterial).toMatchObject({ vertexColors: false });
    const cube = snapshot.resources.find((resource) => resource.kind === 'geometry')!;
    expect(cube.pivot).toEqual({ x: 0, y: 0, z: 0 });
    const bodyMatrix = snapshot.batches[0]!.matrices.slice(
      keys.indexOf('7:3:unit-body') * 16,
      keys.indexOf('7:3:unit-body') * 16 + 16,
    );
    expect(bodyMatrix[12]).toBeCloseTo(2.332);
    expect(bodyMatrix[14]).toBeCloseTo(3.367);
    const memoryBase = keys.indexOf('9:memory:building-base');
    const memoryColor = snapshot.batches[0]!.colors!.slice(memoryBase * 4, memoryBase * 4 + 4);
    expect([...memoryColor]).not.toEqual([0x9b, 0x5b, 0x45, 255]);
    expect(memoryColor[3]).toBe(255);
  });

  it('keeps a missing live generation distinct from a fog-memory generation fallback', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      view({ id: 12, generation: undefined, kind: 'unit', layer: 'unit' }),
      view({
        id: 12,
        generation: undefined,
        kind: 'building',
        layer: 'building',
        entityType: 'house',
        isMemory: true,
      }),
    ]);

    const keys = snapshot.batches[0]!.instanceKeys;
    expect(keys.some((key) => key.startsWith('12:legacy:'))).toBe(true);
    expect(keys.some((key) => key.startsWith('12:memory:'))).toBe(true);
  });

  it('never reuses adapter-managed fallback keys after an entity disappears', () => {
    const adapter = new AoeVoxelAdapter();
    const memory = view({
      id: 12,
      generation: undefined,
      kind: 'building',
      layer: 'building',
      entityType: 'house',
      isMemory: true,
    });
    const first = adapter.createSnapshot([memory]).batches[0]!.instanceKeys[0]!;
    adapter.createSnapshot([]);
    const recreated = adapter.createSnapshot([memory]).batches[0]!.instanceKeys[0]!;
    expect(first).toBe('12:memory:building-base');
    expect(recreated).toBe('12:memory:2:building-base');
  });

  it('insets large building shells so a four-cell landmark does not become a monolith', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      view({
        id: 20,
        generation: 1,
        kind: 'building',
        layer: 'building',
        entityType: 'town-center',
        footprintWidth: 4,
        footprintHeight: 4,
      }),
    ]);
    const keys = snapshot.batches[0]!.instanceKeys;
    const baseIndex = keys.indexOf('20:1:building-base');
    const base = snapshot.batches[0]!.matrices.slice(baseIndex * 16, baseIndex * 16 + 16);

    expect(base[0]).toBeLessThan(3.2);
    expect(base[5]).toBeLessThan(2.1);
    expect(base[12]).toBeGreaterThan(0.4);
  });

  it('keeps live and fog-memory parts on the composed ground plane', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      terrain(1, 2, 3, { entityType: 'hill', elevation: 1 }),
      terrain(2, 6, 7, { entityType: 'hill', elevation: 1 }),
      view({ id: 20, generation: 4, kind: 'unit', layer: 'unit', x: 2.25, y: 3.1 }),
      view({
        id: 21,
        generation: undefined,
        kind: 'building',
        layer: 'building',
        entityType: 'house',
        x: 6,
        y: 7,
        isMemory: true,
      }),
    ]);
    const batch = snapshot.batches[0]!;
    for (const key of ['20:4:unit-body', '21:memory:building-base']) {
      const matrixOffset = batch.instanceKeys.indexOf(key) * 16;
      expect(batch.matrices[matrixOffset + 13]).toBe(0);
    }
  });
});

describe('AoeVoxelAdapter lifecycle', () => {
  it('emits a snapshot accepted by the reusable core boundary', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      terrain(1, 0, 0),
      view({ id: 2, generation: 4, kind: 'unit', layer: 'unit' }),
    ]);

    const result = validateAndCopySnapshotV1(snapshot);
    expect(result).toMatchObject({ ok: true });
  });

  it('advances snapshot and batch revisions and starts a new epoch on bridge reset', () => {
    const adapter = new AoeVoxelAdapter();
    const entities = [terrain(1, 0, 0), view({ id: 2, kind: 'unit', layer: 'unit' })];

    const first = adapter.createSnapshot(entities);
    const second = adapter.createSnapshot(entities);
    expect([first.revision, second.revision]).toEqual([1, 2]);
    expect([first.batches[0]!.revision, second.batches[0]!.revision]).toEqual([1, 2]);
    expect(second.chunks[0]!.revision).toBe(first.chunks[0]!.revision);

    const changed = adapter.createSnapshot([
      terrain(1, 0, 0, { tint: 0x123456 }),
      entities[1]!,
    ]);
    expect(changed.chunks[0]!.revision).toBeGreaterThan(second.chunks[0]!.revision);

    adapter.resetForBridgeSwap();
    const reset = adapter.createSnapshot(entities);
    expect(reset.descriptor.epoch).not.toBe(changed.descriptor.epoch);
    expect(reset.revision).toBe(1);
    expect(reset.batches[0]!.revision).toBe(1);
    expect(reset.chunks[0]!.revision).toBe(1);
  });

  it('increments a terrain chunk incarnation when its key is removed and recreated', () => {
    const adapter = new AoeVoxelAdapter();
    const first = adapter.createSnapshot([terrain(1, 0, 0)]);
    adapter.createSnapshot([]);
    const recreated = adapter.createSnapshot([terrain(1, 0, 0)]);
    expect(first.chunks[0]!.incarnation).toBe(1);
    expect(recreated.chunks[0]!.incarnation).toBe(2);
    expect(recreated.chunks[0]!.revision).toBe(1);
  });

  it('canonicalizes input order and produces identical output from fresh adapters', () => {
    const entities = [
      terrain(2, 16, 0, { tint: 0x778899 }),
      view({ id: 8, generation: 2, kind: 'resource', layer: 'resource', entityType: 'tree' }),
      terrain(1, 15, 0, { tint: 0x112233 }),
      view({ id: 7, generation: 3, kind: 'unit', layer: 'unit', entityType: 'villager' }),
    ];

    const forward = new AoeVoxelAdapter().createSnapshot(entities);
    const reverse = new AoeVoxelAdapter().createSnapshot([...entities].reverse());
    expect(reverse).toEqual(forward);
  });

  it('does not let mutation of a returned snapshot contaminate later snapshots', () => {
    const entities = [terrain(1, 0, 0), view({ id: 2, generation: 4, kind: 'unit', layer: 'unit' })];
    const adapter = new AoeVoxelAdapter();
    const first = adapter.createSnapshot(entities);
    const material = first.resources.find((resource) => resource.kind === 'material')!;
    const geometry = first.resources.find((resource) => resource.kind === 'geometry')!;
    (material.color as { r: number }).r = 0;
    geometry.positions[0] = 99;
    first.chunks[0]!.voxels[0] = 0;
    first.batches[0]!.matrices[0] = 99;

    const actual = adapter.createSnapshot(entities);
    const clean = new AoeVoxelAdapter();
    clean.createSnapshot(entities);
    const expected = clean.createSnapshot(entities);
    expect(actual).toEqual(expected);
  });
});
