import Phaser from 'phaser';
import type { EntityRef, Position } from 'civ-engine';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../../game/simulation/prototypeScenario';
import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';
import {
  AoeVoxelWorldRenderer,
  type AoeVoxelRendererState,
} from '../../rendering/voxel/AoeVoxelWorldRenderer';
import type { ThreeCaptureResult } from 'voxel/three';
import {
  createCameraController,
  type CameraController,
} from './gameScene/cameraController';
import { isoToWorld } from './gameScene/isoProjection';
import { isoWorldPixelBounds } from './gameScene/isoViewHelpers';
import {
  createPointerInputController,
  type PointerInputController,
} from './gameScene/pointerInputController';
import {
  createGameSceneRenderer,
  type GameSceneRenderer,
} from './gameScene/sceneRenderer';
import {
  createSelectionController,
  type SelectionController,
} from './gameScene/selectionController';
import {
  CELL_SIZE,
  type BuildingVisualState,
  type CameraState,
  type DisplayedEntityState,
  type EntityHealthBarState,
  type GameSceneOptions,
  type OccludedUnitState,
  type PlacementPreviewViewState,
  type PlacementPreviewVisualState,
  type SelectionBoxState,
  type WorldRendererMode,
} from './gameScene/sceneViewTypes';

// View-state types + the debug-overlay mode union live in
// `gameScene/sceneViewTypes.ts`; re-exported here so existing importers keep
// resolving them from this module.
export type {
  BuildingVisualState,
  CameraState,
  DebugOverlayMode,
  DisplayedEntityState,
  EntityHealthBarState,
  OccludedUnitState,
  PlacementPreviewViewState,
  PlacementPreviewVisualState,
  SelectionBoxState,
} from './gameScene/sceneViewTypes';

export class GameScene extends Phaser.Scene {
  // FU5: mutable so the HUD's Load button can swap the scene onto a
  // freshly-rehydrated bridge without reconstructing Phaser.
  private bridge: SimulationBridge;
  private readonly options: GameSceneOptions;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private cameraController?: CameraController;
  private sceneRenderer?: GameSceneRenderer;
  private voxelWorldRenderer?: AoeVoxelWorldRenderer;
  private activeRendererMode: WorldRendererMode = 'phaser';
  private selectionController?: SelectionController;
  private pointerInput?: PointerInputController;
  private readonly handleNativeDoubleClick = (event: MouseEvent): void => {
    // Phaser's pointer-up handler owns same-type promotion; this listener only
    // suppresses browser-native text selection on canvas double clicks.
    event.preventDefault();
  };

  constructor(
    bridge: SimulationBridge,
    options: GameSceneOptions = { getDebugOverlayMode: () => 'off' },
  ) {
    super('game');
    this.bridge = bridge;
    this.options = options;
  }

