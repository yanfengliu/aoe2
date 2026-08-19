// Research cost and duration tables, extracted from prototypeEconomyRules.ts so
// that adding a technology does not push that file over its 500-LOC budget.
// Pure data; the accessor functions stay in the parent file and read these.

import type { PlayerResources, ResearchableTechnologyType } from './types';

export const RESEARCH_COSTS: Record<ResearchableTechnologyType, Partial<PlayerResources>> = {
  'feudal-age': { food: 500 },
  'castle-age': { food: 800, gold: 200 },
  'imperial-age': { food: 1000, gold: 800 },
  fletching: { food: 100, gold: 50 },
  'crossbowman-upgrade': { food: 125, gold: 75 },
  'pikeman-upgrade': { food: 215, gold: 90 },
  'light-cavalry-upgrade': { food: 150, gold: 50 },
  'arbalest-upgrade': { food: 300, gold: 300 },
  'halberdier-upgrade': { food: 300, gold: 600 },
  'hussar-upgrade': { food: 500, gold: 600 },
  'heavy-cavalry-archer-upgrade': { food: 750, gold: 600 },
  'cavalier-upgrade': { food: 300, gold: 300 },
  'champion-upgrade': { food: 1000, gold: 450 },
  'elite-longbowman-upgrade': { food: 850, gold: 750 },
  'onager-upgrade': { food: 800, wood: 500 },
  'heavy-scorpion-upgrade': { food: 1000, wood: 1100 },
  'siege-ram-upgrade': { food: 1000, wood: 800 },
  'siege-engineers': { food: 500, wood: 600 }, // Siege Workshop, Imperial: +1 siege range.
  sappers: { food: 400, gold: 200 }, // Blacksmith (AoE2 University), Imperial: +15 infantry attack vs buildings.
  bracer: { food: 450, gold: 300 },
  'blast-furnace': { food: 275, gold: 225 },
  'plate-mail-armor': { food: 300, gold: 150 },
  'plate-barding': { food: 350, gold: 200 },
  forging: { food: 150, gold: 50 },
  'scale-mail-armor': { food: 100 },
  'scale-barding-armor': { food: 150, gold: 50 },
  'padded-archer-armor': { food: 100, gold: 50 },
  'iron-casting': { food: 220, gold: 120 },
  'chain-mail-armor': { food: 200, gold: 100 },
  'chain-barding-armor': { food: 250, gold: 150 },
  'leather-archer-armor': { food: 150, gold: 150 },
  'bodkin-arrow': { food: 200, gold: 150 },
  'ring-archer-armor': { food: 250, gold: 250 },
  chemistry: { food: 300, gold: 200 },
  'man-at-arms-upgrade': { food: 100, gold: 40 },
  'long-swordsman-upgrade': { food: 200, gold: 65 },
  'two-handed-swordsman-upgrade': { food: 300, gold: 100 },
  'paladin-upgrade': { food: 1300, gold: 750 },
  'heavy-camel-upgrade': { food: 325, gold: 360 },
  'double-bit-axe': { wood: 50, food: 100 }, // Gather-rate techs (costs from technologies.csv).
  'bow-saw': { wood: 100, food: 150 },
  'two-man-saw': { wood: 200, food: 300 },
  'gold-mining': { food: 100, wood: 75 },
  'gold-shaft-mining': { food: 200, wood: 150 },
  'stone-mining': { food: 100, wood: 75 },
  'stone-shaft-mining': { food: 200, wood: 150 },
  // Economy carry-capacity techs (Town Center; costs from technologies.csv).
  wheelbarrow: { food: 175, wood: 50 },
  'hand-cart': { food: 305, wood: 200 },
  loom: { gold: 50 }, // technologies.csv:86.
  'guard-tower': { food: 100, gold: 50 }, // Watch Tower upgrades: Guard Tower / Keep.
  keep: { food: 200, gold: 100 },
  bloodlines: { food: 150, gold: 100 }, // Stable, Feudal: +20 mounted HP.
  husbandry: { food: 250 }, // Stable, Castle: +10% mounted speed (technologies.csv:79).
  squires: { food: 200 }, // Barracks, Castle: +10% infantry speed (technologies.csv:12).
  // Farm-food techs (Mill; technologies.csv — Horse Collar 75/75, Heavy Plow 125/125, Crop Rotation 250/250).
  'horse-collar': { food: 75, wood: 75 },
  'heavy-plow': { food: 125, wood: 125 },
  'crop-rotation': { food: 250, wood: 250 },
  'block-printing': { food: 100, gold: 130 }, // Monastery techs (BP 100f/130g, Sanctity 120g, Faith 750f/1000g, Herbal 350g).
  sanctity: { gold: 120 },
  faith: { food: 750, gold: 1000 },
  'herbal-medicine': { gold: 350 },
  heresy: { gold: 1000 },
  'town-watch': { food: 75 }, // LoS techs (technologies.csv rows 88/92/9).
  'town-patrol': { food: 300, gold: 200 },
  tracking: { food: 75 },
  conscription: { food: 150, gold: 150 }, // Castle, Imperial: military trains 25% faster.
  // Projectile techs (technologies.csv): Ballistics (University, Castle),
  // Thumb Ring (Archery Range, Castle).
  ballistics: { wood: 300, gold: 175 },
  'thumb-ring': { food: 300, wood: 250 },
};

