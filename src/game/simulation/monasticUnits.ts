// The monastic line: units that heal, convert, and rest their faith. Age of
// Empires II has exactly two — the Monk and the Spanish MISSIONARY, a monk on
// horseback (units.csv: HP 30, speed 1.1, LOS 9) — and the Missionary CANNOT
// carry relics, which is the price of the horse.
//
// Both convert at this build's 4-cell monastic action range (spec §12's
// deliberate deviation from AoE2's 9; AoE2 gives the Missionary 7 there, and
// that 9-vs-7 split lands together with the monk-range fidelity work, not
// here — a 2-cell split on a 4-cell base would caricature it).

import type { UnitType } from './unitTypes';

export function isMonasticUnit(unitType: UnitType): boolean {
  return unitType === 'monk' || unitType === 'missionary';
}

/** Whether this unit may pick up and deposit relics. The horse says no. */
export function canCarryRelics(unitType: UnitType): boolean {
  return unitType === 'monk';
}
