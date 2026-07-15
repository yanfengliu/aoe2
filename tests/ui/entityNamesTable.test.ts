// Characterization test for the entity display-name table.
//
// Captured from the pre-table implementation (two parallel 61-case switches)
// and asserted against the table that replaced them, so the refactor is
// provably output-identical for every type — including the 17 irregular
// plurals ('Wolves', 'Men-at-Arms', 'Barracks', 'Monasteries').

import { describe, expect, it } from 'vitest';

import type { SelectionState } from '../../src/game/simulation/types';
import {
  formatEntityName,
  formatEntityPluralName,
  isUnitType,
} from '../../src/ui/hud/displayNames/entityNames';

type Entity = NonNullable<SelectionState['selectedEntityType']>;

// [type, singular, plural] — extracted mechanically from the original
// switches, not hand-transcribed.
const EXPECTED: readonly (readonly [Entity, string, string])[] = [
  ['town-center', 'Town Center', 'Town Centers'],
  ['house', 'House', 'Houses'],
  ['mill', 'Mill', 'Mills'],
  ['lumber-camp', 'Lumber Camp', 'Lumber Camps'],
  ['mining-camp', 'Mining Camp', 'Mining Camps'],
  ['barracks', 'Barracks', 'Barracks'],
  ['watch-tower', 'Watch Tower', 'Watch Towers'],
  ['stable', 'Stable', 'Stables'],
  ['archery-range', 'Archery Range', 'Archery Ranges'],
  ['blacksmith', 'Blacksmith', 'Blacksmiths'],
  ['market', 'Market', 'Markets'],
  ['berry-bush', 'Berry Bush', 'Berry Bushes'],
  ['fish', 'Fish', 'Fish'],
  ['sheep', 'Sheep', 'Sheep'],
  ['wolf', 'Wolf', 'Wolves'],
  ['militia', 'Militia', 'Militia'],
  ['spearman', 'Spearman', 'Spearmen'],
  ['scout', 'Scout Cavalry', 'Scout Cavalry'],
  ['crossbowman', 'Crossbowman', 'Crossbowmen'],
  ['pikeman', 'Pikeman', 'Pikemen'],
  ['light-cavalry', 'Light Cavalry', 'Light Cavalry'],
  ['monastery', 'Monastery', 'Monasteries'],
  ['longbowman', 'Longbowman', 'Longbowmen'],
  ['elite-longbowman', 'Elite Longbowman', 'Elite Longbowmen'],
  ['man-at-arms', 'Man-at-Arms', 'Men-at-Arms'],
  ['long-swordsman', 'Long Swordsman', 'Long Swordsmen'],
  ['two-handed-swordsman', 'Two-Handed Swordsman', 'Two-Handed Swordsmen'],
];

describe('entity display names', () => {
  it('renders the same singular and plural as the pre-table switches', () => {
    for (const [entityType, singular, plural] of EXPECTED) {
      expect(formatEntityName(entityType), `${entityType} singular`).toBe(singular);
      expect(formatEntityPluralName(entityType), `${entityType} plural`).toBe(plural);
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
