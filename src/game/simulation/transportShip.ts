// The Transport Ship: what it can carry, and how much.
//
// A transport is the only way a land army crosses water, so its whole content
// is one question — who may board — and one number. The cargo itself rides the
// existing garrison side maps: those store plain entity ids on both sides, so a
// ship can host units exactly as a building does, with no save-format change.

import type { ResearchableTechnologyType, UnitType } from './types';
import { isWaterUnit } from './unitDomain';
import { CAREENING_TRANSPORT_BONUS, DRY_DOCK_TRANSPORT_BONUS } from './dockTechEffects';

// units.csv "Transport Ship": "Garrison inside 5 (10 with careening and 20 with
// dry dock)" — the base, plus the two Dock technologies that raise it.
export const TRANSPORT_CAPACITY = 5;

/**
 * How many units one transport holds, for an owner with this researched set:
 * 5, +5 with Careening, +10 with Dry Dock. The two ADD, so both give 20. The
 * bonuses are keyed on the technologies alone rather than on the menu chain, so
 * the number is right however the set was reached (a save, a scenario, a
 * civilization that starts with one).
 */
export function transportCapacity(
  researchedTechnologies: ReadonlySet<ResearchableTechnologyType>,
): number {
  let capacity = TRANSPORT_CAPACITY;
  if (researchedTechnologies.has('careening')) capacity += CAREENING_TRANSPORT_BONUS;
  if (researchedTechnologies.has('dry-dock')) capacity += DRY_DOCK_TRANSPORT_BONUS;
  return capacity;
}

/**
 * Whether this unit may board a transport. Land units may; ships may not — a
 * ship can already cross water under its own power, and a transport carrying a
 * transport would undo the point of the thing.
 */
export function canBoardTransport(unitType: UnitType): boolean {
  return !isWaterUnit(unitType);
}