export const RESEARCH_TIME_TICKS: Record<ResearchableTechnologyType, number> = {
  'feudal-age': 1300,
  'castle-age': 1600,
  'imperial-age': 1900,
  fletching: 300,
  'crossbowman-upgrade': 350,
  'pikeman-upgrade': 450,
  'light-cavalry-upgrade': 450,
  'arbalest-upgrade': 450,
  'halberdier-upgrade': 500,
  'hussar-upgrade': 500,
  'heavy-cavalry-archer-upgrade': 550,
  'cavalier-upgrade': 500,
  'champion-upgrade': 550,
  'elite-longbowman-upgrade': 550,
  'onager-upgrade': 600,
  'heavy-scorpion-upgrade': 550,
  'siege-ram-upgrade': 600,
  'siege-engineers': 700, // Siege Workshop, Imperial: 70 s × 10 TPS.
  sappers: 200, // Blacksmith, Imperial: quick 20 s research (AoE2 Sappers is a fast tech).
  bracer: 500,
  'blast-furnace': 600,
  'plate-mail-armor': 600,
  'plate-barding': 600,
  forging: 400,
  'scale-mail-armor': 400,
  'scale-barding-armor': 400,
  'padded-archer-armor': 400,
  'iron-casting': 500,
  'chain-mail-armor': 500,
  'chain-barding-armor': 500,
  'leather-archer-armor': 500,
  'bodkin-arrow': 500,
  'ring-archer-armor': 600,
  chemistry: 600,
  'man-at-arms-upgrade': 400,
  'long-swordsman-upgrade': 450,
  'two-handed-swordsman-upgrade': 500,
  'paladin-upgrade': 600,
  'heavy-camel-upgrade': 500,
  // Economy gather-rate techs (CSV research seconds × 10 TPS).
  'double-bit-axe': 250,
  'bow-saw': 500,
  'two-man-saw': 1000,
  'gold-mining': 300,
  'gold-shaft-mining': 750,
  'stone-mining': 300,
  'stone-shaft-mining': 750,
  wheelbarrow: 750, // Carry techs: CSV research seconds × 10 TPS.
  'hand-cart': 550,
  loom: 250, // technologies.csv:86 — 25 s × 10 TPS.
  'guard-tower': 300,
  keep: 400,
  bloodlines: 500, // Stable, Feudal: 50 s × 10 TPS.
  husbandry: 500, // Stable, Castle: 50 s × 10 TPS.
  squires: 400, // Barracks, Castle: 40 s × 10 TPS.
  'horse-collar': 200, // Mill farm-food techs (CSV seconds × 10 TPS — 20/40/70 s).
  'heavy-plow': 400,
  'crop-rotation': 700,
  'block-printing': 550, // Monastery techs (BP 55 s, Sanctity/Faith 60 s, Herbal 35 s × 10 TPS).
  sanctity: 600,
  faith: 600,
  'herbal-medicine': 350,
  heresy: 600,
  'town-watch': 250, // LoS techs — 25/40/35 s × 10 TPS (technologies.csv 88/92/9).
  'town-patrol': 400,
  tracking: 350,
  conscription: 600, // Castle, Imperial: 60 s × 10 TPS.
  ballistics: 600, // 60 s × 10 TPS.
  'thumb-ring': 450, // 45 s × 10 TPS.
};
