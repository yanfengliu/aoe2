// A stand-in for voxel's ThreeRenderRuntime and a terrain cell, shared by the AoeVoxelWorldRenderer tests.
import { vi } from 'vitest';
import type { ApplyResultV1, RenderSnapshotV1 } from 'voxel/core';
import type { ThreeFrameContext, ThreeRenderMetrics } from 'voxel/three';

import type { ProjectedEntityView } from '../../../src/game/simulation/types';
import type { AoeVoxelRuntime } from '../../../src/rendering/voxel/AoeVoxelWorldRenderer';

export function terrain(): ProjectedEntityView {
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
  };
}

export class FakeRuntime implements AoeVoxelRuntime {
  readonly accepted: RenderSnapshotV1[] = [];
  state: ThreeRenderMetrics['state'] = 'running';
  presentedEpoch: string | null = null;
  presentedRevision: number | null = null;
  readonly acceptSnapshot = vi.fn((snapshot: RenderSnapshotV1): ApplyResultV1 => {
    this.accepted.push(snapshot);
    return {
      status: 'accepted',
      revision: snapshot.revision,
      epoch: snapshot.descriptor.epoch,
    };
  });
  readonly frame = vi.fn((_context: ThreeFrameContext) => {
    void _context;
    if (this.state !== 'running') return;
    this.presentedEpoch = this.accepted.at(-1)?.descriptor.epoch ?? null;
    this.presentedRevision = this.accepted.at(-1)?.revision ?? null;
  });
  readonly setView = vi.fn();
  readonly resize = vi.fn();
  readonly dispose = vi.fn();
  readonly setStylizedResolve = vi.fn();
  // AoE2's file link may exercise a Voxel worktree newer than the reachable
  // release pin. Keep this fake as a forward-compatible metrics superset; the
  // inferred structural superset also compiles against pinned 0.1.4, where
  // the ownership counters are not yet part of ThreeRenderMetrics.
  readonly metrics = vi.fn(() => ({
    state: this.state,
    acceptedEpoch: this.accepted.at(-1)?.descriptor.epoch ?? null,
    acceptedRevision: this.accepted.at(-1)?.revision ?? null,
    presentedEpoch: this.presentedEpoch,
    presentedRevision: this.presentedRevision,
    frames: 0,
    materialResources: 0,
    geometryResources: 0,
    chunks: 0,
    visibleChunks: 0,
    instanceBatches: 0,
    instances: 0,
    animatedBatches: 0,
    animatedInstances: 0,
    animationMatrixUpdates: 0,
    drawCalls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
    rendererGeometries: 0,
    rendererTextures: 0,
    contextLosses: 0,
    contextRestorations: 0,
    snapshotInputTypedArrayBytes: 0,
    snapshotCopiedTypedArrayBytes: 0,
    snapshotCopyOperations: 0,
    defensiveSnapshotCopyBytes: 0,
    retainedTypedArrayBytes: 0,
    peakRetainedTypedArrayBytes: 0,
    presentationStagingBytes: 0,
    peakPresentationStagingBytes: 0,
    deltaInputTypedArrayBytes: 0,
    deltaCopiedTypedArrayBytes: 0,
    deltaCopyOperations: 0,
    instancePresentationMatrixWrites: 0,
    instancePresentationColorWrites: 0,
    instancePresentationUpdateRanges: 0,
    // voxel @3623ba7 added the atomic frame-commit lane to ThreeRenderMetrics.
    // AoE reads no atomic metric yet, so the fake reports the "not measured"
    // value the engine itself uses when the lane is inactive.
    atomic: null,
  }));
  readonly capture = vi.fn(() => ({
    dataUrl: 'data:image/png;base64,fake',
    width: 320,
    height: 200,
    epoch: this.accepted.at(-1)?.descriptor.epoch ?? null,
    presentedRevision: null,
    metrics: this.metrics(),
  }));
}
