// What a selection's members are, read off the displayed entities rather than
// off the selection's type: since work 142 a group's type is named only when
// every member shares it, so a group of villagers and a sheep has none, and a
// rule that served "a villager group" must read the members (review round 0).
// And whether a member is drawn on screen, read off the polygons the renderer
// presented for it (review round 1).

import type { ProjectedEntityView } from '../game/simulation/types';
import type { VoxelIsoPoint } from '../rendering/voxel/aoeVoxelGeometry';

export interface IsoRect {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Villagers, with any sheep walking among them: at least one villager, and
 *  nothing else but sheep. A sheep only walks, so it changes nothing about
 *  what the group's villagers act on. */
export function isVillagerGroup(
  ids: readonly number[],
  displayed: readonly ProjectedEntityView[],
): boolean {
  const byId = new Map(displayed.map((entity) => [entity.id, entity]));
  let villagers = 0;
  for (const id of ids) {
    const member = byId.get(id);
    if (member?.kind === 'unit' && member.entityType === 'villager') {
      villagers += 1;
    } else if (!(member?.kind === 'resource' && member.entityType === 'sheep')) {
      return false;
    }
  }
  return villagers > 0;
}

/** Whether a convex polygon and a rectangle share a point, by the separating
 *  axis test: a polygon whose bounding box only grazes a corner of the
 *  rectangle is outside it (review round 1). */
export function convexPolygonIntersectsRect(polygon: readonly VoxelIsoPoint[], rect: IsoRect): boolean {
  if (polygon.length === 0) return false;
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  if (Math.max(...xs) < rect.minX || Math.min(...xs) > rect.maxX) return false;
  if (Math.max(...ys) < rect.minY || Math.min(...ys) > rect.maxY) return false;
  const corners = [
    { x: rect.minX, y: rect.minY }, { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY }, { x: rect.minX, y: rect.maxY },
  ];
  for (let index = 0; index < polygon.length; index += 1) {
    const from = polygon[index]!;
    const to = polygon[(index + 1) % polygon.length]!;
    const normal = { x: to.y - from.y, y: from.x - to.x };
    if (normal.x === 0 && normal.y === 0) continue;
    const along = (point: VoxelIsoPoint): number => point.x * normal.x + point.y * normal.y;
    const body = polygon.map(along);
    const box = corners.map(along);
    if (Math.max(...body) < Math.min(...box) || Math.max(...box) < Math.min(...body)) return false;
  }
  return true;
}

/** Whether any part of a body is inside the view, both in iso pixels: what
 *  DE's "on screen" means for a double-click. `polygons` are the ones the
 *  renderer presented for the entity, its pose, facing and gait included, so
 *  the test is the body the player sees (review round 1). */
export function isDrawnInView(polygons: readonly (readonly VoxelIsoPoint[])[], view: IsoRect): boolean {
  return polygons.some((polygon) => convexPolygonIntersectsRect(polygon, view));
}
