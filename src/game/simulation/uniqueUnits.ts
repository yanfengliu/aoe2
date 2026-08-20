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
  {
    civilization: 'Aztecs',
    unitType: 'jaguar-warrior',
    trainedAt: 'castle',
    elite: ['elite-jaguar-warrior', 'elite-jaguar-warrior-upgrade'],
  },
  {
    civilization: 'Byzantines',
    unitType: 'cataphract',
    trainedAt: 'castle',
    elite: ['elite-cataphract', 'elite-cataphract-upgrade'],
  },
  {
    civilization: 'Celts',
    unitType: 'woad-raider',
    trainedAt: 'castle',
    elite: ['elite-woad-raider', 'elite-woad-raider-upgrade'],
  },
  {
    civilization: 'Chinese',
    unitType: 'chu-ko-nu',
    trainedAt: 'castle',
    elite: ['elite-chu-ko-nu', 'elite-chu-ko-nu-upgrade'],
  },
  {
    civilization: 'Franks',
    unitType: 'throwing-axeman',
    trainedAt: 'castle',
    elite: ['elite-throwing-axeman', 'elite-throwing-axeman-upgrade'],
  },
  {
    civilization: 'Goths',
    unitType: 'huskarl',
    trainedAt: 'castle',
    elite: ['elite-huskarl', 'elite-huskarl-upgrade'],
  },
  {
    civilization: 'Huns',
    unitType: 'tarkan',
    trainedAt: 'castle',
    elite: ['elite-tarkan', 'elite-tarkan-upgrade'],
  },
  {
    civilization: 'Japanese',
    unitType: 'samurai',
    trainedAt: 'castle',
    elite: ['elite-samurai', 'elite-samurai-upgrade'],
  },
  {
    civilization: 'Koreans',
    unitType: 'war-wagon',
    trainedAt: 'castle',
    elite: ['elite-war-wagon', 'elite-war-wagon-upgrade'],
  },
  {
    civilization: 'Mayans',
    unitType: 'plumed-archer',
    trainedAt: 'castle',
    elite: ['elite-plumed-archer', 'elite-plumed-archer-upgrade'],
  },
  {
    civilization: 'Mongols',
    unitType: 'mangudai',
    trainedAt: 'castle',
    elite: ['elite-mangudai', 'elite-mangudai-upgrade'],
  },
  {
    civilization: 'Persians',
    unitType: 'war-elephant',
    trainedAt: 'castle',
    elite: ['elite-war-elephant', 'elite-war-elephant-upgrade'],
  },
  {
    civilization: 'Saracens',
    unitType: 'mameluke',
    trainedAt: 'castle',
    elite: ['elite-mameluke', 'elite-mameluke-upgrade'],
  },
  {
    civilization: 'Spanish',
    unitType: 'conquistador',
    trainedAt: 'castle',
    elite: ['elite-conquistador', 'elite-conquistador-upgrade'],
  },
  {
    civilization: 'Teutons',
    unitType: 'teutonic-knight',
    trainedAt: 'castle',
    elite: ['elite-teutonic-knight', 'elite-teutonic-knight-upgrade'],
  },
  {
    civilization: 'Turks',
    unitType: 'janissary',
    trainedAt: 'castle',
    elite: ['elite-janissary', 'elite-janissary-upgrade'],
  },
  {
    civilization: 'Vikings',
    unitType: 'berserk',
    trainedAt: 'castle',
    elite: ['elite-berserk', 'elite-berserk-upgrade'],
  },
  {
    civilization: 'Koreans',
    unitType: 'turtle-ship',
    trainedAt: 'dock',
    elite: ['elite-turtle-ship', 'elite-turtle-ship-upgrade'],
  },
  {
    civilization: 'Vikings',
    unitType: 'longboat',
    trainedAt: 'dock',
    elite: ['elite-longboat', 'elite-longboat-upgrade'],
  },
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
