import type { ProjectedEntityView } from '../../game/simulation/types';

function interpolateCoordinate(previous: number, current: number, alpha: number): number {
  return previous + (current - previous) * alpha;
}

export function interpolateProjectedEntities(
  entities: ProjectedEntityView[],
  previousPositions: ReadonlyMap<number, { x: number; y: number }>,
  interpolationAlpha: number,
): ProjectedEntityView[] {
  const clampedAlpha = Math.max(0, Math.min(1, interpolationAlpha));

  return entities.map((entity) => {
    if (entity.kind !== 'unit') {
      return entity;
    }

    const previousPosition = previousPositions.get(entity.id);
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
