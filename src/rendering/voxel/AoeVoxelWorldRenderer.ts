import {
  ACESFilmicToneMapping,
  NoToneMapping,
  Scene,
  WebGLRenderer,
  type ToneMapping,
  type WebGLRendererParameters,
} from 'three';
import type { ApplyResultV1, RenderSnapshotV1 } from 'voxel/core';
import {
  ThreeRenderRuntime,
  type RendererLike,
  type StylizedResolveOptions,
  type ThreeCaptureResult,
  type ThreeFrameContext,
  type ThreeRenderMetrics,
  type ThreeRenderRuntimeOptions,
} from 'voxel/three';

import type { ProjectedEntityView } from '../../game/simulation/types';
import { artStyleById, type ArtStyle, type ArtStyleGround, type ArtStyleId } from '../artStyles';
import { readArtStylePreference } from '../artStylePreference';
import type { CameraState } from '../viewTypes';
import { cameraStateToVoxelView } from './aoeCameraSync';
import { AoeDeGround } from './aoeDeGround';
import { packDeGround } from './aoeDeGroundData';
import {
  deGroundTierFor,
  readDeGroundTierOverride,
  webglRendererName,
  type DeGroundTier,
  type RendererNamingContext,
} from './aoeDeGroundTier';
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

/** The part of Three's `WebGLRenderer` an art style drives, and the context the ground's tier is read from. */
export interface ToneMappedRenderer extends RendererLike {
  toneMapping: ToneMapping;
  toneMappingExposure: number;
  getContext?(): RendererNamingContext;
}

export interface AoeVoxelWorldRendererOptions {
  readonly host: HTMLElement;
  readonly width: number;
  readonly height: number;
  readonly pixelRatio?: number;
  readonly createRuntime?: (options: ThreeRenderRuntimeOptions) => AoeVoxelRuntime;
  /** Defaults to the persisted preference, then to `DEFAULT_ART_STYLE_ID`. */
  readonly artStyleId?: ArtStyleId;
  /** Builds the WebGL renderer the runtime draws with; a seam for tests. */
  readonly createWebGLRenderer?: (parameters: WebGLRendererParameters) => ToneMappedRenderer;
}

export interface AoeVoxelRendererState {
  readonly mode: 'voxel';
  /** The art style the canvas is drawn in. */
  readonly artStyle: ArtStyleId;
  /** What draws the ground: the voxel chunks (`metrics.chunks`) or AoE's textured ground mesh. */
  readonly ground: ArtStyleGround;
  /** Which shader the textured ground draws with when it shows (aoeDeGroundTier.ts). */
  readonly groundTier: DeGroundTier;
  /** The renderer the canvas's WebGL context names, which the tier is read from; null when it names none. */
  readonly rasteriser: string | null;
  readonly metrics: ThreeRenderMetrics;
  /** Every call to frame() so far, by the frame loop or by a hit test that had
   *  to draw first. A call while the context is lost or restoring draws
   *  nothing; `metrics.frames` counts the frames the runtime committed. */
  readonly framesDrawn: number;
}

const TONE_MAPPING: Record<ArtStyle['toneMapping'], ToneMapping> = {
  none: NoToneMapping,
  'aces-filmic': ACESFilmicToneMapping,
};

function applyToneMapping(renderer: ToneMappedRenderer, style: ArtStyle): void {
  renderer.toneMapping = TONE_MAPPING[style.toneMapping];
  renderer.toneMappingExposure = style.exposure;
}

