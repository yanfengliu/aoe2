import Phaser from 'phaser';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../../game/simulation/prototypeScenario';
import type {
  ProjectedFrameView,
  RenderState,
  SelectionState,
} from '../../game/simulation/types';

interface SimulationBridge {
  step(deltaMs: number): void;
  getRenderState(): RenderState;
  getSelectionState(): SelectionState;
  selectEntityAtCell(x: number, y: number): boolean;
  clearSelection(): void;
  issueMoveCommand(x: number, y: number): boolean;
  confirmBuildingPlacement(x: number, y: number): boolean;
}

const CELL_SIZE = 24;

export interface CameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
}

export class GameScene extends Phaser.Scene {
  private readonly bridge: SimulationBridge;
  private terrainLayer?: Phaser.GameObjects.Graphics;
  private entityLayer?: Phaser.GameObjects.Graphics;
  private fogLayer?: Phaser.GameObjects.Graphics;
  private selectionLayer?: Phaser.GameObjects.Graphics;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private lastRenderedTick = -1;
  private lastSelectionKey = '';

  constructor(bridge: SimulationBridge) {
    super('game');
    this.bridge = bridge;
  }

  create(): void {
    this.terrainLayer = this.add.graphics();
    this.entityLayer = this.add.graphics();
    this.fogLayer = this.add.graphics();
    this.selectionLayer = this.add.graphics();

    this.cameras.main.setBackgroundColor('#132224');
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * CELL_SIZE, MAP_HEIGHT * CELL_SIZE);
    this.cameras.main.setZoom(1.4);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys(
      'W,A,S,D',
    ) as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
    this.input.mouse?.disableContextMenu();

    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        const nextZoom = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.7, 2.4);
        this.cameras.main.setZoom(nextZoom);
      },
    );

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const cellX = Phaser.Math.Clamp(Math.floor(worldPoint.x / CELL_SIZE), 0, MAP_WIDTH - 1);
      const cellY = Phaser.Math.Clamp(Math.floor(worldPoint.y / CELL_SIZE), 0, MAP_HEIGHT - 1);

      if (pointer.rightButtonDown()) {
        this.bridge.issueMoveCommand(cellX, cellY);
        return;
      }

      if (this.bridge.getSelectionState().placementMode) {
        this.bridge.confirmBuildingPlacement(cellX, cellY);
        return;
      }

      if (!this.bridge.selectEntityAtCell(cellX, cellY)) {
        this.bridge.clearSelection();
      }
    });
  }

  update(_time: number, delta: number): void {
    this.bridge.step(delta);
    this.updateCamera(delta);

    const state = this.bridge.getRenderState();
    const selectionKey = this.getSelectionKey();
    if (state.tick === this.lastRenderedTick && selectionKey === this.lastSelectionKey) {
      return;
    }

    this.lastRenderedTick = state.tick;
    this.lastSelectionKey = selectionKey;
    this.renderState(state, this.bridge.getSelectionState());
  }

  private updateCamera(delta: number): void {
    const camera = this.cameras.main;
    const speed = (delta / 1000) * 420;

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
  }

  private renderState(state: RenderState, selectionState: SelectionState): void {
    if (!this.terrainLayer || !this.entityLayer || !this.fogLayer || !this.selectionLayer) {
      return;
    }

    this.terrainLayer.clear();
    this.entityLayer.clear();
    this.fogLayer.clear();
    this.selectionLayer.clear();

    for (const entity of state.entities) {
      const px = entity.x * CELL_SIZE;
      const py = entity.y * CELL_SIZE;

      if (entity.layer === 'terrain') {
        this.terrainLayer.fillStyle(entity.tint, 1);
        this.terrainLayer.fillRect(px, py, CELL_SIZE + 1, CELL_SIZE + 1);
        continue;
      }

      if (entity.kind === 'resource') {
        this.entityLayer.fillStyle(entity.tint, 1);
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
        this.entityLayer.fillStyle(entity.tint, 1);
        this.entityLayer.fillRoundedRect(
          px - CELL_SIZE * 0.2,
          py - CELL_SIZE * 0.2,
          CELL_SIZE * entity.size,
          CELL_SIZE * entity.size,
          6,
        );
        continue;
      }

      this.entityLayer.fillStyle(entity.tint, 1);
      this.entityLayer.fillCircle(
        px + CELL_SIZE * 0.5,
        py + CELL_SIZE * 0.5,
        CELL_SIZE * entity.size * 0.5,
      );
    }

    if (state.frame) {
      this.renderFog(state.frame);
    }

    this.renderSelection(state, selectionState);
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

  private renderSelection(state: RenderState, selectionState: SelectionState): void {
    if (!this.selectionLayer || selectionState.selectedEntityId === null) {
      return;
    }

    const entity = state.entities.find((candidate) => candidate.id === selectionState.selectedEntityId);
    if (!entity) {
      return;
    }

    const px = entity.x * CELL_SIZE;
    const py = entity.y * CELL_SIZE;
    this.selectionLayer.lineStyle(2, 0xf7e5a5, 0.9);

    if (entity.kind === 'building') {
      this.selectionLayer.strokeRoundedRect(
        px - CELL_SIZE * 0.25,
        py - CELL_SIZE * 0.25,
        CELL_SIZE * entity.size + CELL_SIZE * 0.2,
        CELL_SIZE * entity.size + CELL_SIZE * 0.2,
        6,
      );
      return;
    }

    this.selectionLayer.strokeCircle(
      px + CELL_SIZE * 0.5,
      py + CELL_SIZE * 0.5,
      CELL_SIZE * Math.max(entity.size, 0.55),
    );
  }

  private getSelectionKey(): string {
    const selectionState = this.bridge.getSelectionState();
    return `${selectionState.selectedEntityId ?? 'none'}:${selectionState.placementMode ?? 'none'}`;
  }

  getCameraState(): CameraState | null {
    if (!this.sys.isActive()) {
      return null;
    }

    const camera = this.cameras.main;
    return {
      scrollX: camera.scrollX,
      scrollY: camera.scrollY,
      zoom: camera.zoom,
      width: camera.width,
      height: camera.height,
    };
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
}
