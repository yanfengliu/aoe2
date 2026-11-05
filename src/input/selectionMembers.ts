// What a selection's members are, read off the displayed entities rather than
// off the selection's type: since work 142 a group's type is named only when
// every member shares it, so a group of villagers and a sheep has none, and a
// rule that served "a villager group" must read the members (review round 0).

import type { ProjectedEntityView } from '../game/simulation/types';
import { voxelEntityHitRegions } from '../rendering/voxel/aoeVoxelHitProxy';

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

/** Whether any part of the entity's drawn body is inside the view, both in
 *  iso pixels: what DE's "on screen" means for a double-click, where a box
 *  over the view tests only a circle at the feet (review round 0). The
 *  recipe's still parts, so a body's idle motion of a pixel or so is outside
 *  it. */
export function isDrawnInView(
  entity: ProjectedEntityView,
  view: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number },
): boolean {
  return voxelEntityHitRegions(entity).some(({ polygon }) => {
    const xs = polygon.map((point) => point.x);
    const ys = polygon.map((point) => point.y);
    return Math.max(...xs) >= view.minX && Math.min(...xs) <= view.maxX
      && Math.max(...ys) >= view.minY && Math.min(...ys) <= view.maxY;
  });
}
