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
  /** Multiplier for the FOOD component alone, by age (Incas). */
  readonly foodMultiplierByAge?: Partial<Record<AgeType, number>>;
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
  /** Added to the hard population limit once the owner reaches Imperial. */
  readonly imperialPopulationBonus?: number;
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
const SIEGE_UNITS = new Set<UnitType>(['battering-ram', 'capped-ram', 'siege-ram', 'mangonel', 'onager', 'siege-onager', 'scorpion', 'heavy-scorpion', 'bombard-cannon', 'petard', 'trebuchet']);
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
    carryBonus: [{ bonus: 3 }], // DE: "Villagers carry +3" (sourced v0.3.144).
    startingResourcesDelta: { gold: 50 }, // DE: "Start with +50 gold".
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
      multiplierByAge: { 'castle-age': 0.85, 'imperial-age': 0.8 }, // DE: -15/20%.
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
    // DE: "+3 Villagers, -50 wood, -200 food" · "Town Centers +7 line of
    // sight and provide +15 population space" (demo-ship HP is DE-dead).
    startingResourcesDelta: { wood: -50, food: -200 },
    extraStartingUnits: [{ kind: 'villager', count: 3 }],
    populationProvided: { 'town-center': 15 },
  },
  {
    civilization: 'Ethiopians',
    // DE's bonus is foot archers ATTACK +18% faster — a reload bonus, not
    // move speed (the CSV's transcription error shipped as speed until
    // v0.3.144); the reload seam lands it in the follow-up batch.
    // "Receive +100 gold and +100 food when advancing to the next age."
    ageAdvanceResourceGrant: { food: 100, gold: 100 },
  },
  {
    civilization: 'Franks',
    // DE: "Foragers work +15% faster" (sourced v0.3.146). The mounted +20%
    // HP rides the Feudal-gated age ladder (ageScaledHp, v0.3.148).
    gatherRate: { 'berry-bush': 1.15 },
    buildingCost: [{ applies: (building) => building === 'castle', multiplier: 0.75 }],
  },
  {
    civilization: 'Goths',
    carryBonus: [{ kind: 'boar', bonus: 15 }], // "Hunters carry +15 meat".
    imperialPopulationBonus: 10, // "+10 to population limit in Imperial Age".
    buildingAttack: [{ applies: (unit) => isInfantryUnit(unit), bonus: 1 }],
    cost: [{
      applies: (unit) => isInfantryUnit(unit),
      // DE (sourced v0.3.146): -15/20/25/30% in Dark/Feudal/Castle/Imperial.
      multiplierByAge: { 'dark-age': 0.85, 'feudal-age': 0.8, 'castle-age': 0.75, 'imperial-age': 0.7 },
    }],
  },
  {
    civilization: 'Huns',
    houselessPopulation: true, // "Houses are not required to support population".
    startingResourcesDelta: { wood: -100 }, // "Start game with -100 Wood".
    cost: [{
      applies: (unit) => CAVALRY_ARCHER_LINE.has(unit),
      multiplierByAge: { 'castle-age': 0.9, 'imperial-age': 0.8 }, // DE: -10/20%.
    }],
  },
  {
    civilization: 'Indians',
    // DE (Hindustanis): villagers -8/13/18/23% by age; the old fisherman
    // bonus is DE-dead.
    cost: [{
      applies: (unit) => unit === 'villager',
      multiplierByAge: {
        'dark-age': 0.92, 'feudal-age': 0.87, 'castle-age': 0.82, 'imperial-age': 0.77,
      },
    }],
  },
  {
    civilization: 'Italians',
    cost: [
      { applies: (unit) => GUNPOWDER_UNITS.has(unit), multiplier: 0.8 }, // DE: -20%.
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
    // DE: "Villagers drop off +10% more gold" — the nearest existing seam is
    // the gather rate; the free mining techs it replaced are gone.
    gatherRate: { 'gold-mine': 1.1 },
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
    gatherRate: { boar: 1.4 }, // DE: hunters +40%.
    // The scout-line +20/30% HP rides the Castle/Imperial age ladder
    // (ageScaledHp, v0.3.148).
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
    buildingCost: [{ applies: (building) => building === 'farm', multiplier: 0.6 }], // DE: -40%.
  },
  {
    civilization: 'Incas',
    // "Start with a free llama" (a herdable — this build's sheep) ·
    // "Houses support 10 population" · DE (sourced v0.3.145): "Military
    // Units cost -15/20/25/30% food" by age.
    extraStartingUnits: [{ kind: 'sheep', count: 1 }],
    populationProvided: { house: 5 },
    buildingCost: [{ applies: () => true, stoneMultiplier: 0.85 }],
    cost: [{
      applies: (unit) => unit !== 'villager' && unit !== 'trade-cart' && unit !== 'fishing-ship' && unit !== 'trade-cog' && unit !== 'transport-ship',
      foodMultiplierByAge: { 'dark-age': 0.85, 'feudal-age': 0.8, 'castle-age': 0.75, 'imperial-age': 0.7 },
    }],
  },
  {
    civilization: 'Portuguese',
    // Ship +10/15/20% HP rides the age ladder (ageScaledHp, v0.3.148).
    cost: [{ applies: () => true, goldMultiplier: 0.8 }], // DE: -20% gold.
  },
  {
    civilization: 'Saracens',
    unitHp: [
      { applies: (unit) => unit === 'transport-ship', multiplier: 2 },
      // DE: "Camel Units +25% HP" (the old CA +4 vs buildings is DE-dead).
      { applies: (unit) => unit === 'camel' || unit === 'heavy-camel', multiplier: 1.25 },
    ],
  },
  {
    civilization: 'Slavs',
    gatherRate: { farm: 1.15 },
    // DE: "Monks move +20% faster" (sourced v0.3.146).
    speed: [{ applies: (unit) => unit === 'monk', multiplier: 1.2 }],
    // DE: "Siege Workshop Units cost -15%" — in the CSV since v0.3.81, in
    // the table since v0.3.144.
    cost: [{ applies: (unit) => SIEGE_UNITS.has(unit), multiplier: 0.85 }],
  },
  {
    civilization: 'Turks',
    gatherRate: { 'gold-mine': 1.25 }, // DE: gold miners +25%.
    unitHp: [{ applies: (unit) => GUNPOWDER_UNITS.has(unit), multiplier: 1.25 }],
  },
  {
    civilization: 'Vikings',
    cost: [{
      applies: (unit) => WARSHIPS.has(unit),
      // DE: -10/15/20% in Feudal/Castle/Imperial.
      multiplierByAge: { 'feudal-age': 0.9, 'castle-age': 0.85, 'imperial-age': 0.8 },
    }],
  },
];