function defaultWebGLRenderer(parameters: WebGLRendererParameters): ToneMappedRenderer {
  return new WebGLRenderer(parameters);
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
  private artStyle: ArtStyle;
  private webglRenderer: ToneMappedRenderer | null = null;
  // The scene the runtime draws is AoE's, lent to it, so it can hold AoE's own ground mesh beside the voxel
  // content; the runtime adds only its root group and its daylight rig, which lights both.
  private readonly scene = new Scene();
  private readonly ground = new AoeDeGround();
  // Read once, when the renderer is built; null lets the renderer's name decide.
  private readonly groundTierOverride = readDeGroundTierOverride();
  private rasteriser: string | null = null;
  // A restored context can be a different renderer: Chromium falls back to SwiftShader when its GPU process fails.
  private readonly redetectGroundTier = (): void => { this.detectGroundTier(); };

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
    const createWebGLRenderer = options.createWebGLRenderer ?? defaultWebGLRenderer;
    this.artStyle = artStyleById(options.artStyleId ?? readArtStylePreference());
    this.adapter.setExploredGround(this.artStyle.exploredGround);
    this.scene.add(this.ground.mesh);
    this.applyGround(this.artStyle.ground);
    this.runtime = createRuntime({
      canvas: this.canvas,
      scene: this.scene,
      width: this.width,
      height: this.height,
      pixelRatio: this.pixelRatio,
      // Omitted when the style has no pass, so the DE style costs nothing
      // rather than paying for a pass configured to do nothing.
      stylizedResolve: this.artStyle.resolve ?? undefined,
      // AoE holds the WebGL renderer so a style can set its tone mapping.
      // Three switches shader programs itself when that changes, so a live
      // switch rebuilds no voxel content (the first switch to a curve
      // recompiles the scene's shaders once). Moebius keeps its frame exactly
      // because it sets no curve and its pass's final draw applies none.
      rendererFactory: (parameters) => {
        const renderer = createWebGLRenderer(parameters);
        applyToneMapping(renderer, this.artStyle);
        this.webglRenderer = renderer;
        this.detectGroundTier();
        return renderer;
      },
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
    this.canvas.addEventListener('webglcontextrestored', this.redetectGroundTier);
    options.host.append(this.canvas);
  }

  /** The art style the canvas is drawn in. */
  artStyleId(): ArtStyleId {
    return this.artStyle.id;
  }

  /**
   * Switches the look without rebuilding the world: the resolve pass and the
   * tone mapping apply from the next frame, the explored-ground level from
   * the next snapshot. The caller re-presents so a paused frame changes too.
   */
  setArtStyle(id: ArtStyleId): void {
    this.assertActive();
    const style = artStyleById(id);
    // Recorded only after the runtime accepts the pass. The swap can throw — a
    // refused renderer, a disposed or failed runtime — and voxel keeps the old
    // pass drawing when it does. Recording first would leave `artStyleId()`
    // and the menu naming a style the canvas is not in.
    this.runtime.setStylizedResolve(style.resolve);
    if (this.webglRenderer) applyToneMapping(this.webglRenderer, style);
    this.adapter.setExploredGround(style.exploredGround);
    this.applyGround(style.ground);
    this.artStyle = style;
  }

  /** The ground's tier from the renderer the WebGL context names (aoeDeGroundTier.ts), unless storage overrides it. */
  private detectGroundTier(): void {
    this.rasteriser = webglRendererName(this.webglRenderer?.getContext?.());
    this.ground.setTier(this.groundTierOverride ?? deGroundTierFor(this.rasteriser));
  }

  /** One ground at a time: the voxel chunks leave the next snapshot when the textured ground shows, and come
   *  back when it hides. Both drawn at once z-fight (the de-look plan's experiment E3). */
  private applyGround(ground: ArtStyleGround): void {
    this.adapter.setVoxelGround(ground === 'voxel');
    this.ground.setVisible(ground === 'textured');
  }

  present(
    entities: readonly ProjectedEntityView[],
    simulationDisplayTimeMs: number,
    overlays?: AoeVoxelOverlayInput,
  ): void {
    this.assertActive();
    // The textured ground takes the same frame's cells and fog, so it shows with the snapshot it belongs to.
    // Packed before the snapshot is accepted: if packing throws, the runtime keeps the previous frame whole
    // rather than holding a chunk-less snapshot over a stale ground.
    const ground = this.artStyle.ground === 'textured'
      ? packDeGround(entities, overlays?.frame ?? null, this.artStyle.exploredGround)
      : null;
    const snapshot = this.adapter.createSnapshot(entities, simulationDisplayTimeMs, overlays);
    const result = this.runtime.acceptSnapshot(snapshot);
    if (result.status === 'rejected') {
      throw new Error(
        `Voxel snapshot rejected (${result.code} at ${result.path}): ${result.message}`,
      );
    }
    if (ground) this.ground.update(ground);
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
    return {
      mode: 'voxel',
      artStyle: this.artStyle.id,
      ground: this.artStyle.ground,
      groundTier: this.ground.tier,
      rasteriser: this.rasteriser,
      metrics: this.runtime.metrics(),
      framesDrawn: this.frameIndex,
    };
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
    this.canvas.removeEventListener('webglcontextrestored', this.redetectGroundTier);
    // The ground first: disposing the runtime disposes the WebGL renderer, after which Three no longer tracks
    // the ground's textures and could not free them.
    this.ground.dispose();
    this.runtime.dispose();
    this.canvas.remove();
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('AoeVoxelWorldRenderer is disposed.');
  }
}
