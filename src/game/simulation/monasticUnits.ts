// This roster's monastic line: the Monk and Spanish mounted Missionary heal,
// convert, and carry relics. DE update 169123 (2026-02-17) enabled Missionary
// relic transport, at base speed 0.9 while carrying and 1.1 otherwise.
// https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-169123/
//
// Both convert at this build's 4-cell monastic action range (spec §12's
// deliberate deviation from AoE2's 9; AoE2 gives the Missionary 7 there, and
// that 9-vs-7 split lands together with the monk-range fidelity work, not
// here — a 2-cell split on a 4-cell base would caricature it).

import type { UnitType } from './unitTypes';

export function isMonasticUnit(unitType: UnitType): boolean {
  return unitType === 'monk' || unitType === 'missionary';
}

/** Current DE permits relic pickup and deposit by either monastic unit. */
export function canCarryRelics(unitType: UnitType): boolean {
  return isMonasticUnit(unitType);
}
