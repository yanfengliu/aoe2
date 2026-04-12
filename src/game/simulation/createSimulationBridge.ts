import {
  RenderAdapter,
  VisibilityMap,
  World,
  WorldDebugger,
  createTileGrid,
  type EntityRef,
  type Position,
  type RenderProjector,
} from 'civ-engine';

import {
  DEFAULT_SEED,
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
  TPS,
  createPrototypeScenario,
} from './prototypeScenario';
import { RenderStore } from './renderStore';
import type {
  ActionType,
  AgeType,
  BuildableBuildingType,
  BuildingType,
  BuildingComponent,
  EconomyResourceKind,
  EconomyState,
  GathererComponent,
  HudState,
  MarketActionType,
  MatchState,
  PlayerResources,
  PopulationState,
  ProductionQueueEntry,
  ProjectedEntityView,
  ProjectedFrameView,
  ResearchableTechnologyType,
  RenderState,
  RenderableComponent,
  ResourceComponent,
  ResourceKind,
  SelectionState,
  TerrainComponent,
  TrainableUnitType,
  UnitComponent,
  UnitTaskState,
  UnitType,
  VelocityComponent,
  VisionSourceComponent,
  WanderBoundsComponent,
} from './types';

type GameEvents = Record<string, never>;
type GameCommands = Record<string, never>;

export interface SimulationBridge {
  step(deltaMs: number): void;
  getRenderState(): RenderState;
  getHudState(): HudState;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  selectEntityAtCell(x: number, y: number): boolean;
  selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean;
  clearSelection(): void;
  issueContextCommand(x: number, y: number): boolean;
  issueMoveCommand(x: number, y: number): boolean;
  issueAction(actionType: ActionType): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
  confirmBuildingPlacement(x: number, y: number): boolean;
}

const STANDARD_STARTING_RESOURCES: PlayerResources = {
  food: 200,
  wood: 200,
  gold: 100,
  stone: 200,
};

const STANDARD_POPULATION_CAP = 5;
const VILLAGER_TRAIN_TIME_TICKS = 250;
const TOWN_CENTER_BUILD_TIME_TICKS = 300;
const HOUSE_BUILD_TIME_TICKS = 120;
const DROPOFF_BUILD_TIME_TICKS = 180;
const BARRACKS_BUILD_TIME_TICKS = 240;
const WATCH_TOWER_BUILD_TIME_TICKS = 220;
const STABLE_BUILD_TIME_TICKS = 240;
const ARCHERY_RANGE_BUILD_TIME_TICKS = 240;
const BLACKSMITH_BUILD_TIME_TICKS = 200;
const MARKET_BUILD_TIME_TICKS = 200;
const MILITIA_TRAIN_TIME_TICKS = 210;
const SPEARMAN_TRAIN_TIME_TICKS = 220;
const SCOUT_TRAIN_TIME_TICKS = 300;
const ARCHER_TRAIN_TIME_TICKS = 350;
const SKIRMISHER_TRAIN_TIME_TICKS = 220;
const KNIGHT_TRAIN_TIME_TICKS = 300;
const FEUDAL_AGE_RESEARCH_TIME_TICKS = 1300;
const CASTLE_AGE_RESEARCH_TIME_TICKS = 1600;
const FLETCHING_RESEARCH_TIME_TICKS = 300;
const MELEE_ATTACK_RANGE = 1;
const MARKET_TRANSACTION_AMOUNT = 100;
const MARKET_BASE_RATE = 100;
const MARKET_FEE_RATE = 0.3;
const MARKET_RATE_STEP = 3;
const MARKET_MIN_RATE = 20;

type MarketCommodity = Exclude<EconomyResourceKind, 'gold'>;

interface UnitCommand {
  type: 'move' | 'build' | 'attack';
  target: Position;
  buildingRef?: EntityRef;
  targetEntityRef?: EntityRef;
  targetEntityKind?: 'unit' | 'building';
}

interface ConstructionState {
  isComplete: boolean;
  buildProgressTicks: number;
  totalBuildTicks: number;
  populationProvided: number;
  width: number;
  height: number;
}

interface CombatState {
  currentHp: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
}

interface BuildingHealthState {
  currentHp: number;
  maxHp: number;
}

interface BuildingCombatState {
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toCellIndex(x: number, y: number): number {
  return y * MAP_WIDTH + x;
}

function isSameEntity(ref: EntityRef | null, id: number, world: World<GameEvents, GameCommands>): boolean {
  return ref !== null && world.isCurrent(ref) && ref.id === id;
}

function currentEntityId(
  world: World<GameEvents, GameCommands>,
  ref: EntityRef | null | undefined,
): number | null {
  return ref && world.isCurrent(ref) ? ref.id : null;
}

function cloneResources(resources: PlayerResources): PlayerResources {
  return {
    food: resources.food,
    wood: resources.wood,
    gold: resources.gold,
    stone: resources.stone,
  };
}

function createInitialMarketRates(): Record<MarketCommodity, number> {
  return {
    food: MARKET_BASE_RATE,
    wood: MARKET_BASE_RATE,
    stone: MARKET_BASE_RATE,
  };
}

function marketCommodityForAction(actionType: MarketActionType): MarketCommodity {
  switch (actionType) {
    case 'buy-food':
    case 'sell-food':
      return 'food';
    case 'buy-wood':
    case 'sell-wood':
      return 'wood';
    case 'buy-stone':
    case 'sell-stone':
      return 'stone';
  }
}

function isBuyMarketAction(actionType: MarketActionType): boolean {
  return actionType === 'buy-food' || actionType === 'buy-wood' || actionType === 'buy-stone';
}

function resourceKindToEconomyResource(kind: ResourceKind): EconomyResourceKind {
  switch (kind) {
    case 'gold-mine':
      return 'gold';
    case 'stone-mine':
      return 'stone';
    case 'tree':
      return 'wood';
    case 'berry-bush':
    case 'boar':
    case 'sheep':
      return 'food';
  }
}

function gatherTicksFor(kind: ResourceKind): number {
  switch (kind) {
    case 'sheep':
    case 'berry-bush':
      return 4;
    case 'boar':
    case 'tree':
      return 5;
    case 'gold-mine':
    case 'stone-mine':
      return 6;
  }
}

function gatherAmountFor(kind: ResourceKind): number {
  switch (kind) {
    case 'sheep':
    case 'berry-bush':
    case 'tree':
      return 1;
    case 'boar':
      return 2;
    case 'gold-mine':
    case 'stone-mine':
      return 1;
  }
}

function stepToward(current: Position, target: Position): Position {
  if (current.x !== target.x) {
    return {
      x: current.x + Math.sign(target.x - current.x),
      y: current.y,
    };
  }

  if (current.y !== target.y) {
    return {
      x: current.x,
      y: current.y + Math.sign(target.y - current.y),
    };
  }

  return current;
}

function isAtTarget(current: Position, target: Position): boolean {
  return current.x === target.x && current.y === target.y;
}

function assignVillagerRole(owner: number, ordinal: number): EconomyResourceKind {
  if (ordinal === 0 || ordinal === 1) {
    return 'food';
  }
  if (ordinal === 2) {
    return 'wood';
  }
  if (ordinal === 3) {
    return 'gold';
  }
  return owner === HUMAN_PLAYER_ID ? 'food' : 'wood';
}

function isResourceCandidate(
  entry: {
    id: number;
    position: Position | undefined;
    resource: ResourceComponent | undefined;
  },
): entry is {
  id: number;
  position: Position;
  resource: ResourceComponent;
} {
  return Boolean(entry.position && entry.resource);
}

function isEconomyVillager(
  entry: {
    owner: number;
    task: UnitTaskState;
    desiredResource: GathererComponent['desiredResource'];
    carriedResource: GathererComponent['carriedResource'];
    carriedAmount: number;
  } | null,
): entry is {
  owner: number;
  task: UnitTaskState;
  desiredResource: GathererComponent['desiredResource'];
  carriedResource: GathererComponent['carriedResource'];
  carriedAmount: number;
} {
  return entry !== null;
}

function isEconomyResourceEntry(
  entry: {
    resourceType: ResourceKind;
    amount: number;
    maxAmount: number;
    baseOwner: number | null;
    x: number;
    y: number;
  } | null,
): entry is {
  resourceType: ResourceKind;
  amount: number;
  maxAmount: number;
  baseOwner: number | null;
  x: number;
  y: number;
} {
  return entry !== null;
}

function cloneQueue(queue: ProductionQueueEntry[]): ProductionQueueEntry[] {
  return queue.map((entry) => ({ ...entry }));
}

function manhattanDistance(left: Position, right: Position): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function buildingFootprint(buildingType: BuildingType): { width: number; height: number } {
  switch (buildingType) {
    case 'house':
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
    case 'barracks':
    case 'watch-tower':
    case 'stable':
    case 'archery-range':
    case 'blacksmith':
    case 'market':
      return { width: 2, height: 2 };
    case 'town-center':
      return { width: 1, height: 1 };
  }
}

function buildingPopulationProvided(buildingType: BuildingType): number {
  switch (buildingType) {
    case 'house':
      return 5;
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
    case 'barracks':
    case 'watch-tower':
    case 'stable':
    case 'archery-range':
    case 'blacksmith':
    case 'market':
    case 'town-center':
      return 0;
  }
}

function buildingBuildTimeTicks(buildingType: BuildingType): number {
  switch (buildingType) {
    case 'town-center':
      return TOWN_CENTER_BUILD_TIME_TICKS;
    case 'house':
      return HOUSE_BUILD_TIME_TICKS;
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
      return DROPOFF_BUILD_TIME_TICKS;
    case 'barracks':
      return BARRACKS_BUILD_TIME_TICKS;
    case 'watch-tower':
      return WATCH_TOWER_BUILD_TIME_TICKS;
    case 'stable':
      return STABLE_BUILD_TIME_TICKS;
    case 'archery-range':
      return ARCHERY_RANGE_BUILD_TIME_TICKS;
    case 'blacksmith':
      return BLACKSMITH_BUILD_TIME_TICKS;
    case 'market':
      return MARKET_BUILD_TIME_TICKS;
  }
}

function buildingSize(buildingType: BuildingType): number {
  switch (buildingType) {
    case 'house':
      return 1.1;
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
      return 1.15;
    case 'barracks':
    case 'watch-tower':
    case 'stable':
    case 'archery-range':
    case 'blacksmith':
    case 'market':
      return 1.2;
    case 'town-center':
      return 1.4;
  }
}

function buildingTint(
  buildingType: BuildingType,
  owner: number,
  isComplete: boolean,
): number {
  if (buildingType === 'house') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0xc8a15e : 0x6d593d
      : isComplete ? 0xa66b6b : 0x6a4747;
  }

  if (buildingType === 'mill') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0xb18f54 : 0x625033
      : isComplete ? 0x9e7161 : 0x654540;
  }

  if (buildingType === 'lumber-camp') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0x6c9154 : 0x43573a
      : isComplete ? 0x826c63 : 0x564642;
  }

  if (buildingType === 'mining-camp') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0x7f8f9f : 0x4c5661
      : isComplete ? 0x8a7582 : 0x5b4b54;
  }

  if (buildingType === 'barracks') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0x9b7351 : 0x5b4636
      : isComplete ? 0x8e6257 : 0x5c403b;
  }

  if (buildingType === 'stable') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0xa07b4f : 0x624b34
      : isComplete ? 0x996763 : 0x604340;
  }

  if (buildingType === 'watch-tower') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0x8d9aa7 : 0x56606a
      : isComplete ? 0xa3848f : 0x654e58;
  }

  if (buildingType === 'archery-range') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0x7f6855 : 0x4f4034
      : isComplete ? 0x8b6660 : 0x5a433d;
  }

  if (buildingType === 'blacksmith') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0x6f7682 : 0x434a54
      : isComplete ? 0x8b6670 : 0x5a434b;
  }

  if (buildingType === 'market') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0xb68f52 : 0x6c5637
      : isComplete ? 0xb07a66 : 0x6d4d43;
  }

  return owner === HUMAN_PLAYER_ID
    ? isComplete ? 0xd8b36c : 0x7d6545
    : isComplete ? 0xa15c5c : 0x674040;
}

