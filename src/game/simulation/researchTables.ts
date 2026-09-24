// Research cost and duration tables, extracted from prototypeEconomyRules.ts so
// that adding a technology does not push that file over its 500-LOC budget.
// Pure data; the accessor functions stay in the parent file and read these.

import type { PlayerResources, ResearchableTechnologyType } from './types';

// SOURCING NOTE for Sultans and Carrack (2026-09-01), and it is a correction.
//
// The rows for Shatagni, Recurve Bow, Farimba and Kasbah were checked against
// the wiki when they were written, and two of them changed as a result
// (Shatagni is +2 range, not +1). Sultans and Carrack were NOT: their numbers
// came from model knowledge of AoE2 DE, and the comments originally read
// "(wiki: ...)" as though a source had been consulted. That claim was wrong and
// is retracted here rather than left to be trusted.
//
// The values are plausible and the effects are right in kind, but the exact
// costs and research times need checking against the wiki before either is
// treated as conformant. `design/stats/technologies.csv` carries no row for
// any expansion-civilization unique technology, so the repo cannot settle it
// either — see the 2026-09-01 defect-register entry on the content gap being a
// DATA gap.
// Every row with a technologies.csv row is that row's cost, and RESEARCH_TIME_TICKS
// its research time x TPS; the CSV's costs and times are Definitive Edition's
// (sourced 2026-09-23, pinned in the CSV's header).
// tests/content/trainAndResearchCostsAndTimes.test.ts holds every row to it, so
// no comment here restates a value: a restated number goes stale when the CSV moves.
export const RESEARCH_COSTS: Record<ResearchableTechnologyType, Partial<PlayerResources>> = {
  'feudal-age': { food: 500 },
  'castle-age': { food: 800, gold: 200 },
  'imperial-age': { food: 1000, gold: 800 },
  fletching: { food: 100, gold: 50 },
  'crossbowman-upgrade': { food: 175, gold: 100 },
  'pikeman-upgrade': { food: 160, gold: 90 },
  'light-cavalry-upgrade': { food: 150, gold: 50 },
  'arbalest-upgrade': { food: 450, gold: 350 },
  'halberdier-upgrade': { food: 300, gold: 600 },
  'hussar-upgrade': { food: 500, gold: 600 },
  'heavy-cavalry-archer-upgrade': { food: 900, gold: 500 },
  'cavalier-upgrade': { food: 300, gold: 300 },
  'champion-upgrade': { food: 650, gold: 350 },
  'elite-longbowman-upgrade': { food: 850, gold: 850 },
  'onager-upgrade': { food: 800, gold: 500 },
  'heavy-scorpion-upgrade': { food: 800, wood: 750 },
  'siege-ram-upgrade': { food: 1000 },
  'capped-ram-upgrade': { food: 300 },
  'siege-onager-upgrade': { food: 1450, gold: 1000 },
  'elite-skirmisher-upgrade': { wood: 230, gold: 130 },
  'elite-eagle-warrior-upgrade': { food: 800, gold: 500 },
  'siege-engineers': { food: 500, wood: 600 }, // University, Imperial: +1 siege range.
  sappers: { food: 400, wood: 200 },
  // Castle (technologies.csv): Hoardings toughens castles, El Dorado is the
  // Mayans' Imperial unique technology.
  hoardings: { food: 400, wood: 400 },
  // Market (technologies.csv): see what your allies see.
  guilds: { food: 300, gold: 200 },
  // Market (technologies.csv): the tribute fee, 30% to 20% to nothing.
  coinage: { food: 200, gold: 100 },
  caravan: { food: 200, gold: 200 }, // Market, Castle: Trade Carts 50% faster.
  // Castle, Imperial. The table holds the FLOOR; the real Spies charge is
  // dynamic — 200 gold per living enemy villager (spiesRules.ts).
  spies: { gold: 200 },
  atheism: { food: 500, wood: 300 }, // Huns, Imperial (technologies.csv).
  banking: { food: 300, gold: 200 },
  // Vikings, Castle (technologies.csv): Berserks regenerate twice as fast.
  berserkergang: { food: 500, gold: 850 }, // DE has no Berserkergang (Bogsveigar holds its slot), so this is the CSV's earlier value.
  'el-dorado': { food: 750, gold: 450 },
  // The three below are the first of the twelve expansion civilizations'
  // unique technologies. Costs and effects verified against the wiki rather
  // than written from memory, per the standing lesson — and memory would have
  // been wrong: Shatagni is +2 range, not +1.
  shatagni: { food: 500, gold: 650 },
  'recurve-bow': { wood: 600, gold: 400 },
  farimba: { food: 650, gold: 400 },
  kasbah: { food: 250, gold: 250 }, // Blacksmith (AoE2 University), Imperial: +15 infantry attack vs buildings.
  sultans: { gold: 400 }, // Castle, Castle Age: +10% gold generation. UNVERIFIED (see below).
  carrack: { wood: 200, gold: 200 }, // Castle, Castle Age: all ships +1/+1 armour. UNVERIFIED (see below).
  bracer: { food: 300, gold: 200 },
  'blast-furnace': { food: 275, gold: 225 },
  'plate-mail-armor': { food: 300, gold: 150 },
  'plate-barding': { food: 350, gold: 200 },
  forging: { food: 150 },
  'scale-mail-armor': { food: 100 },
  'scale-barding-armor': { food: 150 },
  'padded-archer-armor': { food: 100 },
  'iron-casting': { food: 220, gold: 120 },
  'chain-mail-armor': { food: 200, gold: 100 },
  'chain-barding-armor': { food: 250, gold: 150 },
  'leather-archer-armor': { food: 150, gold: 150 },
  'bodkin-arrow': { food: 200, gold: 100 },
  'ring-archer-armor': { food: 250, gold: 250 },
  chemistry: { food: 300, gold: 200 },
  'man-at-arms-upgrade': { food: 100, gold: 40 },
  'long-swordsman-upgrade': { food: 150, gold: 65 },
  'two-handed-swordsman-upgrade': { food: 200, gold: 100 },
  'paladin-upgrade': { food: 1300, gold: 750 },
  'heavy-camel-upgrade': { food: 325, gold: 360 },
  'double-bit-axe': { wood: 50, food: 100 }, // Gather-rate techs (costs from technologies.csv).
  'bow-saw': { wood: 100, food: 150 },
  'two-man-saw': { wood: 200, food: 300 },
  'gold-mining': { food: 100, wood: 75 },
  'gold-shaft-mining': { food: 175, wood: 75 },
  'stone-mining': { food: 100, wood: 75 },
  'stone-shaft-mining': { food: 175, wood: 75 },
  // Economy carry-capacity techs (Town Center; costs from technologies.csv).
  wheelbarrow: { food: 175, wood: 50 },
  'hand-cart': { food: 300, wood: 200 },
  loom: { gold: 50 },
  'guard-tower': { food: 100, wood: 250 }, // University upgrades of the Watch Tower: Guard Tower / Keep.
  keep: { food: 500, wood: 350 },
  bloodlines: { food: 150, gold: 100 }, // Stable, Feudal: +20 mounted HP.
  husbandry: { food: 150 }, // Stable, Castle: +10% mounted speed.
  squires: { food: 100 }, // Barracks, Castle: +10% infantry speed.
  // Farm-food techs (Mill).
  'horse-collar': { food: 75, wood: 75 },
  'heavy-plow': { food: 125, wood: 125 },
  'crop-rotation': { food: 250, wood: 250 },
  'block-printing': { gold: 200 }, // Monastery techs.
  sanctity: { gold: 175 },
  faith: { food: 550, gold: 750 },
  // The Monastery's two Imperial faith technologies (technologies.csv).
  illumination: { gold: 120 },
  theocracy: { gold: 200 },
  'herbal-medicine': { gold: 200 },
  heresy: { gold: 1000 },
  'murder-holes': { food: 200, stone: 100 }, // University.
  redemption: { gold: 475 },
  atonement: { gold: 325 },
  fervor: { gold: 140 },
  'town-watch': { food: 75 }, // LoS techs.
  'town-patrol': { food: 300, gold: 100 },
  conscription: { food: 150, gold: 150 }, // Castle, Imperial: military trains 25% faster.
  // Projectile techs (technologies.csv): Ballistics (University, Castle),
  // Thumb Ring (Archery Range, Castle).
  ballistics: { wood: 300, gold: 175 },
  'thumb-ring': { food: 300, wood: 250 },
  // Parthian Tactics (Archery Range, Imperial): the cavalry archer's armor +
  // anti-spearman technology.
  'parthian-tactics': { food: 200, gold: 250 },
  // M5 naval, Dock (technologies.csv): the three that act on every ship at
  // once, then the ship upgrade lines.
  careening: { food: 100, gold: 200 },
  'dry-dock': { food: 200, gold: 400 },
  shipwright: { food: 1000, gold: 300 },
  'war-galley-upgrade': { wood: 150, gold: 100 },
  'galleon-upgrade': { wood: 400, gold: 315 },
  'fast-fire-ship-upgrade': { wood: 280, gold: 250 },
  'heavy-demolition-ship-upgrade': { wood: 250, gold: 300 },
  'cannon-galleon-unlock': { food: 400, wood: 500 },
  'elite-cannon-galleon-upgrade': { wood: 525, gold: 500 },
  // Elite unique-unit upgrades (Castle, Imperial; technologies.csv).
  'elite-jaguar-warrior-upgrade': { food: 1000, gold: 500 },
  'elite-cataphract-upgrade': { food: 1200, gold: 800 },
  'elite-woad-raider-upgrade': { food: 1000, gold: 800 },
  'elite-chu-ko-nu-upgrade': { food: 1300, gold: 1300 },
  'elite-throwing-axeman-upgrade': { food: 850, gold: 550 },
  'elite-huskarl-upgrade': { food: 1200, gold: 550 },
  'elite-tarkan-upgrade': { food: 1000, gold: 500 },
  'elite-samurai-upgrade': { food: 750, gold: 650 },
  'elite-war-wagon-upgrade': { wood: 1000, gold: 800 },
  'elite-plumed-archer-upgrade': { food: 700, wood: 1000 },
  'elite-mangudai-upgrade': { food: 1100, gold: 675 },
  'elite-war-elephant-upgrade': { food: 1350, gold: 800 },
  'elite-mameluke-upgrade': { food: 600, gold: 500 },
  'elite-conquistador-upgrade': { food: 900, gold: 600 },
  'elite-teutonic-knight-upgrade': { food: 950, gold: 500 },
  'elite-janissary-upgrade': { food: 850, gold: 750 },
  'elite-berserk-upgrade': { food: 1075, gold: 475 },
  'elite-turtle-ship-upgrade': { food: 650, gold: 500 },
  'elite-longboat-upgrade': { food: 750, gold: 475 },
  // University building-defence technologies (technologies.csv).
  'masonry': { food: 150, wood: 175 },
  'architecture': { food: 300, wood: 200 },
  'treadmill-crane': { wood: 200, stone: 50 },
  'heated-shot': { food: 350, gold: 100 },
  // Civilization unique technologies (uniqueTechnologies.ts).
  'garland-wars': { food: 450, gold: 750 },
  yeomen: { wood: 750, gold: 450 },
  logistica: { food: 800, gold: 600 },
  'furor-celtica': { food: 750, gold: 450 },
  rocketry: { food: 1100, gold: 900 },
  'bearded-axe': { food: 400, gold: 400 },
  'anarchy': { food: 450, gold: 250 },
  perfusion: { wood: 400, gold: 600 },
  kataparuto: { wood: 550, gold: 300 },
  shinkichon: { food: 1100, gold: 800 },
  drill: { wood: 500, gold: 450 },
  'mahouts': { food: 300, gold: 300 },
  'zealotry': { food: 750, gold: 800 },
  'supremacy': { food: 400, gold: 250 },
  crenellations: { food: 600, stone: 400 },
  artillery: { food: 600, gold: 650 },
  // University defensive completion (technologies.csv).
  'bombard-tower-unlock': { food: 800, wood: 400 },
  'fortified-wall': { wood: 100, food: 200 },
};

