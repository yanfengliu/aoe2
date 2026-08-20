// The Transport Ship: what it can carry, and how much.
//
// A transport is the only way a land army crosses water, so its whole content
// is one question — who may board — and one number. The cargo itself rides the
// existing garrison side maps: those store plain entity ids on both sides, so a
// ship can host units exactly as a building does, with no save-format change.

import type { UnitType } from './types';
import { isWaterUnit } from './unitDomain';

// units.csv "Transport Ship": "Garrison inside 5 (10 with careening and 20 with
// dry dock)". Careening and Dry Dock are Dock technologies this build does not
// have yet, so the base figure is the whole story for now.
export const TRANSPORT_CAPACITY = 5;

/** How many units one transport holds. */
export function transportCapacity(): number {
  return TRANSPORT_CAPACITY;
}

/**
 * Whether this unit may board a transport. Land units may; ships may not — a
 * ship can already cross water under its own power, and a transport carrying a
 * transport would undo the point of the thing.
 */
export function canBoardTransport(unitType: UnitType): boolean {
  return !isWaterUnit(unitType);
}
