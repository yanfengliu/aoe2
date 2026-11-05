// DE's default keys on the buildings' command cards (work 142: the Town Center
// in M2a, every other building in M2b-2). Each key is the `definitive` profile's
// entry in the install's `resources/_common/dat/hotkeys.json`, read with
// `node scripts/dumpDeHotkeys.mjs <GROUP>`: the building's own group, named by
// its `name_string_id` in the English string table, and UNIT_COMMAND_HOTKEYS'
// UNGARRISON (20208, G), which every building that holds units shares. An
// entry's `string_index_list` names the units or technologies it presses (an id
// less 11000 is that unit's or technology's own string), and a line's tiers
// share its slot: the Blacksmith's Q is Forging, then Iron Casting, then Blast
// Furnace. DE's Tower Upgrades are this game's Guard Tower and Keep.
//
// A button DE gives no key on that building has none here, and a key whose
// button this game lacks does nothing. This game's Dock researches Careening,
// Dry Dock and Shipwright, which DE (CivTechTrees) researches at the
// University, and hotkeys.json names no key for the Fast Fire Ship technology.

import type { BuildingType, ResearchableTechnologyType, SelectionState } from '../../game/simulation/types';
import { uniqueTechnology } from '../../game/simulation/uniqueTechnologies';
import { inSlotOrder, type GridKey } from './commandCardKeys';

/** A building's card, keyed by the button's `data-command`. */
type CardKeys = Readonly<Record<string, GridKey>>;

/** One key for every tier of a line: they take the same slot in turn. */
const line = (key: GridKey, ...commands: readonly string[]): Record<string, GridKey> => (
  Object.fromEntries(commands.map((command) => [command, key]))
);

/** TOWN_CENTER_HOTKEYS (string 20004). */
const TOWN_CENTER_KEYS: CardKeys = {
  'train-villager': 'q', // TOWN_CENTER_CREATE_VILLAGER, 19054
  'research-loom': 'a', // TOWN_CENTER_LOOM, 19333
  ...line('s', 'research-wheelbarrow', 'research-hand-cart'), // TOWN_CENTER_WHEELBARROW_HANDCART, 19334
  ...line('d', 'research-town-watch', 'research-town-patrol'), // TOWN_CENTER_TOWN_WATCH_GUARD, 19335
  ...line('z', 'research-feudal-age', 'research-castle-age', 'research-imperial-age'), // TOWN_CENTER_AGE_ADVANCE, 19336
  'action-back-to-work': 'f', // TOWN_CENTER_BACK_TO_WORK, 19324
  'action-ring-town-bell': 'b', // TOWN_CENTER_RING_TOWN_BELL, 19319
};

/** BARRACKS_HOTKEYS (20008). The Goths' Huskarl, trained here after Anarchy,
 *  is on BARRACKS_CREATE_HUSKARL's R ("Infantry Unique Units"); the entry
 *  DE names Condottiero (E) lists a Huskarl string (5679) too. */
const BARRACKS_KEYS: CardKeys = {
  ...line('q', 'train-militia', 'train-man-at-arms', 'train-long-swordsman', 'train-two-handed-swordsman', 'train-champion'), // BARRACKS_CREATE_MILITIA, 19035
  ...line('w', 'train-spearman', 'train-pikeman', 'train-halberdier'), // BARRACKS_CREATE_SPEARMAN, 19034
  ...line('r', 'train-eagle-warrior', 'train-elite-eagle-warrior'), // BARRACKS_CREATE_EAGLE_WARRIOR, 19070
  ...line('r', 'train-huskarl', 'train-elite-huskarl'), // BARRACKS_CREATE_HUSKARL, 19125
  ...line('a', 'research-man-at-arms-upgrade', 'research-long-swordsman-upgrade', 'research-two-handed-swordsman-upgrade', 'research-champion-upgrade'), // BARRACKS_MILITIA_LINE_UPGRADES, 19451
  ...line('s', 'research-pikeman-upgrade', 'research-halberdier-upgrade'), // BARRACKS_SPEARMAN_LINE_UPGRADES, 19452
  'research-elite-eagle-warrior-upgrade': 'f', // BARRACKS_EAGLE_LINE_UPGRADES, 19453
  'research-squires': 'x', // BARRACKS_SQUIRES, 19455
};

