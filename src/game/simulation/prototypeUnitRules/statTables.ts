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
};

export const UNIT_MIN_ATTACK_RANGE = new Map<UnitType, number>([
  ['mangonel', 3],
  ['onager', 3],
  ['bombard-cannon', 5],
]);

export const UNIT_TINTS: Record<UnitType, UnitTintPalette> = {
  villager: { human: 0xf3e2b7, enemy: 0xf0b8b8 },
  scout: { human: 0xead74a, enemy: 0xef7d57 },
  militia: { human: 0xd39a5a, enemy: 0xd27c7c },
  spearman: { human: 0x8bb271, enemy: 0xc88770 },
  archer: { human: 0x84b6d7, enemy: 0xb38ad6 },
  skirmisher: { human: 0x8fc2c3, enemy: 0xc18fa8 },
  knight: { human: 0xa6a08d, enemy: 0xb27d67 },
  crossbowman: { human: 0x6fa0c7, enemy: 0x9e74c8 },
  pikeman: { human: 0x6f9c5a, enemy: 0xb76e58 },
  'light-cavalry': { human: 0xb89868, enemy: 0xc18a6a },
  camel: { human: 0xd8c18a, enemy: 0xc49278 },
  'cavalry-archer': { human: 0x7e8fb0, enemy: 0xa07294 },
  mangonel: { human: 0x8b6d4a, enemy: 0x8a564b },
  scorpion: { human: 0x9a854e, enemy: 0x996453 },
  'battering-ram': { human: 0x6e543a, enemy: 0x6e4239 },
  monk: { human: 0xe3d9b5, enemy: 0xd6aab6 },
  longbowman: { human: 0x5f9057, enemy: 0xa86d91 },
  arbalest: { human: 0x4f82b0, enemy: 0x7f58b0 },
  halberdier: { human: 0x5a8848, enemy: 0xa35744 },
  hussar: { human: 0xa3824e, enemy: 0xab7250 },
  'heavy-cavalry-archer': { human: 0x637693, enemy: 0x8a5a7c },
  cavalier: { human: 0x8d8770, enemy: 0x9a6553 },
  champion: { human: 0xbe8b4c, enemy: 0xbc6a5c },
  'elite-longbowman': { human: 0x4d7645, enemy: 0x8f5578 },
  onager: { human: 0x77593a, enemy: 0x76493b },
  'heavy-scorpion': { human: 0x836c3a, enemy: 0x81503f },
  'siege-ram': { human: 0x574230, enemy: 0x5a3830 },
  'bombard-cannon': { human: 0x2f2f34, enemy: 0x3d2a2a },
  trebuchet: { human: 0x6c553a, enemy: 0x6a3d31 },
  'man-at-arms': { human: 0xc68955, enemy: 0xca7570 },
  'long-swordsman': { human: 0xba7e50, enemy: 0xc1685f },
  'two-handed-swordsman': { human: 0xae7140, enemy: 0xb95e55 },
  paladin: { human: 0x7e7a68, enemy: 0x88584a },
  'heavy-camel': { human: 0xbfa874, enemy: 0xae7f64 },
};

export const UNIT_SIZES: Record<UnitType, number> = {
  villager: 0.45,
  scout: 0.55,
  militia: 0.5,
  spearman: 0.5,
  archer: 0.48,
  skirmisher: 0.48,
  knight: 0.58,
  crossbowman: 0.48,
  pikeman: 0.5,
  'light-cavalry': 0.56,
  camel: 0.57,
  'cavalry-archer': 0.55,
  mangonel: 0.68,
  scorpion: 0.6,
  'battering-ram': 0.75,
  monk: 0.48,
  longbowman: 0.5,
  arbalest: 0.5,
  halberdier: 0.52,
  hussar: 0.57,
  'heavy-cavalry-archer': 0.57,
  cavalier: 0.6,
  champion: 0.52,
  'elite-longbowman': 0.52,
  onager: 0.72,
  'heavy-scorpion': 0.62,
  'siege-ram': 0.8,
  'bombard-cannon': 0.72,
  trebuchet: 0.85,
  'man-at-arms': 0.5,
  'long-swordsman': 0.51,
  'two-handed-swordsman': 0.52,
  paladin: 0.62,
  'heavy-camel': 0.58,
};

export const UNIT_VISION_RADIUS: Record<UnitType, number> = {
  villager: 4,
  scout: 4,
  militia: 3,
  spearman: 3,
  archer: 5,
  skirmisher: 5,
  knight: 4,
  crossbowman: 5,
  pikeman: 3,
  'light-cavalry': 6,
  camel: 4,
  'cavalry-archer': 5,
  mangonel: 9,
  scorpion: 9,
  'battering-ram': 3,
  monk: MONK_VISION_RADIUS,
  longbowman: 7,
  arbalest: 5,
  halberdier: 3,
  hussar: 11,
  'heavy-cavalry-archer': 5,
  cavalier: 4,
  champion: 4,
  'elite-longbowman': 8,
  onager: 10,
  'heavy-scorpion': 9,
  'siege-ram': 3,
  'bombard-cannon': 13,
  trebuchet: 16,
  'man-at-arms': 3,
  'long-swordsman': 3,
  'two-handed-swordsman': 3,
  paladin: 5,
  'heavy-camel': 4,
};

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

export const CAVALRY_TARGETS = new Set<UnitType>([
  'scout',
  'light-cavalry',
  'knight',
  'hussar',
  'cavalier',
  'paladin',
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

export const LIGHT_CAVALRY_TARGETS = new Set<UnitType>(['scout', 'light-cavalry']);

export const HEAVY_CAVALRY_TARGETS = new Set<UnitType>(['knight']);

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

export const MANGONEL_INFANTRY_TARGETS = new Set<UnitType>([
  'militia',
  'spearman',
  'pikeman',
  'villager',
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

