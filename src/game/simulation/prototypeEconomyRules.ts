import { HUMAN_PLAYER_ID } from './prototypeScenario';
import type {
  BuildableBuildingType,
  EconomyResourceKind,
  MarketActionType,
  PlayerResources,
  ResearchableTechnologyType,
  ResourceKind,
  TrainableUnitType,
} from './types';

type MarketCommodity = Exclude<EconomyResourceKind, 'gold'>;

const BUY_MARKET_ACTIONS = new Set<MarketActionType>(['buy-food', 'buy-wood', 'buy-stone']);

const MARKET_COMMODITY_BY_ACTION: Record<MarketActionType, MarketCommodity> = {
  'buy-food': 'food',
  'sell-food': 'food',
  'buy-wood': 'wood',
  'sell-wood': 'wood',
  'buy-stone': 'stone',
  'sell-stone': 'stone',
};

const ECONOMY_RESOURCE_BY_KIND: Record<ResourceKind, EconomyResourceKind | null> = {
  'berry-bush': 'food',
  'gold-mine': 'gold',
  'stone-mine': 'stone',
  boar: 'food',
  fish: 'food',
  sheep: 'food',
  wolf: null,
  tree: 'wood',
  relic: null,
};

const GATHER_TICKS_BY_KIND: Record<ResourceKind, number | null> = {
  'berry-bush': 4,
  'gold-mine': 6,
  'stone-mine': 6,
  boar: 5,
  fish: 4,
  sheep: 4,
  wolf: null,
  tree: 5,
  relic: null,
};

const GATHER_AMOUNT_BY_KIND: Record<ResourceKind, number | null> = {
  'berry-bush': 1,
  'gold-mine': 1,
  'stone-mine': 1,
  boar: 2,
  fish: 1,
  sheep: 1,
  wolf: null,
  tree: 1,
  relic: null,
};

const RESOURCE_BASE_TINTS: Record<ResourceKind, number> = {
  'berry-bush': 0x7a4c8e,
  'gold-mine': 0xd8b44c,
  'stone-mine': 0x8f9aa4,
  boar: 0x6a3b2e,
  fish: 0x6fb5d8,
  sheep: 0xe7ece6,
  wolf: 0x7f8894,
  tree: 0x214d2d,
  relic: 0xf5d680,
};

const TRAINING_COSTS: Record<TrainableUnitType, Partial<PlayerResources>> = {
  villager: { food: 50 },
  scout: { food: 80 },
  militia: { food: 60, gold: 20 },
  spearman: { food: 35, wood: 25 },
  archer: { wood: 25, gold: 45 },
  skirmisher: { food: 35, wood: 25 },
  knight: { food: 60, gold: 75 },
  crossbowman: { wood: 25, gold: 45 },
  pikeman: { food: 35, wood: 25 },
  'light-cavalry': { food: 80 },
  camel: { food: 55, gold: 60 },
  'cavalry-archer': { wood: 40, gold: 70 },
  mangonel: { wood: 160, gold: 135 },
  scorpion: { wood: 80, gold: 60 },
  'battering-ram': { wood: 160, gold: 75 },
  monk: { gold: 100 },
  longbowman: { food: 35, gold: 40 },
  arbalest: { wood: 25, gold: 45 },
  halberdier: { food: 35, wood: 25 },
  hussar: { food: 80 },
  'heavy-cavalry-archer': { wood: 40, gold: 70 },
  cavalier: { food: 60, gold: 75 },
  champion: { food: 60, gold: 20 },
  'elite-longbowman': { food: 35, gold: 40 },
  onager: { wood: 160, gold: 135 },
  'heavy-scorpion': { wood: 80, gold: 60 },
  'siege-ram': { wood: 160, gold: 75 },
  'bombard-cannon': { wood: 225, gold: 225 },
  trebuchet: { wood: 200, gold: 200 },
  'man-at-arms': { food: 60, gold: 20 },
  'long-swordsman': { food: 60, gold: 20 },
  'two-handed-swordsman': { food: 60, gold: 20 },
  paladin: { food: 60, gold: 75 },
  'heavy-camel': { food: 55, gold: 60 },
};

const RESEARCH_COSTS: Record<ResearchableTechnologyType, Partial<PlayerResources>> = {
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
  // Economy gather-rate techs (costs from design/stats/technologies.csv).
  'double-bit-axe': { wood: 50, food: 100 },
  'bow-saw': { wood: 100, food: 150 },
  'two-man-saw': { wood: 200, food: 300 },
  'gold-mining': { food: 100, wood: 75 },
  'gold-shaft-mining': { food: 200, wood: 150 },
  'stone-mining': { food: 100, wood: 75 },
  'stone-shaft-mining': { food: 200, wood: 150 },
  // Economy carry-capacity techs (Town Center; costs from technologies.csv).
  wheelbarrow: { food: 175, wood: 50 },
  'hand-cart': { food: 305, wood: 200 },
};

const CONSTRUCTION_COSTS: Record<BuildableBuildingType, Partial<PlayerResources>> = {
  'town-center': { wood: 275, stone: 100 },
  house: { wood: 25 },
  mill: { wood: 100 },
  'lumber-camp': { wood: 100 },
  'mining-camp': { wood: 100 },
  barracks: { wood: 175 },
  'watch-tower': { stone: 125 },
  stable: { wood: 175 },
  'archery-range': { wood: 175 },
  blacksmith: { wood: 150 },
  market: { wood: 175 },
  'siege-workshop': { wood: 200 },
  monastery: { wood: 175 },
  castle: { stone: 650 },
  wonder: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
  'stone-wall': { stone: 5 },
  'palisade-wall': { wood: 2 },
};

