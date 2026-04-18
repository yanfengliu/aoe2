import Phaser from 'phaser';

import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../../game/simulation/prototypeScenario';
import type {
  PlacementPreviewState,
  ProjectedFrameView,
  ProjectedEntityView,
  RenderState,
  SelectionState,
  UnitType,
} from '../../game/simulation/types';
import { findEntityAtWorldPointInEntities } from './entityHitTest';
import { interpolateProjectedEntities } from './interpolateProjectedEntities';

interface SimulationBridge {
  step(deltaMs: number): void;
  getRenderState(): RenderState;
  getRenderInterpolationAlpha(): number;
  getSelectionState(): SelectionState;
  getPlacementPreview(x: number, y: number): PlacementPreviewState | null;
  selectEntityAtCell(x: number, y: number): boolean;
  selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean;
  selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean;
  clearSelection(): void;
  issueContextCommand(x: number, y: number): boolean;
  issueContextCommandAtEntity(entityId: number): boolean;
  issueMoveCommand(x: number, y: number): boolean;
  confirmBuildingPlacement(x: number, y: number): boolean;
}

const CELL_SIZE = 24;
const EDGE_PAN_THRESHOLD_PX = 20;
const EDGE_PAN_SPEED_PX_PER_SECOND = 480;
const EDGE_PAN_HOVER_DELAY_MS = 500;
const MIDDLE_DRAG_PAN_MIN_DELTA_PX = 0.5;
const MIN_CAMERA_ZOOM = 0.7;
const MAX_CAMERA_ZOOM = 2.4;
const INITIAL_CAMERA_ZOOM = 1.4;

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

interface EdgePanState {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  sinceMs: number;
}

interface RecentFriendlyUnitClick {
  atMs: number;
  cellX: number;
  cellY: number;
  unitType: UnitType | 'sheep';
}

const DRAG_SELECTION_THRESHOLD_PX = 8;
const DOUBLE_CLICK_WINDOW_MS = 300;

export class GameScene extends Phaser.Scene {
  private readonly bridge: SimulationBridge;
  private terrainLayer?: Phaser.GameObjects.Graphics;
  private entityLayer?: Phaser.GameObjects.Graphics;
  private fogLayer?: Phaser.GameObjects.Graphics;
  private healthBarLayer?: Phaser.GameObjects.Graphics;
  private selectionLayer?: Phaser.GameObjects.Graphics;
  private placementLayer?: Phaser.GameObjects.Graphics;
  private selectionBoxLayer?: Phaser.GameObjects.Graphics;
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
  private edgePanState: EdgePanState | null = null;
  private recentFriendlyUnitClick: RecentFriendlyUnitClick | null = null;
  private lastPlacementPreviewVisualState: PlacementPreviewVisualState | null = null;
  private lastBuildingVisualStates: BuildingVisualState[] = [];
  private lastEntityHealthBarStates: EntityHealthBarState[] = [];
  private readonly handleNativeDoubleClick = (event: MouseEvent): void => {
    if (this.dragSelection || this.bridge.getSelectionState().placementMode) {
      return;
    }

    const canvas = this.game.canvas;
    if (!canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }
    const canvasX = (event.clientX - bounds.left) * (canvas.width / bounds.width);
    const canvasY = (event.clientY - bounds.top) * (canvas.height / bounds.height);
    const worldPoint = this.cameras.main.getWorldPoint(canvasX, canvasY);
    const cellX = Phaser.Math.Clamp(Math.floor(worldPoint.x / CELL_SIZE), 0, MAP_WIDTH - 1);
    const cellY = Phaser.Math.Clamp(Math.floor(worldPoint.y / CELL_SIZE), 0, MAP_HEIGHT - 1);

    if (this.trySelectSameTypeOnDoubleClick(cellX, cellY)) {
      this.recentFriendlyUnitClick = null;
      event.preventDefault();
    }
  };

  constructor(bridge: SimulationBridge) {
    super('game');
    this.bridge = bridge;
  }

