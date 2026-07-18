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

// The one authoritative encoding of what each entity kind's clickable body IS.
// Every hit predicate in this module derives from this descriptor, so a shape
// constant (the unit radius factor, the resource-rect inset, the 0.55 circle
// factor, a footprint rule) exists in exactly one place. `unitPadding` widens
// the UNIT circle only — command targeting is forgiving about slightly-missed
// unit bodies, never about buildings or resources. Tiles have no body (null).
type EntityHitShape =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number };

function entityHitShape(
  entity: ProjectedEntityView,
  cellSize: number,
  unitPadding = 0,
): EntityHitShape | null {
  const px = entity.x * cellSize;
  const py = entity.y * cellSize;

  if (entity.kind === 'unit') {
    return {
      kind: 'circle',
      cx: px + cellSize * 0.5,
      cy: py + cellSize * 0.5,
      r: cellSize * entity.size * 0.5 + cellSize * unitPadding,
    };
  }

  if (entity.kind === 'building') {
    return {
      kind: 'rect',
      x: px,
      y: py,
      w: entity.footprintWidth * cellSize,
      h: entity.footprintHeight * cellSize,
    };
  }

  if (entity.kind === 'resource') {
    if (isRectangleResource(entity.entityType)) {
      return {
        kind: 'rect',
        x: px + cellSize * 0.1,
        y: py + cellSize * 0.1,
        w: cellSize * entity.size,
        h: cellSize * entity.size,
      };
    }

    return {
      kind: 'circle',
      cx: px + cellSize * 0.5,
      cy: py + cellSize * 0.5,
      r: cellSize * entity.size * 0.55,
    };
  }

  return null;
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

function shapeIntersectsRect(
  shape: EntityHitShape | null,
  minWorldX: number,
  minWorldY: number,
  maxWorldX: number,
  maxWorldY: number,
): boolean {
  if (shape === null) {
    return false;
  }

  if (shape.kind === 'circle') {
    return intersectsCircle(shape.cx, shape.cy, shape.r, minWorldX, minWorldY, maxWorldX, maxWorldY);
  }

  return intersectsRectangle(shape.x, shape.y, shape.w, shape.h, minWorldX, minWorldY, maxWorldX, maxWorldY);
}

// A point test IS the degenerate rect test: for a rect collapsed to a point,
// intersectsCircle's closest-point clamp returns the point itself and
// intersectsRectangle's four comparisons reduce to containment, term for term
// (NaN agrees too — every comparison fails either way). Routing through one
// predicate keeps the equivalence structural instead of maintained by hand.
function shapeContainsPoint(shape: EntityHitShape | null, worldX: number, worldY: number): boolean {
  return shapeIntersectsRect(shape, worldX, worldY, worldX, worldY);
}

export function isWorldPointInsideEntity(
  entity: ProjectedEntityView,
  worldX: number,
  worldY: number,
  cellSize: number,
): boolean {
  return shapeContainsPoint(entityHitShape(entity, cellSize), worldX, worldY);
}

export function isWorldPointInsideCommandTargetEntity(
  entity: ProjectedEntityView,
  worldX: number,
  worldY: number,
  cellSize: number,
): boolean {
  return shapeContainsPoint(
    entityHitShape(entity, cellSize, UNIT_COMMAND_TARGET_PADDING_CELLS),
    worldX,
    worldY,
  );
}

export function doesWorldRectIntersectEntity(
  entity: ProjectedEntityView,
  startWorldX: number,
  startWorldY: number,
  endWorldX: number,
  endWorldY: number,
  cellSize: number,
): boolean {
  return shapeIntersectsRect(
    entityHitShape(entity, cellSize),
    Math.min(startWorldX, endWorldX),
    Math.min(startWorldY, endWorldY),
    Math.max(startWorldX, endWorldX),
    Math.max(startWorldY, endWorldY),
  );
}

// Isometric marquee test. The drag rectangle is axis-aligned in the camera's
// iso-pixel space (the camera transform is pure translate+scale, no rotation),
// and each entity's body is centred at its iso cell-centre — worldToIso(x + 0.5,
// y + 0.5) — rather than its top-down pixel centre. Note the anchor CELL, not
// the footprint: a 2x2 building's iso reference point is its anchor cell's
// centre. The circle-bodied entities (units, non-rect resources like sheep) are
// exactly the ones whose descriptor is a circle, re-centred here with the same
// radius; buildings / farms / rect resources are never drag-selectable and fall
// back to an iso-centre point test for completeness, as do bodiless tiles.
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
  const shape = entityHitShape(entity, cellSize);

  if (shape?.kind === 'circle') {
    return intersectsCircle(centre.x, centre.y, shape.r, minWorldX, minWorldY, maxWorldX, maxWorldY);
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
