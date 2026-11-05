import type { ProjectedEntityView } from './types';

// A live animal is a unit in Definitive Edition: livestock are units the
// player selects and commands, and wild animals are nobody's units. This game
// keeps every animal as a resource entity, so whatever draws or clicks UNITS
// asks this as well: a unit hidden by a building is drawn as an outline, and
// a click on a unit's drawn body outranks the building drawn in front of it
// (work 142; spec §14.5). A carcass is not a unit, and neither is a fish.
const ANIMALS: ReadonlySet<ProjectedEntityView['entityType']> = new Set(['sheep', 'boar', 'deer', 'wolf']);

export function isLiveAnimalView(entity: ProjectedEntityView): boolean {
  return entity.kind === 'resource' && ANIMALS.has(entity.entityType) && entity.wildlifeAlive !== false;
}

/** A unit, or a live animal: what DE draws and clicks as a unit. */
export function isUnitLikeView(entity: ProjectedEntityView): boolean {
  return entity.kind === 'unit' || isLiveAnimalView(entity);
}
