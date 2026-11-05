// DE's "go to" and "select all" building keys (work 142 M2b-2b-2). Each is the
// `definitive` default of the install's `hotkeys.json` (`node
// scripts/dumpDeHotkeys.mjs CYCLE_COMMAND_HOTKEYS GAME_COMMAND_HOTKEYS`, their
// card groups), cited in spec §14.2:
//  - a go-to key (CYCLE_COMMAND_HOTKEYS) selects the player's next building of
//    its type, in turn by id, and centres the camera on it, as H does for the
//    Town Center (v0.3.155; "The towncenter should be selected", a DE player on
//    H, 2023). DE's update 81058 says these keys cycle: "cycling through them
//    using one key";
//  - a select-all key (GAME_COMMAND_HOTKEYS) selects every building of its
//    types the player owns and leaves the camera ("Without centering", a DE
//    player on Select All Town Centers, 2020).
// A key finds the player's buildings alone and takes no other player's. DE's
// Ctrl+W (Go to Wonder) and Ctrl+Shift+W (Select all Wonders) are keys Chrome
// keeps, closing the tab and the window, so no page receives them and the
// Wonder has no key here. The entries for buildings this game lacks (Krepost,
// Donjon, Settlement, Shipyard, Port, Mule Cart, the heroes) bind nothing.

import type { EntityRef } from 'civ-engine';

import type { HotkeyHandler, HotkeySpec } from '../../game/control/HotkeyRegistry';
import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../game/simulation/prototypeScenario';
import type { BuildingType } from '../../game/simulation/types';
import { centreOnObject, type CentringViewLike } from './goToObject';

interface BuildingKeys {
  /** The key the row adds Ctrl or Ctrl+Shift to; ' ' is Space. */
  readonly key: string;
  readonly types: readonly BuildingType[];
  /** DE's go-to entry on Ctrl and the key (`CYCLE_COMMAND_HOTKEYS`), or null. */
  readonly goTo: string | null;
  /** DE's select-all entry on Ctrl+Shift and the key (`GAME_COMMAND_HOTKEYS`). */
  readonly selectAll: string;
}

/** The buildings SELECT_ALL_MILITARY_BUILDINGS (19003) takes, by its unit_list
 *  (12, 87, 101, 49, 82, 104; its Krepost and Donjon are not in this game). */
export const DE_MILITARY_BUILDINGS: readonly BuildingType[] = [
  'barracks', 'archery-range', 'stable', 'siege-workshop', 'castle', 'monastery',
];

/** DE's rows, each with its entries and their string ids. */
export const DE_BUILDING_KEYS: readonly BuildingKeys[] = [
  { key: 'm', types: ['market'], goTo: 'GOTO_MARKET 19027', selectAll: 'SELECT_ALL_MARKETS 19131' },
  { key: 'b', types: ['barracks'], goTo: 'GOTO_BARRACKS 19269', selectAll: 'SELECT_ALL_BARRACKS 19014' },
  { key: 'a', types: ['archery-range'], goTo: 'GOTO_ARCHERY_RANGE 19270', selectAll: 'SELECT_ALL_ARCHERY_RANGES 19015' },
  { key: 'l', types: ['stable'], goTo: 'GOTO_STABLE 19271', selectAll: 'SELECT_ALL_STABLES 19016' },
  { key: 'k', types: ['siege-workshop'], goTo: 'GOTO_SIEGE_WORKSHOP 19272', selectAll: 'SELECT_ALL_SIEGE_WORKSHOPS 19017' },
  { key: 'd', types: ['dock'], goTo: 'GOTO_DOCK 19273', selectAll: 'SELECT_ALL_DOCKS 19013' },
  { key: 'y', types: ['monastery'], goTo: 'GOTO_MONASTERY 19274', selectAll: 'SELECT_ALL_MONASTERIES 19020' },
  { key: 's', types: ['blacksmith'], goTo: 'GOTO_BLACKSMITH 19275', selectAll: 'SELECT_ALL_BLACKSMITHS 19132' },
  { key: 'i', types: ['mill'], goTo: 'GOTO_MILL 19276', selectAll: 'SELECT_ALL_MILLS 19155' },
  { key: 'u', types: ['university'], goTo: 'GOTO_UNIVERSITY 19277', selectAll: 'SELECT_ALL_UNIVERSITIES 19133' },
  { key: 'v', types: ['castle'], goTo: 'GOTO_CASTLE 19290', selectAll: 'SELECT_ALL_CASTLES 19018' },
  { key: 'g', types: ['mining-camp'], goTo: 'GOTO_MINING_CAMP 19291', selectAll: 'SELECT_ALL_MINING_CAMPS 19156' },
  { key: 'z', types: ['lumber-camp'], goTo: 'GOTO_LUMBER_CAMP 19292', selectAll: 'SELECT_ALL_LUMBER_CAMPS 19157' },
  { key: 'j', types: ['outpost'], goTo: 'GOTO_OUTPOST 419135', selectAll: 'SELECT_ALL_OUTPOSTS 419134' },
  // The Town Center's go-to key is H with no Ctrl (GOTO_TOWN_CENTER 19026).
  { key: 'h', types: ['town-center'], goTo: null, selectAll: 'SELECT_ALL_TOWN_CENTERS 19021' },
  { key: ' ', types: DE_MILITARY_BUILDINGS, goTo: null, selectAll: 'SELECT_ALL_MILITARY_BUILDINGS 19003' },
];

interface HotkeyRegistryLike {
  register(spec: HotkeySpec, handler: HotkeyHandler): void;
}

/** The player's buildings of these types, oldest first. */
function ownBuildings(bridge: SimulationBridge, types: readonly BuildingType[]): number[] {
  return bridge.getEconomyState().buildings
    .filter((building) => building.owner === HUMAN_PLAYER_ID && types.includes(building.buildingType))
    .map((building) => building.id)
    .sort((a, b) => a - b);
}

export function registerGoToBuildingHotkeys(
  hotkeyRegistry: HotkeyRegistryLike,
  // A getter: createApp swaps the bridge on save-load.
  bridgeRef: () => SimulationBridge,
  view: CentringViewLike,
): void {
  // Each key keeps its own place in its turn, so the next press goes on to
  // the next building of its types and comes round to the first.
  const goTo = (types: readonly BuildingType[]): (() => void) => {
    let lastId = -1;
    return () => {
      const bridge = bridgeRef();
      const own = ownBuildings(bridge, types);
      if (own.length === 0) return;
      const next = own.find((id) => id > lastId) ?? own[0]!;
      lastId = next;
      if (bridge.selectEntityById(next)) centreOnObject(bridge, view, next);
    };
  };
  const selectAll = (types: readonly BuildingType[]): void => {
    const bridge = bridgeRef();
    // As selectEntityById, which the go-to keys use, a finished match takes no selection.
    if (bridge.getMatchState().outcome !== 'running') return;
    const refs = ownBuildings(bridge, types)
      .map((id) => bridge.world.getEntityRef(id))
      .filter((ref): ref is EntityRef => ref !== null);
    if (refs.length > 0) bridge.select(refs);
  };
  // A key that finds nothing is still the game's: the browser's action for it
  // (Ctrl+S saves the page) does not happen either.
  hotkeyRegistry.register({ key: 'h' }, goTo(['town-center']));
  for (const row of DE_BUILDING_KEYS) {
    if (row.goTo !== null) hotkeyRegistry.register({ key: row.key, ctrl: true }, goTo(row.types));
    hotkeyRegistry.register({ key: row.key, ctrl: true, shift: true }, () => { selectAll(row.types); });
  }
}
