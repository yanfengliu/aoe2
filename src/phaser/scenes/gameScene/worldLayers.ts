// World-layer renderers factored out of `GameScene.ts`: per-entity health
// bars and the fog-of-war mask. Both are move-only extractions that used to
// live as private methods on GameScene and paint to a dedicated graphics
// layer. The factory shape mirrors the `bridge/` ops-factory pattern used
// elsewhere (see `src/game/simulation/bridge/placementOps.ts`): a flat
// dep-bag in, a small object of render functions out. No behavior change.

import Phaser from 'phaser';

import type {
  ProjectedEntityView,
  ProjectedFrameView,
} from '../../../game/simulation/types';

// Health-bar layout for a single entity. Returned separately so the scene
// (and tests) can recompute it without re-running the paint logic.
export interface HealthBarLayout {
  barX: number;
  barY: number;
  barWidthPx: number;
  barHeightPx: number;
  entityTopPx: number;
}

// Accumulated visual-state record for each entity we drew a bar for. The
// scene stashes these on its per-frame visual-state buffers so browser tests
// can assert on layout without having to re-read the Graphics canvas.
export interface EntityHealthBarVisualState {
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

export interface WorldLayersDeps {
  healthBarLayer: Phaser.GameObjects.Graphics;
  fogLayer: Phaser.GameObjects.Graphics;
  cellSize: number;
}

export interface WorldLayersRenderer {
  // Paint health bars for every entity whose hp is known and non-memory.
  // Returns the visual-state records so the caller can stash them.
  renderEntityHealthBars(entities: ProjectedEntityView[]): EntityHealthBarVisualState[];
  // Paint the fog of war mask onto the fog layer using explored / visible
  // cell indexes from the projected frame.
  renderFog(frame: ProjectedFrameView): void;
}

// Computes the health-bar layout for a single entity. Mirrors the scene's
// prior private helper exactly so the existing browser-test assertions on
// bar width / offset keep matching.
export function computeHealthBarLayout(
  entity: ProjectedEntityView,
  px: number,
  py: number,
  cellSize: number,
): HealthBarLayout {
  const entityWidthPx =
    entity.kind === 'building'
      ? entity.footprintWidth * cellSize
      : cellSize * Math.max(entity.size, 0.55);
  const entityCenterX =
    entity.kind === 'building'
      ? px + (entity.footprintWidth * cellSize) * 0.5
      : px + cellSize * 0.5;
  const entityTopPx =
    entity.kind === 'building'
      ? py
      : py + cellSize * 0.5 - (cellSize * entity.size * 0.5);
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

export function createWorldLayersRenderer(deps: WorldLayersDeps): WorldLayersRenderer {
  const { healthBarLayer, fogLayer, cellSize } = deps;

  function renderEntityHealthBars(
    entities: ProjectedEntityView[],
  ): EntityHealthBarVisualState[] {
    const states: EntityHealthBarVisualState[] = [];

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

      const px = entity.x * cellSize;
      const py = entity.y * cellSize;
      const layout = computeHealthBarLayout(entity, px, py, cellSize);
      const fillRatio = Phaser.Math.Clamp(entity.currentHp / entity.maxHp, 0, 1);
      const fillColor =
        fillRatio > 0.6 ? 0x77d26a
        : fillRatio > 0.3 ? 0xdab85a
        : 0xd76464;

      healthBarLayer.fillStyle(0x101010, 0.88);
      healthBarLayer.fillRoundedRect(layout.barX, layout.barY, layout.barWidthPx, layout.barHeightPx, 2);
      healthBarLayer.fillStyle(0x2d2d2d, 0.95);
      healthBarLayer.fillRoundedRect(
        layout.barX + 1,
        layout.barY + 1,
        Math.max(0, layout.barWidthPx - 2),
        Math.max(0, layout.barHeightPx - 2),
        2,
      );
      healthBarLayer.fillStyle(fillColor, 0.96);
      healthBarLayer.fillRoundedRect(
        layout.barX + 1,
        layout.barY + 1,
        Math.max(0, (layout.barWidthPx - 2) * fillRatio),
        Math.max(0, layout.barHeightPx - 2),
        2,
      );

      states.push({
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

    return states;
  }

  // Iter-3 V3-18: memoize fog render. Pre-fix, every render frame
  // allocated two new Set objects, walked every cell of the map, and
  // emitted a fillRect for every non-visible cell — even when the
  // visibility frame had not changed since the last render. With the
  // fog layer left intact across no-change frames, the GameScene's
  // unconditional fogLayer.clear() becomes redundant work and is
  // removed there too. The fog only re-renders when `frame` updates
  // (different reference) and we cache the last-rendered reference.
  let lastRenderedFrame: ProjectedFrameView | null = null;

  function renderFog(frame: ProjectedFrameView): void {
    if (frame === lastRenderedFrame) {
      return;
    }
    lastRenderedFrame = frame;

    fogLayer.clear();

    const visible = new Set(frame.visibleCells);
    const explored = new Set(frame.exploredCells);

    for (let y = 0; y < frame.mapHeight; y += 1) {
      for (let x = 0; x < frame.mapWidth; x += 1) {
        const index = y * frame.mapWidth + x;
        if (!explored.has(index)) {
          fogLayer.fillStyle(0x081012, 0.94);
          fogLayer.fillRect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1);
          continue;
        }

        if (!visible.has(index)) {
          fogLayer.fillStyle(0x0b1215, 0.58);
          fogLayer.fillRect(x * cellSize, y * cellSize, cellSize + 1, cellSize + 1);
        }
      }
    }
  }

  return { renderEntityHealthBars, renderFog };
}
