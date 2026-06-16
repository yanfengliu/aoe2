import Phaser from 'phaser';

import type { ProjectedEntityView } from '../../../game/simulation/types';

// Resource-entity draw, extracted from GameScene.renderState (mirrors
// drawTerrainCell / unitRenderer / buildingRenderer). Move-only: the branch
// body is byte-identical to the prior inline code — square-footprint resources
// (gold/stone mines, trees) draw as an inset filled rect, everything else
// (berry bushes, sheep, fish, boar, wolf, relic, farm) draws as a centred
// circle. Owner/visual tint + the memory-dimmed fill alpha are passed through
// unchanged. Pulling it out keeps the pinned-legacy GameScene file lean as the
// M7 feedback call-sites land.
export function drawResourceEntity(
  graphics: Phaser.GameObjects.Graphics,
  entity: ProjectedEntityView,
  px: number,
  py: number,
  cellSize: number,
  fillAlpha: number,
): void {
  graphics.fillStyle(entity.tint, fillAlpha);
  if (
    entity.entityType === 'gold-mine'
    || entity.entityType === 'stone-mine'
    || entity.entityType === 'tree'
  ) {
    graphics.fillRect(
      px + cellSize * 0.1,
      py + cellSize * 0.1,
      cellSize * entity.size,
      cellSize * entity.size,
    );
  } else {
    graphics.fillCircle(
      px + cellSize * 0.5,
      py + cellSize * 0.5,
      cellSize * entity.size * 0.55,
    );
  }
}
