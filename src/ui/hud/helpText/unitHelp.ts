// What each unit does, as its tooltip says it (work 148 M2): DE's help text (the
// install's string table, 26xxx) as the source of what to say, in this game's own
// words, every claim checked against this game's rules. One line each.
import type { UnitType } from '../../../game/simulation/types';

// A "Strong vs." stays only where this game's tables bear it out: an attack
// bonus or armor class (prototypeUnitRules/armorClasses.ts, buildingAttack.ts),
// the unit's own armor (prototypeUnitRules/unitArmorTables.ts), or a modelled
// rule such as range, minimum range, speed, blast or conversion. A "Weak vs."
// stays where the counter has a bonus against the unit's class or the unit has
// little armor against the counter's attack. DE claims that rest on mechanics
// this game does not have (resistance to conversion, pass-through bolts,
// trample, charge, volleys of arrows, garrisoned rams, felling trees) are left
// out, as is "Strong vs. infantry" wherever no bonus against infantry exists.
export const UNIT_HELP = {
  villager: 'Gathers resources, and builds and repairs buildings. Also mends ships and siege weapons.',
  // Scout line: +6/+10/+12 against the monk class; cavalry class for the spear and camel bonuses.
  scout: 'Quick horseman for scouting and raids. Very strong vs. Monks. Weak vs. Spearmen and Camels.',
  'light-cavalry': 'Quick horseman for scouting and raids. Very strong vs. Monks. Weak vs. Spearmen and Camels.',
  hussar: 'Quick horseman for scouting and raids. Very strong vs. Monks. Weak vs. Spearmen and Camels.',
  // Militia line: no attack on buildings until the Man-at-Arms (+2/+3/+4 Standard
  // Building), whose tiers also carry the +eagle bonus.
  militia: 'Versatile infantry. Strong vs. Skirmishers. Weak vs. ranged units at long range.',
  'man-at-arms': 'Versatile infantry. Strong vs. buildings, Eagle Warriors and Skirmishers. Weak vs. ranged units at long range.',
  'long-swordsman': 'Versatile infantry. Strong vs. buildings, Eagle Warriors and Skirmishers. Weak vs. ranged units at long range.',
  'two-handed-swordsman': 'Versatile infantry. Strong vs. buildings, Eagle Warriors and Skirmishers. Weak vs. ranged units at long range.',
  champion: 'Versatile infantry. Strong vs. buildings, Eagle Warriors and Skirmishers. Weak vs. ranged units at long range.',
  spearman: 'Infantry built to stop cavalry. Strong vs. cavalry and Camels, especially War Elephants. Weak vs. archers and other ranged units.',
  pikeman: 'Infantry built to stop cavalry. Strong vs. cavalry and Camels, especially War Elephants. Weak vs. archers and other ranged units.',
  halberdier: 'Infantry built to stop cavalry. Strong vs. cavalry and Camels, especially War Elephants. Weak vs. archers and other ranged units.',
  'eagle-warrior': 'Fast infantry for scouting and raids. Strong vs. Monks and archers. Weak vs. the Militia line and cavalry.',
  'elite-eagle-warrior': 'Fast infantry for scouting and raids. Strong vs. Monks and archers. Weak vs. the Militia line and cavalry.',
  archer: 'General-purpose foot archer that fights best from long range. Weak vs. Skirmishers, Mangonels and units at close range.',
  crossbowman: 'General-purpose foot archer that fights best from long range. Weak vs. Skirmishers, Mangonels and units at close range.',
  arbalest: 'General-purpose foot archer that fights best from long range. Weak vs. Skirmishers, Mangonels and units at close range.',
  skirmisher: 'Light ranged unit for fighting archers; it cannot shoot at close range. Strong vs. archers and Spearmen. Weak vs. units at close range.',
  'elite-skirmisher': 'Light ranged unit for fighting archers; it cannot shoot at close range. Strong vs. archers and Spearmen. Weak vs. units at close range.',
  'cavalry-archer': 'Quick mounted archer for hit-and-run attacks. Strong vs. slow units from range. Weak vs. Skirmishers, Scorpions and units at close range.',
  'heavy-cavalry-archer': 'Quick mounted archer for hit-and-run attacks. Strong vs. slow units from range. Weak vs. Skirmishers, Scorpions and units at close range.',
  // Accuracy is one flat roll (spec §10.4), so no "at long range".
  'hand-cannoneer': 'Gunpowder foot soldier with a powerful but inaccurate shot. Very strong vs. infantry. Weak vs. ranged units.',
  knight: 'Heavily armored all-round cavalry. Strong vs. infantry and archers. Weak vs. Spearmen, Camels and Monks.',
  cavalier: 'Heavily armored all-round cavalry. Strong vs. infantry and archers. Weak vs. Spearmen, Camels and Monks.',
  paladin: 'Heavily armored all-round cavalry. Strong vs. infantry and archers. Weak vs. Spearmen, Camels and Monks.',
  // Camels: +10/+18 against the cavalry class only; the spear line's +camel bonus.
  camel: 'Fast mount bred to fight other cavalry. Strong vs. cavalry. Weak vs. Spearmen, archers and Monks.',
  'heavy-camel': 'Fast mount bred to fight other cavalry. Strong vs. cavalry. Weak vs. Spearmen, archers and Monks.',
  // Only the Mangonel line blasts and may attack the ground (spec §10.7).
  mangonel: 'Siege engine whose stones hurt every unit where they land; it cannot fire at close range. Strong vs. tight groups of units. Weak vs. units at close range. Can attack the ground.',
  onager: 'Siege engine whose stones hurt every unit where they land; it cannot fire at close range. Strong vs. tight groups of units. Weak vs. units at close range. Can attack the ground.',
  'siege-onager': 'Siege engine whose stones hurt every unit where they land; it cannot fire at close range. Strong vs. tight groups of units. Weak vs. units at close range. Can attack the ground.',
  // The bolt's pass-through is not modelled (prototypeUnitRules.ts, blast table).
  scorpion: 'Siege engine that shoots heavy bolts; it cannot fire at close range. Weak vs. siege weapons and units at close range.',
  'heavy-scorpion': 'Siege engine that shoots heavy bolts; it cannot fire at close range. Weak vs. siege weapons and units at close range.',
  'battering-ram': 'Siege engine for battering buildings, almost untouched by arrows. Very strong vs. buildings. Weak vs. melee units.',
  'capped-ram': 'Siege engine for battering buildings, almost untouched by arrows. Very strong vs. buildings. Weak vs. melee units.',
  'siege-ram': 'Siege engine for battering buildings, almost untouched by arrows. Very strong vs. buildings. Weak vs. melee units.',
  'bombard-cannon': 'Gunpowder siege weapon with long range; it cannot fire at close range. Strong vs. buildings and siege weapons. Weak vs. units at close range.',
  trebuchet: 'Heavy siege engine that strikes buildings from very far away. Packs up to move and unpacks to fire, and cannot hit anything close. Strong vs. buildings.',
  petard: 'Demolition soldier carrying explosives; it is destroyed when it attacks. Strong vs. buildings. Weak vs. other units.',
  // Monks heal their own owner's units only (spec §10.10), siege and ships included.
  monk: 'Converts enemy units and heals your own wounded units. Carries Relics to a Monastery. Strong vs. slow melee units. Weak vs. Scout Cavalry, Eagle Warriors and ranged units.',
  missionary: 'Spanish unique mounted Monk, faster than a Monk. Converts enemies, heals your wounded and carries Relics. Strong vs. slow melee units. Weak vs. Scout Cavalry, Eagle Warriors and ranged units.',
  'trade-cart': 'Trade unit. Right-click the Market of another player and it hauls goods there, bringing gold back to your nearest Market; the longer the route, the more gold.',
  'trade-cog': 'Trade ship. Right-click the Dock of another player and it hauls goods there, bringing gold back to your nearest Dock; the longer the route, the more gold.',
  'fishing-ship': 'Catches fish and works Fish Traps for food, and builds Fish Traps.',
  // A click on a far shore only sails there; the unload is a click from within
  // three cells (bridge/contextRouter.ts, garrisonOps.ts; review round 2). The
  // line does not say how to board: a right-click on the ship itself does not
  // put a unit aboard today (the entity route takes it as a move; reproduced in
  // the real page, review round 4, R4-2; plan 106's card), and DE's "right-click
  // the Transport Ship to load" returns here when that is mended.
  'transport-ship': 'Carries land units across water. To put them ashore, sail it beside the shore, then right-click the shore.',
  galley: 'Warship with a ranged attack. Weak vs. Fire Ships.',
  'war-galley': 'Warship with a ranged attack. Weak vs. Fire Ships.',
  galleon: 'Warship with a ranged attack. Weak vs. Fire Ships.',
  'fire-ship': 'Warship that sprays fire at close range. Strong vs. the Galley line.',
  'fast-fire-ship': 'Warship that sprays fire at close range. Strong vs. the Galley line.',
  // The demolition blast spares its own side (spec §10.7).
  'demolition-ship': 'Explosive warship that blows itself up when it attacks, hurting enemies around it. Strong vs. units at close range.',
  'heavy-demolition-ship': 'Explosive warship that blows itself up when it attacks, hurting enemies around it. Strong vs. units at close range.',
  'cannon-galleon': 'Gunpowder warship with long range; it cannot fire at close range. Strong vs. buildings. Weak vs. units at close range.',
  'elite-cannon-galleon': 'Gunpowder warship with long range; it cannot fire at close range. Strong vs. buildings. Weak vs. units at close range.',
  // Unique units: each elite tier says what its base says, as DE's does.
  longbowman: 'British unique foot archer with very long range. Weak vs. cavalry and Skirmishers.',
  'elite-longbowman': 'British unique foot archer with very long range. Weak vs. cavalry and Skirmishers.',
  'jaguar-warrior': 'Aztec unique infantry. Very strong vs. infantry. Weak vs. cavalry and archers.',
  'elite-jaguar-warrior': 'Aztec unique infantry. Very strong vs. infantry. Weak vs. cavalry and archers.',
  cataphract: 'Byzantine unique heavy cavalry. Very strong vs. infantry. Weak vs. archers.',
  'elite-cataphract': 'Byzantine unique heavy cavalry. Very strong vs. infantry. Weak vs. archers.',
  'woad-raider': 'Celtic unique infantry that moves fast. Strong vs. siege weapons. Weak vs. archers and cavalry.',
  'elite-woad-raider': 'Celtic unique infantry that moves fast. Strong vs. siege weapons. Weak vs. archers and cavalry.',
  // One arrow a shot: the volley is not modelled.
  'chu-ko-nu': 'Chinese unique foot archer. Weak vs. archers and siege weapons.',
  'elite-chu-ko-nu': 'Chinese unique foot archer. Weak vs. archers and siege weapons.',
  'throwing-axeman': 'Frankish unique infantry that throws axes, a melee attack from range. Weak vs. archers and siege weapons.',
  'elite-throwing-axeman': 'Frankish unique infantry that throws axes, a melee attack from range. Weak vs. archers and siege weapons.',
  huskarl: 'Gothic unique infantry with very high pierce armor. Strong vs. archers and buildings. Weak vs. cavalry and the Militia line.',
  'elite-huskarl': 'Gothic unique infantry with very high pierce armor. Strong vs. archers and buildings. Weak vs. cavalry and the Militia line.',
  tarkan: 'Hunnic unique heavy cavalry. Very strong vs. buildings. Weak vs. Spearmen and Camels.',
  'elite-tarkan': 'Hunnic unique heavy cavalry. Very strong vs. buildings. Weak vs. Spearmen and Camels.',
  samurai: 'Japanese unique infantry with a fast attack. Strong vs. unique units. Weak vs. archers and gunpowder units.',
  'elite-samurai': 'Japanese unique infantry with a fast attack. Strong vs. unique units. Weak vs. archers and gunpowder units.',
  'war-wagon': 'Korean unique mounted archer, slow but sturdy. Strong vs. archers. Weak vs. Spearmen, Skirmishers and Camels.',
  'elite-war-wagon': 'Korean unique mounted archer, slow but sturdy. Strong vs. archers. Weak vs. Spearmen, Skirmishers and Camels.',
  'plumed-archer': 'Mayan unique foot archer that moves fast. Strong vs. archers and infantry. Weak vs. cavalry.',
  'elite-plumed-archer': 'Mayan unique foot archer that moves fast. Strong vs. archers and infantry. Weak vs. cavalry.',
  mangudai: 'Mongol unique mounted archer with a fast attack. Strong vs. siege weapons. Weak vs. Skirmishers, Spearmen and Camels.',
  'elite-mangudai': 'Mongol unique mounted archer with a fast attack. Strong vs. siege weapons. Weak vs. Skirmishers, Spearmen and Camels.',
  'war-elephant': 'Persian unique cavalry, slow and massive. Strong vs. buildings. Weak vs. Spearmen and Monks.',
  'elite-war-elephant': 'Persian unique cavalry, slow and massive. Strong vs. buildings. Weak vs. Spearmen and Monks.',
  mameluke: 'Saracen unique camel rider that strikes in melee from a short distance. Strong vs. cavalry. Weak vs. archers and Spearmen.',
  'elite-mameluke': 'Saracen unique camel rider that strikes in melee from a short distance. Strong vs. cavalry. Weak vs. archers and Spearmen.',
  // Not in the archer class here, so no Skirmisher bonus reaches it.
  conquistador: 'Spanish unique mounted gunner with a powerful shot from range and good speed. Weak vs. Spearmen and Monks.',
  'elite-conquistador': 'Spanish unique mounted gunner with a powerful shot from range and good speed. Weak vs. Spearmen and Monks.',
  'teutonic-knight': 'Teutonic unique infantry with very high melee armor, but slow. Strong vs. melee units. Weak vs. archers and gunpowder units.',
  'elite-teutonic-knight': 'Teutonic unique infantry with very high melee armor, but slow. Strong vs. melee units. Weak vs. archers and gunpowder units.',
  janissary: 'Turkish unique foot gunner with a powerful shot. Weak vs. archers and Skirmishers.',
  'elite-janissary': 'Turkish unique foot gunner with a powerful shot. Weak vs. archers and Skirmishers.',
  berserk: 'Viking unique infantry that slowly heals itself. Strong vs. siege weapons. Weak vs. archers and gunpowder units.',
  'elite-berserk': 'Viking unique infantry that slowly heals itself. Strong vs. siege weapons. Weak vs. archers and gunpowder units.',
  'turtle-ship': 'Korean unique warship with heavy armor and a powerful attack. Strong vs. most warships and buildings.',
  'elite-turtle-ship': 'Korean unique warship with heavy armor and a powerful attack. Strong vs. most warships and buildings.',
  // DE calls it the Longship (strings 26106, 26457).
  longboat: 'Viking unique warship that moves fast and attacks from range.',
  'elite-longboat': 'Viking unique warship that moves fast and attacks from range.',
} as const satisfies Record<UnitType, string>;
