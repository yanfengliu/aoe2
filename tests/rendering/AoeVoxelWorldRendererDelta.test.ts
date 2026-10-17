// @vitest-environment jsdom
// GATE: the live renderer uses public deltas, keeps admission/hit watermarks, and recovers through full snapshots.
// BOUND: the actual ThreeRenderRuntime with a DOM-free draw stub; rasterisation is covered by browser captures.
import { Vector2 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ThreeRenderRuntime, type RendererLike } from 'voxel/three';

import { AoeVoxelWorldRenderer } from '../../src/rendering/voxel/AoeVoxelWorldRenderer';
import { terrain } from './helpers/fakeVoxelRuntime';

class DrawStub implements RendererLike {
  readonly domElement = { width: 320, height: 200 };
  render(): void {}
  setSize(): void {}
  setPixelRatio(): void {}
  getSize(target: Vector2): Vector2 { return target.set(320, 200); }
  getPixelRatio(): number { return 1; }
  dispose(): void {}
}

const camera = { scrollX: 0, scrollY: 0, zoom: 1, width: 320, height: 200,
  viewX: 0, viewY: 0, viewWidth: 320, viewHeight: 200, viewCorners: [] };

describe('world renderer incremental ingestion', () => {
  it('admits deltas, resyncs a rejected delta and restores an outgoing bridge before the next delta', () => {
    let runtime!: ThreeRenderRuntime;
    const renderer = new AoeVoxelWorldRenderer({
      host: document.createElement('div'), width: 320, height: 200, artStyleId: 'de',
      createRuntime: (options) => {
        runtime = new ThreeRenderRuntime({ ...options, renderer: new DrawStub(), rendererFactory: undefined });
        return runtime;
      },
    });
    const snapshots = vi.spyOn(runtime, 'acceptSnapshot');
    const deltas = vi.spyOn(runtime, 'acceptDelta');
    try {
      renderer.present([terrain()], 0);
      renderer.frame(camera, 0);
      const outgoingEpoch = renderer.state().metrics.presentedEpoch;
      expect(renderer.isInteractionReady()).toBe(true);
      renderer.present([terrain()], 16);
      renderer.frame(camera, 16);
      expect(snapshots).toHaveBeenCalledTimes(1);
      expect(deltas).toHaveBeenCalledOnce();
      expect(renderer.isInteractionReady()).toBe(true);
      expect(renderer.state().metrics.presentedRevision).toBe(2);

      deltas.mockReturnValueOnce({ status: 'resync-required', reason: 'uninitialized', expected: null,
        received: { worldId: 'aoe2', epoch: outgoingEpoch!, baseRevision: 2, revision: 3 } });
      renderer.present([terrain()], 32);
      renderer.frame(camera, 16);
      expect(snapshots).toHaveBeenCalledTimes(2);
      expect(renderer.state().metrics.presentedRevision).toBe(3);
      expect(renderer.isInteractionReady()).toBe(true);

      const swap = renderer.beginBridgeSwap();
      renderer.present([{ ...terrain(), tint: 0x334455 }], 0);
      renderer.frame(camera, 0);
      expect(renderer.state().metrics.presentedEpoch).not.toBe(outgoingEpoch);
      swap.rollback();
      renderer.frame(camera, 0);
      expect(renderer.state().metrics.presentedEpoch).toBe(outgoingEpoch);
      expect(renderer.state().metrics.presentedRevision).toBe(3);
      renderer.present([terrain()], 48);
      renderer.frame(camera, 16);
      expect(deltas.mock.calls.at(-1)![0]).toMatchObject({ epoch: outgoingEpoch, baseRevision: 3, revision: 4 });
      expect(renderer.isInteractionReady()).toBe(true);
      expect(renderer.state().metrics.presentedRevision).toBe(4);
    } finally { renderer.dispose(); }
  });
});
