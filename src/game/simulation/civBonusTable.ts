// The civilization-bonus TABLE (spec §9.2): every `civilizations.csv` bonus
// line the derived seams can express, declared as data the way the unique
// technologies are — one entry per civilization, each effect naming what it
// touches and by how much, and one loop per seam applying them all. Lines the
// seams cannot express yet (free technologies, starting-resource deltas,
// age-scaled HP, carry capacity, and the rest) are NOT silently dropped: the
// spec's §9.2 breadth note lists them per civilization as the open remainder.

import type { AgeType, ResourceKind, UnitType } from './types';
import { isInfantryUnit } from './prototypeUnitRules';

export interface CivCostRule {
  readonly applies: (unitType: UnitType) => boolean;
  /** Multiplier for the whole cost, flat or by age (absent ages = 1). */
  readonly multiplier?: number;
  readonly multiplierByAge?: Partial<Record<AgeType, number>>;
  /** Multiplier for the GOLD component alone (Portuguese). */
  readonly goldMultiplier?: number;
  /** Flat wood delta (Italians' fishing ships). */
  readonly woodDelta?: number;
}

export interface CivBonusEntry {
  readonly civilization: string;
  /** Villager gather-rate multipliers by resource kind. */
  readonly gatherRate?: Readonly<Partial<Record<ResourceKind, number>>>;
  readonly unitHp?: ReadonlyArray<{
    readonly applies: (unitType: UnitType) => boolean;
    readonly multiplier: number;
  }>;
  readonly buildingAttack?: ReadonlyArray<{
    readonly applies: (unitType: UnitType) => boolean;
    readonly bonus: number;
  }>;
  readonly trainTime?: ReadonlyArray<{
    readonly applies: (unitType: UnitType) => boolean;
    readonly multiplier: number;
  }>;
  readonly speed?: ReadonlyArray<{
    readonly applies: (unitType: UnitType) => boolean;
    readonly multiplier: number;
  }>;
  readonly cost?: ReadonlyArray<CivCostRule>;
}

const KNIGHT_LINE = new Set<UnitType>(['knight', 'cavalier', 'paladin']);
const GUNPOWDER_UNITS = new Set<UnitType>([
  'hand-cannoneer', 'bombard-cannon', 'cannon-galleon', 'elite-cannon-galleon',
  'conquistador', 'elite-conquistador', 'janissary', 'elite-janissary',
]);
const WARSHIPS = new Set<UnitType>([
  'galley', 'war-galley', 'galleon', 'fire-ship', 'fast-fire-ship',
  'demolition-ship', 'heavy-demolition-ship', 'cannon-galleon',
  'elite-cannon-galleon', 'turtle-ship', 'elite-turtle-ship',
  'longboat', 'elite-longboat',
]);
const SHIPS = new Set<UnitType>([
  ...WARSHIPS, 'fishing-ship', 'transport-ship', 'trade-cog',
]);
const CAVALRY_ARCHER_LINE = new Set<UnitType>(['cavalry-archer', 'heavy-cavalry-archer']);
const FOOT_ARCHER_LINE = new Set<UnitType>(['archer', 'crossbowman', 'arbalest']);
const SCOUT_LINE = new Set<UnitType>(['scout', 'light-cavalry', 'hussar']);
const STABLE_UNITS = new Set<UnitType>([
  'scout', 'light-cavalry', 'hussar', 'knight', 'cavalier', 'paladin', 'camel', 'heavy-camel',
]);
const SPEAR_SKIRM_CAMEL = new Set<UnitType>([
  'spearman', 'pikeman', 'halberdier', 'skirmisher', 'elite-skirmisher', 'camel', 'heavy-camel',
]);

