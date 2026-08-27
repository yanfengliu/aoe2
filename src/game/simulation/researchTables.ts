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
  'capped-ram-upgrade': { food: 300 }, // technologies.csv
  'siege-onager-upgrade': { food: 1450, gold: 1000 }, // technologies.csv
  'elite-skirmisher-upgrade': { wood: 250, gold: 160 }, // technologies.csv
  'elite-eagle-warrior-upgrade': { food: 800, gold: 500 }, // technologies.csv
  'siege-engineers': { food: 500, wood: 600 }, // Siege Workshop, Imperial: +1 siege range.
  sappers: { food: 400, gold: 200 },
  // Castle (technologies.csv): Hoardings toughens castles, El Dorado is the
  // Mayans' Imperial unique technology.
  hoardings: { food: 400, gold: 400 },
  // Market (technologies.csv): see what your allies see.
  guilds: { food: 300, gold: 200 },
  // Market (technologies.csv): the tribute fee, 30% to 20% to nothing.
  coinage: { food: 150, gold: 50 },
  caravan: { food: 200, gold: 200 }, // Market, Castle: Trade Carts 50% faster.
  // Castle, Imperial. The table holds the FLOOR; the real Spies charge is
  // dynamic — 200 gold per living enemy villager (spiesRules.ts).
  spies: { gold: 200 },
  atheism: { food: 500, gold: 500 }, // Huns, Imperial (technologies.csv).
  banking: { food: 200, gold: 100 },
  // Vikings, Castle (technologies.csv): Berserks regenerate twice as fast.
  berserkergang: { food: 850, gold: 400 },
  'el-dorado': { food: 750, gold: 450 }, // Blacksmith (AoE2 University), Imperial: +15 infantry attack vs buildings.
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
  'block-printing': { gold: 200 }, // technologies.csv:69 (Imperial, 200g). Sanctity 120g, Faith 750f/1000g, Herbal 350g.
  sanctity: { gold: 120 },
  faith: { food: 750, gold: 1000 },
  // The Monastery's two Imperial faith technologies (technologies.csv).
  illumination: { gold: 120 },
  theocracy: { gold: 200 },
  'herbal-medicine': { gold: 350 },
  heresy: { gold: 1000 },
  // technologies.csv rows 63/64/67: Atonement 325g, Fervor 140g, Redemption 475g.
  'murder-holes': { food: 200, stone: 200 }, // technologies.csv row: 200f/200s.
  redemption: { gold: 475 },
  atonement: { gold: 325 },
  fervor: { gold: 140 },
  'town-watch': { food: 75 }, // LoS techs (technologies.csv rows 88/92/9).
  'town-patrol': { food: 300, gold: 200 },
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
  careening: { food: 250, gold: 150 },
  'dry-dock': { food: 600, gold: 400 },
  shipwright: { wood: 200, food: 1000 },
  'war-galley-upgrade': { food: 230, gold: 100 },
  'galleon-upgrade': { food: 400, wood: 315 },
  'fast-fire-ship-upgrade': { wood: 280, gold: 250 },
  'heavy-demolition-ship-upgrade': { wood: 200, gold: 300 },
  'cannon-galleon-unlock': { food: 400, wood: 500 },
  'elite-cannon-galleon-upgrade': { wood: 525, gold: 500 },
  // Elite unique-unit upgrades (Castle, Imperial; technologies.csv).
  'elite-jaguar-warrior-upgrade': { food: 1000, gold: 500 },
  'elite-cataphract-upgrade': { food: 1600, gold: 800 },
  'elite-woad-raider-upgrade': { food: 1000, gold: 800 },
  'elite-chu-ko-nu-upgrade': { food: 760, gold: 760 },
  'elite-throwing-axeman-upgrade': { food: 1000, gold: 850 },
  'elite-huskarl-upgrade': { food: 1200, gold: 550 },
  'elite-tarkan-upgrade': { food: 1000, gold: 500 },
  'elite-samurai-upgrade': { food: 950, gold: 875 },
  'elite-war-wagon-upgrade': { food: 1000, gold: 800 },
  'elite-plumed-archer-upgrade': { wood: 1000, food: 500 },
  'elite-mangudai-upgrade': { food: 1100, gold: 675 },
  'elite-war-elephant-upgrade': { food: 1600, gold: 1200 },
  'elite-mameluke-upgrade': { food: 600, gold: 500 },
  'elite-conquistador-upgrade': { food: 1200, gold: 600 },
  'elite-teutonic-knight-upgrade': { food: 1200, gold: 600 },
  'elite-janissary-upgrade': { food: 850, gold: 750 },
  'elite-berserk-upgrade': { food: 1300, gold: 550 },
  'elite-turtle-ship-upgrade': { food: 1000, gold: 800 },
  'elite-longboat-upgrade': { food: 750, gold: 475 },
  // University building-defence technologies (technologies.csv).
  'masonry': { food: 150, wood: 175 },
  'architecture': { food: 300, wood: 200 },
  'treadmill-crane': { food: 300, wood: 200 },
  'heated-shot': { food: 350, gold: 100 },
  // Civilization unique technologies (uniqueTechnologies.ts).
  'garland-wars': { food: 450, gold: 750 },
  'yeomen': { food: 750, gold: 450 },
  'logistica': { food: 1000, gold: 600 },
  'furor-celtica': { food: 750, gold: 450 },
  'rocketry': { food: 600, gold: 600 },
  'bearded-axe': { food: 400, gold: 400 },
  'anarchy': { food: 450, gold: 250 },
  'perfusion': { food: 400, gold: 600 },
  'kataparuto': { food: 750, gold: 400 },
  'shinkichon': { food: 800, gold: 500 },
  'drill': { food: 500, gold: 450 },
  'mahouts': { food: 300, gold: 300 },
  'zealotry': { food: 750, gold: 800 },
  'supremacy': { food: 400, gold: 250 },
  'crenellations': { food: 600, gold: 400 },
  'artillery': { food: 500, gold: 450 },
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
  'capped-ram-upgrade': 500, // technologies.csv 50 s
  'siege-onager-upgrade': 1500, // technologies.csv 150 s
  'elite-skirmisher-upgrade': 500, // technologies.csv 50 s
  'elite-eagle-warrior-upgrade': 400, // technologies.csv 40 s
  'siege-engineers': 700, // Siege Workshop, Imperial: 70 s × 10 TPS.
  sappers: 200, // Blacksmith, Imperial: quick 20 s research (AoE2 Sappers is a fast tech).
  hoardings: 750, // Castle, Imperial: 75 s x 10 TPS.
  guilds: 500, // Market, Imperial: 50 s x 10 TPS.
  coinage: 500, // Market, Feudal: 50 s x 10 TPS.
  caravan: 400, // Market, Castle: 40 s x 10 TPS.
  spies: 10, // Castle, Imperial: 1 s x 10 TPS — the price is the cost, not the wait.
  atheism: 600, // Castle, Imperial: 60 s x 10 TPS.
  banking: 500, // Market, Castle: 50 s x 10 TPS.
  berserkergang: 400, // Castle, Imperial: 40 s x 10 TPS.
  'el-dorado': 500, // Castle, Imperial: 50 s x 10 TPS.
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
  illumination: 650, // 65 s × 10 TPS.
  theocracy: 750, // 75 s × 10 TPS.
  'herbal-medicine': 350,
  heresy: 600,
  'murder-holes': 600, // CSV 60 s x 10 TPS.
  redemption: 500, // CSV 50 s / 40 s / 50 s x 10 TPS.
  atonement: 400,
  fervor: 500,
  'town-watch': 250, // LoS techs — 25/40/35 s × 10 TPS (technologies.csv 88/92/9).
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
  'treadmill-crane': 400,
  'heated-shot': 300,
  // Civilization unique technologies (uniqueTechnologies.ts).
  'garland-wars': 600,
  'yeomen': 600,
  'logistica': 500,
  'furor-celtica': 500,
  'rocketry': 600,
  'bearded-axe': 600,
  'anarchy': 600,
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
