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
  'heavy-scorpion': ['Heavy Scorpion', 'Heavy Scorpions'],
  'siege-ram': ['Siege Ram', 'Siege Rams'],
  'bombard-cannon': ['Bombard Cannon', 'Bombard Cannons'],
  'trebuchet': ['Trebuchet', 'Trebuchets'],
  'fishing-ship': ['Fishing Ship', 'Fishing Ships'],
  'man-at-arms': ['Man-at-Arms', 'Men-at-Arms'],
  'long-swordsman': ['Long Swordsman', 'Long Swordsmen'],
  'two-handed-swordsman': ['Two-Handed Swordsman', 'Two-Handed Swordsmen'],
  'paladin': ['Paladin', 'Paladins'],
  'heavy-camel': ['Heavy Camel', 'Heavy Camels'],
  'stone-wall': ['Stone Wall', 'Stone Walls'],
  'palisade-wall': ['Palisade Wall', 'Palisade Walls'],
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
    const unknown = 'trade-cog' as Entity;
    expect(formatEntityName(unknown)).toBe('trade-cog');
    expect(formatEntityPluralName(unknown)).toBe('trade-cogs');
  });

  it('still classifies unit types', () => {
    expect(isUnitType('militia')).toBe(true);
    expect(isUnitType('town-center')).toBe(false);
    expect(isUnitType(null)).toBe(false);
  });
});
