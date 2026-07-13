import type { ProjectedEntityView } from '../game/simulation/types';

function interpolateCoordinate(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha;
}

// Stable render-cache key for per-unit interpolation + facing. Keyed by
// id:generation (not raw id) so a recycled entity id — unit destroyed, a new
// unit reuses the id next tick with a bumped generation — cannot inherit the
// destroyed unit's previous position and slide across the map for one frame.
// Mirrors how RenderStore de-dupes (renderStore.ts keys by ref.id:generation).
export function renderIdentityKey(
  entity: Pick<ProjectedEntityView, 'id' | 'generation'>,
): string {
  return `${entity.id}:${entity.generation ?? 0}`;
}

export function interpolateProjectedEntities(
  entities: ProjectedEntityView[],
  previousPositions: ReadonlyMap<string, { x: number; y: number }>,
  interpolationAlpha: number,
): ProjectedEntityView[] {
  const clampedAlpha = Math.max(0, Math.min(1, interpolationAlpha));

  return entities.map((entity) => {
    if (entity.kind !== 'unit') {
      return entity;
    }

    const previousPosition = previousPositions.get(renderIdentityKey(entity));
    if (!previousPosition) {
      return entity;
    }

    return {
      ...entity,
      x: interpolateCoordinate(previousPosition.x, entity.x, clampedAlpha),
      y: interpolateCoordinate(previousPosition.y, entity.y, clampedAlpha),
    };
  });
}
