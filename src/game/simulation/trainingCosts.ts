// Training costs, split out of prototypeEconomyRules.ts for the 500-LOC budget
// (2026-09-05). The table is the sim's own answer to "what can be trained",
// so the coverage census (spec §15.8) reads its universe from here.

import type { PlayerResources, TrainableUnitType } from './types';

export const TRAINING_COSTS: Record<TrainableUnitType, Partial<PlayerResources>> = {
  villager: { food: 50 },
  scout: { food: 80 },
  militia: { food: 60, gold: 20 },
  spearman: { food: 35, wood: 25 },
  archer: { wood: 25, gold: 45 },
  skirmisher: { food: 35, wood: 25 },
  'elite-skirmisher': { food: 25, wood: 35 }, // units.csv
  'eagle-warrior': { food: 20, gold: 50 }, // units.csv
  'elite-eagle-warrior': { food: 20, gold: 50 }, // units.csv — the Elite upgrade is the whole cost
  'hand-cannoneer': { food: 45, gold: 50 }, // units.csv
  knight: { food: 60, gold: 75 },
  crossbowman: { wood: 25, gold: 45 },
  pikeman: { food: 35, wood: 25 },
  'light-cavalry': { food: 80 },
  camel: { food: 55, gold: 60 },
  'cavalry-archer': { wood: 40, gold: 70 },
  mangonel: { wood: 160, gold: 135 },
  scorpion: { wood: 80, gold: 60 },
  'battering-ram': { wood: 160, gold: 75 },
  monk: { gold: 100 },
  longbowman: { food: 35, gold: 40 },
  arbalest: { wood: 25, gold: 45 },
  halberdier: { food: 35, wood: 25 },
  hussar: { food: 80 },
  'heavy-cavalry-archer': { wood: 40, gold: 70 },
  cavalier: { food: 60, gold: 75 },
  champion: { food: 60, gold: 20 },
  'elite-longbowman': { food: 35, gold: 40 },
  onager: { wood: 160, gold: 135 },
  'siege-onager': { wood: 160, gold: 135 }, // units.csv
  'heavy-scorpion': { wood: 80, gold: 60 },
  'siege-ram': { wood: 160, gold: 75 },
  'capped-ram': { wood: 160, gold: 75 }, // units.csv
  'bombard-cannon': { wood: 225, gold: 225 },
  trebuchet: { wood: 200, gold: 200 },
  // units.csv: the Petard, demolition infantry - cheap, and spent in one use.
  petard: { food: 80, gold: 20 },
  'trade-cart': { wood: 100, gold: 50 }, // units.csv.
  'trade-cog': { wood: 100, gold: 50 }, // units.csv.
  missionary: { gold: 100 }, // units.csv.
  // M5 naval: units.csv Fishing Ship — 75 wood, 40 s.
  'fishing-ship': { wood: 75 },
  'transport-ship': { wood: 125 }, // units.csv.
  'galley': { wood: 90, gold: 30 },
  'war-galley': { wood: 90, gold: 30 },
  'galleon': { wood: 90, gold: 30 },
  'fire-ship': { wood: 75, gold: 45 },
  'fast-fire-ship': { wood: 75, gold: 45 },
  'demolition-ship': { wood: 70, gold: 50 },
  'heavy-demolition-ship': { wood: 70, gold: 50 },
  'cannon-galleon': { wood: 200, gold: 150 },
  'elite-cannon-galleon': { wood: 200, gold: 150 },
  'jaguar-warrior': { food: 60, gold: 30 },
  'cataphract': { food: 70, gold: 75 },
  'woad-raider': { food: 65, gold: 25 },
  'chu-ko-nu': { wood: 40, gold: 35 },
  'throwing-axeman': { food: 55, gold: 25 },
  'huskarl': { food: 52, gold: 26 },
  'tarkan': { food: 60, gold: 60 },
  'samurai': { food: 60, gold: 30 },
  'war-wagon': { wood: 120, gold: 60 },
  'plumed-archer': { wood: 37, gold: 37 },
  'mangudai': { wood: 55, gold: 65 },
  'war-elephant': { food: 200, gold: 75 },
  'mameluke': { food: 55, gold: 85 },
  'conquistador': { food: 60, gold: 70 },
  'teutonic-knight': { food: 85, gold: 40 },
  'janissary': { food: 60, gold: 55 },
  'berserk': { food: 65, gold: 25 },
  'turtle-ship': { wood: 200, gold: 200 },
  'longboat': { wood: 80, gold: 40 },
  'elite-jaguar-warrior': { food: 60, gold: 30 },
  'elite-cataphract': { food: 70, gold: 75 },
  'elite-woad-raider': { food: 65, gold: 25 },
  'elite-chu-ko-nu': { wood: 40, gold: 35 },
  'elite-throwing-axeman': { food: 55, gold: 25 },
  'elite-huskarl': { food: 52, gold: 26 },
  'elite-tarkan': { food: 60, gold: 60 },
  'elite-samurai': { food: 60, gold: 30 },
  'elite-war-wagon': { wood: 120, gold: 60 },
  'elite-plumed-archer': { wood: 32, gold: 32 },
  'elite-mangudai': { wood: 55, gold: 65 },
  'elite-war-elephant': { food: 200, gold: 75 },
  'elite-mameluke': { food: 55, gold: 85 },
  'elite-conquistador': { food: 60, gold: 70 },
  'elite-teutonic-knight': { food: 85, gold: 40 },
  'elite-janissary': { food: 60, gold: 55 },
  'elite-berserk': { food: 65, gold: 25 },
  'elite-turtle-ship': { wood: 200, gold: 200 },
  'elite-longboat': { wood: 80, gold: 40 },
  'man-at-arms': { food: 60, gold: 20 },
  'long-swordsman': { food: 60, gold: 20 },
  'two-handed-swordsman': { food: 60, gold: 20 },
  paladin: { food: 60, gold: 75 },
  'heavy-camel': { food: 55, gold: 60 },
};

/** Every trainable unit type, in table order — the universe the self-play
 *  coverage census reports its gap against. */
export const TRAINABLE_UNIT_TYPES: readonly TrainableUnitType[] =
  Object.keys(TRAINING_COSTS) as TrainableUnitType[];