  create(): void {
    this.terrainLayer = this.add.graphics();
    this.entityLayer = this.add.graphics();
    this.fogLayer = this.add.graphics();
    this.healthBarLayer = this.add.graphics();
    this.selectionLayer = this.add.graphics();
    this.placementLayer = this.add.graphics();
    this.selectionBoxLayer = this.add.graphics();

    this.cameras.main.setBackgroundColor('#132224');
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * CELL_SIZE, MAP_HEIGHT * CELL_SIZE);
    this.setCameraZoom(INITIAL_CAMERA_ZOOM);

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
        this.setCameraZoom(this.cameras.main.zoom - dy * 0.001);
      },
    );

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        this.recentFriendlyUnitClick = null;
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
        this.recentFriendlyUnitClick = null;
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
        this.panCameraByMiddleDrag(pointer);
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
        this.recentFriendlyUnitClick = null;
        this.bridge.confirmBuildingPlacement(cellX, cellY);
        return;
      }

      if (!this.dragSelection || pointer.id !== this.dragSelection.pointerId) {
        return;
      }

      const dragSelection = this.dragSelection;
      this.dragSelection = null;

      if (this.isDragSelectionActive(dragSelection)) {
        const selectionStart = this.cameras.main.getWorldPoint(
          dragSelection.startScreenX,
          dragSelection.startScreenY,
        );
        const selectionEnd = this.cameras.main.getWorldPoint(
          dragSelection.currentScreenX,
          dragSelection.currentScreenY,
        );
        const didSelect = this.bridge.selectUnitsInBox(
          Math.floor(selectionStart.x / CELL_SIZE),
          Math.floor(selectionStart.y / CELL_SIZE),
          Math.floor(selectionEnd.x / CELL_SIZE),
          Math.floor(selectionEnd.y / CELL_SIZE),
        );
        this.recentFriendlyUnitClick = null;
        if (!didSelect) {
          this.bridge.clearSelection();
        }
        return;
      }

      if (!this.bridge.selectEntityAtCell(cellX, cellY)) {
        this.recentFriendlyUnitClick = null;
        this.bridge.clearSelection();
        return;
      }

      if (this.trySelectSameTypeOnDoubleClick(cellX, cellY)) {
        this.recentFriendlyUnitClick = null;
        return;
      }

      this.updateRecentFriendlyUnitClick(cellX, cellY);
    });
  }

  update(_time: number, delta: number): void {
    this.bridge.step(delta);
    this.updateCamera(_time, delta);
    this.syncFromBridge();
  }

  syncFromBridge(force = false): void {
    if (!this.sys.isActive()) {
      return;
    }

    this.clampCameraToWorld();

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

  private updateCamera(time: number, delta: number): void {
    const camera = this.cameras.main;
    const speed = (delta / 1000) * 420;
    const edgePanSpeed = (delta / 1000) * EDGE_PAN_SPEED_PX_PER_SECOND;

    if (this.cursors?.left.isDown || this.wasd?.A.isDown) {
      camera.scrollX -= speed;
    }
    if (this.cursors?.right.isDown || this.wasd?.D.isDown) {
      camera.scrollX += speed;
    }
    if (this.cursors?.up.isDown || this.wasd?.W.isDown) {
      camera.scrollY -= speed;
    }
    if (this.cursors?.down.isDown || this.wasd?.S.isDown) {
      camera.scrollY += speed;
    }

    if (!this.middleDragPan && !this.dragSelection) {
      const edgePan = this.getEdgePanDelta(time);
      if (edgePan.dx !== 0) {
        camera.scrollX += edgePan.dx * edgePanSpeed;
      }
      if (edgePan.dy !== 0) {
        camera.scrollY += edgePan.dy * edgePanSpeed;
      }
    }

    this.clampCameraToWorld();
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

    if (state.frame) {
      this.renderFog(state.frame);
    }

    this.renderEntityHealthBars(this.displayedEntities);
    this.renderSelection(this.displayedEntities, selectionState);
    this.renderPlacementPreview();
    this.renderSelectionBox();
  }

  private renderEntityHealthBars(entities: ProjectedEntityView[]): void {
    if (!this.healthBarLayer) {
      return;
    }

    for (const entity of entities) {
      if (
        (entity.kind !== 'unit' && entity.kind !== 'building' && entity.kind !== 'resource')
        || entity.currentHp === null
        || entity.maxHp === null
        || entity.maxHp <= 0
        || entity.isMemory
      ) {
        continue;
      }

      const px = entity.x * CELL_SIZE;
      const py = entity.y * CELL_SIZE;
      const layout = this.getHealthBarLayout(entity, px, py);
      const fillRatio = Phaser.Math.Clamp(entity.currentHp / entity.maxHp, 0, 1);
      const fillColor =
        fillRatio > 0.6 ? 0x77d26a
        : fillRatio > 0.3 ? 0xdab85a
        : 0xd76464;

      this.healthBarLayer.fillStyle(0x101010, 0.88);
      this.healthBarLayer.fillRoundedRect(layout.barX, layout.barY, layout.barWidthPx, layout.barHeightPx, 2);
      this.healthBarLayer.fillStyle(0x2d2d2d, 0.95);
      this.healthBarLayer.fillRoundedRect(
        layout.barX + 1,
        layout.barY + 1,
        Math.max(0, layout.barWidthPx - 2),
        Math.max(0, layout.barHeightPx - 2),
        2,
      );
      this.healthBarLayer.fillStyle(fillColor, 0.96);
      this.healthBarLayer.fillRoundedRect(
        layout.barX + 1,
        layout.barY + 1,
        Math.max(0, (layout.barWidthPx - 2) * fillRatio),
        Math.max(0, layout.barHeightPx - 2),
        2,
      );

      this.lastEntityHealthBarStates.push({
        id: entity.id,
        entityKind: entity.kind,
        entityType: entity.entityType,
        owner: entity.owner,
        currentHp: entity.currentHp,
        maxHp: entity.maxHp,
        fillRatio,
        barX: layout.barX,
        barY: layout.barY,
        barWidthPx: layout.barWidthPx,
        barHeightPx: layout.barHeightPx,
        entityTopPx: layout.entityTopPx,
      });
    }
  }

  private renderFog(frame: ProjectedFrameView): void {
    if (!this.fogLayer) {
      return;
    }

    const visible = new Set(frame.visibleCells);
    const explored = new Set(frame.exploredCells);

    for (let y = 0; y < frame.mapHeight; y += 1) {
      for (let x = 0; x < frame.mapWidth; x += 1) {
        const index = y * frame.mapWidth + x;
        if (!explored.has(index)) {
          this.fogLayer.fillStyle(0x081012, 0.94);
          this.fogLayer.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE + 1, CELL_SIZE + 1);
          continue;
        }

        if (!visible.has(index)) {
          this.fogLayer.fillStyle(0x0b1215, 0.58);
          this.fogLayer.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE + 1, CELL_SIZE + 1);
        }
      }
    }
  }

  private renderSelection(entities: ProjectedEntityView[], selectionState: SelectionState): void {
    if (!this.selectionLayer || selectionState.selectedEntityIds.length === 0) {
      return;
    }

    this.selectionLayer.lineStyle(2, 0xf7e5a5, 0.9);
    const selectedIds = new Set(selectionState.selectedEntityIds);

    for (const entity of entities) {
      if (!selectedIds.has(entity.id) || entity.isMemory) {
        continue;
      }

      const px = entity.x * CELL_SIZE;
      const py = entity.y * CELL_SIZE;

      if (entity.kind === 'building') {
        const widthPx = entity.footprintWidth * CELL_SIZE;
        const heightPx = entity.footprintHeight * CELL_SIZE;
        this.selectionLayer.strokeRoundedRect(
          px,
          py,
          widthPx,
          heightPx,
          6,
        );
        continue;
      }

      this.selectionLayer.strokeCircle(
        px + CELL_SIZE * 0.5,
        py + CELL_SIZE * 0.5,
        CELL_SIZE * Math.max(entity.size, 0.55),
      );
    }
  }

  private renderSelectionBox(): void {
    if (!this.selectionBoxLayer) {
      return;
    }

    const selectionBoxState = this.getSelectionBoxState();
    if (!selectionBoxState?.active) {
      return;
    }

    const minX = Math.min(selectionBoxState.startX, selectionBoxState.currentX);
    const minY = Math.min(selectionBoxState.startY, selectionBoxState.currentY);
    const maxX = Math.max(selectionBoxState.startX, selectionBoxState.currentX);
    const maxY = Math.max(selectionBoxState.startY, selectionBoxState.currentY);
    const worldStart = this.cameras.main.getWorldPoint(minX, minY);
    const worldEnd = this.cameras.main.getWorldPoint(maxX, maxY);
    const width = Math.max(1, worldEnd.x - worldStart.x);
    const height = Math.max(1, worldEnd.y - worldStart.y);

    this.selectionBoxLayer.lineStyle(2, 0xf7e5a5, 0.98);
    this.selectionBoxLayer.fillStyle(0xf7e5a5, 0.18);
    this.selectionBoxLayer.fillRect(worldStart.x, worldStart.y, width, height);
    this.selectionBoxLayer.strokeRect(worldStart.x, worldStart.y, width, height);
  }

  private renderPlacementPreview(): void {
    if (!this.placementLayer) {
      this.lastPlacementPreviewVisualState = null;
      return;
    }

    const previewState = this.getPlacementPreviewState();
    if (!previewState?.active) {
      this.lastPlacementPreviewVisualState = null;
      return;
    }

    const tint = previewState.isValid ? 0x8fe388 : 0xe36f6f;
    const fillAlpha = previewState.isValid ? 0.32 : 0.36;
    const strokeWidth = 3;
    let cellOutlineCount = 0;
    let blockedMarkerCount = 0;
    this.placementLayer.lineStyle(strokeWidth, tint, 0.98);
    this.placementLayer.fillStyle(tint, fillAlpha);
    this.placementLayer.fillRect(
      previewState.cellX * CELL_SIZE,
      previewState.cellY * CELL_SIZE,
      previewState.width * CELL_SIZE,
      previewState.height * CELL_SIZE,
    );
    this.placementLayer.strokeRect(
      previewState.cellX * CELL_SIZE,
      previewState.cellY * CELL_SIZE,
      previewState.width * CELL_SIZE,
      previewState.height * CELL_SIZE,
    );

    this.placementLayer.lineStyle(1, previewState.isValid ? 0xf6ffe9 : 0xfff0f0, 0.95);
    for (let offsetY = 0; offsetY < previewState.height; offsetY += 1) {
      for (let offsetX = 0; offsetX < previewState.width; offsetX += 1) {
        const x = (previewState.cellX + offsetX) * CELL_SIZE;
        const y = (previewState.cellY + offsetY) * CELL_SIZE;
        this.placementLayer.strokeRect(x, y, CELL_SIZE, CELL_SIZE);
        cellOutlineCount += 1;

        if (!previewState.isValid) {
          this.placementLayer.lineStyle(2, 0xfff6f6, 0.98);
          this.placementLayer.lineBetween(x + 3, y + 3, x + CELL_SIZE - 3, y + CELL_SIZE - 3);
          this.placementLayer.lineBetween(x + CELL_SIZE - 3, y + 3, x + 3, y + CELL_SIZE - 3);
          blockedMarkerCount += 1;
          this.placementLayer.lineStyle(1, 0xfff0f0, 0.95);
        }
      }
    }

    this.lastPlacementPreviewVisualState = {
      ...previewState,
      strokeWidth,
      cellOutlineCount,
      blockedMarkerCount,
    };
  }

  private getSelectionKey(selectionState: SelectionState): string {
    const selectionIds = selectionState.selectedEntityIds.length > 0
      ? selectionState.selectedEntityIds.join(',')
      : 'none';
    const placementPreviewState = this.getPlacementPreviewState();
    const selectionBoxState = this.getSelectionBoxState();
    const selectionBoxKey = selectionBoxState
      ? [
        selectionBoxState.startX,
        selectionBoxState.startY,
        selectionBoxState.currentX,
        selectionBoxState.currentY,
      ].join(',')
      : 'none';
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
    return `${selectionIds}:${selectionState.placementMode ?? 'none'}:${selectionBoxKey}:${placementPreviewKey}`;
  }

  private isDragSelectionActive(dragSelection: DragSelectionState): boolean {
    return (
      Math.abs(dragSelection.currentScreenX - dragSelection.startScreenX) >= DRAG_SELECTION_THRESHOLD_PX
      || Math.abs(dragSelection.currentScreenY - dragSelection.startScreenY) >= DRAG_SELECTION_THRESHOLD_PX
    );
  }

  private panCameraByMiddleDrag(pointer: Phaser.Input.Pointer): void {
    if (!this.middleDragPan) {
      return;
    }

    const deltaX = pointer.x - this.middleDragPan.lastScreenX;
    const deltaY = pointer.y - this.middleDragPan.lastScreenY;
    this.middleDragPan.lastScreenX = pointer.x;
    this.middleDragPan.lastScreenY = pointer.y;

    if (
      Math.abs(deltaX) < MIDDLE_DRAG_PAN_MIN_DELTA_PX
      && Math.abs(deltaY) < MIDDLE_DRAG_PAN_MIN_DELTA_PX
    ) {
      return;
    }

    const camera = this.cameras.main;
    camera.scrollX -= deltaX / camera.zoom;
    camera.scrollY -= deltaY / camera.zoom;
    this.clampCameraToWorld();
  }

  private getEdgePanDelta(time: number): { dx: -1 | 0 | 1; dy: -1 | 0 | 1 } {
    const pointer = this.input.activePointer;
    const width = this.scale.width;
    const height = this.scale.height;
    // activePointer defaults to (0, 0), which is inside the NW edge zone. Wait
    // for a real mousemove on the canvas before trusting it.
    if (
      pointer.moveTime === 0
      || pointer.isDown
      || pointer.x < 0
      || pointer.y < 0
      || pointer.x > width
      || pointer.y > height
    ) {
      this.edgePanState = null;
      return { dx: 0, dy: 0 };
    }

    const dx =
      pointer.x <= EDGE_PAN_THRESHOLD_PX ? -1
      : pointer.x >= width - EDGE_PAN_THRESHOLD_PX ? 1
      : 0;
    const dy =
      pointer.y <= EDGE_PAN_THRESHOLD_PX ? -1
      : pointer.y >= height - EDGE_PAN_THRESHOLD_PX ? 1
      : 0;

    if (dx === 0 && dy === 0) {
      this.edgePanState = null;
      return { dx: 0, dy: 0 };
    }

    if (
      this.edgePanState === null
      || this.edgePanState.dx !== dx
      || this.edgePanState.dy !== dy
    ) {
      this.edgePanState = {
        dx,
        dy,
        sinceMs: time,
      };
      return { dx: 0, dy: 0 };
    }

    if (time - this.edgePanState.sinceMs < EDGE_PAN_HOVER_DELAY_MS) {
      return { dx: 0, dy: 0 };
    }

    return { dx, dy };
  }

  getCameraState(): CameraState | null {
    if (!this.sys.isActive()) {
      return null;
    }

    this.clampCameraToWorld();

    const camera = this.cameras.main;
    const viewWidth = camera.width / camera.zoom;
    const viewHeight = camera.height / camera.zoom;
    const viewX = camera.scrollX + (camera.width - viewWidth) * 0.5;
    const viewY = camera.scrollY + (camera.height - viewHeight) * 0.5;

    return {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
      width: camera.width,
      height: camera.height,
      viewX,
      viewY,
      viewWidth,
      viewHeight,
    };
  }

  centerCameraOnWorldPosition(worldX: number, worldY: number): void {
    if (!this.sys.isActive()) {
      return;
    }

    this.cameras.main.centerOn(worldX, worldY);
    this.clampCameraToWorld();
  }

  private setCameraZoom(nextZoom: number): void {
    const camera = this.cameras.main;
    const minimumZoom = this.getMinimumCameraZoom();
    const clampedZoom = Phaser.Math.Clamp(nextZoom, minimumZoom, MAX_CAMERA_ZOOM);
    camera.setZoom(clampedZoom);
    this.clampCameraToWorld();
  }

  private clampCameraToWorld(): void {
    if (!this.sys.isActive()) {
      return;
    }

    const camera = this.cameras.main;
    const minimumZoom = this.getMinimumCameraZoom();
    const clampedZoom = Phaser.Math.Clamp(camera.zoom, minimumZoom, MAX_CAMERA_ZOOM);
    if (camera.zoom !== clampedZoom) {
      camera.setZoom(clampedZoom);
    }

    const { minScrollX, maxScrollX, minScrollY, maxScrollY } = this.getCameraScrollBounds(camera);
    camera.scrollX = Phaser.Math.Clamp(camera.scrollX, minScrollX, maxScrollX);
    camera.scrollY = Phaser.Math.Clamp(camera.scrollY, minScrollY, maxScrollY);
  }

  private getMinimumCameraZoom(): number {
    const camera = this.cameras.main;
    return Math.max(
      MIN_CAMERA_ZOOM,
      camera.width / this.getWorldWidthPx(),
      camera.height / this.getWorldHeightPx(),
    );
  }

  private getCameraScrollBounds(camera: Phaser.Cameras.Scene2D.Camera): {
    minScrollX: number;
    maxScrollX: number;
    minScrollY: number;
    maxScrollY: number;
  } {
    const viewWidth = camera.width / camera.zoom;
    const viewHeight = camera.height / camera.zoom;
    const minScrollX = (viewWidth - camera.width) * 0.5;
    const maxScrollX = this.getWorldWidthPx() - (camera.width + viewWidth) * 0.5;
    const minScrollY = (viewHeight - camera.height) * 0.5;
    const maxScrollY = this.getWorldHeightPx() - (camera.height + viewHeight) * 0.5;

    return {
      minScrollX,
      maxScrollX: Math.max(minScrollX, maxScrollX),
      minScrollY,
      maxScrollY: Math.max(minScrollY, maxScrollY),
    };
  }

  private getWorldWidthPx(): number {
    return MAP_WIDTH * CELL_SIZE;
  }

  private getWorldHeightPx(): number {
    return MAP_HEIGHT * CELL_SIZE;
  }

  getScreenPointForCell(cellX: number, cellY: number): { x: number; y: number } | null {
    if (!this.sys.isActive() || !this.game.canvas) {
      return null;
    }

    const camera = this.cameras.main;
    const worldX = cellX * CELL_SIZE + CELL_SIZE * 0.5;
    const worldY = cellY * CELL_SIZE + CELL_SIZE * 0.5;
    const bounds = this.game.canvas.getBoundingClientRect();
    const worldView = camera.worldView;
    const scaleX = bounds.width / worldView.width;
    const scaleY = bounds.height / worldView.height;

    return {
      x: bounds.left + (worldX - worldView.x) * scaleX,
      y: bounds.top + (worldY - worldView.y) * scaleY,
    };
  }

  issueContextCommandAtWorldPosition(worldX: number, worldY: number): boolean {
    if (!this.sys.isActive()) {
      return false;
    }

    const clampedCellX = Phaser.Math.Clamp(Math.floor(worldX), 0, MAP_WIDTH - 1);
    const clampedCellY = Phaser.Math.Clamp(Math.floor(worldY), 0, MAP_HEIGHT - 1);
    const displayedTargetEntity = findEntityAtWorldPointInEntities(
      this.displayedEntities,
      worldX * CELL_SIZE,
      worldY * CELL_SIZE,
      CELL_SIZE,
    );
    const projectedTargetEntity = displayedTargetEntity
      ? null
      : findEntityAtWorldPointInEntities(
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
    if (!this.dragSelection || !this.isDragSelectionActive(this.dragSelection)) {
      return null;
    }

    const width = Math.abs(this.dragSelection.currentScreenX - this.dragSelection.startScreenX);
    const height = Math.abs(this.dragSelection.currentScreenY - this.dragSelection.startScreenY);

    return {
      active: true,
      startX: this.dragSelection.startScreenX,
      startY: this.dragSelection.startScreenY,
      currentX: this.dragSelection.currentScreenX,
      currentY: this.dragSelection.currentScreenY,
      width,
      height,
    };
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

  private getHealthBarLayout(
    entity: ProjectedEntityView,
    px: number,
    py: number,
  ): {
    barX: number;
    barY: number;
    barWidthPx: number;
    barHeightPx: number;
    entityTopPx: number;
  } {
    const entityWidthPx =
      entity.kind === 'building'
        ? entity.footprintWidth * CELL_SIZE
        : CELL_SIZE * Math.max(entity.size, 0.55);
    const entityCenterX =
      entity.kind === 'building'
        ? px + (entity.footprintWidth * CELL_SIZE) * 0.5
        : px + CELL_SIZE * 0.5;
    const entityTopPx =
      entity.kind === 'building'
        ? py
        : py + CELL_SIZE * 0.5 - (CELL_SIZE * entity.size * 0.5);
    const barWidthPx = Phaser.Math.Clamp(
      entityWidthPx * (entity.kind === 'building' ? 0.78 : 1.35),
      18,
      72,
    );
    const barHeightPx = entity.kind === 'building' ? 5 : 4;
    const barX = entityCenterX - barWidthPx * 0.5;
    const barY = entityTopPx - (barHeightPx + 4);

    return {
      barX,
      barY,
      barWidthPx,
      barHeightPx,
      entityTopPx,
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

  private isUnitType(entityType: SelectionState['selectedEntityType']): entityType is UnitType {
    return (
      entityType === 'villager'
      || entityType === 'scout'
      || entityType === 'militia'
      || entityType === 'spearman'
      || entityType === 'archer'
      || entityType === 'skirmisher'
      || entityType === 'knight'
    );
  }
}
