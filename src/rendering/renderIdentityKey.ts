import type { ProjectedEntityView } from '../game/simulation/types';

// Stable render-cache key for per-unit presentation state. Keyed by
// id:generation (not raw id) so a recycled entity id — unit destroyed, a new
// unit reuses the id next tick with a bumped generation — cannot inherit the
// destroyed unit's state and slide across the map for one frame. Mirrors how
// RenderStore de-dupes (renderStore.ts keys by ref.id:generation).
export function renderIdentityKey(
  entity: Pick<ProjectedEntityView, 'id' | 'generation'>,
): string {
  return `${entity.id}:${entity.generation ?? 0}`;
}
