// GATE: incremental ingestion keeps the full snapshot's ordered picture while uploading only changed slots.
// BOUND: actual voxel/core and voxel/three, with a DOM-free renderer. Pixel/rasterisation proof is separate.
import { InstancedMesh, Scene, Vector2 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { RenderWorld, type RenderSnapshotV1 } from 'voxel/core';
import { ThreeRenderRuntime, type RendererLike } from 'voxel/three';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createDisplayedPositionSmoother } from '../../src/rendering/displayedPositionSmoother';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import { acceptAoeVoxelSnapshot, aoeVoxelSnapshotDelta } from '../../src/rendering/voxel/aoeVoxelSnapshotDelta';

class CountingRenderer implements RendererLike {
  readonly domElement = { width: 320, height: 200 };
  render(): void { /* Runtime executes every presenter; only the GPU draw is omitted. */ }
  setSize(): void {}
  setPixelRatio(): void {}
  getSize(target: Vector2): Vector2 { return target.set(320, 200); }
  getPixelRatio(): number { return 1; }
  dispose(): void {}
}

function entity(id: number, layer: 'resource' | 'unit', x: number, y: number): ProjectedEntityView {
  return {
    id, generation: 1, kind: layer, layer, entityType: layer === 'resource' ? 'tree' : 'villager',
    owner: layer === 'resource' ? null : 1, x, y, elevation: 0, tint: 0x557733, size: 1,
    footprintWidth: 1, footprintHeight: 1, visualVariant: 'default', selected: false,
    currentHp: null, maxHp: null, isMemory: false,
  };
}

function frames(unitX = 4): RenderSnapshotV1[] {
  const adapter = new AoeVoxelAdapter();
  adapter.setVoxelGround(false);
  const trees = Array.from({ length: 80 }, (_, i) => entity(i + 10, 'resource', i % 10, Math.floor(i / 10)));
  return Array.from({ length: 5 }, (_, frame) => adapter.createSnapshot([
    ...trees, entity(1, 'unit', unitX + frame / 20, 4),
  ], frame * 16));
}

function picture(snapshot: RenderSnapshotV1): unknown {
  const keyed = <T extends { key: string }>(values: readonly T[]): T[] => [...values].sort((a, b) => a.key.localeCompare(b.key));
  return {
    ...snapshot, resources: keyed(snapshot.resources), chunks: keyed(snapshot.chunks),
    batches: keyed(snapshot.batches).map(({ revision: _revision, ...batch }) => batch),
  };
}

