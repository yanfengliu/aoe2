// Stat tables extracted from prototypeUnitRules.ts to keep that file
// under 500 LOC. Pure data + small constant helpers; the accessor
// functions stay in the parent file and read from these exports.

import type { ResourceKind, UnitType } from '../types';

export interface WildlifeProfile {
  currentHp: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
  armor: number;
  // Mirrors CombatState.pierceArmorBonus (wildlife carry no armor techs → 0).
  pierceArmorBonus: number;
  autoAggro: boolean;
  isAlive: boolean;
  corpsePersists: boolean;
  aggroRange: number;
  targetEntityRef: null;
}

export interface UnitTintPalette {
  human: number;
  enemy: number;
}

export const MELEE_ATTACK_RANGE = 1;
export const MONK_VISION_RADIUS = 9;

export const UNIT_MAX_HP: Record<UnitType, number> = {
  villager: 25,
  scout: 45,
  militia: 40,
  spearman: 45,
  archer: 30,
  skirmisher: 30,
  knight: 100,
  crossbowman: 35,
  pikeman: 55,
  'light-cavalry': 60,
  camel: 100,
  'cavalry-archer': 50,
  mangonel: 50,
  scorpion: 40,
  'battering-ram': 175,
  monk: 30,
  longbowman: 35,
  arbalest: 40,
  halberdier: 60,
  hussar: 75,
  'heavy-cavalry-archer': 60,
  cavalier: 120,
  champion: 70,
  'elite-longbowman': 40,
  onager: 60,
  'heavy-scorpion': 50,
  'siege-ram': 270,
  'bombard-cannon': 80,
  trebuchet: 150,
  'man-at-arms': 50,
  'long-swordsman': 60,
  'two-handed-swordsman': 65,
  paladin: 160,
  'heavy-camel': 120,
  'fishing-ship': 60,
  'galley': 120,
  'war-galley': 135,
  'galleon': 165,
  'fire-ship': 100,
  'fast-fire-ship': 120,
  'demolition-ship': 50,
  'heavy-demolition-ship': 60,
  'cannon-galleon': 120,
  'elite-cannon-galleon': 150,
};

export const UNIT_ATTACK_DAMAGE: Record<UnitType, number> = {
  villager: 3,
  scout: 3,
  militia: 4,
  spearman: 3,
  archer: 4,
  skirmisher: 2,
  knight: 10,
  crossbowman: 5,
  pikeman: 4,
  'light-cavalry': 7,
  camel: 5,
  'cavalry-archer': 6,
  mangonel: 40,
  scorpion: 12,
  'battering-ram': 2,
  monk: 0,
  longbowman: 6,
  arbalest: 6,
  halberdier: 6,
  hussar: 7,
  'heavy-cavalry-archer': 7,
  cavalier: 12,
  champion: 13,
  'elite-longbowman': 7,
  onager: 50,
  'heavy-scorpion': 16,
  'siege-ram': 3,
  'bombard-cannon': 40,
  trebuchet: 200,
  'man-at-arms': 6,
  'long-swordsman': 9,
  'two-handed-swordsman': 11,
  paladin: 14,
  'heavy-camel': 7,
  'fishing-ship': 0,
  'galley': 6,
  'war-galley': 7,
  'galleon': 8,
  'fire-ship': 2,
  'fast-fire-ship': 3,
  'demolition-ship': 110,
  'heavy-demolition-ship': 140,
  'cannon-galleon': 35,
  'elite-cannon-galleon': 45,
};

// Base PIERCE armor per unit, from design/stats/units.csv (the `melee/pierce`
// armor column, second value). Data-driven combat Slice 1: pierce attacks
// (archers/skirmishers/siege/towers) are reduced by this instead of the single
// melee `armor`. The standouts drive AoE2 counter-play: skirmishers (3) shrug
// off archer fire, rams (180+) are near-immune to arrows, cavalry/scout line
// carry 2. Melee base armor stays 0 here (unchanged prototype behaviour); the
// CSV's melee column + armor classes are Slice 2.
export const UNIT_PIERCE_ARMOR: Record<UnitType, number> = {
  villager: 0,
  scout: 2,
  militia: 1,
  spearman: 0,
  archer: 0,
  skirmisher: 3,
  knight: 2,
  crossbowman: 0,
  pikeman: 0,
  'light-cavalry': 2,
  camel: 0,
  'cavalry-archer': 0,
  mangonel: 6,
  scorpion: 6,
  'battering-ram': 180,
  monk: 0,
  longbowman: 0,
  arbalest: 0,
  halberdier: 0,
  hussar: 2,
  'heavy-cavalry-archer': 0,
  cavalier: 2,
  champion: 1,
  'elite-longbowman': 1,
  onager: 7,
  'heavy-scorpion': 7,
  'siege-ram': 195,
  'bombard-cannon': 5,
  trebuchet: 150,
  'man-at-arms': 1,
  'long-swordsman': 1,
  'two-handed-swordsman': 1,
  paladin: 3,
  'heavy-camel': 0,
  'fishing-ship': 6,
  'galley': 6,
  'war-galley': 6,
  'galleon': 8,
  'fire-ship': 6,
  'fast-fire-ship': 8,
  'demolition-ship': 3,
  'heavy-demolition-ship': 3,
  'cannon-galleon': 6,
  'elite-cannon-galleon': 8,
};

