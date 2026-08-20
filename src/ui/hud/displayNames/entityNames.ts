// Display names for every selectable entity type.
//
// ONE ROW PER TYPE, singular and plural together: the two used to be parallel
// 61-case switches whose own comment warned they "need to stay in lockstep
// (every new entity type ships in both); separating them would invite drift".
// A table makes that lockstep structural rather than a promise — a new type
// cannot ship half-named, because there is only one place to add it.
//
// A bare string means the plural is the regular '+s' form (44 of 61 types).
// A tuple spells out a plural that isn't ('Wolves', 'Men-at-Arms', 'Barracks').

import type { SelectionState } from '../../../game/simulation/types';

// The canonical predicate lives with the unit-type table, where
// `satisfies Record<UnitType, true>` makes the compiler enforce exhaustiveness.
// This module re-exports it so HUD callers keep one import site.
export { isUnitType } from '../../../input/unitTypeMap';

type EntityName = string | readonly [singular: string, plural: string];
type EntityType = NonNullable<SelectionState['selectedEntityType']>;

// `satisfies Record<EntityType, EntityName>` restores — and exceeds — the
// key check the old switch gave us: a typo'd key ('castel') and a MISSING
// type are both compile errors. Review proved the interim
// `Record<string, EntityName>` let a renamed key through tsc clean.
const ENTITY_NAMES = {
  'town-center': 'Town Center',
  'house': 'House',
  'mill': 'Mill',
  'lumber-camp': 'Lumber Camp',
  'mining-camp': 'Mining Camp',
  'barracks': ['Barracks', 'Barracks'],
  'watch-tower': 'Watch Tower',
  'stable': 'Stable',
  'archery-range': 'Archery Range',
  'blacksmith': 'Blacksmith',
  'market': 'Market',
  'berry-bush': ['Berry Bush', 'Berry Bushes'],
  'gold-mine': 'Gold Mine',
  'stone-mine': 'Stone Mine',
  'boar': 'Boar',
  'fish': ['Fish', 'Fish'],
  'sheep': ['Sheep', 'Sheep'],
  'wolf': ['Wolf', 'Wolves'],
  'tree': 'Tree',
  'villager': 'Villager',
  'militia': ['Militia', 'Militia'],
  'spearman': ['Spearman', 'Spearmen'],
  'archer': 'Archer',
  'skirmisher': 'Skirmisher',
  'knight': 'Knight',
  'scout': ['Scout Cavalry', 'Scout Cavalry'],
  'crossbowman': ['Crossbowman', 'Crossbowmen'],
  'pikeman': ['Pikeman', 'Pikemen'],
  'light-cavalry': ['Light Cavalry', 'Light Cavalry'],
  'camel': 'Camel',
  'cavalry-archer': 'Cavalry Archer',
  'mangonel': 'Mangonel',
  'scorpion': 'Scorpion',
  'battering-ram': 'Battering Ram',
  'siege-workshop': 'Siege Workshop',
  'monastery': ['Monastery', 'Monasteries'],
  'university': ['University', 'Universities'],
  'dock': ['Dock', 'Docks'],
  'monk': 'Monk',
  'relic': 'Relic',
  'castle': 'Castle',
  'wonder': 'Wonder',
  'longbowman': ['Longbowman', 'Longbowmen'],
  'arbalest': 'Arbalest',
  'halberdier': 'Halberdier',
  'hussar': 'Hussar',
  'heavy-cavalry-archer': 'Heavy Cavalry Archer',
  'cavalier': 'Cavalier',
  'champion': 'Champion',
  'elite-longbowman': ['Elite Longbowman', 'Elite Longbowmen'],
  'onager': 'Onager',
  'heavy-scorpion': 'Heavy Scorpion',
  'siege-ram': 'Siege Ram',
  'bombard-cannon': 'Bombard Cannon',
  'trebuchet': 'Trebuchet',
  'fishing-ship': ['Fishing Ship', 'Fishing Ships'],
  'galley': ['Galley', 'Galleys'],
  'war-galley': ['War Galley', 'War Galleys'],
  'galleon': ['Galleon', 'Galleons'],
  'fire-ship': ['Fire Ship', 'Fire Ships'],
  'fast-fire-ship': ['Fast Fire Ship', 'Fast Fire Ships'],
  'demolition-ship': ['Demolition Ship', 'Demolition Ships'],
  'heavy-demolition-ship': ['Heavy Demolition Ship', 'Heavy Demolition Ships'],
  'cannon-galleon': ['Cannon Galleon', 'Cannon Galleons'],
  'elite-cannon-galleon': ['Elite Cannon Galleon', 'Elite Cannon Galleons'],
  'jaguar-warrior': ['Jaguar Warrior', 'Jaguar Warriors'],
  'cataphract': ['Cataphract', 'Cataphracts'],
  'woad-raider': ['Woad Raider', 'Woad Raiders'],
  'chu-ko-nu': ['Chu Ko Nu', 'Chu Ko Nu'],
  'throwing-axeman': ['Throwing Axeman', 'Throwing Axemen'],
  'huskarl': ['Huskarl', 'Huskarls'],
  'tarkan': ['Tarkan', 'Tarkans'],
  'samurai': ['Samurai', 'Samurai'],
  'war-wagon': ['War Wagon', 'War Wagons'],
  'plumed-archer': ['Plumed Archer', 'Plumed Archers'],
  'mangudai': ['Mangudai', 'Mangudai'],
  'war-elephant': ['War Elephant', 'War Elephants'],
  'mameluke': ['Mameluke', 'Mamelukes'],
  'conquistador': ['Conquistador', 'Conquistadors'],
  'teutonic-knight': ['Teutonic Knight', 'Teutonic Knights'],
  'janissary': ['Janissary', 'Janissaries'],
  'berserk': ['Berserk', 'Berserks'],
  'turtle-ship': ['Turtle Ship', 'Turtle Ships'],
  'longboat': ['Longboat', 'Longboats'],
  'man-at-arms': ['Man-at-Arms', 'Men-at-Arms'],
  'long-swordsman': ['Long Swordsman', 'Long Swordsmen'],
  'two-handed-swordsman': ['Two-Handed Swordsman', 'Two-Handed Swordsmen'],
  'paladin': 'Paladin',
  'heavy-camel': 'Heavy Camel',
  'stone-wall': 'Stone Wall',
  'palisade-wall': 'Palisade Wall',
  'farm': 'Farm',
} as const satisfies Record<EntityType, EntityName>;