function canDropOffAt(
  buildingType: BuildingType,
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

function canAfford(
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

function spendResources(
  resources: PlayerResources,
  cost: Partial<PlayerResources>,
): void {
  resources.food -= cost.food ?? 0;
  resources.wood -= cost.wood ?? 0;
  resources.gold -= cost.gold ?? 0;
  resources.stone -= cost.stone ?? 0;
}

function trainingCost(unitType: TrainableUnitType): Partial<PlayerResources> {
  switch (unitType) {
    case 'villager':
      return { food: 50 };
    case 'scout':
      return { food: 80 };
    case 'militia':
      return { food: 60, gold: 20 };
    case 'spearman':
      return { food: 35, wood: 25 };
    case 'archer':
      return { wood: 25, gold: 45 };
    case 'skirmisher':
      return { food: 35, wood: 25 };
    case 'knight':
      return { food: 60, gold: 75 };
  }
}

function researchCost(technologyType: ResearchableTechnologyType): Partial<PlayerResources> {
  switch (technologyType) {
    case 'feudal-age':
      return { food: 500 };
    case 'castle-age':
      return { food: 800, gold: 200 };
    case 'fletching':
      return { food: 100, gold: 50 };
  }
}

function constructionCost(buildingType: BuildableBuildingType): Partial<PlayerResources> {
  switch (buildingType) {
    case 'town-center':
      return { wood: 275, stone: 100 };
    case 'house':
      return { wood: 25 };
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
      return { wood: 100 };
    case 'barracks':
    case 'stable':
    case 'archery-range':
      return { wood: 175 };
    case 'blacksmith':
      return { wood: 150 };
    case 'market':
      return { wood: 175 };
    case 'watch-tower':
      return { stone: 125 };
  }
}

function trainingTimeTicks(unitType: TrainableUnitType): number {
  switch (unitType) {
    case 'villager':
      return VILLAGER_TRAIN_TIME_TICKS;
    case 'scout':
      return SCOUT_TRAIN_TIME_TICKS;
    case 'militia':
      return MILITIA_TRAIN_TIME_TICKS;
    case 'spearman':
      return SPEARMAN_TRAIN_TIME_TICKS;
    case 'archer':
      return ARCHER_TRAIN_TIME_TICKS;
    case 'skirmisher':
      return SKIRMISHER_TRAIN_TIME_TICKS;
    case 'knight':
      return KNIGHT_TRAIN_TIME_TICKS;
  }
}

function researchTimeTicks(technologyType: ResearchableTechnologyType): number {
  switch (technologyType) {
    case 'feudal-age':
      return FEUDAL_AGE_RESEARCH_TIME_TICKS;
    case 'castle-age':
      return CASTLE_AGE_RESEARCH_TIME_TICKS;
    case 'fletching':
      return FLETCHING_RESEARCH_TIME_TICKS;
  }
}

function buildingMaxHp(buildingType: BuildingType): number {
  switch (buildingType) {
    case 'house':
      return 75;
    case 'mill':
    case 'lumber-camp':
    case 'mining-camp':
      return 100;
    case 'barracks':
    case 'watch-tower':
    case 'stable':
    case 'archery-range':
    case 'blacksmith':
    case 'market':
      return 175;
    case 'town-center':
      return 2400;
  }
}

function buildingVisionRadius(buildingType: BuildingType): number | null {
  switch (buildingType) {
    case 'town-center':
      return 7;
    case 'watch-tower':
      return 8;
    default:
      return null;
  }
}

function createBuildingCombatState(buildingType: BuildingType): BuildingCombatState | null {
  if (buildingType === 'town-center') {
    return {
      attackDamage: 5,
      attackRange: 6,
      reloadTicks: 12,
      cooldownTicks: 0,
    };
  }

  if (buildingType === 'watch-tower') {
    return {
      attackDamage: 5,
      attackRange: 7,
      reloadTicks: 12,
      cooldownTicks: 0,
    };
  }

  return null;
}

function buildingGarrisonCapacity(buildingType: BuildingType): number {
  switch (buildingType) {
    case 'town-center':
    case 'watch-tower':
      return 5;
    default:
      return 0;
  }
}

function canGarrisonAt(buildingType: BuildingType, unitType: UnitType): boolean {
  return unitType === 'villager' && buildingGarrisonCapacity(buildingType) > 0;
}

function buildingArrowCount(buildingType: BuildingType, garrisonedUnits: number): number {
  switch (buildingType) {
    case 'town-center':
      return garrisonedUnits > 0 ? 1 + Math.min(garrisonedUnits, 4) : 0;
    case 'watch-tower':
      return 1;
    default:
      return 0;
  }
}

function canTrainAt(buildingType: BuildingType, unitType: TrainableUnitType): boolean {
  return (
    (buildingType === 'town-center' && unitType === 'villager')
    || (buildingType === 'barracks' && unitType === 'militia')
    || (buildingType === 'barracks' && unitType === 'spearman')
    || (buildingType === 'stable' && unitType === 'scout')
    || (buildingType === 'stable' && unitType === 'knight')
    || (buildingType === 'archery-range' && unitType === 'archer')
    || (buildingType === 'archery-range' && unitType === 'skirmisher')
  );
}

function canResearchAt(
  buildingType: BuildingType,
  technologyType: ResearchableTechnologyType,
): boolean {
  return (
    (buildingType === 'town-center' && technologyType === 'feudal-age')
    || (buildingType === 'town-center' && technologyType === 'castle-age')
    || (buildingType === 'blacksmith' && technologyType === 'fletching')
  );
}

function unitMaxHp(unitType: UnitType): number {
  switch (unitType) {
    case 'villager':
      return 25;
    case 'scout':
      return 45;
    case 'militia':
      return 40;
    case 'spearman':
      return 45;
    case 'archer':
      return 30;
    case 'skirmisher':
      return 30;
    case 'knight':
      return 100;
  }
}

function unitAttackDamage(unitType: UnitType): number {
  switch (unitType) {
    case 'villager':
      return 3;
    case 'scout':
      return 3;
    case 'militia':
      return 4;
    case 'spearman':
      return 3;
    case 'archer':
      return 4;
    case 'skirmisher':
      return 2;
    case 'knight':
      return 10;
  }
}

function unitReloadTicks(unitType: UnitType): number {
  switch (unitType) {
    case 'villager':
      return 12;
    case 'scout':
      return 12;
    case 'militia':
      return 10;
    case 'spearman':
      return 10;
    case 'archer':
      return 20;
    case 'skirmisher':
      return 20;
    case 'knight':
      return 18;
  }
}

function unitAttackRange(unitType: UnitType): number {
  switch (unitType) {
    case 'villager':
    case 'scout':
    case 'militia':
    case 'spearman':
    case 'knight':
      return MELEE_ATTACK_RANGE;
    case 'archer':
    case 'skirmisher':
      return 4;
  }
}

function attackBonusAgainstUnit(attackerType: UnitType, targetType: UnitType): number {
  if (attackerType === 'spearman' && targetType === 'scout') {
    return 12;
  }

  if (attackerType === 'spearman' && targetType === 'knight') {
    return 15;
  }

  if (attackerType === 'skirmisher' && targetType === 'archer') {
    return 4;
  }

  return 0;
}

function isDarkAgePrerequisiteBuilding(buildingType: BuildingType): boolean {
  return (
    buildingType === 'mill'
    || buildingType === 'lumber-camp'
    || buildingType === 'mining-camp'
    || buildingType === 'barracks'
  );
}

function isFeudalAgePrerequisiteBuilding(buildingType: BuildingType): boolean {
  return (
    buildingType === 'stable'
    || buildingType === 'archery-range'
    || buildingType === 'blacksmith'
    || buildingType === 'market'
  );
}

function createProjector(
  visibility: VisibilityMap,
  playerId: number,
  seed: string,
  isSelected: (id: number) => boolean,
): RenderProjector<
  GameEvents,
  GameCommands,
  ProjectedEntityView,
  ProjectedFrameView
> {
  return {
    projectEntity(ref, world) {
      const position = world.getComponent<Position>(ref.id, 'position');
      const renderable = world.getComponent<RenderableComponent>(ref.id, 'renderable');
      if (!position || !renderable) {
        return null;
      }

      const terrain = world.getComponent<TerrainComponent>(ref.id, 'terrain');
      const unit = world.getComponent<UnitComponent>(ref.id, 'unit');
      const building = world.getComponent<BuildingComponent>(ref.id, 'building');
      const resource = world.getComponent<ResourceComponent>(ref.id, 'resource');

      let owner: number | null = null;
      let entityType: ProjectedEntityView['entityType'] = 'grass';

      if (terrain) {
        entityType = terrain.kind;
      }
      if (unit) {
        owner = unit.owner;
        entityType = unit.unitType;
      }
      if (building) {
        owner = building.owner;
        entityType = building.buildingType;
      }
      if (resource) {
        entityType = resource.resourceType;
      }

      if (
        renderable.kind !== 'tile' &&
        owner !== playerId &&
        !visibility.isVisible(playerId, position.x, position.y)
      ) {
        return null;
      }

      return {
        id: ref.id,
        kind: renderable.kind,
        layer: renderable.layer,
        entityType,
        owner,
        x: position.x,
        y: position.y,
        tint: renderable.tint,
        size: renderable.size,
        selected: isSelected(ref.id),
      };
    },
    projectFrame(world) {
      return {
        tick: world.tick,
        playerId,
        seed,
        mapWidth: MAP_WIDTH,
        mapHeight: MAP_HEIGHT,
        visibleCells: visibility
          .getVisibleCells(playerId)
          .map((cell) => toCellIndex(cell.x, cell.y)),
        exploredCells: visibility
          .getExploredCells(playerId)
          .map((cell) => toCellIndex(cell.x, cell.y)),
      };
    },
  };
}

function syncVisibilitySources(
  world: World<GameEvents, GameCommands>,
  visibility: VisibilityMap,
  trackedSources: Map<number, number>,
): void {
  const activeSources = new Map<number, number>();

  for (const id of world.query('position', 'visionSource')) {
    const position = world.getComponent<Position>(id, 'position');
    const source = world.getComponent<VisionSourceComponent>(id, 'visionSource');
    if (!position || !source) {
      continue;
    }

    visibility.setSource(source.playerId, id, {
      x: position.x,
      y: position.y,
      radius: source.radius,
    });
    activeSources.set(id, source.playerId);
  }

  for (const [id, playerId] of trackedSources.entries()) {
    if (activeSources.has(id)) {
      continue;
    }
    visibility.removeSource(playerId, id);
    trackedSources.delete(id);
  }

  for (const [id, playerId] of activeSources.entries()) {
    trackedSources.set(id, playerId);
  }

  visibility.update();
}

function createWorld(seed: string, visibility: VisibilityMap): {
  world: World<GameEvents, GameCommands>;
  getEconomyState: () => EconomyState;
  getPopulationState: (playerId: number) => PopulationState;
  getPlayerAge: (playerId: number) => AgeType;
  getPlayerResources: (playerId: number) => PlayerResources;
  getMatchState: () => MatchState;
  getSelectionState: () => SelectionState;
  selectEntityAtCell: (x: number, y: number) => boolean;
  selectUnitsInBox: (minX: number, minY: number, maxX: number, maxY: number) => boolean;
  clearSelection: () => void;
  issueContextCommand: (x: number, y: number) => boolean;
  issueMoveCommand: (x: number, y: number) => boolean;
  issueAction: (actionType: ActionType) => boolean;
  queueTrainUnit: (unitType: TrainableUnitType) => boolean;
  queueResearch: (technologyType: ResearchableTechnologyType) => boolean;
  issueMarketAction: (actionType: MarketActionType) => boolean;
  beginBuildingPlacement: (buildingType: BuildableBuildingType) => boolean;
  confirmBuildingPlacement: (x: number, y: number) => boolean;
  isSelected: (id: number) => boolean;
} {
  const world = new World<GameEvents, GameCommands>({
    gridWidth: MAP_WIDTH,
    gridHeight: MAP_HEIGHT,
    tps: TPS,
    seed,
  });

  const trackedVisibilitySources = new Map<number, number>();
  const playerAges = new Map<number, AgeType>();
  const researchedTechnologies = new Map<number, Set<ResearchableTechnologyType>>();
  const playerResources = new Map<number, PlayerResources>();
  const marketExchangeRates = createInitialMarketRates();
  const population = new Map<number, PopulationState>();
  const townCenterRefs = new Map<number, EntityRef>();
  const villagerOrdinals = new Map<number, number>();
  const unitCommands = new Map<number, UnitCommand>();
  const rallyPoints = new Map<number, Position>();
  const garrisonedByBuilding = new Map<number, number[]>();
  const garrisonedUnitToBuilding = new Map<number, number>();
  const garrisonedUnitVisionSources = new Map<number, VisionSourceComponent>();
  const productionQueues = new Map<number, ProductionQueueEntry[]>();
  const constructionStates = new Map<number, ConstructionState>();
  const combatStates = new Map<number, CombatState>();
  const buildingHealthStates = new Map<number, BuildingHealthState>();
  const buildingCombatStates = new Map<number, BuildingCombatState>();
  const matchState: MatchState = {
    outcome: 'running',
    summary: 'Battle in progress.',
  };
  let selectedEntityRefs: EntityRef[] = [];
  let placementMode: BuildableBuildingType | null = null;

  world.registerComponent<Position>('position');
  world.registerComponent<TerrainComponent>('terrain');
  world.registerComponent<RenderableComponent>('renderable');
  world.registerComponent<UnitComponent>('unit');
  world.registerComponent<BuildingComponent>('building');
  world.registerComponent<ResourceComponent>('resource');
  world.registerComponent<GathererComponent>('gatherer');
  world.registerComponent<VelocityComponent>('velocity');
  world.registerComponent<VisionSourceComponent>('visionSource');
  world.registerComponent<WanderBoundsComponent>('wanderBounds');

  const scenario = createPrototypeScenario(seed);
  const tiles = createTileGrid(world);

  for (const start of scenario.starts) {
    playerAges.set(start.owner, start.startingAge ?? 'dark-age');
    researchedTechnologies.set(start.owner, new Set());
    playerResources.set(
      start.owner,
      cloneResources(start.startingResources ?? STANDARD_STARTING_RESOURCES),
    );
    population.set(start.owner, {
      current: 0,
      cap: STANDARD_POPULATION_CAP,
    });
    villagerOrdinals.set(start.owner, 0);
  }

  for (const row of scenario.terrain) {
    for (const cell of row) {
      const tile = tiles[cell.y][cell.x];
      const tintByKind: Record<TerrainComponent['kind'], number> = {
        grass: 0x587f4e,
        forest: 0x2f5e34,
        water: 0x295a75,
        hill: 0x8c7d5a,
      };

      world.addComponent(tile, 'terrain', {
        kind: cell.kind,
        buildable: cell.buildable,
        elevation: cell.elevation,
      });
      world.addComponent(tile, 'renderable', {
        kind: 'tile',
        layer: 'terrain',
        tint: tintByKind[cell.kind],
        size: 1,
      });
    }
  }

  function getCurrentEntityId(ref: EntityRef | null): number | null {
    return currentEntityId(world, ref);
  }

  function getEntityRef(id: number): EntityRef | null {
    return world.getEntityRef(id);
  }

  function hasTechnology(owner: number, technologyType: ResearchableTechnologyType): boolean {
    return researchedTechnologies.get(owner)?.has(technologyType) ?? false;
  }

  function createCombatState(owner: number, unitType: UnitType): CombatState {
    const state: CombatState = {
      currentHp: unitMaxHp(unitType),
      maxHp: unitMaxHp(unitType),
      attackDamage: unitAttackDamage(unitType),
      attackRange: unitAttackRange(unitType),
      reloadTicks: unitReloadTicks(unitType),
      cooldownTicks: 0,
    };

    if (unitType === 'archer' && hasTechnology(owner, 'fletching')) {
      state.attackDamage += 1;
      state.attackRange += 1;
    }

    return state;
  }

  function addUnitEntity(
    owner: number,
    unitType: UnitType,
    position: Position,
    vision?: VisionSourceComponent,
  ): number {
    const entity = world.createEntity();
    world.setPosition(entity, position);
    world.addComponent(entity, 'unit', {
      owner,
      unitType,
    });
    world.addComponent(entity, 'renderable', {
      kind: 'unit',
      layer: 'unit',
      tint:
        unitType === 'villager'
          ? owner === HUMAN_PLAYER_ID
            ? 0xf3e2b7
            : 0xf0b8b8
          : unitType === 'militia'
            ? owner === HUMAN_PLAYER_ID
              ? 0xd39a5a
              : 0xd27c7c
          : unitType === 'spearman'
            ? owner === HUMAN_PLAYER_ID
              ? 0x8bb271
              : 0xc88770
          : unitType === 'archer'
            ? owner === HUMAN_PLAYER_ID
              ? 0x84b6d7
              : 0xb38ad6
          : unitType === 'skirmisher'
            ? owner === HUMAN_PLAYER_ID
              ? 0x8fc2c3
              : 0xc18fa8
          : unitType === 'knight'
            ? owner === HUMAN_PLAYER_ID
              ? 0xa6a08d
              : 0xb27d67
          : owner === HUMAN_PLAYER_ID
            ? 0xead74a
            : 0xef7d57,
      size:
        unitType === 'villager'
          ? 0.45
          : unitType === 'militia'
            ? 0.5
            : unitType === 'spearman'
              ? 0.5
            : unitType === 'archer'
              ? 0.48
              : unitType === 'skirmisher'
                ? 0.48
              : unitType === 'knight'
                ? 0.58
              : 0.55,
    });

    const populationState = population.get(owner);
    if (populationState) {
      populationState.current += 1;
    }

    combatStates.set(entity, createCombatState(owner, unitType));

    if (unitType === 'villager') {
      const ordinal = villagerOrdinals.get(owner) ?? 0;
      villagerOrdinals.set(owner, ordinal + 1);
      world.addComponent(entity, 'gatherer', {
        desiredResource: assignVillagerRole(owner, ordinal),
        task: 'idle',
        targetResourceId: null,
        dropOffBuildingId: null,
        carriedResource: null,
        carriedAmount: 0,
        carryCapacity: 10,
        gatherProgressTicks: 0,
      });
    }

    if (vision) {
      world.addComponent(entity, 'visionSource', vision);
    }

    return entity;
  }

  function addBuildingEntity(
    owner: number,
    buildingType: BuildingType,
    position: Position,
    isComplete: boolean,
    vision?: VisionSourceComponent,
  ): number {
    const entity = world.createEntity();
    world.setPosition(entity, position);
    world.addComponent(entity, 'building', {
      owner,
      buildingType,
    });
    world.addComponent(entity, 'renderable', {
      kind: 'building',
      layer: 'building',
      tint: buildingTint(buildingType, owner, isComplete),
      size: buildingSize(buildingType),
    });
    buildingHealthStates.set(entity, {
      currentHp: buildingMaxHp(buildingType),
      maxHp: buildingMaxHp(buildingType),
    });

    if (buildingType === 'town-center') {
      const entityRef = getEntityRef(entity);
      if (entityRef) {
        townCenterRefs.set(owner, entityRef);
      }
    }

    if (
      buildingType === 'town-center'
      || buildingType === 'barracks'
      || buildingType === 'stable'
      || buildingType === 'archery-range'
      || buildingType === 'blacksmith'
      || buildingType === 'market'
    ) {
      if (!productionQueues.has(entity)) {
        productionQueues.set(entity, []);
      }
    }

    const defaultVisionRadius = buildingVisionRadius(buildingType);
    if (vision) {
      world.addComponent(entity, 'visionSource', vision);
    } else if (isComplete && defaultVisionRadius !== null) {
      world.addComponent(entity, 'visionSource', {
        playerId: owner,
        radius: defaultVisionRadius,
      });
    }

    const buildingCombatState = createBuildingCombatState(buildingType);
    if (isComplete && buildingCombatState) {
      buildingCombatStates.set(entity, buildingCombatState);
    }

    const populationState = population.get(owner);
    const populationProvided = buildingPopulationProvided(buildingType);
    if (isComplete && populationState && populationProvided > 0) {
      populationState.cap += populationProvided;
    }

    if (!isComplete) {
      const footprint = buildingFootprint(buildingType);
      constructionStates.set(entity, {
        isComplete: false,
        buildProgressTicks: 0,
        totalBuildTicks: buildingBuildTimeTicks(buildingType),
        populationProvided: buildingPopulationProvided(buildingType),
        width: footprint.width,
        height: footprint.height,
      });
    }

    return entity;
  }

  function addResourceEntity(
    resourceType: ResourceKind,
    position: Position,
    amount: number,
    baseOwner: number | null,
  ): number {
    const entity = world.createEntity();
    world.setPosition(entity, position);

    const tintByResource: Record<ResourceComponent['resourceType'], number> = {
      'berry-bush': 0x7a4c8e,
      'gold-mine': 0xd8b44c,
      'stone-mine': 0x8f9aa4,
      boar: 0x6a3b2e,
      sheep: 0xe7ece6,
      tree: 0x214d2d,
    };
    const sizeByResource: Record<ResourceComponent['resourceType'], number> = {
      'berry-bush': 0.45,
      'gold-mine': 0.8,
      'stone-mine': 0.8,
      boar: 0.48,
      sheep: 0.42,
      tree: 0.58,
    };

    world.addComponent(entity, 'resource', {
      resourceType,
      amount,
      maxAmount: amount,
      baseOwner,
    });
    world.addComponent(entity, 'renderable', {
      kind: 'resource',
      layer: 'resource',
      tint: tintByResource[resourceType],
      size: sizeByResource[resourceType],
    });

    return entity;
  }

  for (const spawn of scenario.spawns) {
    if (
      spawn.kind === 'town-center'
      || spawn.kind === 'house'
      || spawn.kind === 'mill'
      || spawn.kind === 'lumber-camp'
      || spawn.kind === 'mining-camp'
      || spawn.kind === 'barracks'
      || spawn.kind === 'watch-tower'
      || spawn.kind === 'stable'
      || spawn.kind === 'archery-range'
      || spawn.kind === 'blacksmith'
      || spawn.kind === 'market'
    ) {
      const owner = spawn.owner ?? HUMAN_PLAYER_ID;
      addBuildingEntity(owner, spawn.kind, { x: spawn.x, y: spawn.y }, true, spawn.vision);
      continue;
    }

    if (
      spawn.kind === 'villager'
      || spawn.kind === 'scout'
      || spawn.kind === 'militia'
      || spawn.kind === 'spearman'
      || spawn.kind === 'archer'
      || spawn.kind === 'skirmisher'
      || spawn.kind === 'knight'
    ) {
      const owner = spawn.owner ?? HUMAN_PLAYER_ID;
      const unitId = addUnitEntity(owner, spawn.kind, { x: spawn.x, y: spawn.y }, spawn.vision);
      if (spawn.velocity) {
        world.addComponent(unitId, 'velocity', spawn.velocity);
      }
      if (spawn.wanderBounds) {
        world.addComponent(unitId, 'wanderBounds', spawn.wanderBounds);
      }
      continue;
    }

    addResourceEntity(
      spawn.kind,
      { x: spawn.x, y: spawn.y },
      spawn.amount ?? 0,
      spawn.baseOwner,
    );
  }

  function getUnitTaskState(id: number): UnitTaskState {
    if (isGarrisonedUnit(id)) {
      return 'garrisoned';
    }

    const command = unitCommands.get(id);
    if (command) {
      switch (command.type) {
        case 'move':
          return 'moving';
        case 'build':
          return 'building';
        case 'attack':
          return 'attacking';
      }
    }

    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    return gatherer?.task ?? 'idle';
  }

  function isMatchRunning(): boolean {
    return matchState.outcome === 'running';
  }

  function buildingOccupiesCell(buildingId: number, x: number, y: number): boolean {
    const position = world.getComponent<Position>(buildingId, 'position');
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!position || !building) {
      return false;
    }

    const construction = constructionStates.get(buildingId);
    const footprint = construction ?? {
      width: buildingFootprint(building.buildingType).width,
      height: buildingFootprint(building.buildingType).height,
    };

    return (
      x >= position.x
      && x < position.x + footprint.width
      && y >= position.y
      && y < position.y + footprint.height
    );
  }

  function isPlacementBlocked(x: number, y: number, width: number, height: number): boolean {
    for (let cellY = y; cellY < y + height; cellY += 1) {
      for (let cellX = x; cellX < x + width; cellX += 1) {
        if (cellX < 0 || cellX >= MAP_WIDTH || cellY < 0 || cellY >= MAP_HEIGHT) {
          return true;
        }

        const tile = tiles[cellY]?.[cellX];
        const terrain = tile === undefined ? null : world.getComponent<TerrainComponent>(tile, 'terrain');
        if (!terrain?.buildable) {
          return true;
        }

        for (const buildingId of world.query('building')) {
          if (buildingOccupiesCell(buildingId, cellX, cellY)) {
            return true;
          }
        }

        for (const id of world.query('position', 'resource')) {
          const position = world.getComponent<Position>(id, 'position');
          if (position?.x === cellX && position.y === cellY) {
            return true;
          }
        }

        for (const id of world.query('position', 'unit')) {
          const position = world.getComponent<Position>(id, 'position');
          if (position?.x === cellX && position.y === cellY) {
            return true;
          }
        }
      }
    }

    return false;
  }

  function findSpawnPosition(origin: Position): Position {
    const offsets = [
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: -1, y: 1 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: -2, y: 0 },
      { x: 2, y: 0 },
    ];

    for (const offset of offsets) {
      const candidate = {
        x: clamp(origin.x + offset.x, 0, MAP_WIDTH - 1),
        y: clamp(origin.y + offset.y, 0, MAP_HEIGHT - 1),
      };
      if (!isPlacementBlocked(candidate.x, candidate.y, 1, 1)) {
        return candidate;
      }
    }

    return origin;
  }

  function clearGathererOrder(id: number): void {
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    if (!gatherer) {
      return;
    }

    gatherer.task = 'idle';
    gatherer.targetResourceId = null;
    gatherer.dropOffBuildingId = null;
    gatherer.gatherProgressTicks = 0;
  }

  function isGarrisonedUnit(id: number): boolean {
    return garrisonedUnitToBuilding.has(id);
  }

  function getActionOptions(owner: number, buildingType: BuildingType, buildingId: number): ActionType[] {
    if (
      owner === HUMAN_PLAYER_ID
      && buildingGarrisonCapacity(buildingType) > 0
      && (garrisonedByBuilding.get(buildingId)?.length ?? 0) > 0
    ) {
      return ['ungarrison'];
    }

    return [];
  }

  function isVisibleToHuman(position: Position, owner: number | null): boolean {
    return owner === HUMAN_PLAYER_ID || visibility.isVisible(HUMAN_PLAYER_ID, position.x, position.y);
  }

  function findSelectableEntityAtCell(x: number, y: number): number | null {
    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (position?.x === x && position.y === y && isVisibleToHuman(position, unit?.owner ?? null)) {
        return id;
      }
    }

    for (const id of world.query('position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (position && building && buildingOccupiesCell(id, x, y) && isVisibleToHuman(position, building.owner)) {
        return id;
      }
    }

    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      if (position?.x === x && position.y === y && visibility.isVisible(HUMAN_PLAYER_ID, x, y)) {
        return id;
      }
    }

    return null;
  }

  function selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const clampedMinX = clamp(Math.min(minX, maxX), 0, MAP_WIDTH - 1);
    const clampedMaxX = clamp(Math.max(minX, maxX), 0, MAP_WIDTH - 1);
    const clampedMinY = clamp(Math.min(minY, maxY), 0, MAP_HEIGHT - 1);
    const clampedMaxY = clamp(Math.max(minY, maxY), 0, MAP_HEIGHT - 1);

    const ids = [...world.query('position', 'unit')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; unit: UnitComponent } =>
          entry.position !== undefined
          && entry.unit !== undefined
          && entry.unit.owner === HUMAN_PLAYER_ID
          && entry.position.x >= clampedMinX
          && entry.position.x <= clampedMaxX
          && entry.position.y >= clampedMinY
          && entry.position.y <= clampedMaxY,
      )
      .sort((left, right) => {
        const yDelta = left.position.y - right.position.y;
        if (yDelta !== 0) {
          return yDelta;
        }

        return left.position.x - right.position.x;
      })
      .map((entry) => entry.id);

    selectedEntityRefs = ids
      .map((id) => getEntityRef(id))
      .filter((ref): ref is EntityRef => ref !== null);

    if (selectedEntityRefs.length === 0) {
      placementMode = null;
      return false;
    }

    placementMode = null;
    return true;
  }

  function getSelectedEntityIds(): number[] {
    const ids: number[] = [];
    const nextRefs: EntityRef[] = [];

    for (const ref of selectedEntityRefs) {
      const id = getCurrentEntityId(ref);
      if (id === null || ids.includes(id)) {
        continue;
      }

      ids.push(id);
      nextRefs.push(ref);
    }

    if (nextRefs.length !== selectedEntityRefs.length) {
      selectedEntityRefs = nextRefs;
      if (selectedEntityRefs.length === 0) {
        placementMode = null;
      }
    }

    return ids;
  }

  function getSelectedEntityId(): number | null {
    const ids = getSelectedEntityIds();
    if (ids.length > 0) {
      return ids[0];
    }

    if (selectedEntityRefs.length > 0) {
      selectedEntityRefs = [];
      placementMode = null;
    }

    return null;
  }

  function removeSelectedEntity(id: number): void {
    const nextRefs = selectedEntityRefs.filter((ref) => getCurrentEntityId(ref) !== id);
    if (nextRefs.length === selectedEntityRefs.length) {
      return;
    }

    selectedEntityRefs = nextRefs;
    if (selectedEntityRefs.length === 0) {
      placementMode = null;
    }
  }

  function findResourceAtCell(x: number, y: number): number | null {
    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (
        position?.x === x
        && position.y === y
        && resource
        && resource.amount > 0
        && visibility.isVisible(HUMAN_PLAYER_ID, x, y)
      ) {
        return id;
      }
    }

    return null;
  }

  function findHostileUnitAtCell(x: number, y: number, attackerOwner: number): number | null {
    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (
        position?.x === x
        && position.y === y
        && unit
        && unit.owner !== attackerOwner
        && visibility.isVisible(HUMAN_PLAYER_ID, x, y)
      ) {
        return id;
      }
    }

    return null;
  }

  function findHostileBuildingAtCell(x: number, y: number, attackerOwner: number): number | null {
    for (const id of world.query('position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (
        position
        && building
        && building.owner !== attackerOwner
        && buildingOccupiesCell(id, x, y)
        && visibility.isVisible(HUMAN_PLAYER_ID, x, y)
      ) {
        return id;
      }
    }

    return null;
  }

  function findOwnedGarrisonBuildingAtCell(x: number, y: number, owner: number, unitType: UnitType): number | null {
    for (const id of world.query('position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (
        position
        && building
        && building.owner === owner
        && canGarrisonAt(building.buildingType, unitType)
        && buildingOccupiesCell(id, x, y)
      ) {
        const construction = constructionStates.get(id);
        if (construction && !construction.isComplete) {
          continue;
        }

        return id;
      }
    }

    return null;
  }

  function distanceToBuilding(id: number, position: Position): number {
    const buildingPosition = world.getComponent<Position>(id, 'position');
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (!buildingPosition || !building) {
      return Number.POSITIVE_INFINITY;
    }

    const footprint = buildingFootprint(building.buildingType);
    const minX = buildingPosition.x;
    const maxX = buildingPosition.x + footprint.width - 1;
    const minY = buildingPosition.y;
    const maxY = buildingPosition.y + footprint.height - 1;

    const dx =
      position.x < minX ? minX - position.x
      : position.x > maxX ? position.x - maxX
      : 0;
    const dy =
      position.y < minY ? minY - position.y
      : position.y > maxY ? position.y - maxY
      : 0;

    return dx + dy;
  }

  function getBuildingApproachPosition(id: number, from: Position): Position | null {
    const buildingPosition = world.getComponent<Position>(id, 'position');
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (!buildingPosition || !building) {
      return null;
    }

    const footprint = buildingFootprint(building.buildingType);
    const candidates: Position[] = [];

    for (let x = buildingPosition.x; x < buildingPosition.x + footprint.width; x += 1) {
      candidates.push({ x, y: buildingPosition.y - 1 });
      candidates.push({ x, y: buildingPosition.y + footprint.height });
    }

    for (let y = buildingPosition.y; y < buildingPosition.y + footprint.height; y += 1) {
      candidates.push({ x: buildingPosition.x - 1, y });
      candidates.push({ x: buildingPosition.x + footprint.width, y });
    }

    const inBoundsCandidates = candidates.filter(
      (candidate) =>
        candidate.x >= 0
        && candidate.x < MAP_WIDTH
        && candidate.y >= 0
        && candidate.y < MAP_HEIGHT,
    );

    inBoundsCandidates.sort((left, right) => manhattanDistance(from, left) - manhattanDistance(from, right));
    return inBoundsCandidates[0] ?? null;
  }

  function destroyUnitEntity(id: number): void {
    const garrisonBuildingId = garrisonedUnitToBuilding.get(id) ?? null;
    if (garrisonBuildingId !== null) {
      const garrisonedUnits = garrisonedByBuilding.get(garrisonBuildingId) ?? [];
      garrisonedByBuilding.set(
        garrisonBuildingId,
        garrisonedUnits.filter((candidateId) => candidateId !== id),
      );
      if ((garrisonedByBuilding.get(garrisonBuildingId)?.length ?? 0) === 0) {
        garrisonedByBuilding.delete(garrisonBuildingId);
      }
      garrisonedUnitToBuilding.delete(id);
      garrisonedUnitVisionSources.delete(id);
    }

    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (unit) {
      const populationState = population.get(unit.owner);
      if (populationState) {
        populationState.current = Math.max(0, populationState.current - 1);
      }
    }

    removeSelectedEntity(id);

    unitCommands.delete(id);
    combatStates.delete(id);
    world.destroyEntity(id);
  }

  function destroyBuildingEntity(id: number): void {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    const construction = constructionStates.get(id);
    for (const garrisonedUnitId of garrisonedByBuilding.get(id) ?? []) {
      destroyUnitEntity(garrisonedUnitId);
    }
    garrisonedByBuilding.delete(id);

    if (building?.buildingType === 'town-center') {
      const townCenterRef = townCenterRefs.get(building.owner) ?? null;
      if (isSameEntity(townCenterRef, id, world)) {
        townCenterRefs.delete(building.owner);
      }
    }

    if (building) {
      const populationState = population.get(building.owner);
      const populationProvided =
        construction?.populationProvided ?? buildingPopulationProvided(building.buildingType);
      const isComplete = construction?.isComplete ?? true;
      if (populationState && isComplete && populationProvided > 0) {
        populationState.cap = Math.max(populationState.current, populationState.cap - populationProvided);
      }
    }

    removeSelectedEntity(id);

    productionQueues.delete(id);
    rallyPoints.delete(id);
    constructionStates.delete(id);
    buildingHealthStates.delete(id);
    buildingCombatStates.delete(id);
    world.destroyEntity(id);
  }

  function issueUnitMoveCommand(unitId: number, target: Position): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit) {
      return false;
    }

    clearGathererOrder(unitId);
    unitCommands.set(unitId, {
      type: 'move',
      target: {
        x: clamp(target.x, 0, MAP_WIDTH - 1),
        y: clamp(target.y, 0, MAP_HEIGHT - 1),
      },
    });
    return true;
  }

  function issueUnitAttackCommand(
    unitId: number,
    targetEntityId: number,
    targetEntityKind: 'unit' | 'building',
  ): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!unit || !targetPosition) {
      return false;
    }

    if (targetEntityKind === 'unit') {
      const targetUnit = world.getComponent<UnitComponent>(targetEntityId, 'unit');
      if (!targetUnit || targetUnit.owner === unit.owner) {
        return false;
      }
    } else {
      const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
      if (!targetBuilding || targetBuilding.owner === unit.owner) {
        return false;
      }
    }

    const targetEntityRef = getEntityRef(targetEntityId);
    if (!targetEntityRef) {
      return false;
    }

    clearGathererOrder(unitId);
    unitCommands.set(unitId, {
      type: 'attack',
      target: {
        x: targetPosition.x,
        y: targetPosition.y,
      },
      targetEntityRef,
      targetEntityKind,
    });
    return true;
  }

  function enqueueTraining(buildingId: number, unitType: TrainableUnitType): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!building) {
      return false;
    }

    const construction = constructionStates.get(buildingId);
    if (construction && !construction.isComplete) {
      return false;
    }

    if (
      !canTrainAt(building.buildingType, unitType)
      || !getTrainOptions(building.owner, building.buildingType).includes(unitType)
    ) {
      return false;
    }

    const stockpile = playerResources.get(building.owner);
    if (!stockpile) {
      return false;
    }

    const cost = trainingCost(unitType);
    if (!canAfford(stockpile, cost)) {
      return false;
    }

    spendResources(stockpile, cost);
    const queue = productionQueues.get(buildingId) ?? [];
    const totalTicks = trainingTimeTicks(unitType);
    queue.push({
      kind: 'unit',
      label: unitType,
      unitType,
      remainingTicks: totalTicks,
      totalTicks,
      isBlocked: false,
    });
    productionQueues.set(buildingId, queue);
    return true;
  }

  function enqueueResearch(buildingId: number, technologyType: ResearchableTechnologyType): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!building) {
      return false;
    }

    const construction = constructionStates.get(buildingId);
    if (construction && !construction.isComplete) {
      return false;
    }

    if (!canResearchAt(building.buildingType, technologyType)) {
      return false;
    }

    if (!getResearchOptions(building.owner, building.buildingType).includes(technologyType)) {
      return false;
    }

    const queue = productionQueues.get(buildingId) ?? [];
    if (queue.some((entry) => entry.kind === 'technology' && entry.technologyType === technologyType)) {
      return false;
    }

    const stockpile = playerResources.get(building.owner);
    if (!stockpile) {
      return false;
    }

    const cost = researchCost(technologyType);
    if (!canAfford(stockpile, cost)) {
      return false;
    }

    spendResources(stockpile, cost);
    const totalTicks = researchTimeTicks(technologyType);
    queue.push({
      kind: 'technology',
      label: technologyType,
      technologyType,
      remainingTicks: totalTicks,
      totalTicks,
      isBlocked: false,
    });
    productionQueues.set(buildingId, queue);
    return true;
  }

  function executeMarketAction(actionType: MarketActionType): boolean {
    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) {
      return false;
    }

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== HUMAN_PLAYER_ID || building.buildingType !== 'market') {
      return false;
    }

    const construction = constructionStates.get(selectedEntityId);
    if (construction && !construction.isComplete) {
      return false;
    }

    if (!getMarketOptions(building.owner, building.buildingType).includes(actionType)) {
      return false;
    }

    const stockpile = playerResources.get(building.owner);
    if (!stockpile) {
      return false;
    }

    const commodity = marketCommodityForAction(actionType);
    const rate = marketExchangeRates[commodity];
    if (isBuyMarketAction(actionType)) {
      const goldCost = Math.ceil(rate * (1 + MARKET_FEE_RATE));
      if (stockpile.gold < goldCost) {
        return false;
      }

      stockpile.gold -= goldCost;
      stockpile[commodity] += MARKET_TRANSACTION_AMOUNT;
      marketExchangeRates[commodity] = rate + MARKET_RATE_STEP;
      return true;
    }

    if (stockpile[commodity] < MARKET_TRANSACTION_AMOUNT) {
      return false;
    }

    stockpile[commodity] -= MARKET_TRANSACTION_AMOUNT;
    stockpile.gold += Math.floor(rate * (1 - MARKET_FEE_RATE));
    marketExchangeRates[commodity] = Math.max(MARKET_MIN_RATE, rate - MARKET_RATE_STEP);
    return true;
  }

  function garrisonUnit(unitId: number, buildingId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    const capacity = building ? buildingGarrisonCapacity(building.buildingType) : 0;
    if (!unit || !building || unit.owner !== building.owner || !canGarrisonAt(building.buildingType, unit.unitType)) {
      return false;
    }

    const currentUnits = garrisonedByBuilding.get(buildingId) ?? [];
    if (currentUnits.length >= capacity || isGarrisonedUnit(unitId)) {
      return false;
    }

    clearGathererOrder(unitId);
    unitCommands.delete(unitId);

    const visionSource = world.getComponent<VisionSourceComponent>(unitId, 'visionSource');
    if (visionSource) {
      garrisonedUnitVisionSources.set(unitId, { ...visionSource });
      world.removeComponent(unitId, 'visionSource');
    }

    world.removeComponent(unitId, 'position');
    garrisonedUnitToBuilding.set(unitId, buildingId);
    currentUnits.push(unitId);
    garrisonedByBuilding.set(buildingId, currentUnits);
    selectedEntityRefs = [];
    placementMode = null;
    return true;
  }

  function ungarrisonBuilding(buildingId: number): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    const buildingPosition = world.getComponent<Position>(buildingId, 'position');
    const garrisonedUnits = garrisonedByBuilding.get(buildingId) ?? [];
    if (!building || !buildingPosition || garrisonedUnits.length === 0) {
      return false;
    }

    for (const unitId of garrisonedUnits) {
      const unit = world.getComponent<UnitComponent>(unitId, 'unit');
      if (!unit) {
        continue;
      }

      const spawnPosition = findSpawnPosition(buildingPosition);
      world.setPosition(unitId, spawnPosition);
      const storedVisionSource = garrisonedUnitVisionSources.get(unitId);
      if (storedVisionSource) {
        world.addComponent(unitId, 'visionSource', storedVisionSource);
        garrisonedUnitVisionSources.delete(unitId);
      }
      garrisonedUnitToBuilding.delete(unitId);
      clearGathererOrder(unitId);
    }

    garrisonedByBuilding.delete(buildingId);
    return true;
  }

  function startConstruction(
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
  ): boolean {
    const unit = world.getComponent<UnitComponent>(builderId, 'unit');
    if (!unit || unit.unitType !== 'villager') {
      return false;
    }

    if (!getBuildOptions(unit.owner, unit.unitType).includes(buildingType)) {
      return false;
    }

    const clampedAnchor = {
      x: clamp(anchor.x, 0, MAP_WIDTH - 1),
      y: clamp(anchor.y, 0, MAP_HEIGHT - 1),
    };
    const footprint = buildingFootprint(buildingType);
    if (isPlacementBlocked(clampedAnchor.x, clampedAnchor.y, footprint.width, footprint.height)) {
      return false;
    }

    const stockpile = playerResources.get(unit.owner);
    if (!stockpile) {
      return false;
    }

    const cost = constructionCost(buildingType);
    if (!canAfford(stockpile, cost)) {
      return false;
    }

    spendResources(stockpile, cost);
    const buildingId = addBuildingEntity(unit.owner, buildingType, clampedAnchor, false);
    const buildingRef = getEntityRef(buildingId);
    if (!buildingRef) {
      throw new Error(`Expected a current EntityRef for new ${buildingType} construction.`);
    }
    clearGathererOrder(builderId);
    unitCommands.set(builderId, {
      type: 'build',
      target: clampedAnchor,
      buildingRef,
    });
    return true;
  }

  function findBuildPlacementNear(
    origin: Position,
    buildingType: BuildableBuildingType,
  ): Position | null {
    const footprint = buildingFootprint(buildingType);

    for (let radius = 2; radius <= 6; radius += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) {
            continue;
          }

          const candidate = {
            x: origin.x + offsetX,
            y: origin.y + offsetY,
          };
          if (
            candidate.x < 0
            || candidate.y < 0
            || candidate.x + footprint.width > MAP_WIDTH
            || candidate.y + footprint.height > MAP_HEIGHT
          ) {
            continue;
          }

          if (!isPlacementBlocked(candidate.x, candidate.y, footprint.width, footprint.height)) {
            return candidate;
          }
        }
      }
    }

    return null;
  }

  function findOwnedBuilding(owner: number, buildingType: BuildingType): number | null {
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (building?.owner === owner && building.buildingType === buildingType) {
        return id;
      }
    }

    return null;
  }

  function findOwnedUnit(owner: number, unitType: UnitType): number | null {
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit?.owner === owner && unit.unitType === unitType) {
        return id;
      }
    }

    return null;
  }

  function findAvailableVillager(owner: number): number | null {
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit?.owner === owner && unit.unitType === 'villager' && !unitCommands.has(id)) {
        return id;
      }
    }

    return findOwnedUnit(owner, 'villager');
  }

  function countQueuedUnits(buildingId: number, unitType: TrainableUnitType): number {
    const queue = productionQueues.get(buildingId) ?? [];
    return queue.filter((entry) => entry.kind === 'unit' && entry.unitType === unitType).length;
  }

  function countOwnedUnits(owner: number, unitType: UnitType): number {
    let count = 0;

    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit?.owner === owner && unit.unitType === unitType) {
        count += 1;
      }
    }

    return count;
  }

  function countCompletedOwnedBuildings(owner: number, filter: (buildingType: BuildingType) => boolean): number {
    let count = 0;

    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== owner || !filter(building.buildingType)) {
        continue;
      }

      const construction = constructionStates.get(id);
      if (construction && !construction.isComplete) {
        continue;
      }

      count += 1;
    }

    return count;
  }

  function hasCompletedBuilding(owner: number, buildingType: BuildingType): boolean {
    return countCompletedOwnedBuildings(owner, (candidate) => candidate === buildingType) > 0;
  }

  function getPlayerAge(owner: number): AgeType {
    return playerAges.get(owner) ?? 'dark-age';
  }

  function canAdvanceToFeudalAge(owner: number): boolean {
    if (getPlayerAge(owner) !== 'dark-age') {
      return false;
    }

    return countCompletedOwnedBuildings(owner, isDarkAgePrerequisiteBuilding) >= 2;
  }

  function canAdvanceToCastleAge(owner: number): boolean {
    if (getPlayerAge(owner) !== 'feudal-age') {
      return false;
    }

    return countCompletedOwnedBuildings(owner, isFeudalAgePrerequisiteBuilding) >= 2;
  }

  function getTrainOptions(owner: number, buildingType: BuildingType): TrainableUnitType[] {
    switch (buildingType) {
      case 'town-center':
        return ['villager'];
      case 'barracks': {
        const options: TrainableUnitType[] = ['militia'];
        if (getPlayerAge(owner) !== 'dark-age') {
          options.push('spearman');
        }
        return options;
      }
      case 'stable':
        return getPlayerAge(owner) === 'dark-age'
          ? []
          : getPlayerAge(owner) === 'castle-age' || getPlayerAge(owner) === 'imperial-age'
            ? ['scout', 'knight']
            : ['scout'];
      case 'archery-range':
        return getPlayerAge(owner) !== 'dark-age' ? ['archer', 'skirmisher'] : [];
      default:
        return [];
    }
  }

  function getResearchOptions(owner: number, buildingType: BuildingType): ResearchableTechnologyType[] {
    if (buildingType === 'town-center' && canAdvanceToFeudalAge(owner)) {
      return ['feudal-age'];
    }

    if (buildingType === 'town-center' && canAdvanceToCastleAge(owner)) {
      return ['castle-age'];
    }

    if (buildingType === 'blacksmith' && getPlayerAge(owner) !== 'dark-age' && !hasTechnology(owner, 'fletching')) {
      return ['fletching'];
    }

    return [];
  }

  function getMarketOptions(owner: number, buildingType: BuildingType): MarketActionType[] {
    if (buildingType !== 'market' || getPlayerAge(owner) === 'dark-age') {
      return [];
    }

    return [
      'buy-food',
      'sell-food',
      'buy-wood',
      'sell-wood',
      'buy-stone',
      'sell-stone',
    ];
  }

  function getBuildOptions(owner: number, unitType: UnitType): BuildableBuildingType[] {
    if (unitType !== 'villager') {
      return [];
    }

    const options: BuildableBuildingType[] = [
      'house',
      'mill',
      'lumber-camp',
      'mining-camp',
      'barracks',
    ];

    if (getPlayerAge(owner) !== 'dark-age' && hasCompletedBuilding(owner, 'barracks')) {
      options.push('stable');
      options.push('archery-range');
      options.push('blacksmith');
      options.push('market');
      if (hasCompletedBuilding(owner, 'blacksmith')) {
        options.push('watch-tower');
      }
    }

    if (getPlayerAge(owner) === 'castle-age' || getPlayerAge(owner) === 'imperial-age') {
      options.push('town-center');
    }

    return options;
  }

  function targetPriority(unitType: UnitType): number {
    switch (unitType) {
      case 'villager':
        return 0;
      case 'archer':
        return 1;
      case 'spearman':
        return 2;
      case 'skirmisher':
        return 3;
      case 'knight':
        return 4;
      case 'militia':
        return 5;
      case 'scout':
        return 6;
    }
  }

  function findPreferredVisibleEnemyUnit(viewerOwner: number, origin: Position): number | null {
    const candidates = [...world.query('position', 'unit')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; unit: UnitComponent } =>
          entry.position !== undefined
          && entry.unit !== undefined
          && entry.unit.owner !== viewerOwner
          && visibility.isVisible(viewerOwner, entry.position.x, entry.position.y),
      )
      .sort((left, right) => {
        const priorityDelta = targetPriority(left.unit.unitType) - targetPriority(right.unit.unitType);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return manhattanDistance(origin, left.position) - manhattanDistance(origin, right.position);
      });

    return candidates[0]?.id ?? null;
  }

  function findPreferredVisibleEnemyUnitInRange(
    viewerOwner: number,
    origin: Position,
    range: number,
  ): number | null {
    const candidates = [...world.query('position', 'unit')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; unit: UnitComponent } =>
          entry.position !== undefined
          && entry.unit !== undefined
          && entry.unit.owner !== viewerOwner
          && visibility.isVisible(viewerOwner, entry.position.x, entry.position.y)
          && manhattanDistance(origin, entry.position) <= range,
      )
      .sort((left, right) => {
        const priorityDelta = targetPriority(left.unit.unitType) - targetPriority(right.unit.unitType);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return manhattanDistance(origin, left.position) - manhattanDistance(origin, right.position);
      });

    return candidates[0]?.id ?? null;
  }

  function findPreferredVisibleEnemyBuilding(viewerOwner: number, origin: Position): number | null {
    const candidates = [...world.query('position', 'building')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        building: world.getComponent<BuildingComponent>(id, 'building'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; building: BuildingComponent } =>
          entry.position !== undefined
          && entry.building !== undefined
          && entry.building.owner !== viewerOwner
          && visibility.isVisible(viewerOwner, entry.position.x, entry.position.y),
      )
      .sort((left, right) => manhattanDistance(origin, left.position) - manhattanDistance(origin, right.position));

    return candidates[0]?.id ?? null;
  }

  function findNearestDropOffBuilding(
    activeWorld: World<GameEvents, GameCommands>,
    owner: number,
    resourceKind: EconomyResourceKind,
    origin: Position,
  ): number | null {
    let nearestBuildingId: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const id of activeWorld.query('position', 'building')) {
      const position = activeWorld.getComponent<Position>(id, 'position');
      const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
      if (!position || !building || building.owner !== owner) {
        continue;
      }

      const construction = constructionStates.get(id);
      if (construction && !construction.isComplete) {
        continue;
      }

      if (!canDropOffAt(building.buildingType, resourceKind)) {
        continue;
      }

      const distance = manhattanDistance(origin, position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBuildingId = id;
      }
    }

    return nearestBuildingId;
  }

  function assignNearestResource(
    activeWorld: World<GameEvents, GameCommands>,
    villagerId: number,
    gatherer: GathererComponent,
    owner: number,
  ): void {
    const villagerPosition = activeWorld.getComponent<Position>(villagerId, 'position');
    if (!villagerPosition) {
      return;
    }

    const matchingResources = [...activeWorld.query('position', 'resource')]
      .map((id) => ({
        id,
        position: activeWorld.getComponent<Position>(id, 'position'),
        resource: activeWorld.getComponent<ResourceComponent>(id, 'resource'),
      }))
      .filter(isResourceCandidate)
      .filter((entry) => entry.resource.amount > 0)
      .filter(
        (entry) => resourceKindToEconomyResource(entry.resource.resourceType) === gatherer.desiredResource,
      )
      .sort((left, right) => {
        const leftPreferred = left.resource.baseOwner === owner ? 0 : 1;
        const rightPreferred = right.resource.baseOwner === owner ? 0 : 1;
        if (leftPreferred !== rightPreferred) {
          return leftPreferred - rightPreferred;
        }
        const leftDistance = manhattanDistance(left.position, villagerPosition);
        const rightDistance = manhattanDistance(right.position, villagerPosition);
        return leftDistance - rightDistance;
      });

    const target = matchingResources[0];
    if (!target) {
      gatherer.task = 'idle';
      gatherer.targetResourceId = null;
      return;
    }

    gatherer.task = 'to-resource';
    gatherer.targetResourceId = target.id;
    gatherer.dropOffBuildingId = findNearestDropOffBuilding(
      activeWorld,
      owner,
      gatherer.desiredResource,
      target.position,
    );
    gatherer.gatherProgressTicks = 0;
  }

  function playerHasConquestPresence(owner: number): boolean {
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit?.owner === owner) {
        return true;
      }
    }

    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (building?.owner === owner) {
        return true;
      }
    }

    return false;
  }

  function applyTechnology(owner: number, technologyType: ResearchableTechnologyType): void {
    researchedTechnologies.get(owner)?.add(technologyType);

    switch (technologyType) {
      case 'feudal-age':
        playerAges.set(owner, 'feudal-age');
        break;
      case 'castle-age':
        playerAges.set(owner, 'castle-age');
        break;
      case 'fletching':
        for (const id of world.query('unit')) {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = combatStates.get(id);
          if (!unit || !combat || unit.owner !== owner || unit.unitType !== 'archer') {
            continue;
          }

          combat.attackDamage = unitAttackDamage(unit.unitType) + 1;
          combat.attackRange = unitAttackRange(unit.unitType) + 1;
        }
        break;
    }
  }

  world.registerSystem({
    name: 'prototypeAi',
    phase: 'update',
    execute(activeWorld) {
      const humanTownCenterId = currentEntityId(
        activeWorld,
        townCenterRefs.get(HUMAN_PLAYER_ID),
      );
      const humanTownCenterPosition =
        humanTownCenterId === null
          ? null
          : activeWorld.getComponent<Position>(humanTownCenterId, 'position');

      for (const [owner] of playerResources.entries()) {
        if (owner === HUMAN_PLAYER_ID) {
          continue;
        }

        const humanVillagerId = findOwnedUnit(HUMAN_PLAYER_ID, 'villager');
        const ownerTownCenterId = currentEntityId(activeWorld, townCenterRefs.get(owner));
        const ownerTownCenterPosition =
          ownerTownCenterId === null
            ? null
            : activeWorld.getComponent<Position>(ownerTownCenterId, 'position');

        const populationState = population.get(owner);
        const houseId = findOwnedBuilding(owner, 'house');
        if (
          houseId === null
          && ownerTownCenterPosition
          && populationState
          && populationState.current >= populationState.cap
        ) {
          const builderId = findAvailableVillager(owner);
          const anchor = findBuildPlacementNear(ownerTownCenterPosition, 'house');
          if (builderId !== null && anchor) {
            startConstruction(builderId, 'house', anchor);
          }
        }

        const barracksId = findOwnedBuilding(owner, 'barracks');
        if (barracksId === null && ownerTownCenterPosition) {
          const builderId = findAvailableVillager(owner);
          const anchor = findBuildPlacementNear(ownerTownCenterPosition, 'barracks');
          if (builderId !== null && anchor) {
            startConstruction(builderId, 'barracks', anchor);
          }
        }

        const completedBarracksId = barracksId;
        if (
          completedBarracksId !== null
          && countOwnedUnits(owner, 'militia') + countQueuedUnits(completedBarracksId, 'militia') < 2
        ) {
          enqueueTraining(completedBarracksId, 'militia');
        }

        for (const id of activeWorld.query('position', 'unit')) {
          const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
          const position = activeWorld.getComponent<Position>(id, 'position');
          if (!unit || !position || unit.owner !== owner || unit.unitType !== 'militia') {
            continue;
          }

          const currentCommand = unitCommands.get(id);
          if (currentCommand?.type === 'attack') {
            const targetId = currentEntityId(activeWorld, currentCommand.targetEntityRef);
            if (targetId !== null) {
              const hasUnitTarget =
                currentCommand.targetEntityKind === 'unit'
                && activeWorld.getComponent<UnitComponent>(targetId, 'unit')
                && activeWorld.getComponent<Position>(targetId, 'position');
              const hasBuildingTarget =
                currentCommand.targetEntityKind === 'building'
                && activeWorld.getComponent<BuildingComponent>(targetId, 'building')
                && activeWorld.getComponent<Position>(targetId, 'position');
              if (hasUnitTarget || hasBuildingTarget) {
                continue;
              }
            }
          }

          if (humanVillagerId !== null && issueUnitAttackCommand(id, humanVillagerId, 'unit')) {
            continue;
          }

          const visibleTargetId = findPreferredVisibleEnemyUnit(owner, position);
          if (visibleTargetId !== null) {
            issueUnitAttackCommand(id, visibleTargetId, 'unit');
            continue;
          }

          const visibleBuildingId = findPreferredVisibleEnemyBuilding(owner, position);
          if (visibleBuildingId !== null && issueUnitAttackCommand(id, visibleBuildingId, 'building')) {
            continue;
          }

          if (humanTownCenterId !== null && issueUnitAttackCommand(id, humanTownCenterId, 'building')) {
            continue;
          }

          if (humanTownCenterPosition) {
            issueUnitMoveCommand(id, humanTownCenterPosition);
          }
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypePlayerCommands',
    phase: 'update',
    execute(activeWorld) {
      for (const [id, command] of [...unitCommands.entries()]) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!position || !unit) {
          unitCommands.delete(id);
          continue;
        }

        if (command.type === 'attack') {
          const attackerCombat = combatStates.get(id);
          const targetId = currentEntityId(activeWorld, command.targetEntityRef);
          if (targetId === null || !attackerCombat || !command.targetEntityKind) {
            unitCommands.delete(id);
            continue;
          }

          if (attackerCombat.cooldownTicks > 0) {
            attackerCombat.cooldownTicks -= 1;
          }

          if (command.targetEntityKind === 'unit') {
            const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
            const targetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
            const targetCombat = combatStates.get(targetId);
            if (!targetPosition || !targetUnit || !targetCombat || targetUnit.owner === unit.owner) {
              unitCommands.delete(id);
              continue;
            }

            if (manhattanDistance(position, targetPosition) > attackerCombat.attackRange) {
              activeWorld.setPosition(id, stepToward(position, targetPosition));
              continue;
            }

            if (attackerCombat.cooldownTicks > 0) {
              continue;
            }

            targetCombat.currentHp -=
              attackerCombat.attackDamage + attackBonusAgainstUnit(unit.unitType, targetUnit.unitType);
            attackerCombat.cooldownTicks = attackerCombat.reloadTicks;

            if (targetCombat.currentHp <= 0) {
              destroyUnitEntity(targetId);
              unitCommands.delete(id);
            }
            continue;
          }

          const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
          const targetBuilding = activeWorld.getComponent<BuildingComponent>(targetId, 'building');
          const targetHealth = buildingHealthStates.get(targetId);
          if (!targetPosition || !targetBuilding || !targetHealth || targetBuilding.owner === unit.owner) {
            unitCommands.delete(id);
            continue;
          }

          if (distanceToBuilding(targetId, position) > attackerCombat.attackRange) {
            const approachPosition = getBuildingApproachPosition(targetId, position);
            if (!approachPosition) {
              unitCommands.delete(id);
              continue;
            }
            activeWorld.setPosition(id, stepToward(position, approachPosition));
            continue;
          }

          if (attackerCombat.cooldownTicks > 0) {
            continue;
          }

          targetHealth.currentHp -= attackerCombat.attackDamage;
          attackerCombat.cooldownTicks = attackerCombat.reloadTicks;

          if (targetHealth.currentHp <= 0) {
            destroyBuildingEntity(targetId);
            unitCommands.delete(id);
          }
          continue;
        }

        if (command.type === 'move') {
          if (isAtTarget(position, command.target)) {
            unitCommands.delete(id);
            continue;
          }

          activeWorld.setPosition(id, stepToward(position, command.target));
          continue;
        }

        const buildingId = currentEntityId(activeWorld, command.buildingRef);
        if (buildingId === null) {
          unitCommands.delete(id);
          continue;
        }

        const buildingPosition = activeWorld.getComponent<Position>(buildingId, 'position');
        const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
        const construction = constructionStates.get(buildingId);
        if (!buildingPosition || !building || !construction || construction.isComplete) {
          unitCommands.delete(id);
          continue;
        }

        if (!isAtTarget(position, buildingPosition)) {
          activeWorld.setPosition(id, stepToward(position, buildingPosition));
          continue;
        }

        construction.buildProgressTicks += 1;
        if (construction.buildProgressTicks >= construction.totalBuildTicks) {
          construction.buildProgressTicks = construction.totalBuildTicks;
          construction.isComplete = true;

          const renderable = activeWorld.getComponent<RenderableComponent>(buildingId, 'renderable');
          if (renderable) {
            renderable.tint = buildingTint(building.buildingType, building.owner, true);
          }

          const defaultVisionRadius = buildingVisionRadius(building.buildingType);
          if (
            defaultVisionRadius !== null
            && !activeWorld.getComponent<VisionSourceComponent>(buildingId, 'visionSource')
          ) {
            activeWorld.addComponent(buildingId, 'visionSource', {
              playerId: building.owner,
              radius: defaultVisionRadius,
            });
          }

          const buildingCombatState = createBuildingCombatState(building.buildingType);
          if (buildingCombatState) {
            buildingCombatStates.set(buildingId, buildingCombatState);
          }

          const populationState = population.get(building.owner);
          if (populationState) {
            populationState.cap += construction.populationProvided;
          }

          unitCommands.delete(id);
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypeProductionQueues',
    phase: 'update',
    execute() {
      for (const [buildingId, queue] of productionQueues.entries()) {
        if (queue.length === 0) {
          continue;
        }

        const building = world.getComponent<BuildingComponent>(buildingId, 'building');
        const position = world.getComponent<Position>(buildingId, 'position');
        if (!building || !position) {
          productionQueues.set(buildingId, []);
          continue;
        }

        const entry = queue[0];
        if (entry.kind === 'unit') {
          const populationState = population.get(building.owner);
          if (!populationState || !entry.unitType) {
            continue;
          }

          if (populationState.current >= populationState.cap) {
            entry.isBlocked = true;
            continue;
          }
        }

        entry.isBlocked = false;
        entry.remainingTicks -= 1;

        if (entry.remainingTicks > 0) {
          continue;
        }

        if (entry.kind === 'unit' && entry.unitType) {
          const spawnPosition = findSpawnPosition(position);
          const unitId = addUnitEntity(building.owner, entry.unitType, spawnPosition, {
            playerId: building.owner,
            radius: 4,
          });
          const rallyPoint = rallyPoints.get(buildingId);
          if (rallyPoint) {
            issueUnitMoveCommand(unitId, rallyPoint);
          }
        }

        if (entry.kind === 'technology' && entry.technologyType) {
          applyTechnology(building.owner, entry.technologyType);
        }

        queue.shift();
      }
    },
  });

  world.registerSystem({
    name: 'prototypeScoutMovement',
    phase: 'update',
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'velocity', 'wanderBounds')) {
        if (unitCommands.has(id)) {
          continue;
        }

        const position = activeWorld.getComponent<Position>(id, 'position');
        const velocity = activeWorld.getComponent<VelocityComponent>(id, 'velocity');
        const bounds = activeWorld.getComponent<WanderBoundsComponent>(id, 'wanderBounds');
        if (!position || !velocity || !bounds) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!unit || unit.unitType !== 'scout') {
          continue;
        }

        const nextX = position.x + velocity.dx;
        const nextY = position.y + velocity.dy;

        if (nextX < bounds.minX || nextX > bounds.maxX) {
          velocity.dx *= -1;
        }
        if (nextY < bounds.minY || nextY > bounds.maxY) {
          velocity.dy *= -1;
        }

        activeWorld.setPosition(id, {
          x: clamp(position.x + velocity.dx, bounds.minX, bounds.maxX),
          y: clamp(position.y + velocity.dy, bounds.minY, bounds.maxY),
        });
      }
    },
  });

  world.registerSystem({
    name: 'prototypeVillagerEconomy',
    phase: 'update',
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'unit', 'gatherer')) {
        if (unitCommands.has(id)) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        const position = activeWorld.getComponent<Position>(id, 'position');
        const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
        if (!unit || !position || !gatherer || unit.unitType !== 'villager') {
          continue;
        }

        if (gatherer.task === 'idle') {
          assignNearestResource(activeWorld, id, gatherer, unit.owner);
        }

        if (gatherer.task === 'to-resource') {
          const targetPosition = gatherer.targetResourceId === null
            ? null
            : activeWorld.getComponent<Position>(gatherer.targetResourceId, 'position');
          const targetResource = gatherer.targetResourceId === null
            ? null
            : activeWorld.getComponent<ResourceComponent>(gatherer.targetResourceId, 'resource');

          if (!targetPosition || !targetResource || targetResource.amount <= 0) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
            gatherer.targetResourceId = null;
          } else if (isAtTarget(position, targetPosition)) {
            gatherer.task = 'gathering';
            gatherer.gatherProgressTicks = 0;
          } else {
            activeWorld.setPosition(id, stepToward(position, targetPosition));
          }
        }

        if (gatherer.task === 'gathering') {
          if (gatherer.targetResourceId === null) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
          } else {
            const targetPosition = activeWorld.getComponent<Position>(
              gatherer.targetResourceId,
              'position',
            );
            const targetResource = activeWorld.getComponent<ResourceComponent>(
              gatherer.targetResourceId,
              'resource',
            );

            if (
              !targetPosition
              || !targetResource
              || targetResource.amount <= 0
              || !isAtTarget(position, targetPosition)
            ) {
              gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
              gatherer.targetResourceId = null;
              gatherer.gatherProgressTicks = 0;
            } else {
              gatherer.gatherProgressTicks += 1;
              if (
                gatherer.gatherProgressTicks
                >= gatherTicksFor(targetResource.resourceType)
              ) {
                gatherer.gatherProgressTicks = 0;
                const gatherAmount = Math.min(
                  gatherAmountFor(targetResource.resourceType),
                  targetResource.amount,
                  gatherer.carryCapacity - gatherer.carriedAmount,
                );
                targetResource.amount -= gatherAmount;
                gatherer.carriedResource = resourceKindToEconomyResource(
                  targetResource.resourceType,
                );
                gatherer.carriedAmount += gatherAmount;

                if (
                  targetResource.amount <= 0
                  || gatherer.carriedAmount >= gatherer.carryCapacity
                ) {
                  gatherer.task = 'to-dropoff';
                }
              }
            }
          }
        }

        if (gatherer.task === 'to-dropoff') {
          const dropOffId =
            gatherer.carriedResource === null
              ? null
              : findNearestDropOffBuilding(
                activeWorld,
                unit.owner,
                gatherer.carriedResource,
                position,
              );
          gatherer.dropOffBuildingId = dropOffId;
          const dropOffPosition = dropOffId === null
            ? null
            : activeWorld.getComponent<Position>(dropOffId, 'position');

          if (!dropOffPosition || gatherer.carriedResource === null || gatherer.carriedAmount <= 0) {
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
          } else if (isAtTarget(position, dropOffPosition)) {
            const stockpile = playerResources.get(unit.owner);
            if (stockpile) {
              stockpile[gatherer.carriedResource] += gatherer.carriedAmount;
            }
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
            gatherer.targetResourceId = null;
            gatherer.gatherProgressTicks = 0;
          } else {
            activeWorld.setPosition(id, stepToward(position, dropOffPosition));
          }
        }

        if (gatherer.task === 'idle') {
          assignNearestResource(activeWorld, id, gatherer, unit.owner);
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypeVisibility',
    phase: 'update',
    execute(activeWorld) {
      syncVisibilitySources(activeWorld, visibility, trackedVisibilitySources);
    },
  });

  world.registerSystem({
    name: 'prototypeTowerCombat',
    phase: 'update',
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'building')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
        const construction = constructionStates.get(id);
        const buildingCombat = buildingCombatStates.get(id);

        if (
          !position
          || !building
          || !buildingCombat
          || (construction && !construction.isComplete)
        ) {
          continue;
        }

        if (buildingCombat.cooldownTicks > 0) {
          buildingCombat.cooldownTicks -= 1;
        }

        const arrowCount = buildingArrowCount(
          building.buildingType,
          garrisonedByBuilding.get(id)?.length ?? 0,
        );
        const targetId = findPreferredVisibleEnemyUnitInRange(
          building.owner,
          position,
          buildingCombat.attackRange,
        );
        if (targetId === null || buildingCombat.cooldownTicks > 0 || arrowCount <= 0) {
          continue;
        }

        const targetCombat = combatStates.get(targetId);
        if (!targetCombat) {
          continue;
        }

        for (let shotIndex = 0; shotIndex < arrowCount; shotIndex += 1) {
          const activeTargetCombat = combatStates.get(targetId);
          if (!activeTargetCombat) {
            break;
          }

          activeTargetCombat.currentHp -= buildingCombat.attackDamage;
          if (activeTargetCombat.currentHp <= 0) {
            destroyUnitEntity(targetId);
            break;
          }
        }

        buildingCombat.cooldownTicks = buildingCombat.reloadTicks;
      }
    },
  });

  world.registerSystem({
    name: 'prototypeConquestOutcome',
    phase: 'postUpdate',
    execute() {
      if (!isMatchRunning()) {
        return;
      }

      if (!playerHasConquestPresence(HUMAN_PLAYER_ID)) {
        matchState.outcome = 'defeat';
        matchState.summary = 'All of your units and buildings have been destroyed.';
        return;
      }

      const enemyOwners = [...playerResources.keys()].filter((owner) => owner !== HUMAN_PLAYER_ID);
      if (enemyOwners.every((owner) => !playerHasConquestPresence(owner))) {
        matchState.outcome = 'victory';
        matchState.summary = 'All enemy forces have been eliminated.';
      }
    },
  });

  syncVisibilitySources(world, visibility, trackedVisibilitySources);

  function getSelectionState(): SelectionState {
    const selectedEntityIds = getSelectedEntityIds();
    const selectedEntityId = selectedEntityIds[0] ?? null;
    if (selectedEntityId === null) {
      return {
        selectedEntityId: null,
        selectedEntityIds: [],
        selectedCount: 0,
        selectedKind: null,
        selectedEntityType: null,
        owner: null,
        x: null,
        y: null,
        actionOptions: [],
        buildOptions: [],
        marketOptions: [],
        trainOptions: [],
        researchOptions: [],
        queue: [],
        placementMode,
      };
    }

    const position = world.getComponent<Position>(selectedEntityId, 'position');
    const unit = world.getComponent<UnitComponent>(selectedEntityId, 'unit');
    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!position || (!unit && !building)) {
      selectedEntityRefs = [];
      return getSelectionState();
    }

    const selectedUnits = selectedEntityIds
      .map((id) => ({
        id,
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter((entry): entry is { id: number; unit: UnitComponent } => entry.unit !== undefined);
    const allSelectedUnitsAreHumanVillagers =
      selectedUnits.length === selectedEntityIds.length
      && selectedUnits.length > 0
      && selectedUnits.every((entry) => entry.unit.owner === HUMAN_PLAYER_ID && entry.unit.unitType === 'villager');
    const allSelectedUnitsShareType =
      selectedUnits.length === selectedEntityIds.length
      && selectedUnits.length > 0
      && selectedUnits.every((entry) => entry.unit.unitType === selectedUnits[0].unit.unitType);
    const trainOptions: TrainableUnitType[] =
      building?.owner === HUMAN_PLAYER_ID
        ? getTrainOptions(building.owner, building.buildingType)
        : [];
    const actionOptions: ActionType[] =
      building?.owner === HUMAN_PLAYER_ID
        ? getActionOptions(building.owner, building.buildingType, selectedEntityId)
        : [];
    const marketOptions: MarketActionType[] =
      building?.owner === HUMAN_PLAYER_ID
        ? getMarketOptions(building.owner, building.buildingType)
        : [];
    const buildOptions: BuildableBuildingType[] =
      allSelectedUnitsAreHumanVillagers
        ? getBuildOptions(HUMAN_PLAYER_ID, 'villager')
        : selectedEntityIds.length === 1 && unit && unit.owner === HUMAN_PLAYER_ID
        ? getBuildOptions(unit.owner, unit.unitType)
        : [];
    const researchOptions: ResearchableTechnologyType[] =
      building?.owner === HUMAN_PLAYER_ID
        ? getResearchOptions(building.owner, building.buildingType)
        : [];

    return {
      selectedEntityId,
      selectedEntityIds,
      selectedCount: selectedEntityIds.length,
      selectedKind: unit ? 'unit' : 'building',
      selectedEntityType:
        selectedEntityIds.length > 1 && !allSelectedUnitsShareType
          ? null
          : unit?.unitType ?? building?.buildingType ?? null,
      owner: unit?.owner ?? building?.owner ?? null,
      x: position.x,
      y: position.y,
      actionOptions,
      buildOptions,
      marketOptions,
      trainOptions,
      researchOptions,
      queue: cloneQueue(productionQueues.get(selectedEntityId) ?? []),
      placementMode,
    };
  }

  function getSelectedHumanUnitIds(): number[] {
    return getSelectedEntityIds().filter((id) => {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      return unit?.owner === HUMAN_PLAYER_ID;
    });
  }

  function getSelectedHumanVillagerIds(): number[] {
    return getSelectedHumanUnitIds().filter((id) => {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      return unit?.unitType === 'villager';
    });
  }

  function issueUnitContextCommand(unitId: number, target: Position): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit || unit.owner !== HUMAN_PLAYER_ID) {
      return false;
    }

    const resourceId =
      unit.unitType === 'villager'
        ? findResourceAtCell(target.x, target.y)
        : null;
    const ownedGarrisonBuildingId = findOwnedGarrisonBuildingAtCell(target.x, target.y, unit.owner, unit.unitType);
    const hostileUnitId = findHostileUnitAtCell(target.x, target.y, unit.owner);
    const hostileBuildingId = findHostileBuildingAtCell(target.x, target.y, unit.owner);

    if (ownedGarrisonBuildingId !== null) {
      return garrisonUnit(unitId, ownedGarrisonBuildingId);
    }

    if (hostileUnitId !== null) {
      return issueUnitAttackCommand(unitId, hostileUnitId, 'unit');
    }

    if (hostileBuildingId !== null) {
      return issueUnitAttackCommand(unitId, hostileBuildingId, 'building');
    }

    if (resourceId === null) {
      return issueUnitMoveCommand(unitId, target);
    }

    const gatherer = world.getComponent<GathererComponent>(unitId, 'gatherer');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    if (!gatherer || !resource) {
      return issueUnitMoveCommand(unitId, target);
    }

    clearGathererOrder(unitId);
    unitCommands.delete(unitId);
    gatherer.desiredResource = resourceKindToEconomyResource(resource.resourceType);
    gatherer.task = 'to-resource';
    gatherer.targetResourceId = resourceId;
    gatherer.dropOffBuildingId = findNearestDropOffBuilding(
      world,
      unit.owner,
      gatherer.desiredResource,
      target,
    );
    gatherer.gatherProgressTicks = 0;
    return true;
  }

  function selectEntityAtCell(x: number, y: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const nextSelection = findSelectableEntityAtCell(x, y);
    selectedEntityRefs =
      nextSelection === null
        ? []
        : [getEntityRef(nextSelection)].filter((ref): ref is EntityRef => ref !== null);
    if (nextSelection === null) {
      placementMode = null;
      return false;
    }

    return selectedEntityRefs.length > 0;
  }

  function clearSelection(): void {
    selectedEntityRefs = [];
    placementMode = null;
  }

  function issueMoveCommand(x: number, y: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectedUnitIds = getSelectedHumanUnitIds();
    if (selectedUnitIds.length === 0) {
      return false;
    }

    placementMode = null;
    let didIssue = false;
    for (const unitId of selectedUnitIds) {
      didIssue = issueUnitMoveCommand(unitId, {
        x,
        y,
      }) || didIssue;
    }

    return didIssue;
  }

  function issueContextCommand(x: number, y: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) {
      return false;
    }

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (building && building.owner === HUMAN_PLAYER_ID && getSelectedEntityIds().length === 1) {
      const construction = constructionStates.get(selectedEntityId);
      if (construction && !construction.isComplete) {
        return false;
      }

      rallyPoints.set(selectedEntityId, {
        x: clamp(x, 0, MAP_WIDTH - 1),
        y: clamp(y, 0, MAP_HEIGHT - 1),
      });
      placementMode = null;
      return true;
    }

    const selectedUnitIds = getSelectedHumanUnitIds();
    if (selectedUnitIds.length === 0) {
      return false;
    }

    const target = {
      x: clamp(x, 0, MAP_WIDTH - 1),
      y: clamp(y, 0, MAP_HEIGHT - 1),
    };
    placementMode = null;
    let didIssue = false;
    for (const unitId of selectedUnitIds) {
      didIssue = issueUnitContextCommand(unitId, target) || didIssue;
    }

    return didIssue;
  }

  function queueTrainUnit(unitType: TrainableUnitType): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) {
      return false;
    }

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== HUMAN_PLAYER_ID) {
      return false;
    }
    const construction = constructionStates.get(selectedEntityId);
    if (construction && !construction.isComplete) {
      return false;
    }

    return enqueueTraining(selectedEntityId, unitType);
  }

  function queueResearch(technologyType: ResearchableTechnologyType): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) {
      return false;
    }

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== HUMAN_PLAYER_ID) {
      return false;
    }

    const construction = constructionStates.get(selectedEntityId);
    if (construction && !construction.isComplete) {
      return false;
    }

    return enqueueResearch(selectedEntityId, technologyType);
  }

  function issueAction(actionType: ActionType): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId === null) {
      return false;
    }

    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    if (!building || building.owner !== HUMAN_PLAYER_ID) {
      return false;
    }

    switch (actionType) {
      case 'ungarrison':
        return ungarrisonBuilding(selectedEntityId);
    }
  }

  function issueMarketAction(actionType: MarketActionType): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    return executeMarketAction(actionType);
  }

  function beginBuildingPlacement(buildingType: BuildableBuildingType): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectedVillagerId = getSelectedHumanVillagerIds()[0] ?? null;
    if (selectedVillagerId === null) {
      return false;
    }

    const unit = world.getComponent<UnitComponent>(selectedVillagerId, 'unit');
    if (!unit || unit.owner !== HUMAN_PLAYER_ID || unit.unitType !== 'villager') {
      return false;
    }

    placementMode = buildingType;
    return true;
  }

  function confirmBuildingPlacement(x: number, y: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectedVillagerId = getSelectedHumanVillagerIds()[0] ?? null;
    if (placementMode === null || selectedVillagerId === null) {
      return false;
    }

    const unit = world.getComponent<UnitComponent>(selectedVillagerId, 'unit');
    if (!unit || unit.owner !== HUMAN_PLAYER_ID || unit.unitType !== 'villager') {
      return false;
    }

    const anchor = {
      x: clamp(x, 0, MAP_WIDTH - 1),
      y: clamp(y, 0, MAP_HEIGHT - 1),
    };
    const buildingType = placementMode;
    const didStartConstruction = startConstruction(selectedVillagerId, buildingType, anchor);
    if (didStartConstruction) {
      placementMode = null;
    }
    return didStartConstruction;
  }

  return {
    world,
    getEconomyState() {
      const villagers = [...world.query('unit', 'gatherer')]
        .map((id) => {
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
          if (!unit || !gatherer) {
            return null;
          }

          return {
            owner: unit.owner,
            task: getUnitTaskState(id),
            desiredResource: gatherer.desiredResource,
            carriedResource: gatherer.carriedResource,
            carriedAmount: gatherer.carriedAmount,
          };
        })
        .filter(isEconomyVillager);

      const resources = [...world.query('position', 'resource')]
        .map((id) => {
          const position = world.getComponent<Position>(id, 'position');
          const resource = world.getComponent<ResourceComponent>(id, 'resource');
          if (!position || !resource) {
            return null;
          }

          return {
            resourceType: resource.resourceType,
            amount: resource.amount,
            maxAmount: resource.maxAmount,
            baseOwner: resource.baseOwner,
            x: position.x,
            y: position.y,
          };
        })
        .filter(isEconomyResourceEntry);

      const units = [...world.query('position', 'unit')]
        .map((id) => {
          const position = world.getComponent<Position>(id, 'position');
          const unit = world.getComponent<UnitComponent>(id, 'unit');
          const combat = combatStates.get(id);
          if (!position || !unit) {
            return null;
          }

          return {
            id,
            owner: unit.owner,
            unitType: unit.unitType,
            x: position.x,
            y: position.y,
            task: getUnitTaskState(id),
            attackDamage: combat?.attackDamage ?? unitAttackDamage(unit.unitType),
            attackRange: combat?.attackRange ?? unitAttackRange(unit.unitType),
          };
        })
        .filter((entry): entry is EconomyState['units'][number] => entry !== null);

      const buildings = [...world.query('position', 'building')]
        .map((id) => {
          const position = world.getComponent<Position>(id, 'position');
          const building = world.getComponent<BuildingComponent>(id, 'building');
          if (!position || !building) {
            return null;
          }

          const construction = constructionStates.get(id);
          return {
            id,
            owner: building.owner,
            buildingType: building.buildingType,
            x: position.x,
            y: position.y,
            isComplete: construction ? construction.isComplete : true,
            buildProgressTicks: construction
              ? construction.buildProgressTicks
              : buildingBuildTimeTicks(building.buildingType),
            totalBuildTicks: construction
              ? construction.totalBuildTicks
              : buildingBuildTimeTicks(building.buildingType),
            populationProvided: buildingPopulationProvided(building.buildingType),
            queue: cloneQueue(productionQueues.get(id) ?? []),
          };
        })
        .filter((entry): entry is EconomyState['buildings'][number] => entry !== null);

      return {
        ages: Object.fromEntries(
          [...playerAges.entries()].map(([playerId, age]) => [playerId, age]),
        ),
        playerResources: Object.fromEntries(
          [...playerResources.entries()].map(([playerId, resources]) => [
            playerId,
            cloneResources(resources),
          ]),
        ),
        population: Object.fromEntries(
          [...population.entries()].map(([playerId, value]) => [
            playerId,
            { ...value },
          ]),
        ),
        villagers,
        resources,
        units,
        buildings,
      };
    },
    getPopulationState(playerId: number) {
      return { ...(population.get(playerId) ?? { current: 0, cap: 0 }) };
    },
    getPlayerAge,
    getPlayerResources(playerId: number) {
      return cloneResources(
        playerResources.get(playerId) ?? STANDARD_STARTING_RESOURCES,
      );
    },
    getMatchState() {
      return { ...matchState };
    },
    getSelectionState,
    selectEntityAtCell,
    selectUnitsInBox,
    clearSelection,
    issueContextCommand,
    issueMoveCommand,
    issueAction,
    queueTrainUnit,
    queueResearch,
    issueMarketAction,
    beginBuildingPlacement,
    confirmBuildingPlacement,
    isSelected(id: number) {
      return getSelectedEntityIds().includes(id);
    },
  };
}

