// M4 — the civilization unique units. One row per (civilization, unit) pair
// from design/stats/civilizations.csv; the stats behind each unitType are
// transcribed from design/stats/units.csv into the ordinary per-unit tables, so
// a unique unit is a normal roster member that happens to be civ-gated.
//
// This table is the ONLY place the gate lives: optionsRules reads it for both
// the Castle and the Dock train menus, so a civ cannot end up offered a unit it
// has no business training (and a unit cannot be silently offered to nobody).

import type { ResearchableTechnologyType } from './technologyTypes';
import type { TrainableUnitType } from './unitTypes';

export interface UniqueUnitEntry {
  readonly civilization: string;
  readonly unitType: TrainableUnitType;
  /** Which building trains it. Naval unique units come from the Dock. */
  readonly trainedAt: 'castle' | 'dock';
  /**
   * The Imperial elite version and the technology that unlocks it, where
   * that chain exists. The menu shows whichever end of the chain the owner
   * has researched, exactly like the stock upgrade lines.
   */
  readonly elite?: readonly [TrainableUnitType, ResearchableTechnologyType];
}

export const UNIQUE_UNITS_BY_CIVILIZATION: readonly UniqueUnitEntry[] = [
  {
    civilization: 'Britons',
    unitType: 'longbowman',
    trainedAt: 'castle',
    elite: ['elite-longbowman', 'elite-longbowman-upgrade'],
  },
  { civilization: 'Aztecs', unitType: 'jaguar-warrior', trainedAt: 'castle' },
  { civilization: 'Byzantines', unitType: 'cataphract', trainedAt: 'castle' },
  { civilization: 'Celts', unitType: 'woad-raider', trainedAt: 'castle' },
  { civilization: 'Chinese', unitType: 'chu-ko-nu', trainedAt: 'castle' },
  { civilization: 'Franks', unitType: 'throwing-axeman', trainedAt: 'castle' },
  { civilization: 'Goths', unitType: 'huskarl', trainedAt: 'castle' },
  { civilization: 'Huns', unitType: 'tarkan', trainedAt: 'castle' },
  { civilization: 'Japanese', unitType: 'samurai', trainedAt: 'castle' },
  { civilization: 'Koreans', unitType: 'war-wagon', trainedAt: 'castle' },
  { civilization: 'Mayans', unitType: 'plumed-archer', trainedAt: 'castle' },
  { civilization: 'Mongols', unitType: 'mangudai', trainedAt: 'castle' },
  { civilization: 'Persians', unitType: 'war-elephant', trainedAt: 'castle' },
  { civilization: 'Saracens', unitType: 'mameluke', trainedAt: 'castle' },
  { civilization: 'Spanish', unitType: 'conquistador', trainedAt: 'castle' },
  { civilization: 'Teutons', unitType: 'teutonic-knight', trainedAt: 'castle' },
  { civilization: 'Turks', unitType: 'janissary', trainedAt: 'castle' },
  { civilization: 'Vikings', unitType: 'berserk', trainedAt: 'castle' },
  { civilization: 'Koreans', unitType: 'turtle-ship', trainedAt: 'dock' },
  { civilization: 'Vikings', unitType: 'longboat', trainedAt: 'dock' },
];

/** Every unique unit this civilization may train, in roster order. */
export function uniqueUnitsFor(civilization: string): readonly UniqueUnitEntry[] {
  return UNIQUE_UNITS_BY_CIVILIZATION.filter((entry) => entry.civilization === civilization);
}

/** The unique units a given building offers this civilization. */
export function uniqueUnitsTrainedAt(
  civilization: string,
  trainedAt: UniqueUnitEntry['trainedAt'],
): UniqueUnitEntry[] {
  return uniqueUnitsFor(civilization).filter((entry) => entry.trainedAt === trainedAt);
}