/** ARCHERY_RANGE_HOTKEYS (20009). */
const ARCHERY_RANGE_KEYS: CardKeys = {
  ...line('q', 'train-archer', 'train-crossbowman', 'train-arbalest'), // ARCHERY_RANGE_ARCHER, 19038
  ...line('w', 'train-skirmisher', 'train-elite-skirmisher'), // ARCHERY_RANGE_SKIRMISHER, 19043
  ...line('e', 'train-cavalry-archer', 'train-heavy-cavalry-archer'), // ARCHERY_RANGE_CAV_ARCHER, 19040
  'train-hand-cannoneer': 'r', // ARCHERY_RANGE_HAND_CANNONEERS, 19041
  ...line('a', 'research-crossbowman-upgrade', 'research-arbalest-upgrade'), // ARCHERY_RANGE_ARCHER_LINE_UPGRADES, 19458
  'research-elite-skirmisher-upgrade': 's', // ARCHERY_RANGE_SKIRMISHER_LINE_UPGRADES, 19459
  'research-heavy-cavalry-archer-upgrade': 'd', // ARCHERY_RANGE_HEAVY_CAV_ARCHER_UPGRADE, 19460
  'research-thumb-ring': 'z', // ARCHERY_RANGE_THUMB_RING, 19461
  'research-parthian-tactics': 'c', // ARCHERY_RANGE_PARTHIAN_TACTICS, 19462
};

/** STABLE_HOTKEYS (20010). */
const STABLE_KEYS: CardKeys = {
  ...line('q', 'train-scout', 'train-light-cavalry', 'train-hussar'), // STABLE_CREATE_SCOUT, 19060
  ...line('w', 'train-knight', 'train-cavalier', 'train-paladin'), // STABLE_CREATE_KNIGHT, 19030
  ...line('e', 'train-camel', 'train-heavy-camel'), // STABLE_CREATE_CAMEL, 19031
  ...line('a', 'research-light-cavalry-upgrade', 'research-hussar-upgrade'), // STABLE_SCOUT_LINE_UPGRADES, 19464
  ...line('s', 'research-cavalier-upgrade', 'research-paladin-upgrade'), // STABLE_KNIGHT_LINE_UPGRADES, 19465
  'research-heavy-camel-upgrade': 'd', // STABLE_CAMEL_LINE_UPGRADES, 19466
  'research-bloodlines': 'z', // STABLE_BLOODLINES, 19468
  'research-husbandry': 'x', // STABLE_HUSBANDRY, 19469
};

/** SIEGE_WORKSHOP_HOTKEYS (20011). */
const SIEGE_WORKSHOP_KEYS: CardKeys = {
  ...line('q', 'train-battering-ram', 'train-capped-ram', 'train-siege-ram'), // SIEGE_WORKSHOP_CREATE_BATTERING_RAM, 19056
  ...line('w', 'train-mangonel', 'train-onager', 'train-siege-onager'), // SIEGE_WORKSHOP_CREATE_MANGONEL, 19285
  ...line('e', 'train-scorpion', 'train-heavy-scorpion'), // SIEGE_WORKSHOP_SCORPION_BALLISTA, 19049
  'train-bombard-cannon': 'r', // SIEGE_WORKSHOP_CREATE_BOMBARD_CANNON, 19047
  ...line('a', 'research-capped-ram-upgrade', 'research-siege-ram-upgrade'), // SIEGE_WORKSHOP_RAM_UPGRADES, 19475
  ...line('s', 'research-onager-upgrade', 'research-siege-onager-upgrade'), // SIEGE_WORKSHOP_CATAPULT_UPGRADES, 19476
  'research-heavy-scorpion-upgrade': 'd', // SIEGE_WORKSHOP_BALLISTA_UPGRADES, 19477
};

