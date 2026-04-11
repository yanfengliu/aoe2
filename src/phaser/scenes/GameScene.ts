import Phaser from 'phaser';

import type { ProjectedEntityView } from '../../game/simulation/types';

interface SimulationBridge {
  step(deltaMs: number): void;
  getRenderState(): { tick: number; entities: ProjectedEntityView[] };
}

const CELL_SIZE = 24;

export class GameScene extends Phaser.Scene {
  private readonly bridge: SimulationBridge;
  private terrainLayer?: Phaser.GameObjects.Graphics;
  private entityLayer?: Phaser.GameObjects.Graphics;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private lastRenderedTick = -1;

  constructor(bridge: SimulationBridge) {
    super('game');
    this.bridge = bridge;
  }

  create(): void {
    this.terrainLayer = this.add.graphics();
    this.entityLayer = this.add.graphics();

    this.cameras.main.setBackgroundColor('#132224');
    this.cameras.main.setBounds(0, 0, 36 * CELL_SIZE, 24 * CELL_SIZE);
    this.cameras.main.setZoom(1.4);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys(
      'W,A,S,D',
    ) as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;

    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
        const nextZoom = Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.7, 2.4);
        this.cameras.main.setZoom(nextZoom);
      },
    );
  }

  update(_time: number, delta: number): void {
    this.bridge.step(delta);
    this.updateCamera(delta);

    const state = this.bridge.getRenderState();
    if (state.tick === this.lastRenderedTick) {
      return;
    }

    this.lastRenderedTick = state.tick;
    this.renderState(state.entities);
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

  private renderState(entities: ProjectedEntityView[]): void {
    if (!this.terrainLayer || !this.entityLayer) {
      return;
    }

    this.terrainLayer.clear();
    this.entityLayer.clear();

    for (const entity of entities) {
      const px = entity.x * CELL_SIZE;
      const py = entity.y * CELL_SIZE;

      if (entity.layer === 'terrain') {
        this.terrainLayer.fillStyle(entity.tint, 1);
        this.terrainLayer.fillRect(px, py, CELL_SIZE + 1, CELL_SIZE + 1);
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
  }
}
