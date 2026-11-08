import type { EntityId, EntityRef } from 'civ-engine';

import { isStaticMemorableResourceType } from '../prototypeUnitRules';
import type { ResourceComponent } from '../types';
import type { GameWorld } from './pureHelpers';

/** These entities read mutable game-owned health, activity, wildlife or owner
 * state in the projector. Terrain, trees, bushes and mines only need component
 * diffs, except when their selection changes. Buildings include resource farms.
 * The classification follows the work150 investigation; transport, generation
 * handling and JSON validation remain civ-engine RenderAdapter responsibilities. */
function readsExternalState(world: GameWorld, id: EntityId): boolean {
  if (world.getComponent(id, 'unit') || world.getComponent(id, 'building')) return true;
  const resource = world.getComponent<ResourceComponent>(id, 'resource');
  if (resource) return !isStaticMemorableResourceType(resource.resourceType);
  return !world.getComponent(id, 'terrain');
}

/** Install once, BEFORE adapter.connect(), for the lifetime of this live world.
 * The listener queues invalidations before the adapter processes this same diff.
 * Reconnecting the adapter for immediate between-tick reads preserves that order.
 * On-read bridges do not install this listener or keep a candidate set. */
export function trackRenderInvalidation(
  world: GameWorld,
  adapter: { invalidate(ids: Iterable<EntityId>): void },
  consumeExternalChange: () => boolean,
  getSelection: () => readonly EntityRef[],
): void {
  const followed = new Set<EntityId>();
  for (const id of world.getAliveEntities()) {
    if (readsExternalState(world, id)) followed.add(id);
  }
  let selected = new Set(getSelection().map((ref) => ref.id));

  world.onDiff((diff) => {
    for (const id of diff.entities.destroyed) followed.delete(id);
    const reconsider = new Set(diff.entities.created);
    for (const key of ['unit', 'building', 'resource', 'terrain']) {
      const changes = diff.components[key];
      if (!changes) continue;
      for (const [id] of changes.set) reconsider.add(id);
      for (const id of changes.removed) reconsider.add(id);
    }
    for (const id of reconsider) {
      if (world.getEntityRef(id) !== null && readsExternalState(world, id)) followed.add(id);
      else followed.delete(id);
    }

    const candidates = consumeExternalChange() ? new Set(followed) : new Set<EntityId>();
    const nextSelection = new Set(getSelection().map((ref) => ref.id));
    for (const id of selected) if (!nextSelection.has(id)) candidates.add(id);
    for (const id of nextSelection) if (!selected.has(id)) candidates.add(id);
    selected = nextSelection;
    if (candidates.size > 0) adapter.invalidate(candidates);
  });
}
