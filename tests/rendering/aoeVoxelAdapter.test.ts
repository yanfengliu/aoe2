import { describe, expect, it } from 'vitest';
import { validateAndCopySnapshotV1 } from 'voxel/core';
import { DensePaletteChunk, meshVisibleFaces } from 'voxel/meshing';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  AOE_TERRAIN_CHUNK_SIZE,
  AoeVoxelAdapter,
} from '../../src/rendering/voxel/aoeVoxelAdapter';
import { terrainVoxelTint } from '../../src/rendering/voxel/aoeVoxelTerrain';

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

type AdapterSnapshot = ReturnType<AoeVoxelAdapter['createSnapshot']>;

function allInstanceKeys(snapshot: AdapterSnapshot): string[] {
  return snapshot.batches.flatMap((batch) => batch.instanceKeys);
}

function partRecord(snapshot: AdapterSnapshot, key: string) {
  const batch = snapshot.batches.find((candidate) => candidate.instanceKeys.includes(key));
  if (!batch) throw new Error(`Missing expected voxel part: ${key}`);
  const index = batch.instanceKeys.indexOf(key);
  return {
    batch,
    matrix: batch.matrices.slice(index * 16, index * 16 + 16),
    color: batch.colors?.slice(index * 4, index * 4 + 4),
    animation: batch.animation ? {
      periodMs: batch.animation.periodsMs[index],
      phaseRadians: batch.animation.phasesRadians[index],
      translationAmplitude: batch.animation.translationAmplitudes.slice(index * 3, index * 3 + 3),
      rotationAmplitude: batch.animation.rotationAmplitudesRadians.slice(index * 3, index * 3 + 3),
      scaleAmplitude: batch.animation.scaleAmplitudes.slice(index * 3, index * 3 + 3),
    } : undefined,
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
    const expectedTints = [
      terrainVoxelTint(0x112233, 'grass', 0, 0),
      terrainVoxelTint(0x445566, 'grass', 15, 0),
      terrainVoxelTint(0x778899, 'hill', 16, 0),
    ].sort((a, b) => a - b);
    expect(palette?.entries.map((entry) => entry.color)).toEqual([
      { r: 0, g: 0, b: 0, a: 0 },
      ...expectedTints.map((tint) => ({
        r: (tint >>> 16) & 0xff,
        g: (tint >>> 8) & 0xff,
        b: tint & 0xff,
        a: 255,
      })),
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

    expect(snapshot.batches.map((batch) => batch.key)).toEqual([
      'aoe2:batch:matte-parts',
      'aoe2:batch:metal-parts',
      'aoe2:batch:shadow-parts',
      'aoe2:batch:memory-parts',
    ]);
    const keys = allInstanceKeys(snapshot);
    expect(keys).toEqual(expect.arrayContaining([
      '7:3:villager-tunic',
      '7:3:villager-tool-handle',
      '8:2:tree-trunk',
      '8:2:tree-crown-top',
      '9:memory:house-plinth',
      '9:memory:house-chimney-cap',
    ]));
    expect(new Set(keys).size).toBe(keys.length);
    for (const batch of snapshot.batches) {
      expect(batch.matrices).toHaveLength(batch.instanceKeys.length * 16);
      expect(batch.colors).toHaveLength(batch.instanceKeys.length * 4);
    }
    const matteMaterial = snapshot.resources.find(
      (resource) => resource.kind === 'material' && resource.key.endsWith(':matte'),
    );
    const memoryMaterial = snapshot.resources.find(
      (resource) => resource.kind === 'material' && resource.key.endsWith(':memory'),
    );
    expect(matteMaterial).toMatchObject({ vertexColors: false, transparent: false });
    expect(memoryMaterial).toMatchObject({ transparent: true, opacity: 0.5 });
    const cube = snapshot.resources.find((resource) => resource.kind === 'geometry')!;
    expect(cube.pivot).toEqual({ x: 0.5, y: 0.5, z: 0.5 });
    expect(cube.groups).toEqual([]);
    const tunic = partRecord(snapshot, '7:3:villager-tunic').matrix;
    expect(tunic[12]).toBeCloseTo(2.5);
    expect(tunic[14]).toBeCloseTo(3.5);
    const memoryColor = partRecord(snapshot, '9:memory:house-plinth').color!;
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

    const keys = allInstanceKeys(snapshot);
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
    const first = allInstanceKeys(adapter.createSnapshot([memory]))
      .find((key) => key.endsWith(':house-plinth'));
    adapter.createSnapshot([]);
    const recreated = allInstanceKeys(adapter.createSnapshot([memory]))
      .find((key) => key.endsWith(':house-plinth'));
    expect(first).toBe('12:memory:house-plinth');
    expect(recreated).toBe('12:memory:2:house-plinth');
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
    const base = partRecord(snapshot, '20:1:town-center-hall').matrix;

    expect(base[0]).toBeLessThan(3.2);
    expect(base[5]).toBeLessThan(2.1);
    expect(base[12]).toBeGreaterThan(0.4);
  });

  it('keeps live and fog-memory parts on the composed ground plane', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      terrain(1, 2, 3, { entityType: 'hill', elevation: 1 }),
      terrain(2, 6, 7, { entityType: 'hill', elevation: 1 }),
      view({
        id: 20,
        generation: 4,
        kind: 'unit',
        layer: 'unit',
        entityType: 'villager',
        x: 2.25,
        y: 3.1,
      }),
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
    for (const key of ['20:4:villager-boot-left', '21:memory:house-plinth']) {
      const matrix = partRecord(snapshot, key).matrix;
      expect(matrix[13]! - matrix[5]! / 2).toBeCloseTo(0);
    }
  });

  it('switches live units from subtle idle motion to stronger locomotion profiles', () => {
    const adapter = new AoeVoxelAdapter();
    const villager = view({
      id: 20,
      generation: 4,
      kind: 'unit',
      layer: 'unit',
      entityType: 'villager',
      x: 2,
      y: 3,
      size: 0.72,
    });
    const idle = adapter.createSnapshot([villager]);
    const moving = adapter.createSnapshot([{ ...villager, x: 2.2 }]);
    const stopped = adapter.createSnapshot([{ ...villager, x: 2.2 }]);
    const idleBob = partRecord(idle, '20:4:villager-tunic').animation!;
    const movingBob = partRecord(moving, '20:4:villager-tunic').animation!;
    const stoppedBob = partRecord(stopped, '20:4:villager-tunic').animation!;

    expect(movingBob.translationAmplitude[1]).toBeGreaterThan(idleBob.translationAmplitude[1]!);
    expect(movingBob.periodMs).toBeLessThan(idleBob.periodMs!);
    expect(stoppedBob.translationAmplitude[1]).toBeCloseTo(idleBob.translationAmplitude[1]!);
    expect(stoppedBob.phaseRadians).toBe(idleBob.phaseRadians);
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

  it('starts new generations and bridge epochs from idle animation history', () => {
    const adapter = new AoeVoxelAdapter();
    const unit = view({
      id: 20,
      generation: 4,
      kind: 'unit',
      layer: 'unit',
      entityType: 'villager',
      x: 2,
      y: 3,
    });
    const idle = adapter.createSnapshot([unit]);
    const moving = adapter.createSnapshot([{ ...unit, x: 2.2 }]);
    const replacement = adapter.createSnapshot([{ ...unit, generation: 5, x: 2.2 }]);
    const idleAmplitude = partRecord(idle, '20:4:villager-tunic').animation!
      .translationAmplitude[1]!;
    const movingAmplitude = partRecord(moving, '20:4:villager-tunic').animation!
      .translationAmplitude[1]!;
    const replacementAmplitude = partRecord(replacement, '20:5:villager-tunic').animation!
      .translationAmplitude[1]!;

    expect(movingAmplitude).toBeGreaterThan(idleAmplitude);
    expect(replacementAmplitude).toBeCloseTo(idleAmplitude);

    adapter.createSnapshot([{ ...unit, generation: 5, x: 2.4 }]);
    adapter.resetForBridgeSwap();
    const reset = adapter.createSnapshot([{ ...unit, generation: 5, x: 2.4 }]);
    expect(
      partRecord(reset, '20:5:villager-tunic').animation!.translationAmplitude[1],
    ).toBeCloseTo(idleAmplitude);
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
    if (first.batches[0]!.animation) first.batches[0]!.animation.periodsMs[0] = 99;

    const actual = adapter.createSnapshot(entities);
    const clean = new AoeVoxelAdapter();
    clean.createSnapshot(entities);
    const expected = clean.createSnapshot(entities);
    expect(actual).toEqual(expected);
  });
});
