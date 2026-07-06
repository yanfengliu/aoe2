import Phaser from 'phaser';

import type { ProjectedEntityView } from '../../../game/simulation/types';

// Darken / lighten a packed-rgb tint toward black / white by `factor` (pure
// channel math), for the shaded base + sun-lit highlight of a tree crown.
function darken(tint: number, factor: number): number {
  const r = Math.round(((tint >> 16) & 0xff) * (1 - factor));
  const g = Math.round(((tint >> 8) & 0xff) * (1 - factor));
  const b = Math.round((tint & 0xff) * (1 - factor));
  return (r << 16) | (g << 8) | b;
}
function lighten(tint: number, factor: number): number {
  const r = Math.round(((tint >> 16) & 0xff) + (255 - ((tint >> 16) & 0xff)) * factor);
  const g = Math.round(((tint >> 8) & 0xff) + (255 - ((tint >> 8) & 0xff)) * factor);
  const b = Math.round((tint & 0xff) + (255 - (tint & 0xff)) * factor);
  return (r << 16) | (g << 8) | b;
}

// Deterministic per-cell canopy size multiplier in [0.85, 1.15) — a forest of
// same-tint trees gets natural size variation without a stored noise map or any
// Math.random/time (replay- and test-safe), so it doesn't read as one stamp
// repeated. Same hash family as terrainRenderer.cellNoise.
function treeCanopyJitter(cellX: number, cellY: number): number {
  let h = (cellX * 374761393 + cellY * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return 0.85 + (h / 4294967296) * 0.3;
}

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
    // Ground shadow + trunk, then a LAYERED crown (shaded base clumps → tint
    // crown → sun-lit highlight) with a deterministic per-cell size jitter, so a
    // forest reads as lush rounded woodland instead of one flat circle stamped
    // repeatedly. Light comes from the upper-left, matching the buildings.
    graphics.fillStyle(0x000000, 0.18 * fillAlpha);
    graphics.fillEllipse(cx, cy + cellSize * 0.28, cellSize * 0.5, cellSize * 0.2);
    const trunkW = Math.max(2, cellSize * 0.12);
    graphics.fillStyle(0x5b3b1e, fillAlpha);
    graphics.fillRect(cx - trunkW * 0.5, cy - cellSize * 0.05, trunkW, cellSize * 0.4);

    const r = cellSize * 0.42 * treeCanopyJitter(entity.x, entity.y);
    const canopyCy = cy - cellSize * 0.24;
    // Shaded lower clumps (two side blobs) give the crown a rounded, bushy base.
    graphics.fillStyle(darken(entity.tint, 0.3), fillAlpha);
    graphics.fillCircle(cx - r * 0.5, canopyCy + r * 0.32, r * 0.62);
    graphics.fillCircle(cx + r * 0.5, canopyCy + r * 0.3, r * 0.58);
    // Main crown at the raw tint.
    graphics.fillStyle(entity.tint, fillAlpha);
    graphics.fillCircle(cx, canopyCy, r);
    // Sun-lit highlight, upper-left, lighter.
    graphics.fillStyle(lighten(entity.tint, 0.24), fillAlpha);
    graphics.fillCircle(cx - r * 0.34, canopyCy - r * 0.34, r * 0.42);
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

  if (
    entity.entityType === 'sheep'
    || entity.entityType === 'boar'
    || entity.entityType === 'wolf'
  ) {
    // A small standing animal: an oval body + a head bump over a ground shadow,
    // so wildlife reads as a creature on the iso ground rather than a flat dot.
    const s = cellSize * entity.size;
    graphics.fillStyle(0x000000, 0.16 * fillAlpha);
    graphics.fillEllipse(cx, cy + s * 0.28, s * 0.7, s * 0.24);
    graphics.fillStyle(entity.tint, fillAlpha);
    graphics.fillEllipse(cx, cy, s * 0.9, s * 0.55);
    graphics.fillCircle(cx + s * 0.42, cy - s * 0.06, s * 0.24);
    return;
  }

  graphics.fillStyle(entity.tint, fillAlpha);
  graphics.fillCircle(cx, cy, cellSize * entity.size * 0.55);
}