/** MONASTERY_HOTKEYS (20012); MONASTERY_FAITH (19482) is "Devotion, Faith". */
const MONASTERY_KEYS: CardKeys = {
  'train-monk': 'q', // MONASTERY_CREATE_MONK, 19051
  'train-missionary': 'v', // MONASTERY_CREATE_MISSIONARY, 19071
  'research-redemption': 'w', // 19478
  'research-atonement': 'e', // 19479
  'research-fervor': 'r', // 19480
  'research-sanctity': 'a', // 19481
  'research-faith': 's', // 19482
  'research-illumination': 'd', // 19483
  'research-block-printing': 'f', // 19484
  'research-heresy': 'z', // 19485
  'research-theocracy': 'x', // 19486
  'research-herbal-medicine': 'c', // 19487
};

/** MARKET_HOTKEYS (20013). Tribute is not on DE's Market card. */
const MARKET_KEYS: CardKeys = {
  'train-trade-cart': 'q', // MARKET_CREATE_TRADE_CART, 19286
  'research-caravan': 'w', // MARKET_CARAVAN, 19348
  ...line('e', 'research-coinage', 'research-banking'), // MARKET_COINAGE_BANKING, 19349
  'research-guilds': 'r', // MARKET_GUILDS, 19450
  'market-sell-wood': 's', // MARKET_SELL_WOOD, 19103
  'market-sell-food': 'd', // MARKET_SELL_FOOD, 19102
  'market-sell-stone': 'f', // MARKET_SELL_STONE, 19104
  'market-buy-wood': 'x', // MARKET_BUY_WOOD, 19112
  'market-buy-food': 'c', // MARKET_BUY_FOOD, 19111
  'market-buy-stone': 'v', // MARKET_BUY_STONE, 19113
};

/** DOCK_HOTKEYS (20007). A civilization's unique warship (Longboat, Turtle Ship)
 *  takes DOCK_BUILD_LONGBOAT's D and its elite upgrade DOCK_ELITE_UNIQUE_SHIP's
 *  C, the Demolition Ship's keys, which DE's Vikings and Koreans lack. */
const DOCK_KEYS: CardKeys = {
  'train-fishing-ship': 'q', // DOCK_BUILD_FISHING_SHIP, 19045
  ...line('w', 'train-galley', 'train-war-galley', 'train-galleon'), // DOCK_BUILD_GALLEY, 19059
  ...line('r', 'train-fire-ship', 'train-fast-fire-ship'), // DOCK_BUILD_FIRE_GALLEY, 19279
  'train-transport-ship': 'a', // DOCK_BUILD_TRANSPORT, 19284
  'train-trade-cog': 's', // DOCK_BUILD_COG, 19044
  ...line('d', 'train-demolition-ship', 'train-heavy-demolition-ship'), // DOCK_BUILD_RAMMING_SHIP, 19280
  ...line('d', 'train-longboat', 'train-elite-longboat', 'train-turtle-ship', 'train-elite-turtle-ship'), // DOCK_BUILD_LONGBOAT, 19053
  ...line('f', 'train-cannon-galleon', 'train-elite-cannon-galleon'), // DOCK_BUILD_CANNON_GALLEY, 19055
  ...line('x', 'research-war-galley-upgrade', 'research-galleon-upgrade'), // DOCK_WAR_GALLEY_GALLEON, 19344
  'research-heavy-demolition-ship-upgrade': 'c', // DOCK_HEAVY_DEMOLITION_SHIP, 19345
  ...line('c', 'research-elite-longboat-upgrade', 'research-elite-turtle-ship-upgrade'), // DOCK_ELITE_UNIQUE_SHIP, 19457
  ...line('v', 'research-cannon-galleon-unlock', 'research-elite-cannon-galleon-upgrade'), // DOCK_ELITE_CANNON_GALLEON, 19347
};