// "X free" (spec §9.2): the technology researches ITSELF, instantly and at no
// cost, the moment the owner could legally research it — its age reached and a
// building standing whose menu offers it. AoE2's own rule (Franks farm
// upgrades wait for a Mill; Viking carts arrive with the age), and the reason
// the free-tech system checks the same research MENU a player would click.
export const CIV_FREE_TECHNOLOGIES: Readonly<Record<string, readonly import('./technologyTypes').ResearchableTechnologyType[]>> = {
  Byzantines: ['town-watch', 'town-patrol'], // DE frees both.
  Franks: ['horse-collar', 'heavy-plow', 'crop-rotation'],
  Koreans: ['guard-tower', 'keep', 'padded-archer-armor', 'leather-archer-armor', 'ring-archer-armor'],
  Teutons: ['murder-holes', 'herbal-medicine'], // DE frees both.
  Turks: ['chemistry', 'light-cavalry-upgrade', 'hussar-upgrade'],
  Vikings: ['wheelbarrow', 'hand-cart'],
  Vietnamese: ['conscription'], // DE: Conscription free.
  Burmese: ['double-bit-axe', 'bow-saw', 'two-man-saw'],
  Ethiopians: ['pikeman-upgrade'], // DE frees the Pikeman upgrade only.
  Magyars: ['forging', 'iron-casting', 'blast-furnace'],
};

export function civBonusesFor(civilization: string | undefined): CivBonusEntry | undefined {
  if (civilization === undefined) return undefined;
  return CIV_BONUSES.find((entry) => entry.civilization === civilization);
}
