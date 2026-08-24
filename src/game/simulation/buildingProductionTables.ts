// What each building can PRODUCE — the trainable-unit and researchable-tech
// lists. Split out of ./prototypeBuildingRules.ts when the unique-unit elite
// tier pushed that file past the 500-LOC budget.
//
// These two maps are the VALIDATOR: they say a Castle is where a Jaguar Warrior
// comes from. They are deliberately NOT the menu — which unit a given owner is
// offered is decided by bridge/optionsRules.ts reading uniqueUnits.ts, so a
// civilization never sees another's unit. Both are needed: a menu without a
// validator lets a crafted command train anything anywhere.

import type { BuildingType, ResearchableTechnologyType, TrainableUnitType } from './types';

export const TRAINABLE_UNITS_BY_BUILDING = new Map<BuildingType, readonly TrainableUnitType[]>([
  ['town-center', ['villager']],
  ['barracks', ['militia', 'spearman', 'pikeman', 'halberdier', 'champion', 'man-at-arms', 'long-swordsman', 'two-handed-swordsman', 'eagle-warrior', 'elite-eagle-warrior']],
  ['stable', ['scout', 'knight', 'light-cavalry', 'hussar', 'cavalier', 'camel', 'paladin', 'heavy-camel']],
  ['archery-range', ['archer', 'skirmisher', 'elite-skirmisher', 'crossbowman', 'cavalry-archer', 'arbalest', 'heavy-cavalry-archer', 'hand-cannoneer']],
  ['siege-workshop', ['mangonel', 'scorpion', 'battering-ram', 'onager', 'siege-onager', 'heavy-scorpion', 'capped-ram', 'siege-ram', 'bombard-cannon']],
  ['monastery', ['monk']],
  // M5 naval: the Dock is where every ship comes from.
  ['dock', ['fishing-ship', 'galley', 'war-galley', 'galleon', 'fire-ship', 'fast-fire-ship', 'demolition-ship', 'heavy-demolition-ship', 'cannon-galleon', 'elite-cannon-galleon', 'turtle-ship', 'longboat',
    'elite-turtle-ship', 'elite-longboat']],
  ['castle', ['longbowman', 'elite-longbowman', 'trebuchet',
    // M4 unique units — the civ gate is in uniqueUnits.ts; this list only
    // says the Castle is where they come from.
    'jaguar-warrior', 'cataphract', 'woad-raider', 'chu-ko-nu',
    'throwing-axeman', 'huskarl', 'tarkan', 'samurai', 'war-wagon',
    'plumed-archer', 'mangudai', 'war-elephant', 'mameluke', 'conquistador',
    'teutonic-knight', 'janissary', 'berserk',
    // The elite tier of each.
    'elite-jaguar-warrior',
    'elite-cataphract',
    'elite-woad-raider',
    'elite-chu-ko-nu',
    'elite-throwing-axeman',
    'elite-huskarl',
    'elite-tarkan',
    'elite-samurai',
    'elite-war-wagon',
    'elite-plumed-archer',
    'elite-mangudai',
    'elite-war-elephant',
    'elite-mameluke',
    'elite-conquistador',
    'elite-teutonic-knight',
    'elite-janissary',
    'elite-berserk',
  ]],
]);

export const RESEARCHES_BY_BUILDING = new Map<BuildingType, readonly ResearchableTechnologyType[]>([
  ['town-center', ['feudal-age', 'castle-age', 'imperial-age', 'wheelbarrow', 'hand-cart', 'loom', 'town-watch', 'town-patrol']],
  ['blacksmith', ['fletching', 'bracer', 'blast-furnace', 'plate-mail-armor', 'plate-barding', 'forging', 'scale-mail-armor', 'scale-barding-armor', 'padded-archer-armor', 'iron-casting', 'chain-mail-armor', 'chain-barding-armor', 'leather-archer-armor', 'bodkin-arrow', 'ring-archer-armor', 'chemistry', 'sappers']],
  ['dock', ['war-galley-upgrade', 'galleon-upgrade', 'fast-fire-ship-upgrade', 'heavy-demolition-ship-upgrade', 'cannon-galleon-unlock', 'elite-cannon-galleon-upgrade']],
  ['archery-range', ['crossbowman-upgrade', 'arbalest-upgrade', 'heavy-cavalry-archer-upgrade', 'elite-skirmisher-upgrade', 'thumb-ring', 'parthian-tactics']],
  ['barracks', ['pikeman-upgrade', 'halberdier-upgrade', 'champion-upgrade', 'man-at-arms-upgrade', 'long-swordsman-upgrade', 'two-handed-swordsman-upgrade', 'squires', 'tracking', 'elite-eagle-warrior-upgrade']],
  ['stable', ['light-cavalry-upgrade', 'hussar-upgrade', 'cavalier-upgrade', 'paladin-upgrade', 'heavy-camel-upgrade', 'bloodlines', 'husbandry']],
  ['castle', ['elite-longbowman-upgrade', 'conscription',
    // Civilization unique technologies; which one an owner may see is
    // decided by uniqueTechnologies.ts.
    'garland-wars',
    'yeomen',
    'logistica',
    'furor-celtica',
    'rocketry',
    'bearded-axe',
    'anarchy',
    'perfusion',
    'kataparuto',
    'shinkichon',
    'drill',
    'mahouts',
    'zealotry',
    'supremacy',
    'crenellations',
    'artillery',
    // The elite upgrade of each civilization unique unit; which one a given
    // owner may actually see is decided by uniqueUnits.ts.
    'elite-jaguar-warrior-upgrade',
    'elite-cataphract-upgrade',
    'elite-woad-raider-upgrade',
    'elite-chu-ko-nu-upgrade',
    'elite-throwing-axeman-upgrade',
    'elite-huskarl-upgrade',
    'elite-tarkan-upgrade',
    'elite-samurai-upgrade',
    'elite-war-wagon-upgrade',
    'elite-plumed-archer-upgrade',
    'elite-mangudai-upgrade',
    'elite-war-elephant-upgrade',
    'elite-mameluke-upgrade',
    'elite-conquistador-upgrade',
    'elite-teutonic-knight-upgrade',
    'elite-janissary-upgrade',
    'elite-berserk-upgrade',
    'elite-turtle-ship-upgrade',
    'elite-longboat-upgrade',
  ]],
  ['siege-workshop', ['onager-upgrade', 'siege-onager-upgrade', 'heavy-scorpion-upgrade', 'capped-ram-upgrade', 'siege-ram-upgrade', 'siege-engineers']],
  ['lumber-camp', ['double-bit-axe', 'bow-saw', 'two-man-saw']],
  ['mining-camp', ['gold-mining', 'gold-shaft-mining', 'stone-mining', 'stone-shaft-mining']],
  ['mill', ['horse-collar', 'heavy-plow', 'crop-rotation']],
  ['watch-tower', ['guard-tower', 'keep']],
  ['monastery', [
    'block-printing', 'sanctity', 'faith', 'herbal-medicine', 'heresy',
    'redemption', 'atonement', 'fervor',
  ]],
  // University: Ballistics (spec §10.4). Research-only — trains nothing.
  ['university', ['ballistics', 'masonry', 'architecture', 'treadmill-crane', 'heated-shot',
    'murder-holes',
    'bombard-tower-unlock', 'fortified-wall']],
]);