const TRAINING_TIME_TICKS: Record<TrainableUnitType, number> = {
  villager: 250,
  scout: 300,
  militia: 210,
  spearman: 220,
  archer: 350,
  skirmisher: 220,
  knight: 300,
  crossbowman: 270,
  pikeman: 220,
  'light-cavalry': 300,
  camel: 220,
  'cavalry-archer': 340,
  mangonel: 460,
  scorpion: 300,
  'battering-ram': 360,
  monk: 510,
  longbowman: 300,
  arbalest: 270,
  halberdier: 220,
  hussar: 300,
  'heavy-cavalry-archer': 340,
  cavalier: 300,
  champion: 210,
  'elite-longbowman': 300,
  onager: 460,
  'heavy-scorpion': 300,
  'siege-ram': 360,
  'bombard-cannon': 560,
  trebuchet: 500,
  'man-at-arms': 210,
  'long-swordsman': 210,
  'two-handed-swordsman': 210,
  paladin: 300,
  'heavy-camel': 220,
};

const RESEARCH_TIME_TICKS: Record<ResearchableTechnologyType, number> = {
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
  // Carry-capacity techs (CSV research seconds × 10 TPS).
  wheelbarrow: 750,
  'hand-cart': 550,
};

export function marketCommodityForAction(actionType: MarketActionType): MarketCommodity {
  return MARKET_COMMODITY_BY_ACTION[actionType];
}

export function isBuyMarketAction(actionType: MarketActionType): boolean {
  return BUY_MARKET_ACTIONS.has(actionType);
}

export function resourceKindToEconomyResource(kind: ResourceKind): EconomyResourceKind | null {
  return ECONOMY_RESOURCE_BY_KIND[kind];
}

function throwUnharvestableResourceError(kind: ResourceKind): never {
  switch (kind) {
    case 'wolf':
      throw new Error('Wolves are not harvestable resources.');
    case 'relic':
      throw new Error('Relics are not harvestable resources; use the Monk pickup flow.');
    default:
      throw new Error(`Unexpected harvestable resource kind: ${kind}`);
  }
}

export function gatherTicksFor(kind: ResourceKind): number {
  const ticks = GATHER_TICKS_BY_KIND[kind];
  if (ticks === null) {
    throwUnharvestableResourceError(kind);
  }
  return ticks;
}

export function gatherAmountFor(kind: ResourceKind): number {
  const amount = GATHER_AMOUNT_BY_KIND[kind];
  if (amount === null) {
    throwUnharvestableResourceError(kind);
  }
  return amount;
}

export function resourceTint(resourceType: ResourceKind, owner: number | null): number {
  if (resourceType === 'sheep') {
    if (owner === HUMAN_PLAYER_ID) {
      return 0x8fb8ff;
    }
    if (owner !== null) {
      return 0xd39191;
    }
  }

  return RESOURCE_BASE_TINTS[resourceType];
}

export function canDropOffAt(
  buildingType: BuildableBuildingType,
  resourceKind: EconomyResourceKind,
): boolean {
  switch (resourceKind) {
    case 'food':
      return buildingType === 'town-center' || buildingType === 'mill';
    case 'wood':
      return buildingType === 'town-center' || buildingType === 'lumber-camp';
    case 'gold':
    case 'stone':
      return buildingType === 'town-center' || buildingType === 'mining-camp';
  }
}

export function canAfford(
  resources: PlayerResources,
  cost: Partial<PlayerResources>,
): boolean {
  return (
    resources.food >= (cost.food ?? 0)
    && resources.wood >= (cost.wood ?? 0)
    && resources.gold >= (cost.gold ?? 0)
    && resources.stone >= (cost.stone ?? 0)
  );
}

export function resourcesMissing(
  resources: PlayerResources,
  cost: Partial<PlayerResources>,
): EconomyResourceKind | null {
  if (resources.food < (cost.food ?? 0)) {
    return 'food';
  }
  if (resources.wood < (cost.wood ?? 0)) {
    return 'wood';
  }
  if (resources.gold < (cost.gold ?? 0)) {
    return 'gold';
  }
  if (resources.stone < (cost.stone ?? 0)) {
    return 'stone';
  }
  return null;
}

// agent-affordances A2: need-vs-have detail for insufficient_resources
// rejections. Returns null when the cost is affordable. Sibling of
// `resourcesMissing` (which names only the first short resource and is
// kept for the HUD's terse "Not enough food." toasts).
export function describeMissingResources(
  resources: PlayerResources,
  cost: Partial<PlayerResources>,
): string | null {
  const parts: string[] = [];
  for (const kind of ['food', 'wood', 'gold', 'stone'] as const) {
    const need = cost[kind] ?? 0;
    if (resources[kind] < need) {
      parts.push(`need ${need} ${kind} (have ${resources[kind]})`);
    }
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

export function spendResources(
  resources: PlayerResources,
  cost: Partial<PlayerResources>,
): void {
  resources.food -= cost.food ?? 0;
  resources.wood -= cost.wood ?? 0;
  resources.gold -= cost.gold ?? 0;
  resources.stone -= cost.stone ?? 0;
}

export function trainingCost(unitType: TrainableUnitType): Partial<PlayerResources> {
  return TRAINING_COSTS[unitType];
}

export function researchCost(
  technologyType: ResearchableTechnologyType,
): Partial<PlayerResources> {
  return RESEARCH_COSTS[technologyType];
}

export function constructionCost(
  buildingType: BuildableBuildingType,
): Partial<PlayerResources> {
  return CONSTRUCTION_COSTS[buildingType];
}

export function trainingTimeTicks(unitType: TrainableUnitType): number {
  return TRAINING_TIME_TICKS[unitType];
}

export function researchTimeTicks(technologyType: ResearchableTechnologyType): number {
  return RESEARCH_TIME_TICKS[technologyType];
}
