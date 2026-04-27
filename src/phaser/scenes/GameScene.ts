import Phaser from 'phaser';

import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../../game/simulation/prototypeScenario';
import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';
import type {
  PlacementPreviewState,
  ProjectedFrameView,
  ProjectedEntityView,
  RenderState,
  SelectionState,
  UnitType,
} from '../../game/simulation/types';
import {
  doesWorldRectIntersectEntity,
  findCommandTargetEntityAtWorldPointInEntities,
  findEntitiesAtWorldPointInEntities,
} from './entityHitTest';
import {
  createCameraController,
  type CameraController,
} from './gameScene/cameraController';
import {
  createDebugOverlayRenderer,
  type DebugOverlayRenderer,
} from './gameScene/debugOverlay';
import {
  createBuildingRenderer,
  type BuildingRenderer,
} from './gameScene/buildingRenderer';
import {
  createSelectionLayersRenderer,
  type SelectionLayersRenderer,
} from './gameScene/selectionLayers';
import {
  createWorldLayersRenderer,
  type WorldLayersRenderer,
} from './gameScene/worldLayers';
import { isUnitType as isUnitTypeExternal } from './gameScene/unitTypeMap';
import { interpolateProjectedEntities } from './interpolateProjectedEntities';

// Slice 11: debug-overlay modes relevant to world-space drawing. The HUD
// owns the full cycle; the scene only needs to read the current mode to
// decide whether to draw selection rectangles, pathing lines, or fog tints.
// Slice 12 Task D adds `coarse-vs-fine` for the sub-grid probe overlay.
export type DebugOverlayMode =
  | 'off'
  | 'selection-bounds'
  | 'pathing'
  | 'fog-state'
  | 'ai-state'
  | 'perf'
  | 'coarse-vs-fine';

interface GameSceneOptions {
  getDebugOverlayMode(): DebugOverlayMode;
}

const CELL_SIZE = 24;

export interface CameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
  viewX: number;
  viewY: number;
  viewWidth: number;
  viewHeight: number;
}

export interface SelectionBoxState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  width: number;
  height: number;
  previewEntityIds: number[];
}

export interface PlacementPreviewViewState {
  active: boolean;
  buildingType: PlacementPreviewState['buildingType'];
  cellX: number;
  cellY: number;
  width: number;
  height: number;
  isValid: boolean;
}

export interface PlacementPreviewVisualState extends PlacementPreviewViewState {
  strokeWidth: number;
  cellOutlineCount: number;
  blockedMarkerCount: number;
}

export interface BuildingVisualState {
  id: number;
  buildingType: ProjectedEntityView['entityType'];
  owner: number | null;
  cellX: number;
  cellY: number;
  footprintWidthCells: number;
  footprintHeightCells: number;
  widthPx: number;
  heightPx: number;
  visualVariant: ProjectedEntityView['visualVariant'];
  hasFoundationSlab: boolean;
  hasScaffoldPosts: boolean;
  hasStructureBody: boolean;
  hasRoofAccent: boolean;
  hasConstructionIndicator: boolean;
  hasCompletionAccent: boolean;
}

export interface EntityHealthBarState {
  id: number;
  entityKind: 'unit' | 'building' | 'resource';
  entityType: ProjectedEntityView['entityType'];
  owner: number | null;
  currentHp: number;
  maxHp: number;
  fillRatio: number;
  barX: number;
  barY: number;
  barWidthPx: number;
  barHeightPx: number;
  entityTopPx: number;
}

export interface DisplayedEntityState {
  id: number;
  kind: ProjectedEntityView['kind'];
  entityType: ProjectedEntityView['entityType'];
  owner: number | null;
  x: number;
  y: number;
}

interface DragSelectionState {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  currentScreenX: number;
  currentScreenY: number;
}

interface MiddleDragPanState {
  pointerId: number;
  lastScreenX: number;
  lastScreenY: number;
}

interface RecentFriendlyUnitClick {
  atMs: number;
  cellX: number;
  cellY: number;
  unitType: UnitType | 'sheep';
}

interface RecentExactSelectionClick {
  cellX: number;
  cellY: number;
}