export function createSimulationBridge(seed = DEFAULT_SEED): SimulationBridge {
  const visibility = new VisibilityMap(MAP_WIDTH, MAP_HEIGHT);
  const {
    world,
    getEconomyState,
    getPopulationState,
    getPlayerAge,
    getPlayerResources,
    getMatchState,
    getSelectionState,
    selectEntityAtCell,
    selectUnitsInBox,
    clearSelection,
    issueContextCommand,
    issueMoveCommand,
    issueAction,
    queueTrainUnit,
    queueResearch,
    issueMarketAction,
    beginBuildingPlacement,
    confirmBuildingPlacement,
    isSelected,
  } =
    createWorld(seed, visibility);
  const renderStore = new RenderStore();
  const debuggerView = new WorldDebugger({ world });
  const renderAdapter = new RenderAdapter({
    world,
    projector: createProjector(visibility, HUMAN_PLAYER_ID, seed, isSelected),
    debug: debuggerView,
    send(message) {
      renderStore.apply(message);
    },
  });

  renderAdapter.connect();

  let accumulatorMs = 0;

  return {
    step(deltaMs: number) {
      if (getMatchState().outcome !== 'running') {
        return;
      }

      accumulatorMs += deltaMs;
      const tickMs = 1000 / TPS;

      while (accumulatorMs >= tickMs) {
        world.step();
        accumulatorMs -= tickMs;
      }
    },
    getRenderState() {
      return {
        tick: renderStore.getTick(),
        entities: renderStore.getEntities(),
        frame: renderStore.getFrame(),
      };
    },
    getHudState() {
      const debugState = renderStore.getDebug();
      const frame = renderStore.getFrame();
      const metrics = debugState?.metrics;
      const tickDurationMs = metrics?.durationMs.total ?? 0;

      return {
        tick: renderStore.getTick(),
        entityCount: debugState?.entityCount ?? 0,
        visibleEntities: renderStore.getEntities().length,
        visibleCells: frame?.visibleCells.length ?? 0,
        exploredCells: frame?.exploredCells.length ?? 0,
        tickDurationMs,
        fpsTarget: TPS,
        worldSize: `${MAP_WIDTH}x${MAP_HEIGHT}`,
        seed,
        currentAge: getPlayerAge(HUMAN_PLAYER_ID),
        playerResources: getPlayerResources(HUMAN_PLAYER_ID),
        population: getPopulationState(HUMAN_PLAYER_ID),
        matchState: getMatchState(),
      };
    },
    getEconomyState,
    getSelectionState,
    selectEntityAtCell,
    selectUnitsInBox,
    clearSelection,
    issueContextCommand,
    issueMoveCommand,
    issueAction,
    queueTrainUnit,
    queueResearch,
    issueMarketAction,
    beginBuildingPlacement,
    confirmBuildingPlacement,
  };
}