// Base MELEE armor per unit, from design/stats/units.csv (the `melee/pierce`
// armor column, FIRST value). Data-driven combat Slice 2a: melee attacks are
// reduced by this base value plus the unit's armor-tech bonus. Mostly 0; the
// standouts are the cavalry line (knight/cavalier/paladin 2 — meaty vs melee)
// plus champion / trebuchet / heavy-cavalry-archer 1 and bombard cannon 2.
export const UNIT_MELEE_ARMOR: Record<UnitType, number> = {
  villager: 0,
  scout: 0,
  militia: 0,
  spearman: 0,
  archer: 0,
  skirmisher: 0,
  knight: 2,
  crossbowman: 0,
  pikeman: 0,
  'light-cavalry': 0,
  camel: 0,
  'cavalry-archer': 0,
  mangonel: 0,
  scorpion: 0,
  'battering-ram': 0,
  monk: 0,
  longbowman: 0,
  arbalest: 0,
  halberdier: 0,
  hussar: 0,
  'heavy-cavalry-archer': 1,
  cavalier: 2,
  champion: 1,
  'elite-longbowman': 0,
  onager: 0,
  'heavy-scorpion': 0,
  'siege-ram': 0,
  'bombard-cannon': 2,
  trebuchet: 1,
  'man-at-arms': 0,
  'long-swordsman': 0,
  'two-handed-swordsman': 0,
  paladin: 2,
  'heavy-camel': 0,
  'fishing-ship': 0,
  'galley': 0,
  'war-galley': 0,
  'galleon': 0,
  'fire-ship': 0,
  'fast-fire-ship': 0,
  'demolition-ship': 0,
  'heavy-demolition-ship': 0,
  'cannon-galleon': 0,
  'elite-cannon-galleon': 0,
};

export const UNIT_RELOAD_TICKS: Record<UnitType, number> = {
  villager: 12,
  scout: 12,
  militia: 10,
  spearman: 10,
  archer: 20,
  skirmisher: 20,
  knight: 18,
  crossbowman: 20,
  pikeman: 10,
  'light-cavalry': 12,
  camel: 20,
  'cavalry-archer': 20,
  mangonel: 60,
  scorpion: 35,
  'battering-ram': 50,
  monk: 10,
  longbowman: 20,
  arbalest: 20,
  halberdier: 30,
  hussar: 20,
  'heavy-cavalry-archer': 20,
  cavalier: 18,
  champion: 20,
  'elite-longbowman': 20,
  onager: 60,
  'heavy-scorpion': 35,
  'siege-ram': 50,
  'bombard-cannon': 70,
  trebuchet: 100,
  'man-at-arms': 20,
  'long-swordsman': 20,
  'two-handed-swordsman': 20,
  paladin: 18,
  'heavy-camel': 20,
  'fishing-ship': 20,
  'galley': 30,
  'war-galley': 30,
  'galleon': 30,
  'fire-ship': 3,
  'fast-fire-ship': 3,
  'demolition-ship': 10,
  'heavy-demolition-ship': 10,
  'cannon-galleon': 100,
  'elite-cannon-galleon': 100,
};

export const UNIT_ATTACK_RANGE: Record<UnitType, number> = {
  villager: MELEE_ATTACK_RANGE,
  scout: MELEE_ATTACK_RANGE,
  militia: MELEE_ATTACK_RANGE,
  spearman: MELEE_ATTACK_RANGE,
  archer: 4,
  skirmisher: 4,
  knight: MELEE_ATTACK_RANGE,
  crossbowman: 5,
  pikeman: MELEE_ATTACK_RANGE,
  'light-cavalry': MELEE_ATTACK_RANGE,
  camel: MELEE_ATTACK_RANGE,
  'cavalry-archer': 4,
  mangonel: 7,
  scorpion: 7,
  'battering-ram': MELEE_ATTACK_RANGE,
  monk: 0,
  longbowman: 6,
  arbalest: 5,
  halberdier: MELEE_ATTACK_RANGE,
  hussar: MELEE_ATTACK_RANGE,
  'heavy-cavalry-archer': 4,
  cavalier: MELEE_ATTACK_RANGE,
  champion: MELEE_ATTACK_RANGE,
  'elite-longbowman': 6,
  onager: 8,
  'heavy-scorpion': 7,
  'siege-ram': MELEE_ATTACK_RANGE,
  'bombard-cannon': 12,
  trebuchet: 16,
  'man-at-arms': MELEE_ATTACK_RANGE,
  'long-swordsman': MELEE_ATTACK_RANGE,
  'two-handed-swordsman': MELEE_ATTACK_RANGE,
  paladin: MELEE_ATTACK_RANGE,
  'heavy-camel': MELEE_ATTACK_RANGE,
  'fishing-ship': MELEE_ATTACK_RANGE,
  'galley': 5,
  'war-galley': 6,
  'galleon': 7,
  'fire-ship': 2,
  'fast-fire-ship': 2,
  'demolition-ship': 1,
  'heavy-demolition-ship': 1,
  'cannon-galleon': 13,
  'elite-cannon-galleon': 15,
};

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