/** UNIVERSITY_HOTKEYS (19208). */
const UNIVERSITY_KEYS: CardKeys = {
  ...line('q', 'research-masonry', 'research-architecture'), // UNIVERSITY_MASONRY_ARCHITECTURE, 19488
  'research-treadmill-crane': 'w', // 19489
  'research-heated-shot': 'e', // 19490
  'research-ballistics': 'r', // 19491
  ...line('t', 'research-chemistry', 'research-bombard-tower-unlock'), // UNIVERSITY_CHEMISTRY_BOMBARD_TOWER, 19492
  'research-siege-engineers': 'a', // 19493
  'research-murder-holes': 's', // 19495
  'research-fortified-wall': 'd', // 19497
  ...line('f', 'research-guard-tower', 'research-keep'), // UNIVERSITY_TOWER_UPGRADES, 19496
};

/** BLACKSMITH_HOTKEYS (20006). */
const BLACKSMITH_KEYS: CardKeys = {
  ...line('q', 'research-forging', 'research-iron-casting', 'research-blast-furnace'), // BLACKSMITH_MELEE_UPGRADES, 19470
  ...line('w', 'research-scale-mail-armor', 'research-chain-mail-armor', 'research-plate-mail-armor'), // BLACKSMITH_INFANTRY_ARMOR_UPGRADES, 19471
  ...line('e', 'research-scale-barding-armor', 'research-chain-barding-armor', 'research-plate-barding'), // BLACKSMITH_CAVALRY_ARMOR_UPGRADES, 19472
  ...line('a', 'research-fletching', 'research-bodkin-arrow', 'research-bracer'), // BLACKSMITH_ARROW_UPGRADES, 19473
  ...line('s', 'research-padded-archer-armor', 'research-leather-archer-armor', 'research-ring-archer-armor'), // BLACKSMITH_ARCHER_ARMOR_UPGRADES, 19474
};

/** CASTLE_HOTKEYS (20015): the common keys; `castleKeyOf` gives the rest. */
const CASTLE_KEYS: CardKeys = {
  'train-trebuchet': 'w', // TREBUCHET, 19321
  'train-petard': 'e', // CASTLE_CREATE_PETARD, 19069
  'research-hoardings': 'z', // CASTLE_HOARDINGS, 19083
  'research-sappers': 'x', // CASTLE_SAPPERS, 19084
  'research-conscription': 'c', // CASTLE_CONSCRIPTION, 19085
  'research-spies': 'v', // CASTLE_TREASON, 19086 ("Spies/Treason")
};

/** CASTLE_UNIQUE_CASTLE_TECH (19081, S) lists Carrack, Kasbah, Yeomen and
 *  Anarchy among this game's unique technologies; CASTLE_UNIQUE_IMPERIAL_TECH
 *  (19082, D) every other one this game has but four DE no longer lists
 *  (Berserkergang, El Dorado, Sultans, Mahouts), which keep the entry of the
 *  age this game researches them in. */
const DE_UNIQUE_CASTLE_TECHS: ReadonlySet<string> = new Set(['carrack', 'kasbah', 'yeomen', 'anarchy']);
const NOT_IN_DE_UNIQUE_TECHS: ReadonlySet<string> = new Set(['berserkergang', 'el-dorado', 'sultans', 'mahouts']);

function castleKeyOf(command: string): GridKey | null {
  const common = CASTLE_KEYS[command];
  if (common) return common;
  // UNIQUE_UNIT (19322): every unit a Castle trains but the Trebuchet and Petard.
  if (command.startsWith('train-')) return 'q';
  if (!command.startsWith('research-')) return null;
  const tech = command.slice('research-'.length);
  // CASTLE_ELITE_UNIT_UPGRADE (19080): each unique unit's elite upgrade.
  if (/^elite-.+-upgrade$/.test(tech)) return 'a';
  const unique = uniqueTechnology(tech as ResearchableTechnologyType);
  if (!unique) return null;
  if (DE_UNIQUE_CASTLE_TECHS.has(tech)) return 's';
  if (NOT_IN_DE_UNIQUE_TECHS.has(tech)) return unique.age === 'castle-age' ? 's' : 'd';
  return 'd';
}

const NO_CARD_KEYS: CardKeys = {};

/** Every building's card. DE gives no card group to a House, Farm, Fish Trap,
 *  Outpost, tower, wall or Wonder; GATE_HOTKEYS' LOCK_UNLOCK_GATE (19122, Q)
 *  is a button this game's gates lack. Each still has the shared G. */
