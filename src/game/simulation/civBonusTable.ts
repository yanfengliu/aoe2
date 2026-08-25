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
  /** Flat carry-capacity bonus: all villagers, or one resource kind's
   *  gatherers (Goths hunters). Composes with Wheelbarrow's multiplier. */
  readonly carryBonus?: ReadonlyArray<{
    readonly kind?: ResourceKind;
    readonly bonus: number;
  }>;
  /** Extra population a building type supports (Chinese TCs, Inca houses). */
  readonly populationProvided?: Readonly<Partial<Record<string, number>>>;
  /** Opening adjustments: resources added (may be negative) and extra
   *  starting units beside the Town Center. */
  readonly startingResourcesDelta?: Readonly<Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>>>;
  /** Paid into the stockpile each time an age advance completes. */
  readonly ageAdvanceResourceGrant?: Readonly<Partial<Record<'food' | 'wood' | 'gold' | 'stone', number>>>;
  readonly extraStartingUnits?: ReadonlyArray<{ readonly kind: UnitType | 'sheep'; readonly count: number }>;
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
  /** Building-cost rules: whole-cost or single-component multipliers. */
  readonly buildingCost?: ReadonlyArray<{
    readonly applies: (buildingType: string) => boolean;
    readonly multiplier?: number;
    readonly woodMultiplier?: number;
    readonly stoneMultiplier?: number;
  }>;
  /** Building max-HP multipliers (Persians' Town Centers and Docks). */
  readonly buildingHp?: ReadonlyArray<{
    readonly applies: (buildingType: string) => boolean;
    readonly multiplier: number;
  }>;
  /** True: population is never limited by housing (Huns). */
  readonly houselessPopulation?: boolean;
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
    carryBonus: [{ bonus: 5 }], // "Villagers carry +5".
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
    // "Start game with 3 extra villagers but -50 wood and -200 food" ·
    // "Town Centers support 10 population instead of 5".
    startingResourcesDelta: { wood: -50, food: -200 },
    extraStartingUnits: [{ kind: 'villager', count: 3 }],
    populationProvided: { 'town-center': 5 },
  },
  {
    civilization: 'Ethiopians',
    speed: [{ applies: (unit) => FOOT_ARCHER_LINE.has(unit) || unit === 'skirmisher' || unit === 'elite-skirmisher', multiplier: 1.15 }],
    // "Receive +100 gold and +100 food when advancing to the next age."
    ageAdvanceResourceGrant: { food: 100, gold: 100 },
  },
  {
    civilization: 'Franks',
    unitHp: [{ applies: (unit) => KNIGHT_LINE.has(unit), multiplier: 1.2 }],
    buildingCost: [{ applies: (building) => building === 'castle', multiplier: 0.75 }],
  },
  {
    civilization: 'Goths',
    carryBonus: [{ kind: 'boar', bonus: 15 }], // "Hunters carry +15 meat".
    buildingAttack: [{ applies: (unit) => isInfantryUnit(unit), bonus: 1 }],
    cost: [{
      applies: (unit) => isInfantryUnit(unit),
      multiplierByAge: { 'feudal-age': 0.65, 'castle-age': 0.65, 'imperial-age': 0.65 },
    }],
  },
  {
    civilization: 'Huns',
    houselessPopulation: true, // "Houses are not required to support population".
    startingResourcesDelta: { wood: -100 }, // "Start game with -100 Wood".
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
    buildingCost: [{
      applies: (building) => building === 'mill' || building === 'lumber-camp' || building === 'mining-camp',
      multiplier: 0.5,
    }],
  },
  {
    civilization: 'Koreans',
    gatherRate: { 'stone-mine': 1.2 },
  },
  {
    civilization: 'Malians',
    buildingCost: [{ applies: () => true, woodMultiplier: 0.85 }],
  },
  {
    civilization: 'Magyars',
    cost: [{ applies: (unit) => SCOUT_LINE.has(unit), multiplier: 0.85 }],
  },
  {
    civilization: 'Mayans',
    // "Start game with 1 extra villager but -50 food".
    startingResourcesDelta: { food: -50 },
    extraStartingUnits: [{ kind: 'villager', count: 1 }],
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
    civilization: 'Persians',
    startingResourcesDelta: { wood: 50, food: 50 }, // "+50 wood and food".
    buildingHp: [{
      applies: (building) => building === 'town-center' || building === 'dock',
      multiplier: 2,
    }],
  },
  {
    civilization: 'Teutons',
    buildingCost: [{ applies: (building) => building === 'farm', multiplier: 0.67 }],
  },
  {
    civilization: 'Incas',
    // "Start with a free llama" (a herdable — this build's sheep) ·
    // "Houses support 10 population".
    extraStartingUnits: [{ kind: 'sheep', count: 1 }],
    populationProvided: { house: 5 },
    buildingCost: [{ applies: () => true, stoneMultiplier: 0.85 }],
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

// "X free" (spec §9.2): the technology researches ITSELF, instantly and at no
// cost, the moment the owner could legally research it — its age reached and a
// building standing whose menu offers it. AoE2's own rule (Franks farm
// upgrades wait for a Mill; Viking carts arrive with the age), and the reason
// the free-tech system checks the same research MENU a player would click.
export const CIV_FREE_TECHNOLOGIES: Readonly<Record<string, readonly import('./technologyTypes').ResearchableTechnologyType[]>> = {
  Aztecs: ['loom'],
  Byzantines: ['town-watch'],
  Franks: ['horse-collar', 'heavy-plow', 'crop-rotation'],
  Koreans: ['guard-tower', 'keep'],
  Teutons: ['murder-holes'],
  Turks: ['chemistry', 'light-cavalry-upgrade', 'hussar-upgrade'],
  Vikings: ['wheelbarrow', 'hand-cart'],
  Burmese: ['double-bit-axe', 'bow-saw', 'two-man-saw'],
  Ethiopians: ['pikeman-upgrade', 'halberdier-upgrade'],
  Magyars: ['forging', 'iron-casting', 'blast-furnace'],
  Malians: ['gold-mining', 'gold-shaft-mining'],
  Slavs: ['tracking'],
};

export function civBonusesFor(civilization: string | undefined): CivBonusEntry | undefined {
  if (civilization === undefined) return undefined;
  return CIV_BONUSES.find((entry) => entry.civilization === civilization);
}
