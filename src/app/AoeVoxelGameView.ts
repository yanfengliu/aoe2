import type { EntityRef, Position } from 'civ-engine';
import type { ThreeCaptureResult } from 'voxel/three';

import {
  createVoxelCameraController,
  type VoxelCameraController,
} from '../input/voxelCameraController';
import {
  createVoxelPointerInputController,
  type VoxelPointerInputController,
} from '../input/voxelPointerInputController';
import {
  createVoxelSelectionController,
  type VoxelSelectionController,
} from '../input/voxelSelectionController';
import type { SimulationBridge } from '../game/simulation/createSimulationBridge';
import { MAP_HEIGHT, MAP_WIDTH } from '../game/simulation/prototypeScenario';
import { isoToWorld, worldToIso } from '../rendering/isometricProjection';
import {
  AoeVoxelWorldRenderer,
  type AoeVoxelRendererState,
} from '../rendering/voxel/AoeVoxelWorldRenderer';
import {
  createAoeVoxelPresentationCoordinator,
  type AoeVoxelPresentationCoordinator,
} from '../rendering/voxel/AoeVoxelPresentationCoordinator';
import type { AoeUnitMotionHistory } from '../rendering/voxel/aoeVoxelUnitAnimation';
import type {
  BuildingVisualState,
  CameraState,
  DisplayedEntityState,
  EntityHealthBarState,
  PlacementPreviewViewState,
  PlacementPreviewVisualState,
  SelectionBoxState,
} from '../rendering/viewTypes';
import { boundedVisibleSimulationDelta } from './voxelFrameTiming';

export interface AoeVoxelGameViewOptions {
  readonly host: HTMLElement;
  readonly bridge: SimulationBridge;
  readonly pixelRatio?: number;
}

const MAX_CAMERA_FRAME_DELTA_MS = 100;

/**
 * Browser host for AoE's single voxel world canvas.
 *
 * Simulation state remains authoritative. This class owns only disposable
 * camera, input, presentation, animation-frame, and GPU resources.
 */
export class AoeVoxelGameView {
  private bridge: SimulationBridge;
  private readonly host: HTMLElement;
  private readonly renderer: AoeVoxelWorldRenderer;
  private readonly camera: VoxelCameraController;
  private readonly selection: VoxelSelectionController;
  private readonly pointer: VoxelPointerInputController;
  private readonly presentation: AoeVoxelPresentationCoordinator;
  private readonly pressedKeys = new Set<string>();
  private readonly destroyListeners = new Set<() => void>();
  private resizeObserver: ResizeObserver | null = null;
  private animationFrameId: number | null = null;
  private lastFrameTimeMs: number | null = null;
  private currentFrameTimeMs = 0;
  private booted = false;
  private disposed = false;

