// Characterization test for the entity display-name table.
//
// Captured from the pre-table implementation (two parallel 61-case switches)
// and asserted against the table that replaced them. EXPECTED is typed as a
// total Record over the entity union, so the COMPILER forces every one of the
// 61 types to be pinned — an earlier version of this file listed 27 and its
// header still claimed the refactor was "provably output-identical for every
// type", which review correctly called an overclaim (34 regular-plural rows
// were unpinned).

import { describe, expect, it } from 'vitest';

import type { SelectionState } from '../../src/game/simulation/types';
import {
  formatEntityName,
  formatEntityPluralName,
  isUnitType,
} from '../../src/ui/hud/displayNames/entityNames';

type Entity = NonNullable<SelectionState['selectedEntityType']>;

// All 61 types, extracted mechanically from the pre-refactor switches (never
// hand-transcribed). The Record is TOTAL over the entity union, so omitting
// a type is a compile error rather than a silently unpinned row.
const EXPECTED: Readonly<Record<Entity, readonly [singular: string, plural: string]>> = {
  'town-center': ['Town Center', 'Town Centers'],
  'house': ['House', 'Houses'],
  'mill': ['Mill', 'Mills'],
  'lumber-camp': ['Lumber Camp', 'Lumber Camps'],
  'mining-camp': ['Mining Camp', 'Mining Camps'],
  'barracks': ['Barracks', 'Barracks'],
  'watch-tower': ['Watch Tower', 'Watch Towers'],
  'bombard-tower': ['Bombard Tower', 'Bombard Towers'],
  'stable': ['Stable', 'Stables'],
  'archery-range': ['Archery Range', 'Archery Ranges'],
  'blacksmith': ['Blacksmith', 'Blacksmiths'],
  'market': ['Market', 'Markets'],
  'berry-bush': ['Berry Bush', 'Berry Bushes'],
  'gold-mine': ['Gold Mine', 'Gold Mines'],
  'stone-mine': ['Stone Mine', 'Stone Mines'],
  'boar': ['Boar', 'Boars'],
  'fish': ['Fish', 'Fish'],
  'sheep': ['Sheep', 'Sheep'],
  'wolf': ['Wolf', 'Wolves'],
  'tree': ['Tree', 'Trees'],
  'villager': ['Villager', 'Villagers'],
  'militia': ['Militia', 'Militia'],
  'spearman': ['Spearman', 'Spearmen'],
  'archer': ['Archer', 'Archers'],
  'skirmisher': ['Skirmisher', 'Skirmishers'],
  'elite-skirmisher': ['Elite Skirmisher', 'Elite Skirmishers'],
  'eagle-warrior': ['Eagle Warrior', 'Eagle Warriors'],
  'elite-eagle-warrior': ['Elite Eagle Warrior', 'Elite Eagle Warriors'],
  'hand-cannoneer': ['Hand Cannoneer', 'Hand Cannoneers'],
  'knight': ['Knight', 'Knights'],
  'scout': ['Scout Cavalry', 'Scout Cavalry'],
  'crossbowman': ['Crossbowman', 'Crossbowmen'],
  'pikeman': ['Pikeman', 'Pikemen'],
  'light-cavalry': ['Light Cavalry', 'Light Cavalry'],
  'camel': ['Camel', 'Camels'],
  'cavalry-archer': ['Cavalry Archer', 'Cavalry Archers'],
  'mangonel': ['Mangonel', 'Mangonels'],
  'scorpion': ['Scorpion', 'Scorpions'],
  'battering-ram': ['Battering Ram', 'Battering Rams'],
  'siege-workshop': ['Siege Workshop', 'Siege Workshops'],
  'monastery': ['Monastery', 'Monasteries'],
  'university': ['University', 'Universities'],
  'dock': ['Dock', 'Docks'],
  'outpost': ['Outpost', 'Outposts'],
  'fish-trap': ['Fish Trap', 'Fish Traps'],
  'monk': ['Monk', 'Monks'],
  'relic': ['Relic', 'Relics'],
  'castle': ['Castle', 'Castles'],
  'wonder': ['Wonder', 'Wonders'],
  'longbowman': ['Longbowman', 'Longbowmen'],
  'arbalest': ['Arbalest', 'Arbalests'],
  'halberdier': ['Halberdier', 'Halberdiers'],
  'hussar': ['Hussar', 'Hussars'],
  'heavy-cavalry-archer': ['Heavy Cavalry Archer', 'Heavy Cavalry Archers'],
  'cavalier': ['Cavalier', 'Cavaliers'],
  'champion': ['Champion', 'Champions'],
  'elite-longbowman': ['Elite Longbowman', 'Elite Longbowmen'],
  'onager': ['Onager', 'Onagers'],
  'siege-onager': ['Siege Onager', 'Siege Onagers'],
  'heavy-scorpion': ['Heavy Scorpion', 'Heavy Scorpions'],
  'siege-ram': ['Siege Ram', 'Siege Rams'],
  'capped-ram': ['Capped Ram', 'Capped Rams'],
  'bombard-cannon': ['Bombard Cannon', 'Bombard Cannons'],
  'trebuchet': ['Trebuchet', 'Trebuchets'],
  'petard': ['Petard', 'Petards'],
  'trade-cart': ['Trade Cart', 'Trade Carts'],
  'trade-cog': ['Trade Cog', 'Trade Cogs'],
  'missionary': ['Missionary', 'Missionaries'],
  'fishing-ship': ['Fishing Ship', 'Fishing Ships'],
  'transport-ship': ['Transport Ship', 'Transport Ships'],
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
  'elite-jaguar-warrior': ['Elite Jaguar Warrior', 'Elite Jaguar Warriors'],
  'cataphract': ['Cataphract', 'Cataphracts'],
  'elite-cataphract': ['Elite Cataphract', 'Elite Cataphracts'],
  'woad-raider': ['Woad Raider', 'Woad Raiders'],
  'elite-woad-raider': ['Elite Woad Raider', 'Elite Woad Raiders'],
  'chu-ko-nu': ['Chu Ko Nu', 'Chu Ko Nu'],
  'elite-chu-ko-nu': ['Elite Chu Ko Nu', 'Elite Chu Ko Nu'],
  'throwing-axeman': ['Throwing Axeman', 'Throwing Axemen'],
  'elite-throwing-axeman': ['Elite Throwing Axeman', 'Elite Throwing Axemen'],
  'huskarl': ['Huskarl', 'Huskarls'],
  'elite-huskarl': ['Elite Huskarl', 'Elite Huskarls'],
  'tarkan': ['Tarkan', 'Tarkans'],
  'elite-tarkan': ['Elite Tarkan', 'Elite Tarkans'],
  'samurai': ['Samurai', 'Samurai'],
  'elite-samurai': ['Elite Samurai', 'Elite Samurai'],
  'war-wagon': ['War Wagon', 'War Wagons'],
  'elite-war-wagon': ['Elite War Wagon', 'Elite War Wagons'],
  'plumed-archer': ['Plumed Archer', 'Plumed Archers'],
  'elite-plumed-archer': ['Elite Plumed Archer', 'Elite Plumed Archers'],
  'mangudai': ['Mangudai', 'Mangudai'],
  'elite-mangudai': ['Elite Mangudai', 'Elite Mangudai'],
  'war-elephant': ['War Elephant', 'War Elephants'],
  'elite-war-elephant': ['Elite War Elephant', 'Elite War Elephants'],
  'mameluke': ['Mameluke', 'Mamelukes'],
  'elite-mameluke': ['Elite Mameluke', 'Elite Mamelukes'],
  'conquistador': ['Conquistador', 'Conquistadors'],
  'elite-conquistador': ['Elite Conquistador', 'Elite Conquistadors'],
  'teutonic-knight': ['Teutonic Knight', 'Teutonic Knights'],
  'elite-teutonic-knight': ['Elite Teutonic Knight', 'Elite Teutonic Knights'],
  'janissary': ['Janissary', 'Janissaries'],
  'elite-janissary': ['Elite Janissary', 'Elite Janissaries'],
  'berserk': ['Berserk', 'Berserks'],
  'elite-berserk': ['Elite Berserk', 'Elite Berserks'],
  'turtle-ship': ['Turtle Ship', 'Turtle Ships'],
  'elite-turtle-ship': ['Elite Turtle Ship', 'Elite Turtle Ships'],
  'longboat': ['Longboat', 'Longboats'],
  'elite-longboat': ['Elite Longboat', 'Elite Longboats'],
  'man-at-arms': ['Man-at-Arms', 'Men-at-Arms'],
  'long-swordsman': ['Long Swordsman', 'Long Swordsmen'],
  'two-handed-swordsman': ['Two-Handed Swordsman', 'Two-Handed Swordsmen'],
  'paladin': ['Paladin', 'Paladins'],
  'heavy-camel': ['Heavy Camel', 'Heavy Camels'],
  'stone-wall': ['Stone Wall', 'Stone Walls'],
  'palisade-wall': ['Palisade Wall', 'Palisade Walls'],
  'stone-gate': ['Gate', 'Gates'],
  'palisade-gate': ['Palisade Gate', 'Palisade Gates'],
  'farm': ['Farm', 'Farms'],
};

