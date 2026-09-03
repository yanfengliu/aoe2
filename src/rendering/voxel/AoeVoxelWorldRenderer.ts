import type { ApplyResultV1, RenderSnapshotV1 } from 'voxel/core';
import {
  ThreeRenderRuntime,
  type StylizedResolveOptions,
  type ThreeCaptureResult,
  type ThreeFrameContext,
  type ThreeRenderMetrics,
  type ThreeRenderRuntimeOptions,
} from 'voxel/three';

import type { ProjectedEntityView } from '../../game/simulation/types';
import { MOEBIUS_RESOLVE } from '../artStyles';
import type { CameraState } from '../viewTypes';
import { cameraStateToVoxelView } from './aoeCameraSync';
import { AoeVoxelAdapter } from './aoeVoxelAdapter';
import { AOE_DAYLIGHT } from './aoeVoxelDaylight';
import type { AoeVoxelOverlayInput } from './aoeVoxelOverlayParts';
import type { AoeUnitMotionHistory } from './aoeVoxelUnitAnimation';
import { matrixForPart } from './aoeVoxelRecipeTypes';
import {
  findPreparedVoxelEntitiesAtIsoPoint,
  type PreparedVoxelHitState,
  type VoxelHitPurpose,
} from './aoeVoxelHitProxy';
import type { OccludedUnitState } from './aoeVoxelOcclusionSilhouettes';

export interface AoeVoxelRuntime {
  acceptSnapshot(snapshot: RenderSnapshotV1): ApplyResultV1;
  frame(context: ThreeFrameContext): void;
  setStylizedResolve(options: StylizedResolveOptions | null): void;
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
  /** Defaults to the persisted preference, then to `DEFAULT_ART_STYLE_ID`. */
}

export interface AoeVoxelRendererState {
  readonly mode: 'voxel';
  readonly metrics: ThreeRenderMetrics;
}

export interface PresentedVoxelPartMatrix {
  readonly revision: number;
  readonly key: string;
  readonly matrix: readonly number[];
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
  private pendingHitState: PreparedVoxelHitState | null = null;
  private presentedHitState: PreparedVoxelHitState | null = null;
  private animationNowMs = 0;
  private animationClockInitialized = false;
  private lastSimulationDisplayTimeMs: number | null = null;
  private presentedNowMs = 0;
  private disposed = false;

  constructor(options: AoeVoxelWorldRendererOptions) {
    this.width = options.width;
    this.height = options.height;
    this.pixelRatio = options.pixelRatio ?? 1;
    this.canvas = options.host.ownerDocument.createElement('canvas');
    this.canvas.className = 'voxel-world-canvas';
    this.canvas.setAttribute('aria-label', 'Age of Empires voxel world');
    this.canvas.setAttribute('role', 'application');
    this.canvas.tabIndex = 0;
    this.canvas.dataset.worldRenderer = 'voxel';

    const createRuntime = options.createRuntime ?? defaultRuntime;
    this.runtime = createRuntime({
      canvas: this.canvas,
      width: this.width,
      height: this.height,
      pixelRatio: this.pixelRatio,
      stylizedResolve: MOEBIUS_RESOLVE,
      tileWidthPixels: 64,
      tileHeightPixels: 32,
      // Shared with the cast-shadow projector, so the sun that lights a roof
      // is the sun its shadow falls away from.
      daylight: AOE_DAYLIGHT,
      rendererParameters: {
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      },
    });
    options.host.append(this.canvas);
  }