  constructor(options: AoeVoxelGameViewOptions) {
    this.host = options.host;
    this.bridge = options.bridge;
    const size = this.hostSize();
    let rendererToDispose: AoeVoxelWorldRenderer | null = null;
    let pointerToDispose: VoxelPointerInputController | null = null;
    let globalListenersInstalled = false;
    try {
      this.renderer = new AoeVoxelWorldRenderer({
        host: this.host,
        width: size.width,
        height: size.height,
        pixelRatio: options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2),
      });
      rendererToDispose = this.renderer;

      this.camera = createVoxelCameraController({
      canvas: this.renderer.canvas,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      getPressedKeys: () => this.pressedKeys,
      getPointerState: () => this.pointer?.getPointerState()
        ?? { x: 0, y: 0, hasMoved: false, isDown: false },
      isDragSelecting: () => this.pointer?.isDragSelecting() ?? false,
      isMiddleDragging: () => this.pointer?.isMiddleDragging() ?? false,
    });
      this.camera.resize(size.width, size.height);
      this.camera.setZoom(this.camera.initialZoom);

      this.selection = createVoxelSelectionController({
      isActive: () => this.booted && !this.disposed,
      nowMs: () => this.currentFrameTimeMs,
      getBridge: () => this.bridge,
      getDisplayedEntities: () => this.presentation?.displayedEntities() ?? [],
      getVoxelHitEntities: (isoX, isoY, purpose) => (
        this.renderer.findPresentedEntitiesAtIsoPoint(isoX, isoY, purpose)
      ),
      getViewportCellBounds: () => this.viewportCellBounds(),
    });
      this.pointer = createVoxelPointerInputController({
      canvas: this.renderer.canvas,
      getBridge: () => this.bridge,
      getCameraController: () => this.camera,
      getDisplayedEntities: () => this.presentation?.displayedEntities() ?? [],
      selectEntityAtWorldPosition: (x, y) => this.selectEntityAtWorldPosition(x, y),
      issueContextCommandAtWorldPosition: (x, y) => (
        this.issueContextCommandAtWorldPosition(x, y)
      ),
      clearRecentSelectionClicks: () => this.selection.clearRecentSelectionClicks(),
      });
      pointerToDispose = this.pointer;
      this.presentation = createAoeVoxelPresentationCoordinator({
      getBridge: () => this.bridge,
      isActive: () => this.booted && !this.disposed,
      getPlacementPreviewState: () => this.getPlacementPreviewState(),
      getSelectionBoxState: () => this.getSelectionBoxState(),
      screenToWorldPosition: (screenX, screenY) => {
        const iso = this.camera.screenToIso(screenX, screenY);
        const world = isoToWorld(iso.x, iso.y);
        return { x: world.cellX, z: world.cellY };
      },
      centerCameraOnWorldPosition: (x, y) => this.camera.centerOnWorldPosition(x, y),
      present: (entities, simulationDisplayTimeMs, overlays) => {
        this.renderer.present(entities, simulationDisplayTimeMs, overlays);
      },
      });
      this.installGlobalListeners();
      globalListenersInstalled = true;
      this.resizeObserver = typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(this.handleResize);
      this.resizeObserver?.observe(this.host);

      this.booted = true;
      this.presentation.syncFromBridge(true);
      this.renderer.frame(this.camera.getState(), 0, 0);
    } catch (error) {
      this.booted = false;
      this.resizeObserver?.disconnect();
      if (globalListenersInstalled) this.removeGlobalListeners();
      pointerToDispose?.dispose();
      rendererToDispose?.dispose();
      throw error;
    }
  }

  isBooted(): boolean {
    return this.booted && !this.disposed;
  }

  start(): void {
    this.assertActive();
    if (this.animationFrameId !== null) return;
    this.lastFrameTimeMs = null;
    this.animationFrameId = window.requestAnimationFrame(this.frame);
  }

  setBridge(bridge: SimulationBridge): void {
    this.assertActive();
    this.bridge = bridge;
    this.pointer.reset();
    this.camera.resetEdgePanState();
    this.selection.clearRecentSelectionClicks();
    this.presentation.resetForBridgeSwap();
    this.renderer.resetForBridgeSwap();
    this.syncFromBridge(true);
  }

  syncFromBridge(force = false): void {
    if (!this.isBooted()) return;
    this.presentation.syncFromBridge(force);
  }

  getCameraState(): CameraState | null {
    if (!this.isBooted()) return null;
    this.handleResize();
    return this.camera.getState();
  }

  getWorldRendererState(): AoeVoxelRendererState {
    return this.renderer.state();
  }

  getWorldCanvasRect(): { x: number; y: number; width: number; height: number } {
    this.assertActive();
    const rect = this.renderer.canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  inspectVoxelUnitMotion(identity: string): AoeUnitMotionHistory | null {
    return this.renderer.inspectUnitMotion(identity);
  }

  getWorldCapture(): ThreeCaptureResult {
    this.assertActive();
    this.renderer.frame(this.camera.getState(), this.currentFrameTimeMs, 0);
    return this.renderer.captureWorld();
  }

  centerCameraOnWorldPosition(worldX: number, worldY: number): void {
    this.camera.centerOnWorldPosition(worldX, worldY);
  }

  panCameraTo(target: EntityRef | Position): void {
    if ('id' in target && 'generation' in target) {
      const ref = target as EntityRef;
      if (!this.bridge.world.isCurrent(ref)) return;
      const position = this.bridge.world.getComponent<Position>(ref.id, 'position');
      if (position) this.camera.centerOnWorldPosition(position.x, position.y);
      return;
    }
    if ('x' in target && 'y' in target) {
      this.camera.centerOnWorldPosition(target.x, target.y);
    }
  }

  getScreenPointForCell(cellX: number, cellY: number): { x: number; y: number } | null {
    if (!this.isBooted()) return null;
    this.handleResize();
    return this.camera.getScreenPointForCell(cellX, cellY);
  }

  selectEntityAtWorldPosition(
    worldX: number,
    worldY: number,
    isoX?: number,
    isoY?: number,
  ): boolean {
    this.syncFromBridge();
    this.renderer.frame(this.camera.getState(), this.currentFrameTimeMs, 0);
    if (!this.renderer.isInteractionReady()) return false;
    const iso = isoX === undefined || isoY === undefined
      ? worldToIso(worldX, worldY)
      : { x: isoX, y: isoY };
    return this.selection.selectEntityAtWorldPosition(worldX, worldY, iso.x, iso.y);
  }

  issueContextCommandAtWorldPosition(
    worldX: number,
    worldY: number,
    isoX?: number,
    isoY?: number,
  ): boolean {
    this.syncFromBridge();
    this.renderer.frame(this.camera.getState(), this.currentFrameTimeMs, 0);
    if (!this.renderer.isInteractionReady()) return false;
    const iso = isoX === undefined || isoY === undefined
      ? worldToIso(worldX, worldY)
      : { x: isoX, y: isoY };
    return this.selection.issueContextCommandAtWorldPosition(worldX, worldY, iso.x, iso.y);
  }

  getSelectionBoxState(): SelectionBoxState | null {
    return this.pointer.getSelectionBoxState();
  }

  getPlacementPreviewState(): PlacementPreviewViewState | null {
    const selection = this.bridge.getSelectionState();
    if (!selection.placementMode) return null;
    const pointer = this.pointer.getPointerState();
    const iso = this.camera.screenToIso(pointer.x, pointer.y);
    const cell = isoToWorld(iso.x, iso.y);
    const cellX = clamp(Math.floor(cell.cellX), 0, MAP_WIDTH - 1);
    const cellY = clamp(Math.floor(cell.cellY), 0, MAP_HEIGHT - 1);
    const preview = this.bridge.getPlacementPreview(cellX, cellY);
    return preview ? { ...preview } : null;
  }

  getPlacementPreviewVisualState(): PlacementPreviewVisualState | null {
    return this.presentation.getPlacementPreviewVisualState();
  }

  getBuildingVisualStates(): BuildingVisualState[] {
    return this.presentation.getBuildingVisualStates();
  }

  getEntityHealthBarStates(): EntityHealthBarState[] {
    return this.presentation.getEntityHealthBarStates();
  }

  getDisplayedEntities(): DisplayedEntityState[] {
    return this.presentation.getDisplayedEntities();
  }

  onDestroy(listener: () => void): () => void {
    if (this.disposed) {
      listener();
      return () => undefined;
    }
    this.destroyListeners.add(listener);
    return () => this.destroyListeners.delete(listener);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.booted = false;
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.resizeObserver?.disconnect();
    this.removeGlobalListeners();
    this.pointer.dispose();
    this.pressedKeys.clear();
    this.renderer.dispose();
    for (const listener of this.destroyListeners) listener();
    this.destroyListeners.clear();
  }

  private readonly frame = (timeMs: number): void => {
    if (this.disposed) return;
    const elapsedMs = this.lastFrameTimeMs === null
      ? 0
      : Math.max(0, timeMs - this.lastFrameTimeMs);
    const simulationDeltaMs = boundedVisibleSimulationDelta(elapsedMs);
    const cameraDeltaMs = Math.min(MAX_CAMERA_FRAME_DELTA_MS, elapsedMs);
    this.lastFrameTimeMs = timeMs;
    this.currentFrameTimeMs = timeMs;
    this.bridge.step(simulationDeltaMs);
    this.camera.update(timeMs, cameraDeltaMs);
    this.syncFromBridge();
    this.renderer.frame(this.camera.getState(), timeMs, simulationDeltaMs);
    this.animationFrameId = window.requestAnimationFrame(this.frame);
  };

  private readonly handleResize = (): void => {
    if (this.disposed) return;
    const size = this.hostSize();
    this.camera.resize(size.width, size.height);
  };

  private readonly handleFullscreenChange = (): void => {
    this.camera.resetEdgePanState();
    this.handleResize();
  };

  private readonly handleVisibilityChange = (): void => {
    this.lastFrameTimeMs = null;
    this.pressedKeys.clear();
    this.pointer.reset();
    this.camera.resetEdgePanState();
  };

  private installGlobalListeners(): void {
    this.renderer.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.renderer.canvas.addEventListener('pointerdown', this.handleCanvasPointerDown);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private removeGlobalListeners(): void {
    this.renderer.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.renderer.canvas.removeEventListener('pointerdown', this.handleCanvasPointerDown);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private readonly handleDoubleClick = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly handleCanvasPointerDown = (): void => {
    this.renderer.canvas.focus({ preventScroll: true });
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) return;
    if (isCameraKey(event.code)) {
      this.pressedKeys.add(event.code);
      event.preventDefault();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private readonly handleWindowBlur = (): void => {
    this.pressedKeys.clear();
    this.pointer.reset();
    this.camera.resetEdgePanState();
  };

  private viewportCellBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const corners = this.camera.getState().viewCorners;
    return {
      minX: Math.min(...corners.map((point) => point.cellX)),
      minY: Math.min(...corners.map((point) => point.cellY)),
      maxX: Math.max(...corners.map((point) => point.cellX)),
      maxY: Math.max(...corners.map((point) => point.cellY)),
    };
  }

  private hostSize(): { width: number; height: number } {
    return {
      width: Math.max(1, this.host.clientWidth || window.innerWidth || 1),
      height: Math.max(1, this.host.clientHeight || window.innerHeight || 1),
    };
  }

  private assertActive(): void {
    if (!this.isBooted()) throw new Error('AoeVoxelGameView is disposed.');
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isCameraKey(code: string): boolean {
  return code === 'ArrowLeft'
    || code === 'ArrowRight'
    || code === 'ArrowUp'
    || code === 'ArrowDown'
    || code === 'KeyW'
    || code === 'KeyA'
    || code === 'KeyS'
    || code === 'KeyD';
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || Boolean(target.closest('input, textarea, select')));
}