export const RESEARCH_TIME_TICKS: Record<ResearchableTechnologyType, number> = {
  'feudal-age': 1300,
  'castle-age': 1600,
  'imperial-age': 1900,
  fletching: 300,
  'crossbowman-upgrade': 350,
  'pikeman-upgrade': 350,
  'light-cavalry-upgrade': 450,
  'arbalest-upgrade': 500,
  'halberdier-upgrade': 500,
  'hussar-upgrade': 500,
  'heavy-cavalry-archer-upgrade': 500,
  'cavalier-upgrade': 800,
  'champion-upgrade': 700,
  'elite-longbowman-upgrade': 600,
  'onager-upgrade': 750,
  'heavy-scorpion-upgrade': 500,
  'siege-ram-upgrade': 750,
  'capped-ram-upgrade': 500,
  'siege-onager-upgrade': 1500,
  'elite-skirmisher-upgrade': 500,
  'elite-eagle-warrior-upgrade': 500,
  'siege-engineers': 450, // University, Imperial: technologies.csv 45 s x 10 TPS.
  sappers: 100, // Castle, Imperial: technologies.csv 10 s x 10 TPS.
  hoardings: 750, // Castle, Imperial: 75 s x 10 TPS.
  guilds: 500, // Market, Imperial: 50 s x 10 TPS.
  coinage: 700, // Market, Feudal: 70 s x 10 TPS.
  caravan: 400, // Market, Castle: 40 s x 10 TPS.
  spies: 10, // the price is the cost, not the wait
  atheism: 600, // Castle, Imperial: 60 s x 10 TPS.
  banking: 700, // Market, Castle: 70 s x 10 TPS.
  berserkergang: 400, // Castle, Imperial: 40 s x 10 TPS.
  'el-dorado': 500, // Castle, Imperial: 50 s x 10 TPS.
  shatagni: 400, // Castle, Imperial: 40 s x 10 TPS.
  'recurve-bow': 400, // Castle, Imperial: 40 s x 10 TPS.
  farimba: 400, // Castle, Imperial: 40 s x 10 TPS (wiki: 0:40).
  kasbah: 400, // Castle, Castle Age: 40 s x 10 TPS (wiki: 0:40).
  sultans: 500, // Castle, Castle Age: 50 s x 10 TPS. UNVERIFIED (see RESEARCH_COSTS).
  carrack: 400, // Castle, Castle Age: 40 s x 10 TPS. UNVERIFIED (see RESEARCH_COSTS).
  bracer: 400,
  'blast-furnace': 1000,
  'plate-mail-armor': 700,
  'plate-barding': 750,
  forging: 500,
  'scale-mail-armor': 400,
  'scale-barding-armor': 450,
  'padded-archer-armor': 400,
  'iron-casting': 750,
  'chain-mail-armor': 550,
  'chain-barding-armor': 600,
  'leather-archer-armor': 550,
  'bodkin-arrow': 350,
  'ring-archer-armor': 700,
  chemistry: 1000,
  'man-at-arms-upgrade': 400,
  'long-swordsman-upgrade': 400,
  'two-handed-swordsman-upgrade': 450,
  'paladin-upgrade': 1700,
  'heavy-camel-upgrade': 1050,
  // Economy gather-rate techs (CSV research seconds × 10 TPS).
  'double-bit-axe': 250,
  'bow-saw': 500,
  'two-man-saw': 1000,
  'gold-mining': 300,
  'gold-shaft-mining': 750,
  'stone-mining': 300,
  'stone-shaft-mining': 750,
  wheelbarrow: 750,
  'hand-cart': 550,
  loom: 250, // 25 s × 10 TPS.
  'guard-tower': 300,
  keep: 750,
  bloodlines: 500, // Stable, Feudal: 50 s × 10 TPS.
  husbandry: 400, // Stable, Castle: 40 s × 10 TPS.
  squires: 400, // Barracks, Castle: 40 s × 10 TPS.
  'horse-collar': 200,
  'heavy-plow': 400,
  'crop-rotation': 700,
  'block-printing': 550,
  sanctity: 600,
  faith: 600,
  illumination: 650, // 65 s × 10 TPS.
  theocracy: 750, // 75 s × 10 TPS.
  'herbal-medicine': 350,
  heresy: 600,
  'murder-holes': 350, // CSV 35 s x 10 TPS.
  redemption: 500,
  atonement: 400,
  fervor: 500,
  'town-watch': 250,
  'town-patrol': 400,
  conscription: 600, // Castle, Imperial: 60 s × 10 TPS.
  ballistics: 600, // 60 s × 10 TPS.
  'thumb-ring': 450, // 45 s × 10 TPS.
  'parthian-tactics': 650, // 65 s × 10 TPS.
  // M5 naval, Dock (technologies.csv): the three that act on every ship at
  // once, then the ship upgrade lines.
  careening: 500, // 50 s x 10 TPS.
  'dry-dock': 600,
  shipwright: 600,
  'war-galley-upgrade': 500,
  'galleon-upgrade': 650,
  'fast-fire-ship-upgrade': 500,
  'heavy-demolition-ship-upgrade': 500,
  'cannon-galleon-unlock': 500,
  'elite-cannon-galleon-upgrade': 300,
  // Elite unique-unit upgrades (Castle, Imperial; technologies.csv).
  'elite-jaguar-warrior-upgrade': 450,
  'elite-cataphract-upgrade': 500,
  'elite-woad-raider-upgrade': 450,
  'elite-chu-ko-nu-upgrade': 500,
  'elite-throwing-axeman-upgrade': 450,
  'elite-huskarl-upgrade': 400,
  'elite-tarkan-upgrade': 450,
  'elite-samurai-upgrade': 600,
  'elite-war-wagon-upgrade': 750,
  'elite-plumed-archer-upgrade': 450,
  'elite-mangudai-upgrade': 500,
  'elite-war-elephant-upgrade': 750,
  'elite-mameluke-upgrade': 500,
  'elite-conquistador-upgrade': 600,
  'elite-teutonic-knight-upgrade': 500,
  'elite-janissary-upgrade': 550,
  'elite-berserk-upgrade': 450,
  'elite-turtle-ship-upgrade': 650,
  'elite-longboat-upgrade': 600,
  // University building-defence technologies (technologies.csv).
  'masonry': 500,
  'architecture': 700,
  'treadmill-crane': 200,
  'heated-shot': 300,
  // Civilization unique technologies (uniqueTechnologies.ts).
  'garland-wars': 600,
  'yeomen': 600,
  'logistica': 500,
  'furor-celtica': 500,
  'rocketry': 600,
  'bearded-axe': 600,
  anarchy: 400,
  'perfusion': 400,
  'kataparuto': 600,
  'shinkichon': 600,
  'drill': 600,
  'mahouts': 500,
  'zealotry': 500,
  'supremacy': 600,
  'crenellations': 600,
  'artillery': 400,
  // University defensive completion (technologies.csv).
  'bombard-tower-unlock': 600,
  'fortified-wall': 500,
};
