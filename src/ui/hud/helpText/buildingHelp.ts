// What each building does, as its tooltip says it (work 148 M2): DE's help text
// (the install's string table, 26xxx) as the source of what to say, in this
// game's own words, every claim checked against this game's rules. One line each.
import type { BuildingType } from '../../../game/simulation/types';

// What it trains and researches: buildingProductionTables.ts. Drop-offs:
// prototypeEconomyRules.ts canDropOffAt. Population, garrison and arrows:
// prototypeBuildingRules.ts. DE's "Required for ..." is said only where this
// game's own build rules (bridge/buildOptions.ts) need the building, which
// tests/ui/helpTextRequirements.test.ts checks for every building.
export const BUILDING_HELP = {
  // Every sheltered unit adds an arrow, and an empty one still fires one (spec §9.6).
  'town-center': 'Trains Villagers, researches technologies and advances to the next Age. Takes in all four resources. Fires arrows, one more for each unit garrisoned inside, up to 10. Supports 5 population.',
  house: 'Supports 5 population. The top bar shows your population against its limit.',
  mill: 'Villagers drop off food here, and it researches Farm upgrades. Build it close to food to shorten the walk.',
  'lumber-camp': 'Villagers drop off wood here, and it researches woodcutting upgrades. Build it beside a forest to shorten the walk.',
  'mining-camp': 'Villagers drop off gold and stone here, and it researches mining upgrades. Build it beside gold or stone to shorten the walk.',
  // DE's 26135 says the Barracks is required for the Archery Range and Stable; here the
  // Feudal Age's Stable, Archery Range, Blacksmith, Market and Watch Tower all need one
  // (bridge/buildOptions.ts), and tests/ui/helpTextRequirements.test.ts holds this to it.
  barracks: 'Trains infantry and researches their upgrades. Required for the Stable, Archery Range, Blacksmith, Market and Watch Tower.',
  // Of the units a tower admits (no Cavalry Archer: canGarrisonAt), only Villagers and
  // ARCHER_LINE_UNITS add arrows, so the Archer line and Longbowmen and no other
  // archer (towerCombatSystem.ts; review rounds 2 and 3, held by
  // tests/ui/helpTextRequirements.test.ts). It cannot hit a unit against its
  // walls until Murder Holes (spec §10.4).
  'watch-tower': 'Tower that shoots arrows at enemies. Villagers, the Archer line and Longbowmen garrisoned inside add arrows. Strong vs. archers. Weak vs. units at close range, especially rams.',
  // One pierce shot whoever shelters inside, so rams and Trebuchets shrug it off.
  'bombard-tower': 'Tower that fires a heavy cannon shot at enemies. Units can shelter inside. Weak vs. siege weapons that outrange it.',
  stable: 'Trains cavalry and researches their upgrades.',
  'archery-range': 'Trains archers and other ranged units, and researches their upgrades.',
  blacksmith: 'Researches upgrades to the attack and armor of your units.',
  market: 'Buys and sells food, wood and stone for gold, trains Trade Carts and researches trade technologies. Needed to send tribute. Trading fee and tribute tax start at 30%.',
  'siege-workshop': 'Trains siege weapons and researches their upgrades.',
  monastery: 'Trains Monks and researches their upgrades. Relics kept inside earn gold over time.',
  university: 'Researches technologies that improve your units and buildings.',
  // Only ARCHER_LINE_UNITS inside add arrows, Villagers and other archers none
  // (prototypeBuildingRules.ts, towerCombatSystem.ts; review round 2).
  castle: 'Trains your unique unit, Trebuchets and Petards, and researches technologies. Shoots arrows; the Archer and Cavalry Archer lines and Longbowmen garrisoned inside add more. Supports 20 population.',
  wonder: 'A great monument to your civilization. Keep one standing until its countdown runs out to win the game.',
  'stone-wall': 'Sturdy stone wall that is hard to break without siege weapons. Blocks enemies and slows them down.',
  'palisade-wall': 'Cheap wooden wall that is quick to build. Blocks enemies and slows them down.',
  // A gate admits its owner and allies and never locks (spec §8.4).
  'stone-gate': 'Stone gate set in your wall line. Your units and your allies pass through it; enemies cannot.',
  'palisade-gate': 'Light wooden gate set in your palisade. Your units and your allies pass through it; enemies cannot.',
  // Reseeds for its own build cost while its owner can pay (spec §6.6).
  farm: 'Renewable food source with a limited store of food. When it runs out it replants itself for its wood cost if you can pay, or else disappears. One Villager works it at a time.',
  dock: 'Trains and upgrades ships. Fishing Ships bring their catch here, and Trade Cogs trade by sea between Docks.',
  outpost: 'Lookout post that sees far, to spot enemies nearby. It cannot attack or hold units.',
  'fish-trap': 'Food source on the water, like a Farm but built by a Fishing Ship. Holds a limited store of food, then is gone and must be built again.',
} as const satisfies Record<BuildingType, string>;
