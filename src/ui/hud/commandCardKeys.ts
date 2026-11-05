// DE's default command-card keys (work 142). Every key here is the `definitive`
// profile's entry in the `defaults_list` of the install's
// `resources/_common/dat/hotkeys.json`, named by its `name_string_id` in
// `resources/en/strings/key-value/key-value-strings-utf8.txt`. That profile is
// a grid: a key is a slot of the card's 5x3 grid, Q W E R T over A S D F G
// over Z X C V B (the install's `buttons.json` places "Set Gather Point" at
// slot 4, T, and "Ungarrison All Units" at slot 9, G).
//
// A pressed key presses the button of the selected card that holds it, so a
// key does exactly what a click on that button does. Only the cards this file
// names have DE keys yet: the villager's, the Town Center's and the units'
// (M2a and M2b-1); the other buildings' cards are work 142 M2b-2.

import type { BuildableBuildingType } from '../../game/simulation/types';
import type { BuildPageId } from './selectionPanel/buildPages';

export const GRID_KEYS = ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'b'] as const;
export type GridKey = (typeof GRID_KEYS)[number];

export function isGridKey(key: string): key is GridKey {
  return (GRID_KEYS as readonly string[]).includes(key);
}

/** The slot a key names, 0 (Q) to 14 (B): a page's buttons are drawn in this order. */
export function gridSlotOf(key: GridKey): number {
  return GRID_KEYS.indexOf(key);
}

/** A villager's first page opens a build page: UNIT_COMMAND_HOTKEYS'
 *  BUILD_ECONOMIC (string 19214, "Economic Buildings") is Q and
 *  BUILD_MILITARY (19215, "Military Buildings") is W. */
export const BUILD_PAGE_KEYS: Readonly<Record<BuildPageId, GridKey>> = { economic: 'q', military: 'w' };

/** VILLAGER_HOTKEYS (string 20003, "Villager Build"): each building's page is
 *  the entry's `context` and its slot the entry's key. DE's Tower is this
 *  game's Watch Tower and DE's Gate its Stone Gate. The Fish Trap has no
 *  `context` (a Fishing Ship builds it); this game draws it on the Economic page. */
export const VILLAGER_BUILD_SLOTS: Readonly<Record<BuildableBuildingType, { page: BuildPageId; key: GridKey }>> = {
  house: { page: 'economic', key: 'q' }, // VILLAGER_BUILD_HOUSE, 19213
  mill: { page: 'economic', key: 'w' }, // VILLAGER_BUILD_MILL, 19236
  'mining-camp': { page: 'economic', key: 'e' }, // VILLAGER_BUILD_MINING_CAMP, 19288
  'lumber-camp': { page: 'economic', key: 'r' }, // VILLAGER_BUILD_LUMBER_CAMP, 19283
  dock: { page: 'economic', key: 't' }, // VILLAGER_BUILD_DOCK, 19067
  farm: { page: 'economic', key: 'a' }, // VILLAGER_BUILD_FARM, 19200
  blacksmith: { page: 'economic', key: 's' }, // VILLAGER_BUILD_BLACKSMITH, 19063
  market: { page: 'economic', key: 'd' }, // VILLAGER_BUILD_MARKET, 19237
  monastery: { page: 'economic', key: 'f' }, // VILLAGER_BUILD_MONASTERY, 19065
  university: { page: 'economic', key: 'g' }, // VILLAGER_BUILD_UNIVERSITY, 19208
  'town-center': { page: 'economic', key: 'z' }, // VILLAGER_BUILD_TOWN_CENTER, 19238
  wonder: { page: 'economic', key: 'x' }, // VILLAGER_BUILD_WONDER, 19209
  'fish-trap': { page: 'economic', key: 'q' }, // VILLAGER_BUILD_FISH_TRAP, 19202 (no context)
  barracks: { page: 'military', key: 'q' }, // VILLAGER_BUILD_BARRACKS, 19064
  'archery-range': { page: 'military', key: 'w' }, // VILLAGER_BUILD_ARCHERY_RANGE, 19062
  stable: { page: 'military', key: 'e' }, // VILLAGER_BUILD_STABLE, 19206
  'siege-workshop': { page: 'military', key: 'r' }, // VILLAGER_BUILD_SIEGE_WORKSHOP, 19205
  outpost: { page: 'military', key: 'a' }, // VILLAGER_BUILD_OUTPOST, 19203
  'palisade-wall': { page: 'military', key: 's' }, // VILLAGER_BUILD_PALISADE_WALL, 19210
  'stone-wall': { page: 'military', key: 'd' }, // VILLAGER_BUILD_STONE_WALL, 19211
  'watch-tower': { page: 'military', key: 'f' }, // VILLAGER_BUILD_TOWER, 19201
  'bombard-tower': { page: 'military', key: 'g' }, // VILLAGER_BUILD_BOMBARD_TOWER, 19204
  'stone-gate': { page: 'military', key: 'z' }, // VILLAGER_BUILD_GATE_1, 19264
  'palisade-gate': { page: 'military', key: 'x' }, // VILLAGER_BUILD_PALISADE_GATE, 19212
  castle: { page: 'military', key: 'c' }, // VILLAGER_BUILD_CASTLE, 19066
};