const DRAG_SELECTION_THRESHOLD_PX = 8;
const DOUBLE_CLICK_WINDOW_MS = 300;

export class GameScene extends Phaser.Scene {
  // FU5: mutable so the HUD's Load button can swap the scene onto a
  // freshly-rehydrated bridge without reconstructing Phaser.
  private bridge: SimulationBridge;
  private readonly options: GameSceneOptions;
  private terrainLayer?: Phaser.GameObjects.Graphics;
  private entityLayer?: Phaser.GameObjects.Graphics;
  private fogLayer?: Phaser.GameObjects.Graphics;
  private healthBarLayer?: Phaser.GameObjects.Graphics;
  private selectionLayer?: Phaser.GameObjects.Graphics;
  private placementLayer?: Phaser.GameObjects.Graphics;
  private selectionBoxLayer?: Phaser.GameObjects.Graphics;
  private debugLayer?: Phaser.GameObjects.Graphics;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private lastRenderedTick = -1;
  private lastRenderedInterpolationAlpha = Number.NaN;
  private lastSelectionKey = '';
  private lastProjectedEntities: ProjectedEntityView[] = [];
  private previousUnitProjectedPositions = new Map<number, { x: number; y: number }>();
  private displayedEntities: ProjectedEntityView[] = [];
  private dragSelection: DragSelectionState | null = null;
  private middleDragPan: MiddleDragPanState | null = null;
  private cameraController?: CameraController;
  private recentExactSelectionClick: RecentExactSelectionClick | null = null;
  private recentFriendlyUnitClick: RecentFriendlyUnitClick | null = null;
  private lastPlacementPreviewVisualState: PlacementPreviewVisualState | null = null;
  private lastBuildingVisualStates: BuildingVisualState[] = [];
  private lastEntityHealthBarStates: EntityHealthBarState[] = [];
  private debugOverlayRenderer?: DebugOverlayRenderer;
  private worldLayersRenderer?: WorldLayersRenderer;
  private buildingRenderer?: BuildingRenderer;
  private selectionLayersRenderer?: SelectionLayersRenderer;
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
    this.terrainLayer = this.add.graphics();
    this.entityLayer = this.add.graphics();
    this.fogLayer = this.add.graphics();
    this.healthBarLayer = this.add.graphics();
    this.selectionLayer = this.add.graphics();
    this.placementLayer = this.add.graphics();
    this.selectionBoxLayer = this.add.graphics();
    this.debugLayer = this.add.graphics();
    this.debugOverlayRenderer = createDebugOverlayRenderer({
      debugLayer: this.debugLayer,
      bridge: this.bridge,
      cellSize: CELL_SIZE,
    });
    this.worldLayersRenderer = createWorldLayersRenderer({
      healthBarLayer: this.healthBarLayer,
      fogLayer: this.fogLayer,
      cellSize: CELL_SIZE,
    });
    this.buildingRenderer = createBuildingRenderer({
      entityLayer: this.entityLayer,
      cellSize: CELL_SIZE,
    });
    this.selectionLayersRenderer = createSelectionLayersRenderer({
      selectionLayer: this.selectionLayer,
      placementLayer: this.placementLayer,
      selectionBoxLayer: this.selectionBoxLayer,
      cellSize: CELL_SIZE,
      screenToWorldPoint: (screenX, screenY) => {
        const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
        return { x: worldPoint.x, y: worldPoint.y };
      },
      getDisplayedEntities: () => this.displayedEntities,
    });

