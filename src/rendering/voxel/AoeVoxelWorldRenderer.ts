import type { ApplyResultV1, RenderSnapshotV1 } from 'voxel/core';
import {
  ThreeRenderRuntime,
  type ThreeCaptureResult,
  type ThreeFrameContext,
  type ThreeRenderMetrics,
  type ThreeRenderRuntimeOptions,
} from 'voxel/three';

import type { ProjectedEntityView } from '../../game/simulation/types';
import type { CameraStateSnapshot } from '../../phaser/scenes/gameScene/cameraController';
import { cameraStateToVoxelView } from './aoeCameraSync';
import { AoeVoxelAdapter } from './aoeVoxelAdapter';
import type { AoeUnitMotionHistory } from './aoeVoxelUnitAnimation';

export interface AoeVoxelRuntime {
  acceptSnapshot(snapshot: RenderSnapshotV1): ApplyResultV1;
  frame(context: ThreeFrameContext): void;
  setView(center: { readonly x: number; readonly y: number; readonly z: number }, zoom?: number): void;
  resize(width: number, height: number, pixelRatio?: number): void;
  capture(): ThreeCaptureResult;
  metrics(): ThreeRenderMetrics;
  dispose(): void;
}

export interface AoeVoxelWorldRendererOptions {
  readonly host: HTMLElement;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio?: number;
  readonly createRuntime?: (options: ThreeRenderRuntimeOptions) => AoeVoxelRuntime;
}

export interface AoeVoxelRendererState {
  readonly mode: 'voxel';
  readonly metrics: ThreeRenderMetrics;
}

function defaultRuntime(options: ThreeRenderRuntimeOptions): AoeVoxelRuntime {
  return new ThreeRenderRuntime(options);
}

export class AoeVoxelWorldRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly adapter = new AoeVoxelAdapter();
  private readonly runtime: AoeVoxelRuntime;
  private readonly pixelRatio: number;
  private width: number;
  private height: number;
  private frameIndex = 0;
  private disposed = false;

  constructor(options: AoeVoxelWorldRendererOptions) {
    this.width = options.width;
    this.height = options.height;
    this.pixelRatio = options.pixelRatio ?? 1;
    this.canvas = options.host.ownerDocument.createElement('canvas');
    this.canvas.className = 'voxel-world-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.dataset.worldRenderer = 'voxel';

    const createRuntime = options.createRuntime ?? defaultRuntime;
    this.runtime = createRuntime({
      canvas: this.canvas,
      width: this.width,
      height: this.height,
      pixelRatio: this.pixelRatio,
      tileWidthPixels: 64,
      tileHeightPixels: 32,
      daylight: {
        skyColor: 0xcfe7f1,
        groundColor: 0x4a3826,
        fillIntensity: 1.45,
        sunColor: 0xffdfa3,
        sunIntensity: 2.65,
        sunOffset: { x: -22, y: 36, z: -18 },
      },
      rendererParameters: {
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      },
    });
    options.host.append(this.canvas);
  }

  present(entities: readonly ProjectedEntityView[], simulationDisplayTimeMs: number): void {
    this.assertActive();
    const result = this.runtime.acceptSnapshot(
      this.adapter.createSnapshot(entities, simulationDisplayTimeMs),
    );
    if (result.status === 'rejected') {
      throw new Error(
        `Voxel snapshot rejected (${result.code} at ${result.path}): ${result.message}`,
      );
    }
  }

  frame(
    camera: CameraStateSnapshot,
    nowMs: number,
    deltaMs: number,
  ): void {
    this.assertActive();
    const view = cameraStateToVoxelView(camera);
    if (view.width !== this.width || view.height !== this.height) {
      this.width = view.width;
      this.height = view.height;
      this.runtime.resize(this.width, this.height, this.pixelRatio);
    }
    this.runtime.setView(view.center, view.zoom);
    this.runtime.frame({ nowMs, deltaMs, frameIndex: this.frameIndex });
    this.frameIndex += 1;
  }

  resetForBridgeSwap(): void {
    this.assertActive();
    this.adapter.resetForBridgeSwap();
  }

  state(): AoeVoxelRendererState {
    return { mode: 'voxel', metrics: this.runtime.metrics() };
  }

  inspectUnitMotion(identity: string): AoeUnitMotionHistory | null {
    this.assertActive();
    return this.adapter.inspectUnitMotion(identity);
  }

  captureWorld(): ThreeCaptureResult {
    this.assertActive();
    return this.runtime.capture();
  }

  captureComposite(overlay: HTMLCanvasElement): HTMLCanvasElement | null {
    this.assertActive();
    const composite = overlay.ownerDocument.createElement('canvas');
    composite.width = overlay.width;
    composite.height = overlay.height;
    const context = composite.getContext('2d');
    if (!context) return null;
    // Force a same-call render/readback before drawing the WebGL canvas. This
    // keeps capture valid without a globally preserved drawing buffer.
    this.captureWorld();
    context.drawImage(this.canvas, 0, 0, composite.width, composite.height);
    context.drawImage(overlay, 0, 0, composite.width, composite.height);
    return composite;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.runtime.dispose();
    this.canvas.remove();
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('AoeVoxelWorldRenderer is disposed.');
  }
}