/** A building's card, keyed by the button's `data-command`. */
type BuildingCardKeys = Readonly<Record<string, GridKey>>;

/** TOWN_CENTER_HOTKEYS (string 20004), with UNIT_COMMAND_HOTKEYS' UNGARRISON
 *  (20208), which every garrisonable building shares. */
const TOWN_CENTER_KEYS: BuildingCardKeys = {
  'train-villager': 'q', // TOWN_CENTER_CREATE_VILLAGER, 19054
  'research-loom': 'a', // TOWN_CENTER_LOOM, 19333
  'research-wheelbarrow': 's', // TOWN_CENTER_WHEELBARROW_HANDCART, 19334
  'research-hand-cart': 's',
  'research-town-watch': 'd', // TOWN_CENTER_TOWN_WATCH_GUARD, 19335
  'research-town-patrol': 'd',
  'research-feudal-age': 'z', // TOWN_CENTER_AGE_ADVANCE, 19336
  'research-castle-age': 'z',
  'research-imperial-age': 'z',
  'action-back-to-work': 'f', // TOWN_CENTER_BACK_TO_WORK, 19324
  'action-ungarrison': 'g', // UNGARRISON, 20208
  'action-ring-town-bell': 'b', // TOWN_CENTER_RING_TOWN_BELL, 19319
};

const BUILDING_CARD_KEYS: Readonly<Record<string, BuildingCardKeys>> = {
  'town-center': TOWN_CENTER_KEYS,
};

/** Whether this building's card takes DE's keys (work 142 M2a: the Town Center). */
export function hasBuildingCardKeys(buildingType: string): boolean {
  return Object.hasOwn(BUILDING_CARD_KEYS, buildingType);
}

/** The DE key of a button on a building's card, or null when DE gives it none here. */
export function buildingCardKeyOf(buildingType: string, command: string): GridKey | null {
  return BUILDING_CARD_KEYS[buildingType]?.[command] ?? null;
}

/** A unit's card (work 142 M2b-1), keyed by the button's `data-command`:
 *  MILITARY_UNITS_HOTKEYS (string 20014, "Military Units") holds the stances
 *  and formations, and a Fishing Ship builds the Fish Trap on
 *  VILLAGER_BUILD_FISH_TRAP's Q, which has no build page (no `context`). */
const UNIT_CARD_KEYS: BuildingCardKeys = {
  'stance-aggressive': 'a', // AGGRESSIVE, 19315
  'stance-defensive': 's', // DEFENSIVE, 19316
  'stance-stand-ground': 'd', // STAND_GROUND, 19317
  'stance-no-attack': 'f', // NO_ATTACK, 19318
  'formation-line': 'z', // FORMATION_LINE, 19304
  'formation-box': 'x', // FORMATION_BOX, 19303
  'formation-staggered': 'c', // FORMATION_STAGGARD, 19305
  'formation-flank': 'v', // FORMATION_FLANK, 19306
  'build-fish-trap': 'q', // VILLAGER_BUILD_FISH_TRAP, 19202
};

/** The DE key of a button on a unit's card, or null when DE gives it none here. */
export function unitCardKeyOf(command: string): GridKey | null {
  return UNIT_CARD_KEYS[command] ?? null;
}

/** The military card's orders, which this game gives by key alone (DE draws a
 *  button for each, at its key's slot): PATROL (19312) Q and ATTACK_MOVE
 *  (200008) R, and UNIT_COMMAND_HOTKEYS' ATTACK_GROUND (19220) T, which DE's
 *  card holds only for a unit that may attack the ground; T is GARRISON
 *  (19012) on the others. Not in this game, so their keys do nothing: GUARD
 *  (19313) W, FOLLOW (19314) E, STOP (19216) G or AUTO_SCOUT (19350) G on a
 *  Scout, and BUILD_MENU (19352) or SPECIAL_ABILITY (19234) B. */
export type MilitaryOrder = 'patrol' | 'attack-move' | 'attack-ground';
export const MILITARY_ORDER_KEYS: Readonly<Record<MilitaryOrder, GridKey>> = {
  patrol: 'q',
  'attack-move': 'r',
  'attack-ground': 't',
};

/** Orders a card's buttons by their DE slots, as DE's grid draws them; a
 *  button DE gives no key keeps its place after the keyed ones. */
export function inUnitCardSlotOrder<T>(options: readonly T[], commandOf: (option: T) => string): T[] {
  const slot = (option: T): number => {
    const key = unitCardKeyOf(commandOf(option));
    return key === null ? GRID_KEYS.length : gridSlotOf(key);
  };
  return [...options].sort((a, b) => slot(a) - slot(b));
}