const BUILDING_CARD_KEYS: Readonly<Record<BuildingType, CardKeys>> = {
  'town-center': TOWN_CENTER_KEYS,
  barracks: BARRACKS_KEYS,
  'archery-range': ARCHERY_RANGE_KEYS,
  stable: STABLE_KEYS,
  'siege-workshop': SIEGE_WORKSHOP_KEYS,
  monastery: MONASTERY_KEYS,
  market: MARKET_KEYS,
  dock: DOCK_KEYS,
  university: UNIVERSITY_KEYS,
  blacksmith: BLACKSMITH_KEYS,
  castle: CASTLE_KEYS,
  mill: line('q', 'research-horse-collar', 'research-heavy-plow', 'research-crop-rotation'), // MILL_FARM_UPGRADES, 19337
  'lumber-camp': line('q', 'research-double-bit-axe', 'research-bow-saw', 'research-two-man-saw'), // LUMBER_CAMP_WOOD_UPGRADES, 19340
  'mining-camp': {
    ...line('q', 'research-gold-mining', 'research-gold-shaft-mining'), // MINING_CAMP_GOLD_UPGRADES, 19338
    ...line('w', 'research-stone-mining', 'research-stone-shaft-mining'), // MINING_CAMP_STONE_UPGRADES, 19339
  },
  house: NO_CARD_KEYS,
  farm: NO_CARD_KEYS,
  'fish-trap': NO_CARD_KEYS,
  outpost: NO_CARD_KEYS,
  'watch-tower': NO_CARD_KEYS,
  'bombard-tower': NO_CARD_KEYS,
  'palisade-wall': NO_CARD_KEYS,
  'stone-wall': NO_CARD_KEYS,
  'palisade-gate': NO_CARD_KEYS,
  'stone-gate': NO_CARD_KEYS,
  wonder: NO_CARD_KEYS,
};

/** Whether this is a building's card, which owns DE's whole grid. */
export function hasBuildingCardKeys(buildingType: string): boolean {
  return Object.hasOwn(BUILDING_CARD_KEYS, buildingType);
}

/** The DE key of a button on a building's card, or null when DE gives it none there. */
export function buildingCardKeyOf(buildingType: string, command: string): GridKey | null {
  if (!hasBuildingCardKeys(buildingType)) return null;
  if (command === 'action-ungarrison') return 'g'; // UNGARRISON, 20208
  if (buildingType === 'castle') return castleKeyOf(command);
  return BUILDING_CARD_KEYS[buildingType as BuildingType][command] ?? null;
}

/** Where a button stands among those that share its key: a line's tiers in
 *  the order the table lists them, which is the order DE's slot shows them in
 *  (Chemistry before the Bombard Tower, whatever order the bridge lists). */
function tierRankOf(buildingType: BuildingType, command: string): number {
  const rank = Object.keys(BUILDING_CARD_KEYS[buildingType]).indexOf(command);
  return rank < 0 ? 0 : rank;
}

type CardLists = Pick<SelectionState, 'actionOptions' | 'trainOptions' | 'marketOptions' | 'visibleResearchOptions'>;

/** The selected building's card lists in the order of DE's slots, as DE's grid
 *  draws them; any other selection's as they come. */
export function inBuildingCardSlotOrder(
  state: CardLists & Pick<SelectionState, 'selectedKind' | 'selectedEntityType'>,
): CardLists {
  const type = state.selectedEntityType;
  if (state.selectedKind !== 'building' || type === null || !hasBuildingCardKeys(type)) return state;
  const building = type as BuildingType;
  const sort = <T extends string>(options: readonly T[], kind: string): T[] => inSlotOrder(
    options,
    (option) => buildingCardKeyOf(building, `${kind}-${option}`),
    (option) => tierRankOf(building, `${kind}-${option}`),
  );
  return {
    actionOptions: sort(state.actionOptions, 'action'),
    trainOptions: sort(state.trainOptions, 'train'),
    marketOptions: sort(state.marketOptions, 'market'),
    visibleResearchOptions: sort(state.visibleResearchOptions, 'research'),
  };
}
