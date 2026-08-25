// The unit roster union, extracted from ./types.ts to keep that file under the
// 500-LOC budget (same pattern as ./technologyTypes). types.ts re-exports both
// names, so existing `from './types'` imports keep working.

export type UnitType =
  | 'villager'
  | 'scout'
  | 'militia'
  | 'spearman'
  | 'archer'
  | 'skirmisher'
  // The Skirmisher's own upgrade (units.csv "Elite Skirmisher: Upgraded
  // skirmisher"). Without it the Skirmisher never improves, which in Age of
  // Empires II makes the whole line a Feudal-only answer to archers.
  | 'elite-skirmisher'
  // The Meso-American civilizations have no cavalry at all, so the Eagle line
  // is their only fast unit — the one that raids, catches siege, and runs down
  // Monks (units.csv gives it +8 against them). Castle Age at the Barracks.
  | 'eagle-warrior'
  | 'elite-eagle-warrior'
  // Imperial gunpowder at the Archery Range: the answer to massed infantry,
  // and the only archer-role unit whose damage ignores Skirmisher armour.
  | 'hand-cannoneer'
  | 'knight'
  | 'crossbowman'
  | 'pikeman'
  | 'light-cavalry'
  | 'camel'
  | 'cavalry-archer'
  | 'mangonel'
  | 'scorpion'
  | 'battering-ram'
  | 'monk'
  | 'longbowman'
  | 'arbalest'
  | 'halberdier'
  | 'hussar'
  | 'heavy-cavalry-archer'
  | 'cavalier'
  | 'champion'
  | 'elite-longbowman'
  | 'onager'
  // The mangonel line's Imperial tier (units.csv "Siege Onager: Upgraded
  // Onager"), the most expensive unit upgrade in the game at 1450 food and
  // 1000 gold.
  | 'siege-onager'
  | 'heavy-scorpion'
  // The ram line's middle tier (units.csv "Capped Ram: Upgraded Battering Ram",
  // Imperial). Its absence made the line Battering -> Siege in one step.
  | 'capped-ram'
  | 'siege-ram'
  | 'bombard-cannon'
  | 'trebuchet'
  | 'petard'
  // M-trade: land trade (spec §6.7) — carries goods between Markets for gold.
  | 'trade-cart'
  | 'trade-cog'
  // The Spanish unique monk-on-horseback, trained at the Monastery.
  | 'missionary'
  // FU2: Militia-line intermediates (Man-at-Arms/Long Swordsman/Two-Handed Swordsman) + Paladin + Heavy Camel.
  | 'man-at-arms'
  | 'long-swordsman'
  | 'two-handed-swordsman'
  | 'paladin'
  | 'heavy-camel'
  // M5 naval: the first WATER-domain unit. Water units path over water cells
  // and never over land (see unitDomain.ts).
  | 'fishing-ship'
  | 'galley'
  | 'war-galley'
  | 'galleon'
  | 'fire-ship'
  | 'fast-fire-ship'
  | 'demolition-ship'
  | 'heavy-demolition-ship'
  | 'transport-ship'
  | 'cannon-galleon'
  | 'elite-cannon-galleon'
  // M4 unique units: one per civilization, Castle-trained unless the
  // Dock is noted in uniqueUnits.ts. Stats from design/stats/units.csv.
  | 'jaguar-warrior'
  | 'cataphract'
  | 'woad-raider'
  | 'chu-ko-nu'
  | 'throwing-axeman'
  | 'huskarl'
  | 'tarkan'
  | 'samurai'
  | 'war-wagon'
  | 'plumed-archer'
  | 'mangudai'
  | 'war-elephant'
  | 'mameluke'
  | 'conquistador'
  | 'teutonic-knight'
  | 'janissary'
  | 'berserk'
  | 'turtle-ship'
  | 'longboat'
  // The ELITE tier of each unique unit, unlocked by an Imperial Castle
  // technology. Stats from design/stats/units.csv `Elite <name>` rows.
  | 'elite-jaguar-warrior'
  | 'elite-cataphract'
  | 'elite-woad-raider'
  | 'elite-chu-ko-nu'
  | 'elite-throwing-axeman'
  | 'elite-huskarl'
  | 'elite-tarkan'
  | 'elite-samurai'
  | 'elite-war-wagon'
  | 'elite-plumed-archer'
  | 'elite-mangudai'
  | 'elite-war-elephant'
  | 'elite-mameluke'
  | 'elite-conquistador'
  | 'elite-teutonic-knight'
  | 'elite-janissary'
  | 'elite-berserk'
  | 'elite-turtle-ship'
  | 'elite-longboat';

// Every unit on the roster is trainable somewhere, so this is an ALIAS rather
// than a second 44-member list. It previously was a byte-identical copy of
// UnitType, which meant a new unit had to be typed twice with nothing catching
// a miss. Keep the name: it marks the positions where "a type a building can
// produce" is meant, and re-splitting is a one-line change if that ever stops
// being every unit. Pinned by tests/simulation/unitRoster.test.ts.
export type TrainableUnitType = UnitType;