  present(
    entities: readonly ProjectedEntityView[],
    simulationDisplayTimeMs: number,
    overlays?: AoeVoxelOverlayInput,
  ): void {
    this.assertActive();
    const snapshot = this.adapter.createSnapshot(entities, simulationDisplayTimeMs, overlays);
    const result = this.runtime.acceptSnapshot(snapshot);
    if (result.status === 'rejected') {
      throw new Error(
        `Voxel snapshot rejected (${result.code} at ${result.path}): ${result.message}`,
      );
    }
    // Voxel ambient animation and hit geometry share a monotonic clock driven
    // only by forward simulation display progress. Browser RAF time advances
    // while paused, while replay scrubs can move simulation time backward;
    // neither may move this dependency-facing clock. Bridge swaps rebase the
    // next sample through lastSimulationDisplayTimeMs=null below.
    if (!this.animationClockInitialized) {
      this.animationNowMs = simulationDisplayTimeMs;
      this.animationClockInitialized = true;
    } else if (this.lastSimulationDisplayTimeMs !== null) {
      this.animationNowMs += Math.max(
        0,
        simulationDisplayTimeMs - this.lastSimulationDisplayTimeMs,
      );
    }
    this.lastSimulationDisplayTimeMs = simulationDisplayTimeMs;
    const hitState = this.adapter.latestHitState();
    if (
      !hitState
      || hitState.epoch !== result.epoch
      || hitState.revision !== result.revision
    ) throw new Error('Voxel hit state did not match the accepted render snapshot.');
    this.pendingHitState = hitState;
  }

  frame(
    camera: CameraState,
    _wallNowMs: number,
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
    this.runtime.frame({
      nowMs: this.animationNowMs,
      deltaMs,
      frameIndex: this.frameIndex,
    });
    this.frameIndex += 1;
    const metrics = this.runtime.metrics();
    if (
      metrics.state === 'running'
      && this.pendingHitState
      && metrics.presentedEpoch === this.pendingHitState.epoch
      && metrics.presentedRevision === this.pendingHitState.revision
    ) this.presentedHitState = this.pendingHitState;
    if (
      metrics.state === 'running'
      && this.presentedHitState
      && metrics.presentedEpoch === this.presentedHitState.epoch
      && metrics.presentedRevision === this.presentedHitState.revision
    ) this.presentedNowMs = this.animationNowMs;
  }

  resetForBridgeSwap(): void {
    this.assertActive();
    this.adapter.resetForBridgeSwap();
    this.lastSimulationDisplayTimeMs = null;
    this.pendingHitState = null;
    this.presentedHitState = null;
  }

  state(): AoeVoxelRendererState {
    return { mode: 'voxel', metrics: this.runtime.metrics() };
  }

  inspectUnitMotion(identity: string): AoeUnitMotionHistory | null {
    this.assertActive();
    return this.adapter.inspectUnitMotion(identity);
  }

  /** Bounded read-only diagnostic for browser presentation proofs. */
  inspectPresentedPartMatrix(
    identity: string,
    partSuffix: string,
  ): PresentedVoxelPartMatrix | null {
    this.assertActive();
    if (!this.isInteractionReady() || !this.presentedHitState) return null;
    const key = `${identity}:${partSuffix}`;
    for (const entity of this.presentedHitState.entities) {
      const part = entity.parts.find((candidate) => candidate.key === key);
      if (part) {
        return {
          revision: this.presentedHitState.revision,
          key,
          matrix: [...matrixForPart(part)],
        };
      }
    }
    return null;
  }

  /** Units whose behind-building silhouette cue fired in the latest snapshot. */
  getOccludedUnitStates(): readonly OccludedUnitState[] {
    this.assertActive();
    return this.adapter.latestOccludedUnits();
  }

  isInteractionReady(): boolean {
    this.assertActive();
    const metrics = this.runtime.metrics();
    return metrics.state === 'running'
      && metrics.acceptedEpoch !== null
      && metrics.acceptedRevision !== null
      && metrics.acceptedEpoch === metrics.presentedEpoch
      && metrics.acceptedRevision === metrics.presentedRevision
      && metrics.presentedEpoch === this.presentedHitState?.epoch
      && metrics.presentedRevision === this.presentedHitState.revision;
  }

  findPresentedEntitiesAtIsoPoint(
    isoX: number,
    isoY: number,
    purpose: VoxelHitPurpose,
  ): ProjectedEntityView[] {
    if (!this.isInteractionReady() || !this.presentedHitState) return [];
    return findPreparedVoxelEntitiesAtIsoPoint(
      this.presentedHitState.entities,
      isoX,
      isoY,
      purpose,
      this.presentedNowMs,
    );
  }

  captureWorld(): ThreeCaptureResult {
    this.assertActive();
    return this.runtime.capture();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pendingHitState = null;
    this.presentedHitState = null;
    this.runtime.dispose();
    this.canvas.remove();
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('AoeVoxelWorldRenderer is disposed.');
  }
}
