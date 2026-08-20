// Minimum range on defensive buildings, and the technology that removes it.
//
// A Tower or a Castle shoots down from arrow slits: an attacker pressed against
// the wall is underneath them and cannot be hit. That is the whole reason
// infantry hug a tower in Age of Empires, and the whole reason Murder Holes
// exists — holes in the floor of the hoarding, through which the defenders can
// finally reach what is directly below.
//
// DERIVED from the owner's researched set at the fire site, like every other
// building combat modifier: no per-building state and no save-format change.

import type { BuildingType, ResearchableTechnologyType } from './types';

// Cells from the footprint within which an un-teched building cannot shoot.
// One ring: a unit standing against the wall is safe, a unit one cell out is
// not — enough to make hugging a tower worth doing without making a tower
// useless against anything that reaches it.
const DEFENSIVE_MINIMUM_RANGE = 1;

// Deliberately NOT the Town Center. AoE2's minimum range is a Tower and Castle
// rule, and a Town Center that could not defend the villagers standing under it
// would be a trap — under it is exactly where they gather, and where they
// garrison from when raided.
const BUILDINGS_WITH_MINIMUM_RANGE = new Set<BuildingType>([
  'watch-tower', 'bombard-tower', 'castle',
]);

/** Whether this building currently cannot shoot what stands against it. */
export function hasBuildingMinimumRange(
  buildingType: BuildingType,
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): boolean {
  if (!BUILDINGS_WITH_MINIMUM_RANGE.has(buildingType)) return false;
  return !researchedTechnologies.has('murder-holes');
}

/**
 * How close a unit may get before this building can no longer hit it: 0 for
 * anything without a minimum range, and 0 for everything once its owner has
 * researched Murder Holes.
 */
export function buildingMinimumRange(
  buildingType: BuildingType,
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  return hasBuildingMinimumRange(buildingType, researchedTechnologies)
    ? DEFENSIVE_MINIMUM_RANGE
    : 0;
}