export const CIV_BONUSES: readonly CivBonusEntry[] = [
  {
    civilization: 'Aztecs',
    trainTime: [{ applies: (unit) => unit !== 'villager', multiplier: 0.85 }],
  },
  {
    civilization: 'Berbers',
    // "Villagers move +10% faster" · "Ships move +10% faster" ·
    // "Stable units cost -20% (starting in Castle Age)".
    speed: [
      { applies: (unit) => unit === 'villager', multiplier: 1.1 },
      { applies: (unit) => SHIPS.has(unit), multiplier: 1.1 },
    ],
    cost: [{
      applies: (unit) => STABLE_UNITS.has(unit),
      multiplierByAge: { 'castle-age': 0.8, 'imperial-age': 0.8 },
    }],
  },
  {
    civilization: 'Britons',
    gatherRate: { sheep: 1.25 },
  },
  {
    civilization: 'Byzantines',
    // "Spearman skirmisher and camel lines cost 25% less".
    cost: [{ applies: (unit) => SPEAR_SKIRM_CAMEL.has(unit), multiplier: 0.75 }],
  },
  {
    civilization: 'Celts',
    // "Infantry moves 15% faster" · "Lumberjacks work 15% faster".
    gatherRate: { tree: 1.15 },
    speed: [{ applies: (unit) => isInfantryUnit(unit), multiplier: 1.15 }],
  },
  {
    civilization: 'Chinese',
    unitHp: [{ applies: (unit) => unit === 'demolition-ship' || unit === 'heavy-demolition-ship', multiplier: 1.5 }],
  },
  {
    civilization: 'Ethiopians',
    speed: [{ applies: (unit) => FOOT_ARCHER_LINE.has(unit) || unit === 'skirmisher' || unit === 'elite-skirmisher', multiplier: 1.15 }],
  },
  {
    civilization: 'Franks',
    unitHp: [{ applies: (unit) => KNIGHT_LINE.has(unit), multiplier: 1.2 }],
  },
  {
    civilization: 'Goths',
    buildingAttack: [{ applies: (unit) => isInfantryUnit(unit), bonus: 1 }],
    cost: [{
      applies: (unit) => isInfantryUnit(unit),
      multiplierByAge: { 'feudal-age': 0.65, 'castle-age': 0.65, 'imperial-age': 0.65 },
    }],
  },
  {
    civilization: 'Huns',
    cost: [{
      applies: (unit) => CAVALRY_ARCHER_LINE.has(unit),
      multiplierByAge: { 'castle-age': 0.75, 'imperial-age': 0.7 },
    }],
  },
  {
    civilization: 'Indians',
    // "Fishermen work 15% faster" · villager cost by age.
    gatherRate: { fish: 1.15 },
    cost: [{
      applies: (unit) => unit === 'villager',
      multiplierByAge: {
        'dark-age': 0.9, 'feudal-age': 0.85, 'castle-age': 0.8, 'imperial-age': 0.75,
      },
    }],
  },
  {
    civilization: 'Italians',
    cost: [
      { applies: (unit) => GUNPOWDER_UNITS.has(unit), multiplier: 0.75 },
      { applies: (unit) => unit === 'fishing-ship', woodDelta: -15 },
    ],
  },
  {
    civilization: 'Japanese',
    unitHp: [{ applies: (unit) => unit === 'fishing-ship', multiplier: 2 }],
  },
  {
    civilization: 'Koreans',
    gatherRate: { 'stone-mine': 1.2 },
  },
  {
    civilization: 'Magyars',
    cost: [{ applies: (unit) => SCOUT_LINE.has(unit), multiplier: 0.85 }],
  },
  {
    civilization: 'Mayans',
    cost: [{
      applies: (unit) => FOOT_ARCHER_LINE.has(unit),
      multiplierByAge: { 'feudal-age': 0.9, 'castle-age': 0.8, 'imperial-age': 0.7 },
    }],
  },
  {
    civilization: 'Mongols',
    gatherRate: { boar: 1.5 },
    unitHp: [{ applies: (unit) => unit === 'light-cavalry' || unit === 'hussar', multiplier: 1.3 }],
  },
  {
    civilization: 'Portuguese',
    unitHp: [{ applies: (unit) => SHIPS.has(unit), multiplier: 1.1 }],
    cost: [{ applies: () => true, goldMultiplier: 0.85 }],
  },
  {
    civilization: 'Saracens',
    unitHp: [{ applies: (unit) => unit === 'transport-ship', multiplier: 2 }],
    buildingAttack: [{ applies: (unit) => CAVALRY_ARCHER_LINE.has(unit), bonus: 4 }],
  },
  {
    civilization: 'Slavs',
    gatherRate: { farm: 1.15 },
  },
  {
    civilization: 'Turks',
    gatherRate: { 'gold-mine': 1.15 },
    unitHp: [{ applies: (unit) => GUNPOWDER_UNITS.has(unit), multiplier: 1.25 }],
  },
  {
    civilization: 'Vikings',
    cost: [{ applies: (unit) => WARSHIPS.has(unit), multiplier: 0.8 }],
  },
];

export function civBonusesFor(civilization: string | undefined): CivBonusEntry | undefined {
  if (civilization === undefined) return undefined;
  return CIV_BONUSES.find((entry) => entry.civilization === civilization);
}
