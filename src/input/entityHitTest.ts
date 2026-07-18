import { HUMAN_PLAYER_ID } from '../game/simulation/prototypeScenario';
import type { ProjectedEntityView, RenderState, ResourceKind } from '../game/simulation/types';
import { worldToIso } from '../rendering/isometricProjection';

const LAYER_PRIORITY: Record<ProjectedEntityView['kind'], number> = {
  tile: 0,
  resource: 1,
  building: 2,
  unit: 3,
};
const UNIT_COMMAND_TARGET_PADDING_CELLS = 0.18;

function selectableOwnerPriority(owner: number | null): number {
  if (owner === HUMAN_PLAYER_ID) {
    return 0;
  }

  if (owner === null) {
    return 2;
  }

  return 1;
}

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

function intersectsRectangle(
  x: number,
  y: number,
  width: number,
  height: number,
  minWorldX: number,
  minWorldY: number,
  maxWorldX: number,
  maxWorldY: number,
): boolean {
  return (
    maxWorldX >= x
    && minWorldX <= x + width
    && maxWorldY >= y
    && minWorldY <= y + height
  );
}

function intersectsCircle(
  centerX: number,
  centerY: number,
  radius: number,
  minWorldX: number,
  minWorldY: number,
  maxWorldX: number,
  maxWorldY: number,
): boolean {
  const closestX = Math.max(minWorldX, Math.min(centerX, maxWorldX));
  const closestY = Math.max(minWorldY, Math.min(centerY, maxWorldY));
  const dx = centerX - closestX;
  const dy = centerY - closestY;
  return dx * dx + dy * dy <= radius * radius;
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
      cellSize * entity.size * 0.5,
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

export function isWorldPointInsideCommandTargetEntity(
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
      cellSize * entity.size * 0.5 + cellSize * UNIT_COMMAND_TARGET_PADDING_CELLS,
      worldX,
      worldY,
    );
  }

  return isWorldPointInsideEntity(entity, worldX, worldY, cellSize);
}

export function doesWorldRectIntersectEntity(
  entity: ProjectedEntityView,
  startWorldX: number,
  startWorldY: number,
  endWorldX: number,
  endWorldY: number,
  cellSize: number,
): boolean {
  const minWorldX = Math.min(startWorldX, endWorldX);
  const minWorldY = Math.min(startWorldY, endWorldY);
  const maxWorldX = Math.max(startWorldX, endWorldX);
  const maxWorldY = Math.max(startWorldY, endWorldY);
  const px = entity.x * cellSize;
  const py = entity.y * cellSize;

  if (entity.kind === 'unit') {
    return intersectsCircle(
      px + cellSize * 0.5,
      py + cellSize * 0.5,
      cellSize * entity.size * 0.5,
      minWorldX,
      minWorldY,
      maxWorldX,
      maxWorldY,
    );
  }

  if (entity.kind === 'building') {
    return intersectsRectangle(
      px,
      py,
      entity.footprintWidth * cellSize,
      entity.footprintHeight * cellSize,
      minWorldX,
      minWorldY,
      maxWorldX,
      maxWorldY,
    );
  }

  if (entity.kind === 'resource') {
    if (isRectangleResource(entity.entityType)) {
      return intersectsRectangle(
        px + cellSize * 0.1,
        py + cellSize * 0.1,
        cellSize * entity.size,
        cellSize * entity.size,
        minWorldX,
        minWorldY,
        maxWorldX,
        maxWorldY,
      );
    }

    return intersectsCircle(
      px + cellSize * 0.5,
      py + cellSize * 0.5,
      cellSize * entity.size * 0.55,
      minWorldX,
      minWorldY,
      maxWorldX,
      maxWorldY,
    );
  }

  return false;
}

