// Production (unit-training) tech effects. Pure DERIVED multipliers read at the
// single production enqueue site (trainingMarketOps), stacking with the Aztecs
// creation-speed civ bonus (civBonusEffects.civTrainTimeMultiplier).
//
// Conscription (Castle, Imperial): units trained at the Barracks, Archery
// Range, Stable, or Castle are created 25% faster (technologies.csv). No
// per-unit state — the discounted tick count is computed at enqueue and lives
// in the already-persisted production queue.

import type { BuildingType, ResearchableTechnologyType } from './types';

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
