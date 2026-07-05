import Phaser from 'phaser';

import type { ProjectedEntityView } from '../../../game/simulation/types';

// Resource-entity draw (mirrors terrainRenderer / unitRenderer / buildingRenderer).
// M7 isometric overhaul increment 8: resources sit on the iso ground with depth
// instead of as flat top-down shapes — a TREE is a brown trunk + a raised tinted
// canopy over a ground shadow (so forests read as iso woodland, not dark
// squares); a gold/stone MINE is a small mound of tinted rock lumps over a
// shadow. Everything else (berry bush, sheep, fish, boar, wolf, relic, farm)
// stays a centred circle at the cell's iso centre. Owner/visual tint + the
// memory-dimmed fill alpha pass through unchanged; pure per-frame draw.
export function drawResourceEntity(
  graphics: Phaser.GameObjects.Graphics,
  entity: ProjectedEntityView,
  px: number,
  py: number,
  cellSize: number,
  fillAlpha: number,
): void {
  const cx = px + cellSize * 0.5;
  const cy = py + cellSize * 0.5;

  if (entity.entityType === 'tree') {
    graphics.fillStyle(0x000000, 0.18 * fillAlpha);
    graphics.fillEllipse(cx, cy + cellSize * 0.28, cellSize * 0.5, cellSize * 0.2);
    const trunkW = Math.max(2, cellSize * 0.12);
    graphics.fillStyle(0x5b3b1e, fillAlpha);
    graphics.fillRect(cx - trunkW * 0.5, cy - cellSize * 0.05, trunkW, cellSize * 0.4);
    graphics.fillStyle(entity.tint, fillAlpha);
    graphics.fillCircle(cx, cy - cellSize * 0.24, cellSize * 0.42);
    return;
  }

  if (entity.entityType === 'gold-mine' || entity.entityType === 'stone-mine') {
    const s = cellSize * entity.size;
    graphics.fillStyle(0x000000, 0.18 * fillAlpha);
    graphics.fillEllipse(cx, cy + cellSize * 0.22, cellSize * 0.62, cellSize * 0.22);
    graphics.fillStyle(entity.tint, fillAlpha);
    graphics.fillCircle(cx - s * 0.22, cy + s * 0.04, s * 0.26);
    graphics.fillCircle(cx + s * 0.22, cy + s * 0.06, s * 0.24);
    graphics.fillCircle(cx, cy - s * 0.12, s * 0.28);
    return;
  }

  graphics.fillStyle(entity.tint, fillAlpha);
  graphics.fillCircle(cx, cy, cellSize * entity.size * 0.55);
}