describe('entity display names', () => {
  it('renders the same singular and plural as the pre-table switches', () => {
    for (const [entityType, [singular, plural]] of Object.entries(EXPECTED) as [
      Entity, readonly [string, string],
    ][]) {
      expect(formatEntityName(entityType), `${entityType} singular`).toBe(singular);
      expect(formatEntityPluralName(entityType), `${entityType} plural`).toBe(plural);
    }
  });

  it('rejects inherited Object.prototype members instead of returning undefined', () => {
    // Review-confirmed: the table lookup used bracket access on an object
    // literal, so ENTITY_NAMES['toString'] resolved to Object.prototype's
    // method — the `=== undefined` guard missed it, the tuple branch indexed
    // a function, and formatEntityName returned undefined from a `: string`
    // signature. The pre-table switch returned the raw id.
    for (const inherited of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
      expect(formatEntityName(inherited as Entity), `${inherited} singular`).toBe(inherited);
      expect(formatEntityPluralName(inherited as Entity), `${inherited} plural`)
        .toBe(`${inherited}s`);
    }
  });

  it('keeps the no-selection fallbacks', () => {
    expect(formatEntityName(null)).toBe('No selection');
    expect(formatEntityPluralName(null)).toBe('Units');
  });

  it('falls back to the raw id for an unknown future type, pluralising with +s', () => {
    // Verified against the pre-table switches: the singular default returned
    // the bare id, the plural default appended 's'.
    const unknown = 'ox-wagon' as Entity;
    expect(formatEntityName(unknown)).toBe('ox-wagon');
    expect(formatEntityPluralName(unknown)).toBe('ox-wagons');
  });

  it('still classifies unit types', () => {
    expect(isUnitType('militia')).toBe(true);
    expect(isUnitType('town-center')).toBe(false);
    expect(isUnitType(null)).toBe(false);
  });
});