  create(): void {
    this.activeRendererMode = this.options.rendererMode ?? 'phaser';
    this.game.canvas?.classList.add('phaser-overlay-canvas');
    if (this.activeRendererMode === 'voxel') {
      const host = this.game.canvas?.parentElement;
      if (host) {
        try {
          this.voxelWorldRenderer = new AoeVoxelWorldRenderer({
            host,
            width: this.scale.width,
            height: this.scale.height,
            pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
          });
        } catch (error) {
          console.warn('[aoe2] voxel renderer failed to initialize; using Phaser.', error);
          this.activeRendererMode = 'phaser';
        }
      } else {
        console.warn('[aoe2] voxel renderer host is unavailable; using Phaser.');
        this.activeRendererMode = 'phaser';
      }
    }

    // Creates the eight graphics layers (in the pre-split depth order) plus
    // the per-role sub-renderers, and owns every render-side cache.
    this.sceneRenderer = createGameSceneRenderer({
      scene: this,
      getBridge: () => this.bridge,
      getDebugOverlayMode: () => this.options.getDebugOverlayMode(),
      getCameraController: () => this.cameraController,
      getPlacementPreviewState: () => this.getPlacementPreviewState(),
      getSelectionBoxState: () => this.getSelectionBoxState(),
      getSelectionBoxKey: () => this.pointerInput?.getSelectionBoxKey() ?? 'none',
      worldRendererMode: this.activeRendererMode,
      presentVoxelWorld: (entities) => this.voxelWorldRenderer?.present(entities),
    });

    this.cameras.main.setBackgroundColor(
      this.activeRendererMode === 'voxel' ? 'rgba(0,0,0,0)' : '#132224',
    );
    // Isometric world extent: the diamond bounding box of all cells (its left
    // half spans negative X), with a one-tile margin so edge diamonds aren't
    // clipped. Replaces the top-down square extent.
    const isoBounds = isoWorldPixelBounds(MAP_WIDTH, MAP_HEIGHT, CELL_SIZE);
    this.cameras.main.setBounds(isoBounds.x, isoBounds.y, isoBounds.width, isoBounds.height);
    this.cameraController = createCameraController({
      scene: this,
      camera: this.cameras.main,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      isDragSelecting: () => this.pointerInput?.isDragSelecting() ?? false,
      isMiddleDragging: () => this.pointerInput?.isMiddleDragging() ?? false,
    });
    this.cameraController.setZoom(this.cameraController.initialZoom);
    // The camera recentres on the human player's base (Town Center, else the
    // centroid of owned entities) on the first render frame that has one — see
    // centerOnPlayerBaseOnce() in gameScene/sceneRenderer.ts. Until then it
    // sits at the clamped default.

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys(
      'W,A,S,D',
    ) as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.game.canvas?.addEventListener('dblclick', this.handleNativeDoubleClick);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.canvas?.removeEventListener('dblclick', this.handleNativeDoubleClick);
      this.voxelWorldRenderer?.dispose();
      this.voxelWorldRenderer = undefined;
    });

    this.selectionController = createSelectionController({
      scene: this,
      getBridge: () => this.bridge,
      getDisplayedEntities: () => this.sceneRenderer?.displayedEntities() ?? [],
    });
    // Registers the scene's wheel + pointer handlers (same registration order
    // as before the split: wheel, pointerdown, pointermove, pointerup).
    this.pointerInput = createPointerInputController({
      scene: this,
      getBridge: () => this.bridge,
      getCameraController: () => this.cameraController,
      getDisplayedEntities: () => this.sceneRenderer?.displayedEntities() ?? [],
      selectEntityAtWorldPosition: (worldX, worldY) =>
        this.selectEntityAtWorldPosition(worldX, worldY),
      issueContextCommandAtWorldPosition: (worldX, worldY) =>
        this.issueContextCommandAtWorldPosition(worldX, worldY),
      clearRecentSelectionClicks: () => this.clearRecentSelectionClicks(),
    });
  }

  update(_time: number, delta: number): void {
    this.bridge.step(delta);
    this.cameraController?.update(_time, delta, {
      cursors: this.cursors,
      wasd: this.wasd,
    });
    this.syncFromBridge();
    const camera = this.cameraController?.getState();
    if (camera && this.voxelWorldRenderer) {
      this.voxelWorldRenderer.frame(camera, _time, delta);
    }
  }

  // FU5: swap the live simulation bridge the scene is reading from. The
  // HUD Load button calls this after constructing a new bridge from a
  // save blob; the cached render/selection signatures are reset so the
  // very next syncFromBridge forces a full re-render against the newly
  // rehydrated world state.
  setBridge(bridge: SimulationBridge): void {
    this.bridge = bridge;
    this.pointerInput?.reset();
    this.cameraController?.resetEdgePanState();
    this.clearRecentSelectionClicks();
    this.sceneRenderer?.resetForBridgeSwap();
    this.voxelWorldRenderer?.resetForBridgeSwap();
    this.syncFromBridge(true);
  }

  syncFromBridge(force = false): void {
    this.sceneRenderer?.syncFromBridge(force);
  }

  getCameraState(): CameraState | null {
    return this.cameraController?.getState() ?? null;
  }

  getWorldRendererState(): AoeVoxelRendererState | { mode: 'phaser'; metrics: null } {
    return this.voxelWorldRenderer?.state() ?? { mode: 'phaser', metrics: null };
  }

  getCaptureCanvas(): HTMLCanvasElement | null {
    const overlay = this.game.canvas;
    if (!overlay) return null;
    if (this.voxelWorldRenderer) return this.voxelWorldRenderer.captureComposite(overlay);
    return overlay;
  }

  getWorldCapture(): ThreeCaptureResult | null {
    return this.voxelWorldRenderer?.captureWorld() ?? null;
  }

  centerCameraOnWorldPosition(worldX: number, worldY: number): void {
    this.cameraController?.centerOnWorldPosition(worldX, worldY);
  }

  // Spec 2 (annotation-ui v0.1.5) AO-4: pan camera to a target — either an
  // EntityRef (looked up via the bridge.world's isCurrent + Position
  // component) or a Position value (direct). Resolution direction is the
  // OPPOSITE of bridge.world.getEntityRef (which takes an id and returns
  // the current EntityRef): we have the EntityRef and need the position.
  // Stale refs (generation mismatch) and entities without a position
  // component are no-op (caller handles toast separately if desired).
  panCameraTo(target: EntityRef | Position): void {
    if (!this.cameraController) return;
    if ('id' in target && 'generation' in target) {
      const ref = target as EntityRef;
      const world = this.bridge.world;
      if (!world.isCurrent(ref)) return;
      const pos = world.getComponent<Position>(ref.id, 'position');
      if (!pos) return;
      this.cameraController.centerOnWorldPosition(pos.x, pos.y);
      return;
    }
    if ('x' in target && 'y' in target) {
      this.cameraController.centerOnWorldPosition(target.x, target.y);
    }
  }

  getScreenPointForCell(cellX: number, cellY: number): { x: number; y: number } | null {
    return this.cameraController?.getScreenPointForCell(cellX, cellY) ?? null;
  }

  selectEntityAtWorldPosition(worldX: number, worldY: number): boolean {
    return this.selectionController?.selectEntityAtWorldPosition(worldX, worldY) ?? false;
  }

  issueContextCommandAtWorldPosition(worldX: number, worldY: number): boolean {
    return this.selectionController?.issueContextCommandAtWorldPosition(worldX, worldY) ?? false;
  }

  getSelectionBoxState(): SelectionBoxState | null {
    return this.pointerInput?.getSelectionBoxState() ?? null;
  }

  getPlacementPreviewState(): PlacementPreviewViewState | null {
    const selectionState = this.bridge.getSelectionState();
    if (!selectionState.placementMode) {
      return null;
    }

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = isoToWorld(worldPoint.x, worldPoint.y);
    const cellX = Phaser.Math.Clamp(Math.floor(cell.cellX), 0, MAP_WIDTH - 1);
    const cellY = Phaser.Math.Clamp(Math.floor(cell.cellY), 0, MAP_HEIGHT - 1);
    const previewState = this.bridge.getPlacementPreview(cellX, cellY);
    if (!previewState) {
      return null;
    }

    return { ...previewState };
  }

  getPlacementPreviewVisualState(): PlacementPreviewVisualState | null {
    return this.sceneRenderer?.getPlacementPreviewVisualState() ?? null;
  }

  getBuildingVisualStates(): BuildingVisualState[] {
    return this.sceneRenderer?.getBuildingVisualStates() ?? [];
  }

  getEntityHealthBarStates(): EntityHealthBarState[] {
    return this.sceneRenderer?.getEntityHealthBarStates() ?? [];
  }

  getOccludedUnitStates(): OccludedUnitState[] {
    return this.sceneRenderer?.getOccludedUnitStates() ?? [];
  }

  getDisplayedEntities(): DisplayedEntityState[] {
    return this.sceneRenderer?.getDisplayedEntities() ?? [];
  }

  private clearRecentSelectionClicks(): void {
    this.selectionController?.clearRecentSelectionClicks();
  }
}
