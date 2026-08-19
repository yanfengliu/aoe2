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
import { RESEARCH_COSTS, RESEARCH_TIME_TICKS } from './researchTables';

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
  // M1 Farms: a farm yields food, gathered like any other food resource.
  farm: 'food',
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
  farm: 4, // M1 Farms: berry-bush food cadence (spec §6.3 ~0.32–0.34 food/sec; berry-bush parity).
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
  // M1 Farms: 1 food per gather cycle (berry-bush parity).
  farm: 1,
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
  // M1 Farms: golden wheat tint (resource-tint path only; a hybrid farm renders via the building tint while its building component is present).
  farm: 0xd9b84a,
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
  // M5 naval: units.csv Fishing Ship — 75 wood, 40 s.
  'fishing-ship': { wood: 75 },
  'galley': { wood: 90, gold: 30 },
  'war-galley': { wood: 90, gold: 30 },
  'galleon': { wood: 90, gold: 30 },
  'fire-ship': { wood: 75, gold: 45 },
  'fast-fire-ship': { wood: 75, gold: 45 },
  'demolition-ship': { wood: 70, gold: 50 },
  'heavy-demolition-ship': { wood: 70, gold: 50 },
  'cannon-galleon': { wood: 200, gold: 150 },
  'elite-cannon-galleon': { wood: 200, gold: 150 },
  'man-at-arms': { food: 60, gold: 20 },
  'long-swordsman': { food: 60, gold: 20 },
  'two-handed-swordsman': { food: 60, gold: 20 },
  paladin: { food: 60, gold: 75 },
  'heavy-camel': { food: 55, gold: 60 },
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
  university: { wood: 200 }, // structures.csv: Castle Age, 200 wood.
  dock: { wood: 150 }, // structures.csv: Dark Age, 150 wood.
  castle: { stone: 650 },
  wonder: { food: 1000, wood: 1000, gold: 1000, stone: 1000 },
  'stone-wall': { stone: 5 },
  'palisade-wall': { wood: 2 },
  // M1 Farms: structures.csv cost {Wood: 60}.
  farm: { wood: 60 },
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
  'fishing-ship': 400,
  'galley': 600,
  'war-galley': 360,
  'galleon': 360,
  'fire-ship': 360,
  'fast-fire-ship': 360,
  'demolition-ship': 310,
  'heavy-demolition-ship': 310,
  'cannon-galleon': 460,
  'elite-cannon-galleon': 460,
  'man-at-arms': 210,
  'long-swordsman': 210,
  'two-handed-swordsman': 210,
  paladin: 300,
  'heavy-camel': 220,
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

// M1 Farms ownership gate: a building+resource HYBRID (Farm) is an OWNED structure gatherable only by its owner (else enemy villagers steal its food); neutral resources (no building component) stay gatherable by anyone.
export function canGatherResource(
  gathererOwner: number,
  resourceIsOwnedStructure: boolean,
  resourceBaseOwner: number | null,
): boolean {
  if (resourceIsOwnedStructure && resourceBaseOwner !== gathererOwner) {
    return false;
  }
  return true;
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
      // M5 naval: the Dock is where a Fishing Ship lands its catch. Fish are
      // food, so this is the food case rather than a naval special case.
      return buildingType === 'town-center'
        || buildingType === 'mill'
        || buildingType === 'dock';
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

// agent-affordances A2: need-vs-have detail for insufficient_resources rejections; null when affordable. Sibling of `resourcesMissing` (terse HUD toast).
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

// Repair cost (spec §8.1): a fraction of build cost proportional to HP restored (full repair from 0 = half build cost); each resource rounded UP so repair is never free; charged up front at issue.
export const REPAIR_COST_FRACTION = 0.5;

export function repairCost(
  buildingType: BuildableBuildingType,
  missingHp: number,
  maxHp: number,
): Partial<PlayerResources> {
  const build = CONSTRUCTION_COSTS[buildingType];
  const fraction = maxHp > 0 ? REPAIR_COST_FRACTION * (Math.max(0, missingHp) / maxHp) : 0;
  const cost: Partial<PlayerResources> = {};
  for (const key of ['food', 'wood', 'gold', 'stone'] as const) {
    const amount = build[key];
    if (amount) {
      const charged = Math.ceil(amount * fraction);
      if (charged > 0) cost[key] = charged;
    }
  }
  return cost;
}

export function trainingTimeTicks(unitType: TrainableUnitType): number {
  return TRAINING_TIME_TICKS[unitType];
}

export function researchTimeTicks(technologyType: ResearchableTechnologyType): number {
  return RESEARCH_TIME_TICKS[technologyType];
}
