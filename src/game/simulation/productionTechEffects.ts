// Production (unit-training) tech effects. Pure DERIVED multipliers read at the
// single production enqueue site (trainingMarketOps), stacking with the Aztecs
// creation-speed civ bonus (civBonusEffects.civTrainTimeMultiplier).
//
// Conscription (Castle, Imperial): units trained at the Barracks, Archery
// Range, Stable, or Castle are created 25% faster (technologies.csv). No
// per-unit state — the discounted tick count is computed at enqueue and lives
// in the already-persisted production queue.

import type { BuildingType, ResearchableTechnologyType } from './types';
import { UNIQUE_TECHNOLOGIES } from './uniqueTechnologies';

// Conscription: ×0.75 train time (25% faster).
export const CONSCRIPTION_TRAIN_TIME_MULTIPLIER = 0.75;

// The military buildings Conscription speeds up (technologies.csv applies-to:
// Barracks;Archery Range;Stable;Castle). Siege Workshop, Monastery, Dock, and
// the Town Center are excluded.
const CONSCRIPTION_BUILDINGS = new Set<BuildingType>([
  'barracks',
  'archery-range',
  'stable',
  'castle',
]);

// The owner's train-time multiplier for a unit trained at `buildingType`, from
// researched production techs. 1.0 (no change) unless Conscription is researched
// and the building is one it speeds up.
export function conscriptionTrainTimeMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  buildingType: BuildingType,
): number {
  if (researchedTechnologies.has('conscription') && CONSCRIPTION_BUILDINGS.has(buildingType)) {
    return CONSCRIPTION_TRAIN_TIME_MULTIPLIER;
  }
  return 1;
}

/**
 * The train-time multiplier from a civilization unique technology, e.g. the
 * Goths' Perfusion (Barracks work twice as fast, so half the time).
 *
 * Kept separate from Conscription so the two MULTIPLY rather than one winning:
 * a Goth with both trains Barracks units in 0.375 of the base time, which is
 * what AoE2 does and what the declared multipliers say.
 */
export function uniqueTechTrainTimeMultiplier(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
  buildingType: BuildingType,
): number {
  let multiplier = 1;
  for (const technology of UNIQUE_TECHNOLOGIES) {
    if (!technology.trainRate) continue;
    if (technology.trainRate.building !== buildingType) continue;
    if (!researchedTechnologies.has(technology.id)) continue;
    multiplier /= technology.trainRate.multiplier;
  }
  return multiplier;
}
