// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplyResultV1, RenderSnapshotV1 } from 'voxel/core';
import type {
  ThreeFrameContext,
  ThreeRenderMetrics,
  ThreeRenderRuntimeOptions,
} from 'voxel/three';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  AoeVoxelWorldRenderer,
  type AoeVoxelRuntime,
} from '../../src/rendering/voxel/AoeVoxelWorldRenderer';

function terrain(): ProjectedEntityView {
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

class FakeRuntime implements AoeVoxelRuntime {
  readonly accepted: RenderSnapshotV1[] = [];
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
  });
  readonly setView = vi.fn();
  readonly resize = vi.fn();
  readonly dispose = vi.fn();
  readonly metrics = vi.fn((): ThreeRenderMetrics => ({
    state: 'running',
    acceptedEpoch: this.accepted.at(-1)?.descriptor.epoch ?? null,
    acceptedRevision: this.accepted.at(-1)?.revision ?? null,
    presentedEpoch: null,
    presentedRevision: null,
    frames: 0,
    materialResources: 0,
    geometryResources: 0,
    chunks: 0,
    visibleChunks: 0,
    instanceBatches: 0,
    instances: 0,
    drawCalls: 0,
    triangles: 0,
    points: 0,
    lines: 0,
    rendererGeometries: 0,
    rendererTextures: 0,
    contextLosses: 0,
    contextRestorations: 0,
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

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('AoeVoxelWorldRenderer', () => {
  it('owns one world canvas and drives snapshot, camera, frame, reset, and teardown', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const runtime = new FakeRuntime();
    let runtimeOptions: ThreeRenderRuntimeOptions | undefined;
    const renderer = new AoeVoxelWorldRenderer({
      host,
      width: 800,
      height: 600,
      pixelRatio: 1,
      createRuntime: (options) => {
        runtimeOptions = options;
        return runtime;
      },
    });

    expect(host.querySelectorAll('.voxel-world-canvas')).toHaveLength(1);
    expect(runtimeOptions?.canvas).toBe(host.querySelector('.voxel-world-canvas'));
    expect(runtimeOptions?.rendererParameters).toMatchObject({
      alpha: true,
      antialias: false,
    });
    expect(runtimeOptions?.rendererParameters).not.toHaveProperty('preserveDrawingBuffer');

    renderer.present([terrain()]);
    const firstEpoch = runtime.accepted[0]!.descriptor.epoch;
    renderer.frame({
      scrollX: -400,
      scrollY: -300,
      zoom: 1,
      width: 800,
      height: 600,
      viewX: -400,
      viewY: -300,
      viewWidth: 800,
      viewHeight: 600,
      viewCorners: [],
    }, 100, 16);

    expect(runtime.setView).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 }, 1);
    expect(runtime.frame).toHaveBeenCalledWith({ nowMs: 100, deltaMs: 16, frameIndex: 0 });

    renderer.resetForBridgeSwap();
    renderer.present([terrain()]);
    expect(runtime.accepted[1]!.descriptor.epoch).not.toBe(firstEpoch);
    expect(runtime.accepted[1]!.revision).toBe(1);

    renderer.dispose();
    renderer.dispose();
    expect(runtime.dispose).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.voxel-world-canvas')).toBeNull();
  });

  it('composites the Three world below the transparent Phaser overlay', () => {
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const host = document.createElement('div');
    const runtime = new FakeRuntime();
    const renderer = new AoeVoxelWorldRenderer({
      host,
      width: 320,
      height: 200,
      createRuntime: () => runtime,
    });
    const overlay = document.createElement('canvas');
    overlay.width = 640;
    overlay.height = 400;

    const composite = renderer.captureComposite(overlay);

    expect(composite).not.toBeNull();
    expect(runtime.capture).toHaveBeenCalledTimes(1);
    expect(composite).toMatchObject({ width: 640, height: 400 });
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(drawImage.mock.calls[0]?.[0]).toBe(renderer.canvas);
    expect(drawImage.mock.calls[1]?.[0]).toBe(overlay);
  });
});
