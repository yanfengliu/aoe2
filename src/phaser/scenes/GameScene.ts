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
  createSelectionLayersRenderer,
  type SelectionLayersRenderer,
} from './gameScene/selectionLayers';
import {
  createWorldLayersRenderer,
  type WorldLayersRenderer,
} from './gameScene/worldLayers';
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
    this.fogLayer.clear();
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
        this.renderBuildingEntity(entity, px, py);
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

  private renderBuildingEntity(entity: ProjectedEntityView, px: number, py: number): void {
    if (!this.entityLayer || entity.kind !== 'building') {
      return;
    }

    const widthPx = entity.footprintWidth * CELL_SIZE;
    const heightPx = entity.footprintHeight * CELL_SIZE;
    const isConstruction = entity.visualVariant === 'construction';
    // Memory buildings are last-seen snapshots drawn at half opacity to cue the
    // player that the information may be stale.
    const baseFillAlpha = isConstruction ? 0.62 : 1;
    const fillAlpha = entity.isMemory ? baseFillAlpha * 0.5 : baseFillAlpha;
    const strokeAlpha = entity.isMemory ? 0.5 : 0.98;

    this.entityLayer.lineStyle(3, isConstruction ? 0xf7e6c3 : 0x2b2117, strokeAlpha);
    this.entityLayer.fillStyle(entity.tint, fillAlpha);
    this.entityLayer.fillRoundedRect(px, py, widthPx, heightPx, 6);
    this.entityLayer.strokeRoundedRect(px, py, widthPx, heightPx, 6);

    let hasFoundationSlab = false;
    let hasScaffoldPosts = false;
    let hasStructureBody = false;
    let hasRoofAccent = false;
    let hasConstructionIndicator = false;
    let hasCompletionAccent = false;

    if (entity.isMemory) {
      // Memory buildings render as a flat tinted rectangle only — the detailed body
      // and roof layers would paint fully-opaque pixels over the ghost, so we skip
      // them and rely on the base fillAlpha to communicate "stale / last-seen".
    } else if (isConstruction) {
      this.renderBuildingFoundation(px, py, widthPx, heightPx);
      this.renderConstructionPosts(px, py, widthPx, heightPx);
      hasFoundationSlab = true;
      hasScaffoldPosts = true;
      hasConstructionIndicator = true;
    } else {
      this.renderCompletedBuildingBody(px, py, widthPx, heightPx);
      this.renderCompletedBuildingRoof(px, py, widthPx, heightPx);
      hasStructureBody = true;
      hasRoofAccent = true;
      hasCompletionAccent = true;
    }

    if (entity.isMemory) {
      // Memory buildings do not contribute to visual-state test assertions — they
      // are ghosts of buildings the player has not confirmed still exist.
      return;
    }

    this.lastBuildingVisualStates.push({
      id: entity.id,
      buildingType: entity.entityType,
      owner: entity.owner,
      cellX: entity.x,
      cellY: entity.y,
      footprintWidthCells: entity.footprintWidth,
      footprintHeightCells: entity.footprintHeight,
      widthPx,
      heightPx,
      visualVariant: entity.visualVariant,
      hasFoundationSlab,
      hasScaffoldPosts,
      hasStructureBody,
      hasRoofAccent,
      hasConstructionIndicator,
      hasCompletionAccent,
    });
  }

  private renderBuildingFoundation(px: number, py: number, widthPx: number, heightPx: number): void {
    if (!this.entityLayer) {
      return;
    }

    const inset = 4;
    const slabX = px + inset;
    const slabY = py + inset;
    const slabWidth = Math.max(8, widthPx - inset * 2);
    const slabHeight = Math.max(8, heightPx - inset * 2);

    this.entityLayer.fillStyle(0xc8bea8, 0.92);
    this.entityLayer.fillRoundedRect(slabX, slabY, slabWidth, slabHeight, 3);
    this.entityLayer.lineStyle(2, 0x6a6257, 0.95);
    this.entityLayer.strokeRoundedRect(slabX, slabY, slabWidth, slabHeight, 3);

    this.entityLayer.lineStyle(1, 0xece4d2, 0.7);
    this.entityLayer.lineBetween(slabX + slabWidth * 0.5, slabY + 2, slabX + slabWidth * 0.5, slabY + slabHeight - 2);
    this.entityLayer.lineBetween(slabX + 2, slabY + slabHeight * 0.5, slabX + slabWidth - 2, slabY + slabHeight * 0.5);
  }

  private renderConstructionPosts(px: number, py: number, widthPx: number, heightPx: number): void {
    if (!this.entityLayer) {
      return;
    }

    const postInset = 5;
    const postHeight = Math.max(8, Math.min(16, heightPx * 0.45));
    const topY = py + postInset;
    const bottomY = topY + postHeight;
    const leftX = px + postInset;
    const rightX = px + widthPx - postInset;

    this.entityLayer.lineStyle(2, 0x8d6c49, 0.95);
    this.entityLayer.lineBetween(leftX, topY, leftX, bottomY);
    this.entityLayer.lineBetween(rightX, topY, rightX, bottomY);
    this.entityLayer.lineBetween(leftX, topY, rightX, topY);
    this.entityLayer.lineStyle(2, 0xf5e9cf, 0.8);
    this.entityLayer.lineBetween(leftX, bottomY, rightX, topY);
    this.entityLayer.lineBetween(leftX, topY, rightX, bottomY);
  }

  private renderCompletedBuildingBody(px: number, py: number, widthPx: number, heightPx: number): void {
    if (!this.entityLayer) {
      return;
    }

    const insetX = Math.max(5, widthPx * 0.14);
    const insetTop = Math.max(8, heightPx * 0.34);
    const insetBottom = Math.max(4, heightPx * 0.14);
    const bodyX = px + insetX;
    const bodyY = py + insetTop;
    const bodyWidth = Math.max(8, widthPx - insetX * 2);
    const bodyHeight = Math.max(8, heightPx - insetTop - insetBottom);

    this.entityLayer.fillStyle(0xf0d39a, 0.92);
    this.entityLayer.fillRoundedRect(bodyX, bodyY, bodyWidth, bodyHeight, 4);
    this.entityLayer.lineStyle(2, 0x5b4125, 0.9);
    this.entityLayer.strokeRoundedRect(bodyX, bodyY, bodyWidth, bodyHeight, 4);

    const doorWidth = Math.max(4, bodyWidth * 0.2);
    const doorHeight = Math.max(6, bodyHeight * 0.45);
    this.entityLayer.fillStyle(0x744d2d, 0.9);
    this.entityLayer.fillRoundedRect(
      bodyX + (bodyWidth - doorWidth) * 0.5,
      bodyY + bodyHeight - doorHeight,
      doorWidth,
      doorHeight,
      2,
    );
  }

  private renderCompletedBuildingRoof(px: number, py: number, widthPx: number, heightPx: number): void {
    if (!this.entityLayer) {
      return;
    }

    const roofInset = Math.max(4, widthPx * 0.08);
    const roofBaseY = py + Math.max(10, heightPx * 0.38);
    const roofPeakY = py + Math.max(2, heightPx * 0.08);
    const leftX = px + roofInset;
    const rightX = px + widthPx - roofInset;
    const centerX = px + widthPx * 0.5;

    this.entityLayer.fillStyle(0x8d4f39, 0.96);
    this.entityLayer.fillTriangle(leftX, roofBaseY, centerX, roofPeakY, rightX, roofBaseY);
    this.entityLayer.lineStyle(2, 0x4c2418, 0.95);
    this.entityLayer.strokeTriangle(leftX, roofBaseY, centerX, roofPeakY, rightX, roofBaseY);
    this.entityLayer.lineStyle(1, 0xe7b07d, 0.65);
    this.entityLayer.lineBetween(centerX, roofPeakY + 1, centerX, roofBaseY - 2);
  }

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
    return (
      entityType === 'villager'
      || entityType === 'scout'
      || entityType === 'militia'
      || entityType === 'spearman'
      || entityType === 'archer'
      || entityType === 'skirmisher'
      || entityType === 'knight'
      || entityType === 'crossbowman'
      || entityType === 'pikeman'
      || entityType === 'light-cavalry'
      || entityType === 'camel'
      || entityType === 'cavalry-archer'
      || entityType === 'monk'
      || entityType === 'mangonel'
      || entityType === 'scorpion'
      || entityType === 'battering-ram'
      || entityType === 'longbowman'
      || entityType === 'arbalest'
      || entityType === 'halberdier'
      || entityType === 'hussar'
      || entityType === 'heavy-cavalry-archer'
      || entityType === 'cavalier'
      || entityType === 'champion'
      || entityType === 'elite-longbowman'
      || entityType === 'onager'
      || entityType === 'heavy-scorpion'
      || entityType === 'siege-ram'
      || entityType === 'bombard-cannon'
      || entityType === 'trebuchet'
    );
  }
}