describe('snapshot deltas', () => {
  it('keeps the actual translucent mesh bounds equal to full ingestion when an edge caster moves inward', () => {
    const [first, second] = frames(12);
    const next = { ...second!, batches: second!.batches.map((batch) => {
      const matrices = batch.matrices.slice();
      batch.instanceKeys.forEach((key, index) => { if (key.startsWith('1:1:')) matrices[index * 16 + 12]! -= 2; });
      return { ...batch, matrices };
    }) };
    const scene = new Scene();
    const fullScene = new Scene();
    const runtime = new ThreeRenderRuntime({ renderer: new CountingRenderer(), scene, width: 320, height: 200 });
    const full = new ThreeRenderRuntime({ renderer: new CountingRenderer(), scene: fullScene, width: 320, height: 200 });
    try {
      expect(runtime.acceptSnapshot(first!).status).toBe('accepted');
      runtime.frame({ nowMs: 0, deltaMs: 0, frameIndex: 0 });
      expect(runtime.acceptDelta(aoeVoxelSnapshotDelta(first!, next)!).status).toBe('accepted');
      expect(full.acceptSnapshot(next).status).toBe('accepted');
      runtime.frame({ nowMs: 16, deltaMs: 16, frameIndex: 1 });
      full.frame({ nowMs: 16, deltaMs: 16, frameIndex: 0 });
      const actual = scene.getObjectByName('aoe2:batch:shadow-parts') as InstancedMesh;
      const expected = fullScene.getObjectByName('aoe2:batch:shadow-parts') as InstancedMesh;
      expect(actual).toBeInstanceOf(InstancedMesh);
      expect(actual.boundingBox).toEqual(expected.boundingBox);
      expect(actual.boundingSphere).toEqual(expected.boundingSphere);
    } finally { runtime.dispose(); full.dispose(); }
  });

  it('preserves the exact ordered picture through interpolated frames of a real match', () => {
    const bridge = createSimulationBridge('aoe2-prototype', { forceAiForOwners: new Set([1]) });
    for (let tick = 0; tick < 600; tick += 1) bridge.step(100);
    const smoother = createDisplayedPositionSmoother();
    const adapter = new AoeVoxelAdapter();
    adapter.setVoxelGround(false);
    const world = new RenderWorld();
    let previous: RenderSnapshotV1 | null = null;
    try {
      for (let tick = 0; tick < 8; tick += 1) {
        bridge.step(100);
        const state = bridge.getRenderState();
        for (const alpha of [0, 1 / 3, 2 / 3]) {
          const next = adapter.createSnapshot(smoother.apply(state.entities, state.tick, alpha), (state.tick + alpha) * 100, {
            frame: state.frame, placementPreview: null, selectionPreviewEntityIds: [], selectionMarqueeWorldCorners: null,
          });
          const delta = previous ? aoeVoxelSnapshotDelta(previous, next) : null;
          expect((delta ? world.acceptDelta(delta) : world.acceptSnapshot(next)).status).toBe('accepted');
          expect(picture(world.acceptedSnapshot()!)).toEqual(picture(next));
          previous = next;
        }
      }
    } finally { world.dispose(); }
  });

  it('requires a snapshot for a new epoch or changed descriptor', () => {
    const [first, next] = frames();
    expect(aoeVoxelSnapshotDelta(first!, { ...next!, descriptor: { ...next!.descriptor, epoch: 'new' } })).toBeNull();
    expect(aoeVoxelSnapshotDelta(first!, { ...next!, descriptor: {
      ...next!.descriptor, limits: { ...next!.descriptor.limits, maxBatches: 100 },
    } })).toBeNull();
  });

  it('puts a full translucent batch if any key order, count or layout changes', () => {
    const [first, second] = frames();
    const shadow = second!.batches.find((batch) => batch.key === 'aoe2:batch:shadow-parts')!;
    for (const instanceKeys of [[...shadow.instanceKeys].reverse(), shadow.instanceKeys.slice(1)]) {
      const next = { ...second!, batches: second!.batches.map((batch) => batch === shadow ? { ...shadow, instanceKeys } : batch) };
      expect(aoeVoxelSnapshotDelta(first!, next)!.operations).toContainEqual({ op: 'put-batch', batch: next.batches.find((batch) => batch.key === shadow.key) });
    }
    const next = { ...second!, batches: second!.batches.map((batch) => batch === shadow ? { ...shadow, colors: undefined } : batch) };
    expect(aoeVoxelSnapshotDelta(first!, next)!.operations).toContainEqual({ op: 'put-batch', batch: next.batches.find((batch) => batch.key === shadow.key) });
  });

  it('preserves terrain, fog-memory, births, removals and art-style round trips through the real reducer', () => {
    const adapter = new AoeVoxelAdapter();
    const world = new RenderWorld();
    const tiles = Array.from({ length: 4 }, (_, id) => ({
      ...entity(100 + id, 'resource', id % 2, Math.floor(id / 2)),
      layer: 'terrain' as const, kind: 'tile' as const, entityType: 'grass' as const,
    }));
    let previous: RenderSnapshotV1 | null = null;
    try {
      for (let step = 0; step < 8; step += 1) {
        adapter.setVoxelGround(step !== 3 && step !== 4);
        adapter.setExploredGround(step >= 5 ? 0.5 : 0.35);
        const entities: ProjectedEntityView[] = [
          ...tiles.map((tile) => ({ ...tile, tint: step >= 2 ? 0x224422 : tile.tint })),
          ...(step === 4 ? [] : [{ ...entity(1, 'resource', 1, 1), generation: step >= 5 ? 2 : 1, isMemory: step === 2 }]),
          ...(step < 6 ? [entity(2, 'unit', step / 4, 0)] : []),
        ];
        const next = adapter.createSnapshot(entities, step * 100, {
          frame: { tick: step, playerId: 1, seed: 'delta', mapWidth: 2, mapHeight: 2,
            visibleCells: step === 2 ? [0] : [0, 1, 2, 3], exploredCells: [0, 1, 2, 3], recentUnitDeaths: [], projectiles: [] },
          placementPreview: null, selectionPreviewEntityIds: [], selectionMarqueeWorldCorners: null,
        });
        const delta = previous ? aoeVoxelSnapshotDelta(previous, next) : null;
        expect((delta ? world.acceptDelta(delta) : world.acceptSnapshot(next)).status, `step ${step}`).toBe('accepted');
        expect(picture(world.acceptedSnapshot()!), `ordered picture at step ${step}`).toEqual(picture(next));
        previous = next;
      }
    } finally { world.dispose(); }
  });

  it('preserves changed animation tuples and colors, including zero to nonzero animation', () => {
    const [first] = frames();
    const batch = first!.batches.find((candidate) => candidate.key === 'aoe2:batch:still-matte-parts')!;
    const count = batch.instanceKeys.length;
    const original = {
      ...batch,
      animation: { schemaVersion: 'voxel.instance-transform-animation/1' as const,
        periodsMs: new Float32Array(count), phasesRadians: new Float32Array(count),
        translationAmplitudes: new Float32Array(count * 3), rotationAmplitudesRadians: new Float32Array(count * 3), scaleAmplitudes: new Float32Array(count * 3) },
    };
    const before = { ...first!, batches: first!.batches.map((candidate) => candidate === batch ? original : candidate) };
    const changed = { ...original, revision: 2, colors: original.colors!.slice(), animation: {
      ...original.animation, periodsMs: original.animation.periodsMs.slice(), translationAmplitudes: original.animation.translationAmplitudes.slice(),
    } };
    changed.colors[0] = 99;
    changed.animation.periodsMs[0] = 1_000;
    changed.animation.translationAmplitudes[0] = 0.1;
    const next = { ...before, revision: 2, batches: before.batches.map((candidate) => candidate === original ? changed : candidate) };
    const world = new RenderWorld();
    try {
      expect(world.acceptSnapshot(before).status).toBe('accepted');
      const delta = aoeVoxelSnapshotDelta(before, next)!;
      expect(delta.operations).toHaveLength(1);
      expect(delta.operations[0]!.op).toBe('patch-batch-instances');
      expect(world.acceptDelta(delta).status).toBe('accepted');
      expect(picture(world.acceptedSnapshot()!)).toEqual(picture(next));
    } finally { world.dispose(); }
  });

  it('retries a full snapshot when a delta needs resync or exceeds a runtime budget', () => {
    const [first, next] = frames();
    for (const refused of [
      { status: 'resync-required', reason: 'uninitialized', expected: null, received: { worldId: 'aoe2', epoch: 'x', revision: 1, baseRevision: 0 } },
      { status: 'rejected', code: 'limit.delta-input-bytes', path: '$', message: 'budget' },
    ] as const) {
      const runtime = {
        acceptDelta: vi.fn(() => refused),
        acceptSnapshot: vi.fn(() => ({ status: 'accepted' as const, epoch: next!.descriptor.epoch, revision: next!.revision })),
      };
      expect(acceptAoeVoxelSnapshot(runtime, next!, first!).status).toBe('accepted');
      expect(runtime.acceptDelta).toHaveBeenCalledOnce();
      expect(runtime.acceptSnapshot).toHaveBeenCalledWith(next);
    }
  });

  it('patches the moving slots while keeping the full snapshot\'s shadow order and bytes', () => {
    const snapshots = frames();
    const world = new RenderWorld();
    try {
      expect(world.acceptSnapshot(snapshots[0]!).status).toBe('accepted');
      for (let index = 1; index < snapshots.length; index += 1) {
        const next = snapshots[index]!;
        const delta = aoeVoxelSnapshotDelta(snapshots[index - 1]!, next);
        expect(delta, 'the same epoch/descriptor has an incremental update').not.toBeNull();
        expect(delta!.operations.some((op) => op.op === 'patch-batch-instances')).toBe(true);
        expect(world.acceptDelta(delta).status).toBe('accepted');
        expect(picture(world.acceptedSnapshot()!)).toEqual(picture(next));
      }
    } finally { world.dispose(); }
  });

  it('the real presenter rewrites fewer than one quarter of the full-snapshot slots between frames', () => {
    const snapshots = frames();
    const run = (incremental: boolean): number => {
      const runtime = new ThreeRenderRuntime({ renderer: new CountingRenderer(), width: 320, height: 200 });
      try {
        expect(runtime.acceptSnapshot(snapshots[0]!).status).toBe('accepted');
        runtime.frame({ nowMs: 0, deltaMs: 0, frameIndex: 0 });
        const before = runtime.metrics().instancePresentationMatrixWrites;
        for (let index = 1; index < snapshots.length; index += 1) {
          const delta = incremental ? aoeVoxelSnapshotDelta(snapshots[index - 1]!, snapshots[index]!) : null;
          const result = delta ? runtime.acceptDelta(delta) : runtime.acceptSnapshot(snapshots[index]!);
          expect(result.status).toBe('accepted');
          runtime.frame({ nowMs: index * 16, deltaMs: 16, frameIndex: index });
        }
        return runtime.metrics().instancePresentationMatrixWrites - before;
      } finally { runtime.dispose(); }
    };
    const full = run(false);
    const incremental = run(true);
    expect(full, 'control: the snapshot path uploads the still trees\' shadows').toBeGreaterThan(500);
    expect(incremental).toBeLessThan(full / 4);
  });
});
