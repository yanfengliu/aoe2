// Pure isometric view/camera math. Every function depends only on plain input
// values, so camera and selection geometry stay deterministic in unit tests.

import type { ProjectedEntityView } from '../game/simulation/types';
import { doesIsoWorldRectIntersectEntity } from '../input/entityHitTest';

export interface CellRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// The cell (Town Center centre, else the centroid of owned entities) the camera
// should frame on the first render. null when the player has no live entities
// yet — the caller retries next frame.
export function computeBaseFocusCell(
  entities: readonly ProjectedEntityView[],
  humanPlayerId: number,
): { cellX: number; cellY: number } | null {
  const owned = entities.filter((entity) => entity.owner === humanPlayerId && !entity.isMemory);
  if (owned.length === 0) {
    return null;
  }

  const townCenter = owned.find(
    (entity) => entity.kind === 'building' && entity.entityType === 'town-center',
  );
  if (townCenter) {
    return {
      cellX: townCenter.x + townCenter.footprintWidth / 2,
      cellY: townCenter.y + townCenter.footprintHeight / 2,
    };
  }

  return {
    cellX: owned.reduce((sum, entity) => sum + entity.x + 0.5, 0) / owned.length,
    cellY: owned.reduce((sum, entity) => sum + entity.y + 0.5, 0) / owned.length,
  };
}

// Iso-pixel AABB of an on-screen drag rectangle. `screenToIso` maps a canvas
// point to iso-pixel world space (camera.getWorldPoint). The camera transform is
// pure translate+scale (no rotation), so two opposite screen corners bound the
// rect — the marquee hit-test then compares each unit's iso centre in this space.
export function isoDragPixelBounds(
  startScreenX: number,
  startScreenY: number,
  currentScreenX: number,
  currentScreenY: number,
  screenToIso: (screenX: number, screenY: number) => { x: number; y: number },
): CellRect {
  const start = screenToIso(
    Math.min(startScreenX, currentScreenX),
    Math.min(startScreenY, currentScreenY),
  );
  const end = screenToIso(
    Math.max(startScreenX, currentScreenX),
    Math.max(startScreenY, currentScreenY),
  );
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  };
}

// A live entity is drag-selectable when it's a human-owned unit or a human-owned
// sheep (the only marquee-eligible resource). Memory ghosts never qualify.
export function isDragSelectableEntity(
  entity: ProjectedEntityView,
  humanPlayerId: number,
): boolean {
  if (entity.isMemory) {
    return false;
  }
  if (entity.kind === 'unit') {
    return entity.owner === humanPlayerId;
  }
  return (
    entity.kind === 'resource'
    && entity.entityType === 'sheep'
    && entity.owner === humanPlayerId
  );
}

// Drag-selectable entities whose iso body intersects the marquee (iso-pixel
// bounds), ordered top-to-bottom then left-to-right then by id for a stable
// live-preview list. `isDragSelectable` is the scene's owner/kind predicate.
export function marqueePreviewEntities(
  entities: readonly ProjectedEntityView[],
  bounds: CellRect,
  isDragSelectable: (entity: ProjectedEntityView) => boolean,
  cellSize: number,
): ProjectedEntityView[] {
  return entities
    .filter(isDragSelectable)
    .filter((entity) =>
      doesIsoWorldRectIntersectEntity(
        entity,
        bounds.minX,
        bounds.minY,
        bounds.maxX,
        bounds.maxY,
        cellSize,
      ))
    .sort((left, right) => {
      const yDelta = left.y - right.y;
      if (Math.abs(yDelta) > 0.001) {
        return yDelta;
      }
      const xDelta = left.x - right.x;
      if (Math.abs(xDelta) > 0.001) {
        return xDelta;
      }
      return left.id - right.id;
    });
}