    this.cameras.main.setBackgroundColor('#132224');
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * CELL_SIZE, MAP_HEIGHT * CELL_SIZE);
    this.cameraController = createCameraController({
      scene: this,
      camera: this.cameras.main,
      cellSize: CELL_SIZE,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      isDragSelecting: () => this.dragSelection !== null,
      isMiddleDragging: () => this.middleDragPan !== null,
    });
    this.cameraController.setZoom(this.cameraController.initialZoom);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys(
      'W,A,S,D',
    ) as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();
    this.game.canvas?.addEventListener('dblclick', this.handleNativeDoubleClick);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.canvas?.removeEventListener('dblclick', this.handleNativeDoubleClick);
    });

    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        this.cameraController?.setZoom(this.cameras.main.zoom - dy * 0.001);
      },
    );

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.clearRecentSelectionClicks();
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.issueContextCommandAtWorldPosition(
          worldPoint.x / CELL_SIZE,
          worldPoint.y / CELL_SIZE,
        );
        return;
      }

      if (pointer.middleButtonDown()) {
        this.middleDragPan = {
          pointerId: pointer.id,
          lastScreenX: pointer.x,
          lastScreenY: pointer.y,
        };
        this.dragSelection = null;
        this.clearRecentSelectionClicks();
        return;
      }

      if (!pointer.leftButtonDown()) {
        return;
      }

      if (this.bridge.getSelectionState().placementMode) {
        return;
      }

      this.dragSelection = {
        pointerId: pointer.id,
        startScreenX: pointer.x,
        startScreenY: pointer.y,
        currentScreenX: pointer.x,
        currentScreenY: pointer.y,
      };
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.middleDragPan && pointer.id === this.middleDragPan.pointerId && pointer.middleButtonDown()) {
        const deltaX = pointer.x - this.middleDragPan.lastScreenX;
        const deltaY = pointer.y - this.middleDragPan.lastScreenY;
        this.middleDragPan.lastScreenX = pointer.x;
        this.middleDragPan.lastScreenY = pointer.y;
        this.cameraController?.panByMiddleDrag(deltaX, deltaY);
      }

      if (!this.dragSelection || pointer.id !== this.dragSelection.pointerId || !pointer.leftButtonDown()) {
        return;
      }

      this.dragSelection.currentScreenX = pointer.x;
      this.dragSelection.currentScreenY = pointer.y;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 1 && this.middleDragPan && pointer.id === this.middleDragPan.pointerId) {
        this.middleDragPan = null;
      }

      if (pointer.button !== 0) {
        return;
      }

      if (this.dragSelection && pointer.id === this.dragSelection.pointerId) {
        this.dragSelection.currentScreenX = pointer.x;
        this.dragSelection.currentScreenY = pointer.y;
      }

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cellX = Phaser.Math.Clamp(Math.floor(worldPoint.x / CELL_SIZE), 0, MAP_WIDTH - 1);
      const cellY = Phaser.Math.Clamp(Math.floor(worldPoint.y / CELL_SIZE), 0, MAP_HEIGHT - 1);

      if (this.bridge.getSelectionState().placementMode) {
        this.clearRecentSelectionClicks();
        this.bridge.confirmBuildingPlacement(cellX, cellY);
        return;
      }

      if (!this.dragSelection || pointer.id !== this.dragSelection.pointerId) {
        return;
      }

      const dragSelection = this.dragSelection;
      this.dragSelection = null;

      if (this.isDragSelectionActive(dragSelection)) {
        const didSelect = this.bridge.selectUnitsByIds(
          this.getSelectionPreviewEntities(dragSelection).map((entity) => entity.id),
        );
        this.clearRecentSelectionClicks();
        if (!didSelect) {
          this.bridge.clearSelection();
        }
        return;
      }

      this.selectEntityAtWorldPosition(worldPoint.x / CELL_SIZE, worldPoint.y / CELL_SIZE);
    });
  }

  update(_time: number, delta: number): void {
    this.bridge.step(delta);
    this.cameraController?.update(_time, delta, {
      cursors: this.cursors,
      wasd: this.wasd,
    });
    this.syncFromBridge();
  }

  // FU5: swap the live simulation bridge the scene is reading from. The
  // HUD Load button calls this after constructing a new bridge from a
  // save blob; the cached render/selection signatures are reset so the
  // very next syncFromBridge forces a full re-render against the newly
  // rehydrated world state.
  setBridge(bridge: SimulationBridge): void {
    this.bridge = bridge;
    this.lastRenderedTick = -1;
    this.lastRenderedInterpolationAlpha = Number.NaN;
    this.lastSelectionKey = '';
    this.lastProjectedEntities = [];
    this.previousUnitProjectedPositions = new Map();
    this.displayedEntities = [];
    this.dragSelection = null;
    this.middleDragPan = null;
    this.cameraController?.resetEdgePanState();
    this.clearRecentSelectionClicks();
    this.lastPlacementPreviewVisualState = null;
    this.lastBuildingVisualStates = [];
    this.lastEntityHealthBarStates = [];
    if (this.debugLayer) {
      this.debugOverlayRenderer = createDebugOverlayRenderer({
        debugLayer: this.debugLayer,
        bridge: this.bridge,
        cellSize: CELL_SIZE,
      });
    }
    if (this.healthBarLayer && this.fogLayer) {
      this.worldLayersRenderer = createWorldLayersRenderer({
        healthBarLayer: this.healthBarLayer,
        fogLayer: this.fogLayer,
        cellSize: CELL_SIZE,
      });
    }
    if (this.selectionLayer && this.placementLayer && this.selectionBoxLayer) {
      this.selectionLayersRenderer = createSelectionLayersRenderer({
        selectionLayer: this.selectionLayer,
        placementLayer: this.placementLayer,
        selectionBoxLayer: this.selectionBoxLayer,
        cellSize: CELL_SIZE,
        screenToWorldPoint: (screenX, screenY) => {
          const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
          return { x: worldPoint.x, y: worldPoint.y };
        },
        getDisplayedEntities: () => this.displayedEntities,
      });
    }
    this.syncFromBridge(true);
  }

  syncFromBridge(force = false): void {
    if (!this.sys.isActive()) {
      return;
    }

    this.cameraController?.clampToWorld();

    const state = this.bridge.getRenderState();
    const selectionState = this.bridge.getSelectionState();
    const interpolationAlpha = this.bridge.getRenderInterpolationAlpha();
    const selectionKey = this.getSelectionKey(selectionState);
    if (
      !force
      && state.tick === this.lastRenderedTick
      && selectionKey === this.lastSelectionKey
      && Math.abs(interpolationAlpha - this.lastRenderedInterpolationAlpha) < 0.001
    ) {
      return;
    }

    if (state.tick !== this.lastRenderedTick) {
      this.previousUnitProjectedPositions = new Map(
        this.lastProjectedEntities
          .filter((entity) => entity.kind === 'unit')
          .map((entity) => [entity.id, { x: entity.x, y: entity.y }]),
      );
      this.lastProjectedEntities = state.entities.map((entity) => ({ ...entity }));
    }

    this.lastRenderedTick = state.tick;
    this.lastRenderedInterpolationAlpha = interpolationAlpha;
    this.lastSelectionKey = selectionKey;
    this.renderState(state, selectionState, interpolationAlpha);
  }

  private renderState(
    state: RenderState,
    selectionState: SelectionState,
    interpolationAlpha: number,
  ): void {
    if (
      !this.terrainLayer
      || !this.entityLayer
      || !this.fogLayer
      || !this.healthBarLayer
      || !this.selectionLayer
      || !this.placementLayer
      || !this.selectionBoxLayer
      || !this.debugLayer
    ) {
      return;
    }

    this.terrainLayer.clear();
    this.entityLayer.clear();
    // Iter-3 V3-18: do NOT clear fogLayer here. `renderFog` below now
    // memoizes on the projected frame reference; clearing
    // unconditionally + re-rendering every RAF tick was the prior
    // perf hot path. renderFog clears the layer itself when the
    // frame has actually changed.
    this.healthBarLayer.clear();
    this.selectionLayer.clear();
    this.placementLayer.clear();
    this.selectionBoxLayer.clear();
    this.debugLayer.clear();
    this.lastBuildingVisualStates = [];
    this.lastEntityHealthBarStates = [];
    this.displayedEntities = interpolateProjectedEntities(
      state.entities,
      this.previousUnitProjectedPositions,
      interpolationAlpha,
    );

    for (const entity of this.displayedEntities) {
      const px = entity.x * CELL_SIZE;
      const py = entity.y * CELL_SIZE;
      const fillAlpha = entity.isMemory ? 0.5 : 1;

      if (entity.layer === 'terrain') {
        this.terrainLayer.fillStyle(entity.tint, 1);
        this.terrainLayer.fillRect(px, py, CELL_SIZE + 1, CELL_SIZE + 1);
        continue;
      }

      if (entity.kind === 'resource') {
        this.entityLayer.fillStyle(entity.tint, fillAlpha);
        if (
          entity.entityType === 'gold-mine'
          || entity.entityType === 'stone-mine'
          || entity.entityType === 'tree'
        ) {
          this.entityLayer.fillRect(
            px + CELL_SIZE * 0.1,
            py + CELL_SIZE * 0.1,
            CELL_SIZE * entity.size,
            CELL_SIZE * entity.size,
          );
        } else {
          this.entityLayer.fillCircle(
            px + CELL_SIZE * 0.5,
            py + CELL_SIZE * 0.5,
            CELL_SIZE * entity.size * 0.55,
          );
        }
        continue;
      }

      if (entity.kind === 'building') {
        const visualState = this.buildingRenderer?.renderBuildingEntity(entity, px, py);
        if (visualState) {
          this.lastBuildingVisualStates.push(visualState);
        }
        continue;
      }

      this.entityLayer.fillStyle(entity.tint, fillAlpha);
      this.entityLayer.fillCircle(
        px + CELL_SIZE * 0.5,
        py + CELL_SIZE * 0.5,
        CELL_SIZE * entity.size * 0.5,
      );
    }

    if (state.frame && this.worldLayersRenderer) {
      this.worldLayersRenderer.renderFog(state.frame);
    }

    if (this.worldLayersRenderer) {
      this.lastEntityHealthBarStates = this.worldLayersRenderer.renderEntityHealthBars(
        this.displayedEntities,
      );
    }
    if (this.selectionLayersRenderer) {
      this.selectionLayersRenderer.renderSelection(this.displayedEntities, selectionState);
      this.lastPlacementPreviewVisualState = this.selectionLayersRenderer.renderPlacementPreview(
        this.getPlacementPreviewState(),
      );
      this.selectionLayersRenderer.renderSelectionBox(this.getSelectionBoxState());
    }
    this.renderDebugOverlay(this.displayedEntities, selectionState, state.frame);
  }

  // Slice 11: draw world-space overlays driven by the HUD's debug mode.
  // The shapes live on their own `debugLayer` above the placement layer so
  // they never get clipped by selection or fog. Actual drawing lives in
  // `gameScene/debugOverlay.ts`; this method just forwards the scene's
  // view data to the dep-bag renderer.
  private renderDebugOverlay(
    entities: ProjectedEntityView[],
    selectionState: SelectionState,
    frame: ProjectedFrameView | null,
  ): void {
    if (!this.debugOverlayRenderer) {
      return;
    }

    this.debugOverlayRenderer.render(
      this.options.getDebugOverlayMode(),
      entities,
      selectionState,
      frame,
    );
  }

  private getSelectionKey(selectionState: SelectionState): string {
    const selectionIds = selectionState.selectedEntityIds.length > 0
      ? selectionState.selectedEntityIds.join(',')
      : 'none';
    const placementPreviewState = this.getPlacementPreviewState();
    const selectionBoxKey = this.getSelectionBoxKey();
    const placementPreviewKey = placementPreviewState
      ? [
        placementPreviewState.buildingType,
        placementPreviewState.cellX,
        placementPreviewState.cellY,
        placementPreviewState.width,
        placementPreviewState.height,
        placementPreviewState.isValid ? 'valid' : 'invalid',
      ].join(',')
      : 'none';
    // Slice 11: include the debug overlay mode so the cached render
    // invalidates when F2 cycles between modes (e.g. the selection-bounds
    // box should appear / disappear even if the selection is unchanged).
    const debugMode = this.options.getDebugOverlayMode();
    return `${selectionIds}:${selectionState.placementMode ?? 'none'}:${selectionBoxKey}:${placementPreviewKey}:${debugMode}`;
  }

  private isDragSelectionActive(dragSelection: DragSelectionState): boolean {
    return (
      Math.abs(dragSelection.currentScreenX - dragSelection.startScreenX) >= DRAG_SELECTION_THRESHOLD_PX
      || Math.abs(dragSelection.currentScreenY - dragSelection.startScreenY) >= DRAG_SELECTION_THRESHOLD_PX
    );
  }

  getCameraState(): CameraState | null {
    return this.cameraController?.getState() ?? null;
  }

  centerCameraOnWorldPosition(worldX: number, worldY: number): void {
    this.cameraController?.centerOnWorldPosition(worldX, worldY);
  }

  getScreenPointForCell(cellX: number, cellY: number): { x: number; y: number } | null {
    return this.cameraController?.getScreenPointForCell(cellX, cellY) ?? null;
  }

  selectEntityAtWorldPosition(worldX: number, worldY: number): boolean {
    if (!this.sys.isActive()) {
      return false;
    }

    const clickCellX = Phaser.Math.Clamp(Math.floor(worldX), 0, MAP_WIDTH - 1);
    const clickCellY = Phaser.Math.Clamp(Math.floor(worldY), 0, MAP_HEIGHT - 1);
    const targetEntities = findEntitiesAtWorldPointInEntities(
      this.displayedEntities,
      worldX * CELL_SIZE,
      worldY * CELL_SIZE,
      CELL_SIZE,
    );
    if (targetEntities.length === 0) {
      this.clearRecentSelectionClicks();
      this.bridge.clearSelection();
      return false;
    }

    const selectionState = this.bridge.getSelectionState();
    const currentSelectedId = selectionState.selectedCount === 1
      ? selectionState.selectedEntityId
      : null;
    let targetEntity = targetEntities[0]!;
    let didCycleExactSelection = false;
    if (
      currentSelectedId !== null
      && targetEntities.length > 1
      && this.wasRepeatedExactSelectionClick(clickCellX, clickCellY)
    ) {
      const currentIndex = targetEntities.findIndex((candidate) => candidate.id === currentSelectedId);
      if (currentIndex >= 0) {
        targetEntity = targetEntities[(currentIndex + 1) % targetEntities.length] ?? targetEntity;
        didCycleExactSelection = targetEntity.id !== currentSelectedId;
      }
    }

    if (!this.bridge.selectEntityById(targetEntity.id)) {
      this.clearRecentSelectionClicks();
      this.bridge.clearSelection();
      return false;
    }

    this.recentExactSelectionClick = {
      cellX: clickCellX,
      cellY: clickCellY,
    };

    if (didCycleExactSelection) {
      this.recentFriendlyUnitClick = null;
      return true;
    }

    if (this.trySelectSameTypeOnDoubleClick(clickCellX, clickCellY)) {
      this.clearRecentSelectionClicks();
      return true;
    }

    this.updateRecentFriendlyUnitClick(clickCellX, clickCellY);
    return true;
  }

  issueContextCommandAtWorldPosition(worldX: number, worldY: number): boolean {
    if (!this.sys.isActive()) {
      return false;
    }

    const clampedCellX = Phaser.Math.Clamp(Math.floor(worldX), 0, MAP_WIDTH - 1);
    const clampedCellY = Phaser.Math.Clamp(Math.floor(worldY), 0, MAP_HEIGHT - 1);
    const displayedTargetEntity = findCommandTargetEntityAtWorldPointInEntities(
      this.displayedEntities,
      worldX * CELL_SIZE,
      worldY * CELL_SIZE,
      CELL_SIZE,
    );
    const projectedTargetEntity = displayedTargetEntity
      ? null
      : findCommandTargetEntityAtWorldPointInEntities(
        this.bridge.getRenderState().entities,
        worldX * CELL_SIZE,
        worldY * CELL_SIZE,
        CELL_SIZE,
      );
    const targetEntity = displayedTargetEntity ?? projectedTargetEntity;

    if (targetEntity && this.bridge.issueContextCommandAtEntity(targetEntity.id)) {
      return true;
    }

    return this.bridge.issueContextCommand(clampedCellX, clampedCellY);
  }

  getSelectionBoxState(): SelectionBoxState | null {
    if (!this.dragSelection) {
      return null;
    }

    return this.buildSelectionBoxState(this.dragSelection);
  }

  getPlacementPreviewState(): PlacementPreviewViewState | null {
    const selectionState = this.bridge.getSelectionState();
    if (!selectionState.placementMode) {
      return null;
    }

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cellX = Phaser.Math.Clamp(Math.floor(worldPoint.x / CELL_SIZE), 0, MAP_WIDTH - 1);
    const cellY = Phaser.Math.Clamp(Math.floor(worldPoint.y / CELL_SIZE), 0, MAP_HEIGHT - 1);
    const previewState = this.bridge.getPlacementPreview(cellX, cellY);
    if (!previewState) {
      return null;
    }

    return { ...previewState };
  }

  getPlacementPreviewVisualState(): PlacementPreviewVisualState | null {
    return this.lastPlacementPreviewVisualState
      ? { ...this.lastPlacementPreviewVisualState }
      : null;
  }

  getBuildingVisualStates(): BuildingVisualState[] {
    return this.lastBuildingVisualStates.map((state) => ({ ...state }));
  }

  getEntityHealthBarStates(): EntityHealthBarState[] {
    return this.lastEntityHealthBarStates.map((state) => ({ ...state }));
  }

  getDisplayedEntities(): DisplayedEntityState[] {
    return this.displayedEntities.map((entity) => ({
      id: entity.id,
      kind: entity.kind,
      entityType: entity.entityType,
      owner: entity.owner,
      x: entity.x,
      y: entity.y,
    }));
  }

  private getSelectionPreviewEntityIds(dragSelection: DragSelectionState): number[] {
    return this.bridge.filterSelectableUnitIds(
      this.getSelectionPreviewEntities(dragSelection).map((entity) => entity.id),
    );
  }

  private getSelectionPreviewEntities(dragSelection: DragSelectionState): ProjectedEntityView[] {
    const selectionBounds = this.getDragSelectionWorldBounds(dragSelection);
    if (!selectionBounds) {
      return [];
    }

    return this.displayedEntities
      .filter((entity) => this.isDragSelectableEntity(entity))
      .filter((entity) =>
        doesWorldRectIntersectEntity(
          entity,
          selectionBounds.minWorldX,
          selectionBounds.minWorldY,
          selectionBounds.maxWorldX,
          selectionBounds.maxWorldY,
          CELL_SIZE,
        ))
      .sort((left, right) => {
        const yDelta = left.y - right.y;
        if (Math.abs(yDelta) > 0.001) {
          return yDelta;
        }

        const xDelta = left.x - right.x;
        if (Math.abs(xDelta) > 0.001) {
          return xDelta;
        }

        return left.id - right.id;
      });
  }

  private isDragSelectableEntity(entity: ProjectedEntityView): boolean {
    if (entity.isMemory) {
      return false;
    }

    if (entity.kind === 'unit') {
      return entity.owner === HUMAN_PLAYER_ID;
    }

    return entity.kind === 'resource'
      && entity.entityType === 'sheep'
      && entity.owner === HUMAN_PLAYER_ID;
  }

  private getDragSelectionWorldBounds(dragSelection: DragSelectionState): {
    minWorldX: number;
    minWorldY: number;
    maxWorldX: number;
    maxWorldY: number;
  } | null {
    if (!this.isDragSelectionActive(dragSelection)) {
      return null;
    }

    const minX = Math.min(dragSelection.startScreenX, dragSelection.currentScreenX);
    const minY = Math.min(dragSelection.startScreenY, dragSelection.currentScreenY);
    const maxX = Math.max(dragSelection.startScreenX, dragSelection.currentScreenX);
    const maxY = Math.max(dragSelection.startScreenY, dragSelection.currentScreenY);
    const worldStart = this.cameras.main.getWorldPoint(minX, minY);
    const worldEnd = this.cameras.main.getWorldPoint(maxX, maxY);

    return {
      minWorldX: Math.min(worldStart.x, worldEnd.x),
      minWorldY: Math.min(worldStart.y, worldEnd.y),
      maxWorldX: Math.max(worldStart.x, worldEnd.x),
      maxWorldY: Math.max(worldStart.y, worldEnd.y),
    };
  }

  // Iter-3 follow-up: building entity rendering moved to
  // `gameScene/buildingRenderer.ts`. Only the call-site on line ~547
  // remains; the 5 private methods (renderBuildingEntity +
  // renderBuildingFoundation + renderConstructionPosts +
  // renderCompletedBuildingBody + renderCompletedBuildingRoof) became
  // a single factory there. ~160 lines of rendering + visual-state
  // coupling code shed from this file.

  private trySelectSameTypeOnDoubleClick(cellX: number, cellY: number): boolean {
    const recentClick = this.recentFriendlyUnitClick;
    if (
      recentClick === null
      || recentClick.cellX !== cellX
      || recentClick.cellY !== cellY
      || this.time.now - recentClick.atMs > DOUBLE_CLICK_WINDOW_MS
    ) {
      return false;
    }

    const bounds = this.getViewportCellBounds();
    return this.bridge.selectOwnedUnitsByTypeInRect(
      recentClick.unitType,
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
    );
  }

  private updateRecentFriendlyUnitClick(cellX: number, cellY: number): void {
    const selectionState = this.bridge.getSelectionState();
    if (
      selectionState.owner !== HUMAN_PLAYER_ID
      || selectionState.selectedCount !== 1
    ) {
      return;
    }

    const isUnit = selectionState.selectedKind === 'unit'
      && this.isUnitType(selectionState.selectedEntityType);
    const isOwnedSheep = selectionState.selectedKind === 'resource'
      && selectionState.selectedEntityType === 'sheep';

    if (!isUnit && !isOwnedSheep) {
      return;
    }

    this.recentFriendlyUnitClick = {
      atMs: this.time.now,
      cellX,
      cellY,
      unitType: isOwnedSheep ? 'sheep' : (selectionState.selectedEntityType as UnitType),
    };
  }

  private getViewportCellBounds(): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    const worldView = this.cameras.main.worldView;

    return {
      minX: Phaser.Math.Clamp(Math.floor(worldView.x / CELL_SIZE), 0, MAP_WIDTH - 1),
      minY: Phaser.Math.Clamp(Math.floor(worldView.y / CELL_SIZE), 0, MAP_HEIGHT - 1),
      maxX: Phaser.Math.Clamp(Math.floor((worldView.right - 1) / CELL_SIZE), 0, MAP_WIDTH - 1),
      maxY: Phaser.Math.Clamp(Math.floor((worldView.bottom - 1) / CELL_SIZE), 0, MAP_HEIGHT - 1),
    };
  }

  private clearRecentSelectionClicks(): void {
    this.recentExactSelectionClick = null;
    this.recentFriendlyUnitClick = null;
  }

  private wasRepeatedExactSelectionClick(cellX: number, cellY: number): boolean {
    return (
      this.recentExactSelectionClick?.cellX === cellX
      && this.recentExactSelectionClick.cellY === cellY
    );
  }

  private getSelectionBoxKey(): string {
    if (!this.dragSelection || !this.isDragSelectionActive(this.dragSelection)) {
      return 'none';
    }

    return [
      this.dragSelection.startScreenX,
      this.dragSelection.startScreenY,
      this.dragSelection.currentScreenX,
      this.dragSelection.currentScreenY,
    ].join(',');
  }

  private buildSelectionBoxState(dragSelection: DragSelectionState): SelectionBoxState | null {
    if (!this.isDragSelectionActive(dragSelection)) {
      return null;
    }

    const width = Math.abs(dragSelection.currentScreenX - dragSelection.startScreenX);
    const height = Math.abs(dragSelection.currentScreenY - dragSelection.startScreenY);

    return {
      active: true,
      startX: dragSelection.startScreenX,
      startY: dragSelection.startScreenY,
      currentX: dragSelection.currentScreenX,
      currentY: dragSelection.currentScreenY,
      width,
      height,
      previewEntityIds: this.getSelectionPreviewEntityIds(dragSelection),
    };
  }

  private isUnitType(entityType: SelectionState['selectedEntityType']): entityType is UnitType {
    return isUnitTypeExternal(entityType);
  }
}