// `hasOwn`, not bracket access alone: an object literal inherits from
// Object.prototype, so ENTITY_NAMES['toString'] resolved to that method — the
// `undefined` guard missed it and callers got undefined out of a `: string`
// signature. Same hazard as the `in`-operator bug fixed in isUnitType.
function nameOf(entityType: string): EntityName | undefined {
  return Object.hasOwn(ENTITY_NAMES, entityType)
    ? (ENTITY_NAMES as Readonly<Record<string, EntityName>>)[entityType]
    : undefined;
}

// Human-readable name for the entity selected in the HUD. The fallback
// returns the raw kebab-cased id so unknown future entity types stay
// legible until they're added here.
export function formatEntityName(entityType: SelectionState['selectedEntityType']): string {
  if (!entityType) return 'No selection';
  const name = nameOf(entityType);
  if (name === undefined) return entityType;
  return typeof name === 'string' ? name : name[0];
}

// An unknown type pluralises with the same '+s' rule as a regular row, so a
// future entity stays legible until it is added to the table.
export function formatEntityPluralName(entityType: SelectionState['selectedEntityType']): string {
  if (!entityType) return 'Units';
  const name = nameOf(entityType) ?? entityType;
  return typeof name === 'string' ? `${name}s` : name[1];
}

export function formatSelectionName(selectionState: SelectionState): string {
  if (selectionState.selectedCount <= 1) {
    return formatEntityName(selectionState.selectedEntityType);
  }

  const label =
    selectionState.selectedEntityType === null
      ? 'Units'
      : formatEntityPluralName(selectionState.selectedEntityType);
  return `${selectionState.selectedCount} ${label} Selected`;
}