// Isometric marquee test. The drag rectangle is axis-aligned in the camera's
// iso-pixel space (the camera transform is pure translate+scale, no rotation),
// and each entity's body is centred at its iso cell-centre — worldToIso(x + 0.5,
// y + 0.5) — rather than its top-down pixel centre. Drag-selectable entities
// (units, non-farm resources like sheep) render as circles, so the circle case
// is exact; buildings / farms are never drag-selectable and fall back to an
// iso-centre point test for completeness.
export function doesIsoWorldRectIntersectEntity(
  entity: ProjectedEntityView,
  startWorldX: number,
  startWorldY: number,
  endWorldX: number,
  endWorldY: number,
  cellSize: number,
): boolean {
  const minWorldX = Math.min(startWorldX, endWorldX);
  const minWorldY = Math.min(startWorldY, endWorldY);
  const maxWorldX = Math.max(startWorldX, endWorldX);
  const maxWorldY = Math.max(startWorldY, endWorldY);
  const centre = worldToIso(entity.x + 0.5, entity.y + 0.5);

  if (entity.kind === 'unit') {
    return intersectsCircle(
      centre.x,
      centre.y,
      cellSize * entity.size * 0.5,
      minWorldX,
      minWorldY,
      maxWorldX,
      maxWorldY,
    );
  }

  if (entity.kind === 'resource' && !isRectangleResource(entity.entityType)) {
    return intersectsCircle(
      centre.x,
      centre.y,
      cellSize * entity.size * 0.55,
      minWorldX,
      minWorldY,
      maxWorldX,
      maxWorldY,
    );
  }

  return (
    centre.x >= minWorldX && centre.x <= maxWorldX && centre.y >= minWorldY && centre.y <= maxWorldY
  );
}

export function findEntityAtWorldPoint(
  renderState: RenderState,
  worldX: number,
  worldY: number,
  cellSize: number,
): ProjectedEntityView | null {
  return findEntityAtWorldPointInEntities(renderState.entities, worldX, worldY, cellSize);
}

// Topmost point-hit under the pointer: higher render layer wins, ties broken
// by later render order (the entity drawn on top). `containsPoint` defaults to
// the exact-body test; command targeting passes the slightly padded variant.
// Both callers had this identical sort/pick body; only the point test differed.
function topPointHit(
  entities: ProjectedEntityView[],
  worldX: number,
  worldY: number,
  cellSize: number,
  containsPoint?: (
    entity: ProjectedEntityView,
    pointWorldX: number,
    pointWorldY: number,
    pointCellSize: number,
  ) => boolean,
): ProjectedEntityView | null {
  return getIndexedPointHitCandidates(entities, worldX, worldY, cellSize, containsPoint)
    .sort((left, right) => {
      const layerDelta = LAYER_PRIORITY[right.entity.kind] - LAYER_PRIORITY[left.entity.kind];
      if (layerDelta !== 0) {
        return layerDelta;
      }

      return right.index - left.index;
    })[0]?.entity ?? null;
}

export function findEntityAtWorldPointInEntities(
  entities: ProjectedEntityView[],
  worldX: number,
  worldY: number,
  cellSize: number,
): ProjectedEntityView | null {
  return topPointHit(entities, worldX, worldY, cellSize);
}

export function findCommandTargetEntityAtWorldPointInEntities(
  entities: ProjectedEntityView[],
  worldX: number,
  worldY: number,
  cellSize: number,
): ProjectedEntityView | null {
  return topPointHit(entities, worldX, worldY, cellSize, isWorldPointInsideCommandTargetEntity);
}

export function findEntitiesAtWorldPointInEntities(
  entities: ProjectedEntityView[],
  worldX: number,
  worldY: number,
  cellSize: number,
): ProjectedEntityView[] {
  return getIndexedPointHitCandidates(entities, worldX, worldY, cellSize)
    .sort((left, right) => {
      const layerDelta = LAYER_PRIORITY[right.entity.kind] - LAYER_PRIORITY[left.entity.kind];
      if (layerDelta !== 0) {
        return layerDelta;
      }

      // Exact-click selection should preserve the old bridge behaviour where
      // the human player's unit wins same-layer overlaps before enemy or Gaia.
      const ownerDelta = selectableOwnerPriority(left.entity.owner) - selectableOwnerPriority(right.entity.owner);
      if (ownerDelta !== 0) {
        return ownerDelta;
      }

      return right.index - left.index;
    })
    .map(({ entity }) => entity);
}

function getIndexedPointHitCandidates(
  entities: ProjectedEntityView[],
  worldX: number,
  worldY: number,
  cellSize: number,
  containsPoint: (
    entity: ProjectedEntityView,
    pointWorldX: number,
    pointWorldY: number,
    pointCellSize: number,
  ) => boolean = isWorldPointInsideEntity,
): Array<{ entity: ProjectedEntityView; index: number }> {
  return entities
    .map((entity, index) => ({ entity, index }))
    .filter(({ entity }) => entity.kind !== 'tile' && !entity.isMemory)
    .filter(({ entity }) => containsPoint(entity, worldX, worldY, cellSize));
}
