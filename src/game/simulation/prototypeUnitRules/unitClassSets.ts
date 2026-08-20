// Unit CLASSIFICATION tables — which units belong to which combat class, plus
// the wildlife profiles. Split out of ./statTables.ts (per-unit NUMBERS) when
// the roster grew past what one file could hold under the 500-LOC budget.
// statTables re-exports every name here, so existing imports keep working.

import type { ResourceKind } from '../types';
import type { UnitType } from '../unitTypes';

export const UNIT_MIN_ATTACK_RANGE = new Map<UnitType, number>([
  ['mangonel', 3],
  ['onager', 3],
  ['bombard-cannon', 5],
]);

export const ARCHER_LINE_UNITS = new Set<UnitType>([
  'archer',
  'crossbowman',
  'cavalry-archer',
  'longbowman',
  'arbalest',
  'heavy-cavalry-archer',
  'elite-longbowman',
]);

export const STATIC_MEMORABLE_RESOURCE_TYPES = new Set<ResourceKind>([
  'tree',
  'berry-bush',
  'gold-mine',
  'stone-mine',
]);

export const CAVALRY_UNITS = new Set<UnitType>([
  'scout',
  'light-cavalry',
  'hussar',
  'camel',
  'knight',
  'cavalier',
  'paladin',
  'heavy-camel',
]);

// Mounted units = cavalry + the mounted-archer line — the scope of BOTH
// Stable rider techs (Husbandry csv:79, Bloodlines csv:78; applies-to
// "Cavalry;Cavalry Archer;Conquistador" — conquistador is not in the roster).
// Spread from CAVALRY_UNITS so the sets cannot drift. The barding ARMOR techs
// stay on CAVALRY_UNITS (mounted archers take the archer armor line instead).
export const MOUNTED_UNITS = new Set<UnitType>([
  ...CAVALRY_UNITS,
  'cavalry-archer',
  'heavy-cavalry-archer',
]);

export const INFANTRY_UNITS = new Set<UnitType>([
  'militia',
  'champion',
  'spearman',
  'pikeman',
  'halberdier',
  'man-at-arms',
  'long-swordsman',
  'two-handed-swordsman',
]);

export const MELEE_UNITS = new Set<UnitType>([
  'militia',
  'champion',
  'spearman',
  'pikeman',
  'halberdier',
  'scout',
  'light-cavalry',
  'hussar',
  'camel',
  'knight',
  'cavalier',
  'villager',
  'battering-ram',
  'siege-ram',
  'man-at-arms',
  'long-swordsman',
  'two-handed-swordsman',
  'paladin',
  'heavy-camel',
]);

export const WILDLIFE_PROFILES = {
  boar: {
    maxHp: 75,
    attackDamage: 7,
    reloadTicks: 14,
    autoAggro: false,
    corpsePersists: true,
    aggroRange: 3,
  },
  wolf: {
    maxHp: 25,
    attackDamage: 3,
    reloadTicks: 12,
    autoAggro: true,
    corpsePersists: false,
    aggroRange: 5,
  },
} as const;

