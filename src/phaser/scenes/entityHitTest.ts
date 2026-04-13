import type { ProjectedEntityView, RenderState, ResourceKind } from '../../game/simulation/types';

const LAYER_PRIORITY: Record<ProjectedEntityView['kind'], number> = {
  tile: 0,
  resource: 1,
  building: 2,
  unit: 3,
};
const UNIT_HIT_TEST_PADDING_CELLS = 0.12;

function isRectangleResource(resourceType: ProjectedEntityView['entityType']): resourceType is ResourceKind {
  return resourceType === 'gold-mine' || resourceType === 'stone-mine' || resourceType === 'tree';
}

function containsCircle(
  centerX: number,
  centerY: number,
  radius: number,
  worldX: number,
  worldY: number,
): boolean {
  const dx = worldX - centerX;
  const dy = worldY - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

function containsRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  worldX: number,
  worldY: number,
): boolean {
  return worldX >= x && worldX <= x + width && worldY >= y && worldY <= y + height;
}

export function isWorldPointInsideEntity(
  entity: ProjectedEntityView,
  worldX: number,
  worldY: number,
  cellSize: number,
): boolean {
  const px = entity.x * cellSize;
  const py = entity.y * cellSize;

  if (entity.kind === 'unit') {
    return containsCircle(
      px + cellSize * 0.5,
      py + cellSize * 0.5,
      cellSize * (entity.size * 0.5 + UNIT_HIT_TEST_PADDING_CELLS),
      worldX,
      worldY,
    );
  }

  if (entity.kind === 'building') {
    return containsRectangle(
      px,
      py,
      entity.footprintWidth * cellSize,
      entity.footprintHeight * cellSize,
      worldX,
      worldY,
    );
  }

  if (entity.kind === 'resource') {
    if (isRectangleResource(entity.entityType)) {
      return containsRectangle(
        px + cellSize * 0.1,
        py + cellSize * 0.1,
        cellSize * entity.size,
        cellSize * entity.size,
        worldX,
        worldY,
      );
    }

    return containsCircle(
      px + cellSize * 0.5,
      py + cellSize * 0.5,
      cellSize * entity.size * 0.55,
      worldX,
      worldY,
    );
  }

  return false;
}

export function findEntityAtWorldPoint(
  renderState: RenderState,
  worldX: number,
  worldY: number,
  cellSize: number,
): ProjectedEntityView | null {
  const candidates = renderState.entities
    .filter((entity) => entity.kind !== 'tile')
    .filter((entity) => isWorldPointInsideEntity(entity, worldX, worldY, cellSize))
    .sort((left, right) => LAYER_PRIORITY[right.kind] - LAYER_PRIORITY[left.kind]);

  return candidates[0] ?? null;
}
