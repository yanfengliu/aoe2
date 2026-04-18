import {
  findGridPath,
  RenderAdapter,
  VisibilityMap,
  World,
  WorldDebugger,
  createTileGrid,
  type EntityRef,
  type Position,
  type RenderProjector,
} from 'civ-engine';

import { getBuildingFootprint } from '../content/buildingFootprints';
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
  PlacementPreviewState,
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
  UnitTransformComponent,
  UnitTaskState,
  UnitType,
  VelocityComponent,
  VisionSourceComponent,
  WanderBoundsComponent,
} from './types';

type GameEvents = Record<string, never>;
type GameCommands = Record<string, never>;

// Snapshot of a static entity (building or resource) captured the last time the player saw
// it. Used by fog memory rendering. Purely a data value — no ECS component involved — so it
// survives after the source entity is destroyed or leaves vision.
interface MemoryEntry {
  kind: 'building' | 'resource';
  entityType: ProjectedEntityView['entityType'];
  position: Position;
  footprintWidth: number;
  footprintHeight: number;
  tint: number;
  owner: number | null;
  size: number;
  visualVariant: ProjectedEntityView['visualVariant'];
  lastSeenTick: number;
}

type GameComponents = {
  position: Position;
  terrain: TerrainComponent;
  renderable: RenderableComponent;
  unit: UnitComponent;
  unitTransform: UnitTransformComponent;
  building: BuildingComponent;
  resource: ResourceComponent;
  gatherer: GathererComponent;
  velocity: VelocityComponent;
  visionSource: VisionSourceComponent;
  wanderBounds: WanderBoundsComponent;
};
type GameWorld = World<GameEvents, GameCommands, GameComponents>;

export interface SimulationBridge {
  step(deltaMs: number): void;
  getRenderState(): RenderState;
  getRenderInterpolationAlpha(): number;
  getHudState(): HudState;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  getPlacementPreview(x: number, y: number): PlacementPreviewState | null;
  selectEntityAtCell(x: number, y: number): boolean;
  selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean;
  selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean;
  clearSelection(): void;
  issueContextCommand(x: number, y: number): boolean;
  issueContextCommandAtEntity(entityId: number): boolean;
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
const SIEGE_WORKSHOP_BUILD_TIME_TICKS = 260;
const MILITIA_TRAIN_TIME_TICKS = 210;
const SPEARMAN_TRAIN_TIME_TICKS = 220;
const SCOUT_TRAIN_TIME_TICKS = 300;
const ARCHER_TRAIN_TIME_TICKS = 350;
const SKIRMISHER_TRAIN_TIME_TICKS = 220;
const KNIGHT_TRAIN_TIME_TICKS = 300;
const FEUDAL_AGE_RESEARCH_TIME_TICKS = 1300;
const CASTLE_AGE_RESEARCH_TIME_TICKS = 1600;
const FLETCHING_RESEARCH_TIME_TICKS = 300;
const CROSSBOWMAN_TRAIN_TIME_TICKS = 270;
const PIKEMAN_TRAIN_TIME_TICKS = 220;
const LIGHT_CAVALRY_TRAIN_TIME_TICKS = 300;
const CAMEL_TRAIN_TIME_TICKS = 220;
const CAVALRY_ARCHER_TRAIN_TIME_TICKS = 340;
const MANGONEL_TRAIN_TIME_TICKS = 460;
const SCORPION_TRAIN_TIME_TICKS = 300;
const BATTERING_RAM_TRAIN_TIME_TICKS = 360;
const CROSSBOWMAN_UPGRADE_RESEARCH_TIME_TICKS = 350;
const PIKEMAN_UPGRADE_RESEARCH_TIME_TICKS = 450;
const LIGHT_CAVALRY_UPGRADE_RESEARCH_TIME_TICKS = 450;
const MELEE_ATTACK_RANGE = 1;
const MARKET_TRANSACTION_AMOUNT = 100;
const MARKET_BASE_RATE = 100;
const MARKET_FEE_RATE = 0.3;
const MARKET_RATE_STEP = 3;
const MARKET_MIN_RATE = 20;
const UNIT_SUBGRID_RESOLUTION = 4;
const UNIT_SUBGRID_STEP_PER_TICK = 2;
const SHEEP_SUBGRID_STEP_PER_TICK = 1;
const UNIT_CELL_SLOT_OFFSETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 0 },
  { x: 0.5, y: 0 },
  { x: 0, y: 0.5 },
  { x: 0.5, y: 0.5 },
];
const MAX_HERDABLE_CLAIM_RADIUS = 6;
const CARDINAL_NEIGHBOR_OFFSETS: Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

type MarketCommodity = Exclude<EconomyResourceKind, 'gold'>;

interface UnitCommand {
  type: 'move' | 'build' | 'attack';
  target: Position;
  buildingRef?: EntityRef;
  targetEntityRef?: EntityRef;
  targetEntityKind?: 'unit' | 'building' | 'resource';
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

interface SelectableEntityCandidate {
  id: number;
  kind: 'unit' | 'building' | 'resource';
  owner: number | null;
}

interface BuildingCombatState {
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
}

interface WildlifeState extends CombatState {
  autoAggro: boolean;
  isAlive: boolean;
  corpsePersists: boolean;
  aggroRange: number;
  targetEntityRef: EntityRef | null;
}

interface UnitMovementPlan {
  destination: Position;
  nextStep: Position;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toCellIndex(x: number, y: number): number {
  return y * MAP_WIDTH + x;
}

function isSameEntity(
  ref: EntityRef | null,
  id: number,
  world: World<GameEvents, GameCommands>,
): boolean {
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

function defaultCivilizationName(owner: number): string {
  if (owner === HUMAN_PLAYER_ID) {
    return 'Britons';
  }

  if (owner === 2) {
    return 'Franks';
  }

  return `Player ${owner}`;
}

function factionName(owner: number | null): string | null {
  if (owner === null) {
    return 'Gaia';
  }

  return owner === HUMAN_PLAYER_ID ? 'Player' : 'Enemy';
}

function inventoryResourceName(resourceType: ResourceKind): string {
  switch (resourceType) {
    case 'tree':
      return 'wood';
    case 'gold-mine':
      return 'gold';
    case 'stone-mine':
      return 'stone';
    case 'berry-bush':
    case 'boar':
    case 'fish':
    case 'sheep':
    case 'wolf':
      return 'food';
  }
}

function economyResourceLabel(resource: EconomyResourceKind): string {
  switch (resource) {
    case 'food':
      return 'Food';
    case 'wood':
      return 'Wood';
    case 'gold':
      return 'Gold';
    case 'stone':
      return 'Stone';
  }
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

function resourceKindToEconomyResource(kind: ResourceKind): EconomyResourceKind | null {
  switch (kind) {
    case 'gold-mine':
      return 'gold';
    case 'stone-mine':
      return 'stone';
    case 'tree':
      return 'wood';
    case 'berry-bush':
    case 'boar':
    case 'fish':
    case 'sheep':
      return 'food';
    case 'wolf':
      return null;
  }
}

function gatherTicksFor(kind: ResourceKind): number {
  switch (kind) {
    case 'sheep':
    case 'berry-bush':
    case 'fish':
      return 4;
    case 'boar':
    case 'tree':
      return 5;
    case 'gold-mine':
    case 'stone-mine':
      return 6;
    case 'wolf':
      throw new Error('Wolves are not harvestable resources.');
  }
}

function gatherAmountFor(kind: ResourceKind): number {
  switch (kind) {
    case 'sheep':
    case 'berry-bush':
    case 'fish':
    case 'tree':
      return 1;
    case 'boar':
      return 2;
    case 'gold-mine':
    case 'stone-mine':
      return 1;
    case 'wolf':
      throw new Error('Wolves are not harvestable resources.');
  }
}

function resourceTint(resourceType: ResourceKind, owner: number | null): number {
  if (resourceType === 'sheep') {
    if (owner === HUMAN_PLAYER_ID) {
      return 0x8fb8ff;
    }
    if (owner !== null) {
      return 0xd39191;
    }
  }

  const tintByResource: Record<ResourceKind, number> = {
    'berry-bush': 0x7a4c8e,
    'gold-mine': 0xd8b44c,
    'stone-mine': 0x8f9aa4,
    boar: 0x6a3b2e,
    fish: 0x6fb5d8,
    sheep: 0xe7ece6,
    wolf: 0x7f8894,
    tree: 0x214d2d,
  };

  return tintByResource[resourceType];
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

function getUnitCellSlotOffset(unitId: number): { x: number; y: number } {
  const normalizedIndex =
    ((unitId % UNIT_CELL_SLOT_OFFSETS.length) + UNIT_CELL_SLOT_OFFSETS.length)
    % UNIT_CELL_SLOT_OFFSETS.length;
  return UNIT_CELL_SLOT_OFFSETS[normalizedIndex] ?? UNIT_CELL_SLOT_OFFSETS[0]!;
}

function getUnitTargetTransformForCell(
  unitId: number,
  position: Position,
): UnitTransformComponent {
  const slotOffset = getUnitCellSlotOffset(unitId);
  return {
    fineX: (position.x + slotOffset.x) * UNIT_SUBGRID_RESOLUTION,
    fineY: (position.y + slotOffset.y) * UNIT_SUBGRID_RESOLUTION,
  };
}

function projectUnitTransformCoordinate(fineCoordinate: number): number {
  return fineCoordinate / UNIT_SUBGRID_RESOLUTION;
}

function clampUnitTransformToMap(transform: UnitTransformComponent): UnitTransformComponent {
  return {
    fineX: clamp(transform.fineX, 0, MAP_WIDTH * UNIT_SUBGRID_RESOLUTION - 1),
    fineY: clamp(transform.fineY, 0, MAP_HEIGHT * UNIT_SUBGRID_RESOLUTION - 1),
  };
}

function gridPositionFromUnitTransform(transform: UnitTransformComponent): Position {
  return {
    x: clamp(Math.floor(transform.fineX / UNIT_SUBGRID_RESOLUTION), 0, MAP_WIDTH - 1),
    y: clamp(Math.floor(transform.fineY / UNIT_SUBGRID_RESOLUTION), 0, MAP_HEIGHT - 1),
  };
}

function isUnitTransformAtTarget(
  transform: UnitTransformComponent,
  unitId: number,
  target: Position,
): boolean {
  const targetTransform = getUnitTargetTransformForCell(unitId, target);
  return (
    transform.fineX === targetTransform.fineX
    && transform.fineY === targetTransform.fineY
  );
}

function stepUnitTransformToward(
  transform: UnitTransformComponent,
  targetTransform: UnitTransformComponent,
  stepUnits: number = UNIT_SUBGRID_STEP_PER_TICK,
): UnitTransformComponent {
  const targetFineX = targetTransform.fineX;
  const targetFineY = targetTransform.fineY;

  if (transform.fineX !== targetFineX) {
    return {
      fineX:
        transform.fineX
        + Math.sign(targetFineX - transform.fineX)
          * Math.min(Math.abs(targetFineX - transform.fineX), stepUnits),
      fineY: transform.fineY,
    };
  }

  if (transform.fineY !== targetFineY) {
    return {
      fineX: transform.fineX,
      fineY:
        transform.fineY
        + Math.sign(targetFineY - transform.fineY)
          * Math.min(Math.abs(targetFineY - transform.fineY), stepUnits),
    };
  }

  return transform;
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

function shouldMaintainGatheringOrder(
  owner: number,
  gatherer: GathererComponent,
): boolean {
  return owner !== HUMAN_PLAYER_ID || gatherer.hasExplicitGatherOrder;
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
    owner: number | null;
    baseOwner: number | null;
    x: number;
    y: number;
  } | null,
): entry is {
  resourceType: ResourceKind;
  amount: number;
  maxAmount: number;
  owner: number | null;
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

function distanceSquared(left: Position, right: Position): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
}

function buildingFootprint(buildingType: BuildingType): { width: number; height: number } {
  return getBuildingFootprint(buildingType);
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
    case 'siege-workshop':
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
    case 'siege-workshop':
      return SIEGE_WORKSHOP_BUILD_TIME_TICKS;
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
    case 'siege-workshop':
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

  if (buildingType === 'siege-workshop') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0x8e7352 : 0x57462f
      : isComplete ? 0x8b6a55 : 0x57413a;
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
    case 'light-cavalry':
      return { food: 80 };
    case 'militia':
      return { food: 60, gold: 20 };
    case 'spearman':
    case 'skirmisher':
    case 'pikeman':
      return { food: 35, wood: 25 };
    case 'archer':
    case 'crossbowman':
      return { wood: 25, gold: 45 };
    case 'knight':
      return { food: 60, gold: 75 };
    case 'camel':
      return { food: 55, gold: 60 };
    case 'cavalry-archer':
      return { wood: 40, gold: 70 };
    case 'mangonel':
      return { wood: 160, gold: 135 };
    case 'scorpion':
      return { wood: 80, gold: 60 };
    case 'battering-ram':
      return { wood: 160, gold: 75 };
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
    case 'crossbowman-upgrade':
      return { food: 125, gold: 75 };
    case 'pikeman-upgrade':
      return { food: 215, gold: 90 };
    case 'light-cavalry-upgrade':
      return { food: 150, gold: 50 };
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
    case 'siege-workshop':
      return { wood: 200 };
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
    case 'crossbowman':
      return CROSSBOWMAN_TRAIN_TIME_TICKS;
    case 'pikeman':
      return PIKEMAN_TRAIN_TIME_TICKS;
    case 'light-cavalry':
      return LIGHT_CAVALRY_TRAIN_TIME_TICKS;
    case 'camel':
      return CAMEL_TRAIN_TIME_TICKS;
    case 'cavalry-archer':
      return CAVALRY_ARCHER_TRAIN_TIME_TICKS;
    case 'mangonel':
      return MANGONEL_TRAIN_TIME_TICKS;
    case 'scorpion':
      return SCORPION_TRAIN_TIME_TICKS;
    case 'battering-ram':
      return BATTERING_RAM_TRAIN_TIME_TICKS;
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
    case 'crossbowman-upgrade':
      return CROSSBOWMAN_UPGRADE_RESEARCH_TIME_TICKS;
    case 'pikeman-upgrade':
      return PIKEMAN_UPGRADE_RESEARCH_TIME_TICKS;
    case 'light-cavalry-upgrade':
      return LIGHT_CAVALRY_UPGRADE_RESEARCH_TIME_TICKS;
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
    case 'siege-workshop':
      return 2000;
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
    || (buildingType === 'barracks' && unitType === 'pikeman')
    || (buildingType === 'stable' && unitType === 'scout')
    || (buildingType === 'stable' && unitType === 'knight')
    || (buildingType === 'stable' && unitType === 'light-cavalry')
    || (buildingType === 'stable' && unitType === 'camel')
    || (buildingType === 'archery-range' && unitType === 'archer')
    || (buildingType === 'archery-range' && unitType === 'skirmisher')
    || (buildingType === 'archery-range' && unitType === 'crossbowman')
    || (buildingType === 'archery-range' && unitType === 'cavalry-archer')
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
    || (buildingType === 'archery-range' && technologyType === 'crossbowman-upgrade')
    || (buildingType === 'barracks' && technologyType === 'pikeman-upgrade')
    || (buildingType === 'stable' && technologyType === 'light-cavalry-upgrade')
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
    case 'crossbowman':
      return 35;
    case 'pikeman':
      return 55;
    case 'light-cavalry':
      return 60;
    case 'camel':
      return 100;
    case 'cavalry-archer':
      return 50;
    case 'mangonel':
      return 50;
    case 'scorpion':
      return 40;
    case 'battering-ram':
      return 175;
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
    case 'crossbowman':
      return 5;
    case 'pikeman':
      return 4;
    case 'light-cavalry':
      return 7;
    case 'camel':
      return 5;
    case 'cavalry-archer':
      return 6;
    case 'mangonel':
      return 40;
    case 'scorpion':
      return 12;
    case 'battering-ram':
      return 2;
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
    case 'crossbowman':
      return 20;
    case 'pikeman':
      return 10;
    case 'light-cavalry':
      return 12;
    case 'camel':
      return 20;
    case 'cavalry-archer':
      return 20;
    case 'mangonel':
      return 60;
    case 'scorpion':
      return 35;
    case 'battering-ram':
      return 50;
  }
}

function unitAttackRange(unitType: UnitType): number {
  switch (unitType) {
    case 'villager':
    case 'scout':
    case 'militia':
    case 'spearman':
    case 'knight':
    case 'pikeman':
    case 'light-cavalry':
    case 'camel':
    case 'battering-ram':
      return MELEE_ATTACK_RANGE;
    case 'archer':
    case 'skirmisher':
    case 'cavalry-archer':
      return 4;
    case 'crossbowman':
      return 5;
    case 'mangonel':
    case 'scorpion':
      return 7;
  }
}

// Fletching is a one-shot Blacksmith upgrade that buffs the entire archer line
// (+1 attack / +1 range). When Crossbowman (or a future Arbalest) upgrade
// arrives, createCombatState is re-run for the new unitType so the buff must
// still fire for any archer-line unitType, not just `archer`.
function isArcherLineUnit(unitType: UnitType): boolean {
  return unitType === 'archer' || unitType === 'crossbowman';
}

function isWildlifeResourceType(resourceType: ResourceKind): resourceType is 'boar' | 'wolf' {
  return resourceType === 'boar' || resourceType === 'wolf';
}

// A "static" resource sits on its cell forever (until depleted) and is therefore
// safe to cache in fog memory. Sheep and any wildlife (boar, wolf) are movable
// and would yield a stale ghost at their old cell once they leave vision; fish
// stay put but are also excluded so the predicate stays explicit and exhaustive.
function isStaticMemorableResourceType(
  resourceType: ResourceKind,
): resourceType is 'tree' | 'berry-bush' | 'gold-mine' | 'stone-mine' {
  switch (resourceType) {
    case 'tree':
    case 'berry-bush':
    case 'gold-mine':
    case 'stone-mine':
      return true;
    case 'sheep':
    case 'boar':
    case 'wolf':
    case 'fish':
      return false;
  }
}

function wildlifeMaxHp(resourceType: 'boar' | 'wolf'): number {
  switch (resourceType) {
    case 'boar':
      return 75;
    case 'wolf':
      return 25;
  }
}

function wildlifeAttackDamage(resourceType: 'boar' | 'wolf'): number {
  switch (resourceType) {
    case 'boar':
      return 7;
    case 'wolf':
      return 3;
  }
}

function wildlifeReloadTicks(resourceType: 'boar' | 'wolf'): number {
  switch (resourceType) {
    case 'boar':
      return 14;
    case 'wolf':
      return 12;
  }
}

function wildlifeAggroRange(resourceType: 'boar' | 'wolf'): number {
  switch (resourceType) {
    case 'boar':
      return 3;
    case 'wolf':
      return 5;
  }
}

function wildlifeCorpsePersists(resourceType: 'boar' | 'wolf'): boolean {
  return resourceType === 'boar';
}

function wildlifeHasAutoAggro(resourceType: 'boar' | 'wolf'): boolean {
  return resourceType === 'wolf';
}

function createWildlifeState(resourceType: 'boar' | 'wolf'): WildlifeState {
  return {
    currentHp: wildlifeMaxHp(resourceType),
    maxHp: wildlifeMaxHp(resourceType),
    attackDamage: wildlifeAttackDamage(resourceType),
    attackRange: MELEE_ATTACK_RANGE,
    reloadTicks: wildlifeReloadTicks(resourceType),
    cooldownTicks: 0,
    autoAggro: wildlifeHasAutoAggro(resourceType),
    isAlive: true,
    corpsePersists: wildlifeCorpsePersists(resourceType),
    aggroRange: wildlifeAggroRange(resourceType),
    targetEntityRef: null,
  };
}

function unitTint(unitType: UnitType, owner: number): number {
  const isHuman = owner === HUMAN_PLAYER_ID;
  switch (unitType) {
    case 'villager':
      return isHuman ? 0xf3e2b7 : 0xf0b8b8;
    case 'militia':
      return isHuman ? 0xd39a5a : 0xd27c7c;
    case 'spearman':
      return isHuman ? 0x8bb271 : 0xc88770;
    case 'archer':
      return isHuman ? 0x84b6d7 : 0xb38ad6;
    case 'skirmisher':
      return isHuman ? 0x8fc2c3 : 0xc18fa8;
    case 'knight':
      return isHuman ? 0xa6a08d : 0xb27d67;
    case 'crossbowman':
      return isHuman ? 0x6fa0c7 : 0x9e74c8;
    case 'pikeman':
      return isHuman ? 0x6f9c5a : 0xb76e58;
    case 'light-cavalry':
      return isHuman ? 0xb89868 : 0xc18a6a;
    case 'scout':
      return isHuman ? 0xead74a : 0xef7d57;
    case 'camel':
      return isHuman ? 0xd8c18a : 0xc49278;
    case 'cavalry-archer':
      return isHuman ? 0x7e8fb0 : 0xa07294;
    case 'mangonel':
      return isHuman ? 0x8b6d4a : 0x8a564b;
    case 'scorpion':
      return isHuman ? 0x9a854e : 0x996453;
    case 'battering-ram':
      return isHuman ? 0x6e543a : 0x6e4239;
  }
}

function unitSize(unitType: UnitType): number {
  switch (unitType) {
    case 'villager':
      return 0.45;
    case 'militia':
    case 'spearman':
    case 'pikeman':
      return 0.5;
    case 'archer':
    case 'skirmisher':
    case 'crossbowman':
      return 0.48;
    case 'knight':
      return 0.58;
    case 'light-cavalry':
      return 0.56;
    case 'scout':
      return 0.55;
    case 'camel':
      return 0.57;
    case 'cavalry-archer':
      return 0.55;
    case 'mangonel':
      return 0.68;
    case 'scorpion':
      return 0.6;
    case 'battering-ram':
      return 0.75;
  }
}

// Canonical AoE2 DE line-of-sight values per unit type. Scouts have the
// shorter scout-line radius (4); Light Cavalry upgrades that to 6. Archers
// and Crossbowmen see one tile farther than melee. Used both at spawn time
// (addUnitEntity / production queue) and on upgrade (upgradeOwnedUnits).
function unitVisionRadius(unitType: UnitType): number {
  switch (unitType) {
    case 'scout':
      return 4;
    case 'light-cavalry':
      return 6;
    case 'archer':
    case 'crossbowman':
    case 'skirmisher':
      return 5;
    case 'spearman':
    case 'pikeman':
    case 'militia':
      return 3;
    case 'knight':
      return 4;
    case 'villager':
      return 4;
    case 'camel':
      return 4;
    case 'cavalry-archer':
      return 5;
    case 'mangonel':
    case 'scorpion':
      return 9;
    case 'battering-ram':
      return 3;
  }
}

// Returns true when the target is classified as cavalry for the purposes of
// anti-cavalry bonus damage (Spearman, Pikeman, Camel). The mounted-but-not-
// cavalry units (Camel, Cavalry Archer) are explicitly excluded so Camels
// themselves don't trigger the bonus, matching AoE2 DE canon.
function isCavalryTarget(targetType: UnitType): boolean {
  return targetType === 'scout' || targetType === 'light-cavalry' || targetType === 'knight';
}

function attackBonusAgainstUnit(attackerType: UnitType, targetType: UnitType): number {
  if (attackerType === 'spearman' && (targetType === 'scout' || targetType === 'light-cavalry')) {
    return 12;
  }

  if (attackerType === 'spearman' && targetType === 'knight') {
    return 15;
  }

  if (attackerType === 'pikeman' && (targetType === 'scout' || targetType === 'light-cavalry')) {
    return 19;
  }

  if (attackerType === 'pikeman' && targetType === 'knight') {
    return 22;
  }

  if (attackerType === 'skirmisher' && (targetType === 'archer' || targetType === 'crossbowman')) {
    return 4;
  }

  if (attackerType === 'camel' && isCavalryTarget(targetType)) {
    return 9;
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

// Returns true if any cell of an entity's footprint is currently visible to the
// given player. Single-cell entities (resources, units, 1x1 buildings) check the
// anchor cell only; multi-cell buildings (e.g. the 4x4 Town Center) count as
// visible when even one of their cells is in vision.
function isFootprintVisible(
  visibility: VisibilityMap,
  playerId: number,
  anchorX: number,
  anchorY: number,
  footprintWidth: number,
  footprintHeight: number,
): boolean {
  const flooredX = Math.floor(anchorX);
  const flooredY = Math.floor(anchorY);
  for (let offsetY = 0; offsetY < footprintHeight; offsetY += 1) {
    for (let offsetX = 0; offsetX < footprintWidth; offsetX += 1) {
      if (visibility.isVisible(playerId, flooredX + offsetX, flooredY + offsetY)) {
        return true;
      }
    }
  }
  return false;
}

const PROJECTED_LAYER_ORDER: Record<ProjectedEntityView['layer'], number> = {
  terrain: 0,
  resource: 1,
  building: 2,
  unit: 3,
};

// Stable comparator for the projected render entity list: layer first (so units
// always draw on top of buildings on top of resources on top of terrain), then
// y (row) so southern entities draw later, then x (column) for determinism.
// Hoisted to top level so the per-frame `getRenderState` sort doesn't allocate
// a fresh closure each call.
function compareProjectedRenderEntities(
  left: ProjectedEntityView,
  right: ProjectedEntityView,
): number {
  const layerDelta = PROJECTED_LAYER_ORDER[left.layer] - PROJECTED_LAYER_ORDER[right.layer];
  if (layerDelta !== 0) {
    return layerDelta;
  }
  if (left.y !== right.y) {
    return left.y - right.y;
  }
  return left.x - right.x;
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
  getEntityHealth: (id: number) => { currentHp: number; maxHp: number } | null,
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
      const unitTransform = world.getComponent<UnitTransformComponent>(ref.id, 'unitTransform');
      if (!position || !renderable) {
        return null;
      }

      const terrain = world.getComponent<TerrainComponent>(ref.id, 'terrain');
      const unit = world.getComponent<UnitComponent>(ref.id, 'unit');
      const building = world.getComponent<BuildingComponent>(ref.id, 'building');
      const resource = world.getComponent<ResourceComponent>(ref.id, 'resource');
      const health = getEntityHealth(ref.id);

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
        owner = resource.owner;
        entityType = resource.resourceType;
      }

      if (
        renderable.kind !== 'tile' &&
        owner !== playerId &&
        !isFootprintVisible(
          visibility,
          playerId,
          position.x,
          position.y,
          renderable.footprintWidth,
          renderable.footprintHeight,
        )
      ) {
        return null;
      }

      return {
        id: ref.id,
        kind: renderable.kind,
        layer: renderable.layer,
        entityType,
        owner,
        x: unitTransform
          ? projectUnitTransformCoordinate(unitTransform.fineX)
          : position.x,
        y: unitTransform
          ? projectUnitTransformCoordinate(unitTransform.fineY)
          : position.y,
        tint: renderable.tint,
        size: renderable.size,
        footprintWidth: renderable.footprintWidth,
        footprintHeight: renderable.footprintHeight,
        visualVariant: renderable.visualVariant,
        selected: isSelected(ref.id),
        currentHp: health?.currentHp ?? null,
        maxHp: health?.maxHp ?? null,
        isMemory: false,
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

function updateSheepOwnership(activeWorld: World<GameEvents, GameCommands>): boolean {
  const typedWorld = activeWorld as GameWorld;
  let didChange = false;

  for (const sheepId of typedWorld.query('position', 'resource', 'renderable')) {
    const sheepPosition = typedWorld.getComponent(sheepId, 'position');
    const resource = typedWorld.getComponent(sheepId, 'resource');
    const renderable = typedWorld.getComponent(sheepId, 'renderable');
    if (
      !sheepPosition
      || !resource
      || !renderable
      || resource.resourceType !== 'sheep'
      || resource.amount <= 0
    ) {
      continue;
    }

    if (resource.owner !== null) {
      continue;
    }

    let claimedOwner: number | null = resource.owner;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    let bestUnitId = Number.POSITIVE_INFINITY;

    for (const unitId of typedWorld.queryInRadius(
      sheepPosition.x,
      sheepPosition.y,
      MAX_HERDABLE_CLAIM_RADIUS,
      'unit',
      'visionSource',
    )) {
      const unitPosition = typedWorld.getComponent(unitId, 'position');
      const unit = typedWorld.getComponent(unitId, 'unit');
      const visionSource = typedWorld.getComponent(unitId, 'visionSource');
      if (!unitPosition || !unit || !visionSource) {
        continue;
      }

      const claimDistanceSquared = distanceSquared(unitPosition, sheepPosition);
      if (claimDistanceSquared > visionSource.radius * visionSource.radius) {
        continue;
      }

      if (
        claimDistanceSquared < bestDistanceSquared
        || (
          claimDistanceSquared === bestDistanceSquared
          && (
            unit.owner < (claimedOwner ?? Number.POSITIVE_INFINITY)
            || (unit.owner === claimedOwner && unitId < bestUnitId)
          )
        )
      ) {
        claimedOwner = unit.owner;
        bestDistanceSquared = claimDistanceSquared;
        bestUnitId = unitId;
      }
    }

    if (resource.owner !== claimedOwner) {
      resource.owner = claimedOwner;
      renderable.tint = resourceTint(resource.resourceType, claimedOwner);
      didChange = true;
    }
  }

  return didChange;
}

function createWorld(seed: string, visibility: VisibilityMap): {
  world: GameWorld;
  getEconomyState: () => EconomyState;
  getPopulationState: (playerId: number) => PopulationState;
  getPlayerAge: (playerId: number) => AgeType;
  getPlayerResources: (playerId: number) => PlayerResources;
  getMatchState: () => MatchState;
  getSelectionState: () => SelectionState;
  getPlacementPreview: (x: number, y: number) => PlacementPreviewState | null;
  getEntityHealth: (id: number) => { currentHp: number; maxHp: number } | null;
  selectEntityAtCell: (x: number, y: number) => boolean;
  selectOwnedUnitsByTypeInRect: (
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) => boolean;
  selectUnitsInBox: (minX: number, minY: number, maxX: number, maxY: number) => boolean;
  clearSelection: () => void;
  issueContextCommand: (x: number, y: number) => boolean;
  issueContextCommandAtEntity: (entityId: number) => boolean;
  issueMoveCommand: (x: number, y: number) => boolean;
  issueAction: (actionType: ActionType) => boolean;
  queueTrainUnit: (unitType: TrainableUnitType) => boolean;
  queueResearch: (technologyType: ResearchableTechnologyType) => boolean;
  issueMarketAction: (actionType: MarketActionType) => boolean;
  beginBuildingPlacement: (buildingType: BuildableBuildingType) => boolean;
  confirmBuildingPlacement: (x: number, y: number) => boolean;
  isSelected: (id: number) => boolean;
  consumeOutOfBandRenderChange: () => boolean;
  getFogMemoryEntities: (liveEntityIds: Set<number>) => ProjectedEntityView[];
  getHumanFogMemorySize: () => number;
} {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: MAP_WIDTH,
    gridHeight: MAP_HEIGHT,
    tps: TPS,
    seed,
  });

  const trackedVisibilitySources = new Map<number, number>();
  const playerAges = new Map<number, AgeType>();
  const playerCivilizations = new Map<number, string>();
  const researchedTechnologies = new Map<number, Set<ResearchableTechnologyType>>();
  const playerResources = new Map<number, PlayerResources>();
  const marketExchangeRates = createInitialMarketRates();
  const population = new Map<number, PopulationState>();
  const townCenterRefs = new Map<number, EntityRef>();
  const villagerOrdinals = new Map<number, number>();
  const unitCommands = new Map<number, UnitCommand>();
  const sheepMoveOrders = new Map<number, Position>();
  const rallyPoints = new Map<number, Position>();
  // Per-player last-seen snapshot of static buildings and resources (Item 3, Slice 1).
  // Keyed by playerId -> entityId -> snapshot. Refreshed every tick for entities currently
  // visible to the player; read at render-projection time for cells that are
  // explored-but-not-visible, so the player remembers enemy bases and resource patches that
  // have since left vision. Units are excluded in v1.
  const lastSeenStatic = new Map<number, Map<number, MemoryEntry>>();

  function getOrCreateMemoryMap(playerId: number): Map<number, MemoryEntry> {
    let map = lastSeenStatic.get(playerId);
    if (!map) {
      map = new Map<number, MemoryEntry>();
      lastSeenStatic.set(playerId, map);
    }
    return map;
  }

  // Build `ProjectedEntityView` entries for every memory record whose position is
  // explored-but-not-visible, deduped against any live entity the renderer is already
  // drawing for the same entity id. Returned views carry `isMemory: true` so the scene can
  // render them at reduced opacity and skip selection overlays.
  function getFogMemoryEntities(liveEntityIds: Set<number>): ProjectedEntityView[] {
    const humanMemory = lastSeenStatic.get(HUMAN_PLAYER_ID);
    if (!humanMemory || humanMemory.size === 0) {
      return [];
    }

    const memoryViews: ProjectedEntityView[] = [];
    for (const [entityId, entry] of humanMemory) {
      if (liveEntityIds.has(entityId)) {
        continue;
      }
      const isExplored = visibility.isExplored(HUMAN_PLAYER_ID, entry.position.x, entry.position.y);
      if (!isExplored) {
        continue;
      }
      const isVisible = visibility.isVisible(HUMAN_PLAYER_ID, entry.position.x, entry.position.y);
      // If the entity is currently visible and the live projector is not emitting it
      // (e.g. it was static and never visible at renderAdapter connect time, so the
      // initial snapshot skipped it), surface it from memory as a live (non-memory)
      // projection so the player sees it. When the entity's visibility changes later,
      // memory still carries the most recent snapshot.
      memoryViews.push({
        id: entityId,
        kind: entry.kind,
        layer: entry.kind,
        entityType: entry.entityType,
        owner: entry.owner,
        x: entry.position.x,
        y: entry.position.y,
        tint: entry.tint,
        size: entry.size,
        footprintWidth: entry.footprintWidth,
        footprintHeight: entry.footprintHeight,
        visualVariant: entry.visualVariant,
        selected: false,
        currentHp: null,
        maxHp: null,
        isMemory: !isVisible,
      });
    }
    return memoryViews;
  }

  // Cheap pre-check used by `getRenderState` to short-circuit the merge logic when
  // the human player has no fog memory (e.g. immediately after world bootstrap, or
  // in unit tests that never let the visibility system run). Avoids the
  // `getFogMemoryEntities` call and the dedupe Set allocation in the common case.
  function getHumanFogMemorySize(): number {
    return lastSeenStatic.get(HUMAN_PLAYER_ID)?.size ?? 0;
  }
  const garrisonedByBuilding = new Map<number, number[]>();
  const garrisonedUnitToBuilding = new Map<number, number>();
  const garrisonedUnitVisionSources = new Map<number, VisionSourceComponent>();
  const productionQueues = new Map<number, ProductionQueueEntry[]>();
  const constructionStates = new Map<number, ConstructionState>();
  const combatStates = new Map<number, CombatState>();
  const buildingHealthStates = new Map<number, BuildingHealthState>();
  const buildingCombatStates = new Map<number, BuildingCombatState>();
  const wildlifeStates = new Map<number, WildlifeState>();
  const matchState: MatchState = {
    outcome: 'running',
    summary: '',
  };
  let selectedEntityRefs: EntityRef[] = [];
  let selectionFocusCell: Position | null = null;
  let placementMode: BuildableBuildingType | null = null;
  let hasOutOfBandRenderChange = false;

  function markOutOfBandRenderChange(): void {
    hasOutOfBandRenderChange = true;
  }

  world.registerComponent<Position>('position');
  world.registerComponent<TerrainComponent>('terrain');
  world.registerComponent<RenderableComponent>('renderable');
  world.registerComponent<UnitComponent>('unit');
  world.registerComponent<UnitTransformComponent>('unitTransform');
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
    playerCivilizations.set(start.owner, start.civilization ?? defaultCivilizationName(start.owner));
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
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
      });
    }
  }

  function getCurrentEntityId(ref: EntityRef | null): number | null {
    return currentEntityId(world, ref);
  }

  function getEntityRef(id: number): EntityRef | null {
    return world.getEntityRef(id);
  }

  function getEntityHealth(id: number): { currentHp: number; maxHp: number } | null {
    const unit = world.getComponent<UnitComponent>(id, 'unit');
    if (unit) {
      const combat = combatStates.get(id);
      if (!combat) {
        return null;
      }

      return {
        currentHp: combat.currentHp,
        maxHp: combat.maxHp,
      };
    }

    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (building) {
      const health = buildingHealthStates.get(id);
      if (!health) {
        return null;
      }

      return {
        currentHp: health.currentHp,
        maxHp: health.maxHp,
      };
    }

    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    if (resource) {
      const wildlife = wildlifeStates.get(id);
      if (!wildlife || !wildlife.isAlive) {
        return null;
      }

      return {
        currentHp: wildlife.currentHp,
        maxHp: wildlife.maxHp,
      };
    }

    return null;
  }

  function getSelectionHealth(id: number): SelectionState['health'] {
    const health = getEntityHealth(id);
    if (!health) {
      return null;
    }

    return {
      current: health.currentHp,
      max: health.maxHp,
    };
  }

  function getSelectionAttack(
    id: number,
    unit: UnitComponent | undefined,
    building: BuildingComponent | undefined,
    resource: ResourceComponent | undefined,
  ): number | null {
    if (unit) {
      return combatStates.get(id)?.attackDamage ?? unitAttackDamage(unit.unitType);
    }

    if (building) {
      return buildingCombatStates.get(id)?.attackDamage ?? null;
    }

    if (resource) {
      const wildlife = wildlifeStates.get(id);
      return wildlife?.isAlive ? wildlife.attackDamage : null;
    }

    return null;
  }

  function getSelectionArmor(
    unit: UnitComponent | undefined,
    building: BuildingComponent | undefined,
    resource: ResourceComponent | undefined,
    id: number,
  ): number | null {
    if (unit || building) {
      return 0;
    }

    if (resource) {
      return wildlifeStates.get(id)?.isAlive ? 0 : null;
    }

    return null;
  }

  function getSelectionCiv(
    owner: number | null,
    kind: SelectionState['selectedKind'],
  ): string | null {
    if (kind === 'resource' || owner === null) {
      return null;
    }

    return playerCivilizations.get(owner) ?? defaultCivilizationName(owner);
  }

  function getSelectionInventory(
    id: number,
    unit: UnitComponent | undefined,
    building: BuildingComponent | undefined,
    resource: ResourceComponent | undefined,
  ): string | null {
    if (resource) {
      if (resource.resourceType === 'wolf') {
        return null;
      }
      return `${resource.amount} / ${resource.maxAmount} ${inventoryResourceName(resource.resourceType)} remaining`;
    }

    if (unit) {
      const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
      if (!gatherer) {
        return null;
      }

      if (!gatherer.carriedResource || gatherer.carriedAmount <= 0) {
        return 'Empty';
      }

      return `${gatherer.carriedAmount} ${economyResourceLabel(gatherer.carriedResource)}`;
    }

    if (building) {
      const capacity = buildingGarrisonCapacity(building.buildingType);
      if (capacity <= 0) {
        return null;
      }

      return `${garrisonedByBuilding.get(id)?.length ?? 0} / ${capacity} garrisoned`;
    }

    return null;
  }

  function getUnitTransform(
    id: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): UnitTransformComponent | null {
    return activeWorld.getComponent<UnitTransformComponent>(id, 'unitTransform') ?? null;
  }

  function syncUnitTransformToPosition(
    id: number,
    position: Position,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): void {
    const transform = getUnitTransform(id, activeWorld);
    if (!transform) {
      return;
    }

    const targetTransform = getUnitTargetTransformForCell(id, position);
    transform.fineX = targetTransform.fineX;
    transform.fineY = targetTransform.fineY;
  }

  function moveUnitOneSubgridStep(
    id: number,
    target: Position,
    activeWorld: World<GameEvents, GameCommands> = world,
    stepUnits: number = UNIT_SUBGRID_STEP_PER_TICK,
  ): Position | null {
    const transform = getUnitTransform(id, activeWorld);
    if (!transform) {
      return null;
    }

    const targetTransform = getUnitTargetTransformForCell(id, target);
    const nextTransform = clampUnitTransformToMap(stepUnitTransformToward(transform, targetTransform, stepUnits));
    transform.fineX = nextTransform.fineX;
    transform.fineY = nextTransform.fineY;

    const nextGridPosition = gridPositionFromUnitTransform(nextTransform);
    const currentGridPosition = activeWorld.getComponent<Position>(id, 'position');
    if (
      !currentGridPosition
      || currentGridPosition.x !== nextGridPosition.x
      || currentGridPosition.y !== nextGridPosition.y
    ) {
      activeWorld.setPosition(id, nextGridPosition);
    }

    return nextGridPosition;
  }

  function isUnitAtTarget(
    id: number,
    target: Position,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    const transform = getUnitTransform(id, activeWorld);
    if (!transform) {
      const position = activeWorld.getComponent<Position>(id, 'position');
      return position ? isAtTarget(position, target) : false;
    }

    return isUnitTransformAtTarget(transform, id, target);
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

    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'fletching')) {
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
    world.addComponent(entity, 'unitTransform', getUnitTargetTransformForCell(entity, position));
    world.addComponent(entity, 'renderable', {
      kind: 'unit',
      layer: 'unit',
      tint: unitTint(unitType, owner),
      size: unitSize(unitType),
      footprintWidth: 1,
      footprintHeight: 1,
      visualVariant: 'default',
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
        hasExplicitGatherOrder: false,
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
    const footprint = buildingFootprint(buildingType);
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
      footprintWidth: footprint.width,
      footprintHeight: footprint.height,
      visualVariant: isComplete ? 'complete' : 'construction',
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

    const sizeByResource: Record<ResourceComponent['resourceType'], number> = {
      'berry-bush': 0.45,
      'gold-mine': 0.8,
      'stone-mine': 0.8,
      boar: 0.48,
      fish: 0.42,
      sheep: 0.42,
      wolf: 0.46,
      tree: 0.58,
    };

    world.addComponent(entity, 'resource', {
      resourceType,
      amount,
      maxAmount: amount,
      owner: null,
      baseOwner,
    });
    world.addComponent(entity, 'renderable', {
      kind: 'resource',
      layer: 'resource',
      tint: resourceTint(resourceType, null),
      size: sizeByResource[resourceType],
      footprintWidth: 1,
      footprintHeight: 1,
      visualVariant: 'default',
    });

    if (resourceType === 'sheep') {
      world.addComponent(entity, 'unitTransform', getUnitTargetTransformForCell(entity, position));
    }

    if (isWildlifeResourceType(resourceType)) {
      wildlifeStates.set(entity, createWildlifeState(resourceType));
    }

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
      || spawn.kind === 'siege-workshop'
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
      || spawn.kind === 'crossbowman'
      || spawn.kind === 'pikeman'
      || spawn.kind === 'light-cavalry'
      || spawn.kind === 'camel'
      || spawn.kind === 'cavalry-archer'
      || spawn.kind === 'mangonel'
      || spawn.kind === 'scorpion'
      || spawn.kind === 'battering-ram'
    ) {
      const owner = spawn.owner ?? HUMAN_PLAYER_ID;
      const spawnPosition = spawn.requiresSafeSpawn
        ? findScenarioSpawnPosition({ x: spawn.x, y: spawn.y })
        : { x: spawn.x, y: spawn.y };
      if (!spawnPosition) {
        throw new Error(`Expected a safe spawn position for initial ${spawn.kind} at ${spawn.x},${spawn.y}.`);
      }

      const unitId = addUnitEntity(owner, spawn.kind, spawnPosition, spawn.vision);
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

  updateSheepOwnership(world);

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

  function buildingOccupiesCell(
    buildingId: number,
    x: number,
    y: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    const position = activeWorld.getComponent<Position>(buildingId, 'position');
    const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
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

  function isTerrainPassableForUnit(
    x: number,
    y: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
      return false;
    }

    const tile = tiles[y]?.[x];
    const terrain = tile === undefined ? null : activeWorld.getComponent<TerrainComponent>(tile, 'terrain');
    return terrain ? terrain.kind !== 'water' && terrain.kind !== 'forest' : false;
  }

  function isCellBlockedByBuilding(
    x: number,
    y: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    for (const buildingId of activeWorld.query('building')) {
      if (buildingOccupiesCell(buildingId, x, y, activeWorld)) {
        return true;
      }
    }

    return false;
  }

  function isCellBlockedByResource(
    x: number,
    y: number,
    ignoredResourceId: number | null = null,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    for (const id of activeWorld.query('position', 'resource')) {
      if (ignoredResourceId !== null && id === ignoredResourceId) {
        continue;
      }

      const position = activeWorld.getComponent<Position>(id, 'position');
      if (position?.x === x && position.y === y) {
        return true;
      }
    }

    return false;
  }

  function isCellOccupiedByUnit(
    x: number,
    y: number,
    ignoredUnitId: number | null = null,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    for (const id of activeWorld.query('position', 'unit')) {
      if (ignoredUnitId !== null && id === ignoredUnitId) {
        continue;
      }

      const position = activeWorld.getComponent<Position>(id, 'position');
      if (position?.x === x && position.y === y) {
        return true;
      }
    }

    return false;
  }

  function isCellPassableForSpawn(
    x: number,
    y: number,
    ignoredUnitId: number | null = null,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    void ignoredUnitId;
    return (
      isTerrainPassableForUnit(x, y, activeWorld)
      && !isCellBlockedByBuilding(x, y, activeWorld)
      && !isCellBlockedByResource(x, y, null, activeWorld)
    );
  }

  function isCellPassableForUnit(
    unitId: number,
    x: number,
    y: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    return isCellPassableForSpawn(x, y, unitId, activeWorld);
  }

  function isCellPassableForWildlife(
    resourceId: number,
    x: number,
    y: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    return (
      isTerrainPassableForUnit(x, y, activeWorld)
      && !isCellBlockedByBuilding(x, y, activeWorld)
      && !isCellBlockedByResource(x, y, resourceId, activeWorld)
    );
  }

  function isHarvestableResource(
    resourceId: number,
    resource: ResourceComponent,
  ): boolean {
    if (resource.amount <= 0) {
      return false;
    }

    const wildlife = wildlifeStates.get(resourceId);
    if (!wildlife) {
      return true;
    }

    return !wildlife.isAlive && resource.resourceType !== 'wolf';
  }

  function isPlacementBlocked(x: number, y: number, width: number, height: number): boolean {
    for (let cellY = y; cellY < y + height; cellY += 1) {
      for (let cellX = x; cellX < x + width; cellX += 1) {
        if (cellX < 0 || cellX >= MAP_WIDTH || cellY < 0 || cellY >= MAP_HEIGHT) {
          return true;
        }

        if (!isTerrainPassableForUnit(cellX, cellY)) {
          return true;
        }

        if (
          isCellBlockedByBuilding(cellX, cellY)
          || isCellBlockedByResource(cellX, cellY)
          || isCellOccupiedByUnit(cellX, cellY)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  function uniquePositions(positions: Position[]): Position[] {
    const seen = new Set<string>();
    const unique: Position[] = [];

    for (const position of positions) {
      const key = `${position.x},${position.y}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(position);
    }

    return unique;
  }

  function getCellsWithinRange(center: Position, range: number): Position[] {
    const cells: Position[] = [];

    for (let y = center.y - range; y <= center.y + range; y += 1) {
      for (let x = center.x - range; x <= center.x + range; x += 1) {
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
          continue;
        }

        const distance = Math.abs(center.x - x) + Math.abs(center.y - y);
        if (distance > range) {
          continue;
        }

        cells.push({ x, y });
      }
    }

    return cells;
  }

  function getApproachCellsForFootprint(anchor: Position, width: number, height: number, range = 1): Position[] {
    const candidates: Position[] = [];
    const minX = anchor.x - range;
    const maxX = anchor.x + width - 1 + range;
    const minY = anchor.y - range;
    const maxY = anchor.y + height - 1 + range;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
          continue;
        }

        const dx =
          x < anchor.x ? anchor.x - x
          : x > anchor.x + width - 1 ? x - (anchor.x + width - 1)
          : 0;
        const dy =
          y < anchor.y ? anchor.y - y
          : y > anchor.y + height - 1 ? y - (anchor.y + height - 1)
          : 0;
        const distance = dx + dy;
        if (distance === 0 || distance > range) {
          continue;
        }

        candidates.push({ x, y });
      }
    }

    return uniquePositions(candidates);
  }

  function getNearestMoveCandidates(target: Position): Position[] {
    const candidates: Position[] = [];
    const maxRadius = Math.max(MAP_WIDTH, MAP_HEIGHT);

    for (let radius = 0; radius <= maxRadius; radius += 1) {
      for (let y = target.y - radius; y <= target.y + radius; y += 1) {
        for (let x = target.x - radius; x <= target.x + radius; x += 1) {
          if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) {
            continue;
          }

          const distance = Math.abs(target.x - x) + Math.abs(target.y - y);
          if (distance !== radius) {
            continue;
          }

          candidates.push({ x, y });
        }
      }
    }

    return uniquePositions(candidates);
  }

  function findMovementPlan(
    unitId: number,
    start: Position,
    candidates: Position[],
    preferCurrentCell: boolean,
    activeWorld: World<GameEvents, GameCommands> = world,
    isPassable: (
      entityId: number,
      x: number,
      y: number,
      worldState: World<GameEvents, GameCommands>,
    ) => boolean = isCellPassableForUnit,
  ): UnitMovementPlan | null {
    const uniqueCandidates = uniquePositions(candidates).filter((candidate) =>
      isPassable(unitId, candidate.x, candidate.y, activeWorld),
    );

    if (preferCurrentCell) {
      const currentCellCandidate = uniqueCandidates.find(
        (candidate) => candidate.x === start.x && candidate.y === start.y,
      );
      if (currentCellCandidate) {
        return {
          destination: currentCellCandidate,
          nextStep: currentCellCandidate,
        };
      }
    }

    for (const destination of uniqueCandidates) {
      const pathResult = findGridPath({
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        start,
        goal: destination,
        blocked: (x, y) => !isPassable(unitId, x, y, activeWorld),
      });
      if (!pathResult) {
        continue;
      }

      return {
        destination,
        nextStep: pathResult.path[1] ?? destination,
      };
    }

    return null;
  }

  function findMovePlan(
    unitId: number,
    target: Position,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    if (!position) {
      return null;
    }

    return findMovementPlan(unitId, position, getNearestMoveCandidates(target), false, activeWorld);
  }

  function findResourceApproachPlan(
    unitId: number,
    resourceId: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    const resourcePosition = activeWorld.getComponent<Position>(resourceId, 'position');
    if (!position || !resourcePosition) {
      return null;
    }

    return findMovementPlan(
      unitId,
      position,
      getApproachCellsForFootprint(resourcePosition, 1, 1, 1),
      true,
      activeWorld,
    );
  }

  function findBuildingApproachPlan(
    unitId: number,
    buildingId: number,
    range = 1,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    const buildingPosition = activeWorld.getComponent<Position>(buildingId, 'position');
    const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
    if (!position || !buildingPosition || !building) {
      return null;
    }

    const footprint = buildingFootprint(building.buildingType);
    return findMovementPlan(
      unitId,
      position,
      getApproachCellsForFootprint(buildingPosition, footprint.width, footprint.height, range),
      true,
      activeWorld,
    );
  }

  function findUnitRangePlan(
    unitId: number,
    targetPosition: Position,
    range: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    if (!position) {
      return null;
    }

    const candidates = getCellsWithinRange(targetPosition, range)
      .filter((candidate) => !(candidate.x === targetPosition.x && candidate.y === targetPosition.y));
    return findMovementPlan(unitId, position, candidates, true, activeWorld);
  }

  function findWildlifeRangePlan(
    resourceId: number,
    targetPosition: Position,
    range: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(resourceId, 'position');
    if (!position) {
      return null;
    }

    const candidates = getCellsWithinRange(targetPosition, range)
      .filter((candidate) => !(candidate.x === targetPosition.x && candidate.y === targetPosition.y));
    return findMovementPlan(
      resourceId,
      position,
      candidates,
      true,
      activeWorld,
      isCellPassableForWildlife,
    );
  }

  function hasSpawnEgress(
    candidate: Position,
    ignoredUnitId: number | null = null,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    if (!isCellPassableForSpawn(candidate.x, candidate.y, ignoredUnitId, activeWorld)) {
      return false;
    }

    return CARDINAL_NEIGHBOR_OFFSETS.some((offset) =>
      isCellPassableForSpawn(candidate.x + offset.x, candidate.y + offset.y, ignoredUnitId, activeWorld),
    );
  }

  function findSafeSpawnPosition(
    candidates: Position[],
    ignoredUnitId: number | null = null,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): Position | null {
    for (const candidate of uniquePositions(candidates)) {
      if (!hasSpawnEgress(candidate, ignoredUnitId, activeWorld)) {
        continue;
      }

      return candidate;
    }

    return null;
  }

  function findScenarioSpawnPosition(
    origin: Position,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): Position | null {
    return findSafeSpawnPosition(getNearestMoveCandidates(origin), null, activeWorld);
  }

  function findBuildingSpawnPosition(
    anchor: Position,
    buildingType: BuildingType,
    ignoredUnitId: number | null = null,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): Position | null {
    const footprint = buildingFootprint(buildingType);
    return findSafeSpawnPosition(
      getApproachCellsForFootprint(anchor, footprint.width, footprint.height, 1),
      ignoredUnitId,
      activeWorld,
    );
  }

  function clearGathererOrder(id: number): void {
    const gatherer = world.getComponent<GathererComponent>(id, 'gatherer');
    if (!gatherer) {
      return;
    }

    gatherer.hasExplicitGatherOrder = false;
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

  // Returns true if any cell of an entity's footprint is currently visible to the
  // human player. Owned entities are always considered visible. Multi-tile buildings
  // (e.g. the 4x4 Town Center) count as visible if any one of their footprint cells
  // is in vision; single-cell entities behave identically to `isVisibleToHuman`.
  function isEntityFootprintVisibleToHuman(
    position: Position,
    owner: number | null,
    footprintWidth: number,
    footprintHeight: number,
  ): boolean {
    if (owner === HUMAN_PLAYER_ID) {
      return true;
    }
    return isFootprintVisible(
      visibility,
      HUMAN_PLAYER_ID,
      position.x,
      position.y,
      footprintWidth,
      footprintHeight,
    );
  }

  // Resolve an entity's owner, anchor position, and footprint. Returns null if the
  // entity has no position component (e.g. the entity has been destroyed).
  function getEntityVisibilityProbe(entityId: number): {
    position: Position;
    owner: number | null;
    footprintWidth: number;
    footprintHeight: number;
  } | null {
    const position = world.getComponent<Position>(entityId, 'position');
    if (!position) {
      return null;
    }
    const unit = world.getComponent<UnitComponent>(entityId, 'unit');
    const building = world.getComponent<BuildingComponent>(entityId, 'building');
    const resource = world.getComponent<ResourceComponent>(entityId, 'resource');
    const owner = unit?.owner ?? building?.owner ?? resource?.owner ?? null;
    let footprintWidth = 1;
    let footprintHeight = 1;
    if (building) {
      const footprint = buildingFootprint(building.buildingType);
      footprintWidth = footprint.width;
      footprintHeight = footprint.height;
    }
    return { position, owner, footprintWidth, footprintHeight };
  }

  function isEntityVisibleToHuman(entityId: number): boolean {
    const probe = getEntityVisibilityProbe(entityId);
    if (!probe) {
      return false;
    }
    return isEntityFootprintVisibleToHuman(
      probe.position,
      probe.owner,
      probe.footprintWidth,
      probe.footprintHeight,
    );
  }

  function compareSelectableEntities(
    left: SelectableEntityCandidate,
    right: SelectableEntityCandidate,
  ): number {
    const kindPriority: Record<SelectableEntityCandidate['kind'], number> = {
      unit: 0,
      building: 1,
      resource: 2,
    };
    const ownerPriority = (owner: number | null): number => {
      if (owner === HUMAN_PLAYER_ID) {
        return 0;
      }
      if (owner === null) {
        return 2;
      }
      return 1;
    };

    const kindDelta = kindPriority[left.kind] - kindPriority[right.kind];
    if (kindDelta !== 0) {
      return kindDelta;
    }

    const ownerDelta = ownerPriority(left.owner) - ownerPriority(right.owner);
    if (ownerDelta !== 0) {
      return ownerDelta;
    }

    return left.id - right.id;
  }

  function getSelectableEntitiesAtCell(x: number, y: number): SelectableEntityCandidate[] {
    const candidates: SelectableEntityCandidate[] = [];

    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (position?.x === x && position.y === y && isVisibleToHuman(position, unit?.owner ?? null)) {
        candidates.push({
          id,
          kind: 'unit',
          owner: unit?.owner ?? null,
        });
      }
    }

    for (const id of world.query('position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (position && building && buildingOccupiesCell(id, x, y) && isVisibleToHuman(position, building.owner)) {
        candidates.push({
          id,
          kind: 'building',
          owner: building.owner,
        });
      }
    }

    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (
        position?.x === x
        && position.y === y
        && resource
        && isVisibleToHuman(position, resource.owner)
      ) {
        candidates.push({
          id,
          kind: 'resource',
          owner: resource.owner,
        });
      }
    }

    return candidates.sort(compareSelectableEntities);
  }

  function entityOccupiesCell(entityId: number, x: number, y: number): boolean {
    const position = world.getComponent<Position>(entityId, 'position');
    if (!position) {
      return false;
    }

    if (world.getComponent<BuildingComponent>(entityId, 'building')) {
      return buildingOccupiesCell(entityId, x, y);
    }

    return position.x === x && position.y === y;
  }

  function getHumanUnitIdsInRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    unitType?: UnitType,
  ): number[] {
    const clampedMinX = clamp(Math.min(minX, maxX), 0, MAP_WIDTH - 1);
    const clampedMaxX = clamp(Math.max(minX, maxX), 0, MAP_WIDTH - 1);
    const clampedMinY = clamp(Math.min(minY, maxY), 0, MAP_HEIGHT - 1);
    const clampedMaxY = clamp(Math.max(minY, maxY), 0, MAP_HEIGHT - 1);

    return [...world.query('position', 'unit')]
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
          && (unitType === undefined || entry.unit.unitType === unitType)
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
  }

  function selectUnitIds(ids: number[]): boolean {
    selectedEntityRefs = ids
      .map((id) => getEntityRef(id))
      .filter((ref): ref is EntityRef => ref !== null);
    selectionFocusCell = null;

    if (selectedEntityRefs.length === 0) {
      placementMode = null;
      return false;
    }

    placementMode = null;
    return true;
  }

  function getHumanOwnedSheepIdsInRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): number[] {
    const clampedMinX = clamp(Math.min(minX, maxX), 0, MAP_WIDTH - 1);
    const clampedMaxX = clamp(Math.max(minX, maxX), 0, MAP_WIDTH - 1);
    const clampedMinY = clamp(Math.min(minY, maxY), 0, MAP_HEIGHT - 1);
    const clampedMaxY = clamp(Math.max(minY, maxY), 0, MAP_HEIGHT - 1);

    return [...world.query('position', 'resource')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        resource: world.getComponent<ResourceComponent>(id, 'resource'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; resource: ResourceComponent } =>
          entry.position !== undefined
          && entry.resource !== undefined
          && entry.resource.resourceType === 'sheep'
          && entry.resource.owner === HUMAN_PLAYER_ID
          && entry.resource.amount > 0
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
  }

  function selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const unitIds = getHumanUnitIdsInRect(minX, minY, maxX, maxY);
    const sheepIds = getHumanOwnedSheepIdsInRect(minX, minY, maxX, maxY);
    return selectUnitIds([...unitIds, ...sheepIds]);
  }

  function selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const ids = unitType === 'sheep'
      ? getHumanOwnedSheepIdsInRect(minX, minY, maxX, maxY)
      : getHumanUnitIdsInRect(minX, minY, maxX, maxY, unitType);
    return selectUnitIds(ids);
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
        selectionFocusCell = null;
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
      selectionFocusCell = null;
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
      selectionFocusCell = null;
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

  function resolveSelectionTile(selectedEntityId: number, position: Position): Position {
    if (
      selectionFocusCell
      && entityOccupiesCell(selectedEntityId, selectionFocusCell.x, selectionFocusCell.y)
    ) {
      return selectionFocusCell;
    }

    return position;
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

  function findHostileWildlifeAtCell(x: number, y: number): number | null {
    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      const wildlife = wildlifeStates.get(id);
      if (
        position?.x === x
        && position.y === y
        && resource
        && wildlife?.isAlive
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
    markOutOfBandRenderChange();
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
    markOutOfBandRenderChange();
  }

  function killWildlifeEntity(id: number): void {
    const resource = world.getComponent<ResourceComponent>(id, 'resource');
    const wildlife = wildlifeStates.get(id);
    if (!resource || !wildlife) {
      return;
    }

    wildlife.currentHp = 0;
    wildlife.cooldownTicks = 0;
    wildlife.isAlive = false;
    wildlife.targetEntityRef = null;

    if (!wildlife.corpsePersists || resource.amount <= 0) {
      destroyResourceEntity(id);
      return;
    }

    markOutOfBandRenderChange();
  }

  function destroyResourceEntity(id: number): void {
    removeSelectedEntity(id);
    wildlifeStates.delete(id);
    sheepMoveOrders.delete(id);
    world.destroyEntity(id);
    markOutOfBandRenderChange();
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

  function issueSheepMoveCommand(sheepId: number, target: Position): boolean {
    const resource = world.getComponent<ResourceComponent>(sheepId, 'resource');
    if (
      !resource
      || resource.resourceType !== 'sheep'
      || resource.owner !== HUMAN_PLAYER_ID
      || resource.amount <= 0
    ) {
      return false;
    }

    sheepMoveOrders.set(sheepId, {
      x: clamp(target.x, 0, MAP_WIDTH - 1),
      y: clamp(target.y, 0, MAP_HEIGHT - 1),
    });
    return true;
  }

  function getSelectedOwnedSheepIds(): number[] {
    return getSelectedEntityIds().filter((id) => {
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      return (
        resource !== undefined
        && resource.resourceType === 'sheep'
        && resource.owner === HUMAN_PLAYER_ID
        && resource.amount > 0
      );
    });
  }

  function issueUnitAttackCommand(
    unitId: number,
    targetEntityId: number,
    targetEntityKind: 'unit' | 'building' | 'resource',
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
    } else if (targetEntityKind === 'building') {
      const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
      if (!targetBuilding || targetBuilding.owner === unit.owner) {
        return false;
      }
    } else {
      const targetResource = world.getComponent<ResourceComponent>(targetEntityId, 'resource');
      const wildlife = wildlifeStates.get(targetEntityId);
      if (!targetResource || !wildlife || !wildlife.isAlive) {
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
    selectionFocusCell = null;
    placementMode = null;
    markOutOfBandRenderChange();
    return true;
  }

  function ungarrisonBuilding(buildingId: number): boolean {
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    const buildingPosition = world.getComponent<Position>(buildingId, 'position');
    const garrisonedUnits = garrisonedByBuilding.get(buildingId) ?? [];
    if (!building || !buildingPosition || garrisonedUnits.length === 0) {
      return false;
    }

    const remainingGarrisonedUnits: number[] = [];
    let didUngarrisonUnit = false;

    for (const unitId of garrisonedUnits) {
      const unit = world.getComponent<UnitComponent>(unitId, 'unit');
      if (!unit) {
        continue;
      }

      const spawnPosition = findBuildingSpawnPosition(buildingPosition, building.buildingType);
      if (!spawnPosition) {
        remainingGarrisonedUnits.push(unitId);
        continue;
      }

      world.setPosition(unitId, spawnPosition);
      syncUnitTransformToPosition(unitId, spawnPosition);
      const storedVisionSource = garrisonedUnitVisionSources.get(unitId);
      if (storedVisionSource) {
        world.addComponent(unitId, 'visionSource', storedVisionSource);
        garrisonedUnitVisionSources.delete(unitId);
      }
      garrisonedUnitToBuilding.delete(unitId);
      clearGathererOrder(unitId);
      didUngarrisonUnit = true;
    }

    if (remainingGarrisonedUnits.length > 0) {
      garrisonedByBuilding.set(buildingId, remainingGarrisonedUnits);
    } else {
      garrisonedByBuilding.delete(buildingId);
    }

    if (didUngarrisonUnit) {
      markOutOfBandRenderChange();
    }
    return didUngarrisonUnit;
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
    markOutOfBandRenderChange();
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

  // Returns true when the owner has reached AT LEAST the given age. Used to
  // gate features that unlock in one age and remain available in every later
  // age (e.g., Castle-Age production-line upgrades that must stay researchable
  // even if the player advances to Imperial before researching them).
  function isAtLeastAge(owner: number, minAge: AgeType): boolean {
    const order: Record<AgeType, number> = {
      'dark-age': 0,
      'feudal-age': 1,
      'castle-age': 2,
      'imperial-age': 3,
    };
    return order[getPlayerAge(owner)] >= order[minAge];
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
          options.push(hasTechnology(owner, 'pikeman-upgrade') ? 'pikeman' : 'spearman');
        }
        return options;
      }
      case 'stable': {
        if (getPlayerAge(owner) === 'dark-age') {
          return [];
        }
        const scoutLine: TrainableUnitType = hasTechnology(owner, 'light-cavalry-upgrade')
          ? 'light-cavalry'
          : 'scout';
        if (isAtLeastAge(owner, 'castle-age')) {
          return [scoutLine, 'knight', 'camel'];
        }
        return [scoutLine];
      }
      case 'archery-range': {
        if (getPlayerAge(owner) === 'dark-age') {
          return [];
        }
        const archerLine: TrainableUnitType = hasTechnology(owner, 'crossbowman-upgrade')
          ? 'crossbowman'
          : 'archer';
        const options: TrainableUnitType[] = [archerLine, 'skirmisher'];
        if (isAtLeastAge(owner, 'castle-age')) {
          options.push('cavalry-archer');
        }
        return options;
      }
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

    if (
      buildingType === 'archery-range'
      && isAtLeastAge(owner, 'castle-age')
      && !hasTechnology(owner, 'crossbowman-upgrade')
    ) {
      return ['crossbowman-upgrade'];
    }

    if (
      buildingType === 'barracks'
      && isAtLeastAge(owner, 'castle-age')
      && !hasTechnology(owner, 'pikeman-upgrade')
    ) {
      return ['pikeman-upgrade'];
    }

    if (
      buildingType === 'stable'
      && isAtLeastAge(owner, 'castle-age')
      && !hasTechnology(owner, 'light-cavalry-upgrade')
    ) {
      return ['light-cavalry-upgrade'];
    }

    return [];
  }

  function getVisibleResearchOptions(owner: number, buildingType: BuildingType): ResearchableTechnologyType[] {
    if (buildingType === 'town-center') {
      const age = getPlayerAge(owner);
      if (age === 'dark-age') {
        return ['feudal-age'];
      }
      if (age === 'feudal-age') {
        return ['castle-age'];
      }
      return [];
    }

    return getResearchOptions(owner, buildingType);
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
      case 'crossbowman':
      case 'cavalry-archer':
        return 1;
      case 'spearman':
      case 'pikeman':
        return 2;
      case 'skirmisher':
        return 3;
      case 'knight':
      case 'camel':
        return 4;
      case 'militia':
        return 5;
      case 'scout':
      case 'light-cavalry':
        return 6;
      // Siege weapons are backline priority: Mangonel / Scorpion are glass-cannon
      // ranged threats (shoot them first once the frontline clears); Ram is a
      // slow anti-building mass that is normally safe to ignore unless it is
      // attacking something. Bucketed together since v1 AI doesn't distinguish.
      case 'mangonel':
      case 'scorpion':
      case 'battering-ram':
        return 7;
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
    const candidates = [...world.queryInRadius(origin.x, origin.y, range, 'position', 'unit')]
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
      .filter((entry) => isHarvestableResource(entry.id, entry.resource))
      .filter(
        (entry) => resourceKindToEconomyResource(entry.resource.resourceType) === gatherer.desiredResource,
      )
      .sort((left, right) => {
        const leftPreferred =
          left.resource.owner === owner ? 0
          : left.resource.owner === null && left.resource.baseOwner === owner ? 1
          : 2;
        const rightPreferred =
          right.resource.owner === owner ? 0
          : right.resource.owner === null && right.resource.baseOwner === owner ? 1
          : 2;
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

  function findNearestHostileWildlifeTarget(
    origin: Position,
    aggroRange: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): number | null {
    let bestUnitId: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const unitId of (activeWorld as GameWorld).queryInRadius(
      origin.x,
      origin.y,
      aggroRange,
      'unit',
    )) {
      const unit = activeWorld.getComponent<UnitComponent>(unitId, 'unit');
      const position = activeWorld.getComponent<Position>(unitId, 'position');
      const combat = combatStates.get(unitId);
      if (!unit || !position || !combat || combat.currentHp <= 0) {
        continue;
      }

      const distance = manhattanDistance(origin, position);
      if (distance > aggroRange) {
        continue;
      }

      if (distance < bestDistance || (distance === bestDistance && unitId < (bestUnitId ?? Number.POSITIVE_INFINITY))) {
        bestDistance = distance;
        bestUnitId = unitId;
      }
    }

    return bestUnitId;
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

  function upgradeOwnedUnits(owner: number, from: UnitType, to: UnitType): void {
    for (const id of world.query('unit')) {
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!unit || unit.owner !== owner || unit.unitType !== from) {
        continue;
      }

      const combat = combatStates.get(id);
      const hpRatio = combat && combat.maxHp > 0 ? combat.currentHp / combat.maxHp : 1;
      unit.unitType = to;

      const renderable = world.getComponent<RenderableComponent>(id, 'renderable');
      if (renderable) {
        renderable.tint = unitTint(to, owner);
        renderable.size = unitSize(to);
      }

      const vision = world.getComponent<VisionSourceComponent>(id, 'visionSource');
      if (vision) {
        vision.radius = unitVisionRadius(to);
      }

      const nextCombat = createCombatState(owner, to);
      if (combat) {
        nextCombat.cooldownTicks = combat.cooldownTicks;
      }
      nextCombat.currentHp = Math.max(1, Math.min(nextCombat.maxHp, Math.round(nextCombat.maxHp * hpRatio)));
      combatStates.set(id, nextCombat);
    }
  }

  // Rewrite any still-pending training-queue entry on buildings owned by
  // `owner` whose stored unitType matches the predecessor to the upgraded
  // type. Progress ticks and costs are preserved — only the type mutates —
  // so a half-trained predecessor finishes as the upgraded unit, matching
  // the "old line no longer trainable" invariant.
  function rewriteQueuedPredecessorUnits(
    owner: number,
    from: TrainableUnitType,
    to: TrainableUnitType,
  ): void {
    for (const [buildingId, queue] of productionQueues.entries()) {
      const building = world.getComponent<BuildingComponent>(buildingId, 'building');
      if (!building || building.owner !== owner) {
        continue;
      }
      for (const entry of queue) {
        if (entry.kind === 'unit' && entry.unitType === from) {
          entry.unitType = to;
          entry.label = to;
        }
      }
    }
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
          if (!unit || !combat || unit.owner !== owner || !isArcherLineUnit(unit.unitType)) {
            continue;
          }

          combat.attackDamage = unitAttackDamage(unit.unitType) + 1;
          combat.attackRange = unitAttackRange(unit.unitType) + 1;
        }
        break;
      case 'crossbowman-upgrade':
        upgradeOwnedUnits(owner, 'archer', 'crossbowman');
        rewriteQueuedPredecessorUnits(owner, 'archer', 'crossbowman');
        break;
      case 'pikeman-upgrade':
        upgradeOwnedUnits(owner, 'spearman', 'pikeman');
        rewriteQueuedPredecessorUnits(owner, 'spearman', 'pikeman');
        break;
      case 'light-cavalry-upgrade':
        upgradeOwnedUnits(owner, 'scout', 'light-cavalry');
        rewriteQueuedPredecessorUnits(owner, 'scout', 'light-cavalry');
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
              const hasResourceTarget =
                currentCommand.targetEntityKind === 'resource'
                && activeWorld.getComponent<ResourceComponent>(targetId, 'resource')
                && wildlifeStates.get(targetId)?.isAlive
                && activeWorld.getComponent<Position>(targetId, 'position');
              if (hasUnitTarget || hasBuildingTarget || hasResourceTarget) {
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
    after: ['prototypeAi'],
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
              const unitRangePlan = findUnitRangePlan(
                id,
                targetPosition,
                attackerCombat.attackRange,
                activeWorld,
              );
              if (!unitRangePlan) {
                unitCommands.delete(id);
                continue;
              }
              moveUnitOneSubgridStep(id, unitRangePlan.nextStep, activeWorld);
              continue;
            }

            if (attackerCombat.cooldownTicks > 0) {
              continue;
            }

            targetCombat.currentHp -=
              attackerCombat.attackDamage + attackBonusAgainstUnit(unit.unitType, targetUnit.unitType);
            attackerCombat.cooldownTicks = attackerCombat.reloadTicks;
            markOutOfBandRenderChange();

            if (targetCombat.currentHp <= 0) {
              destroyUnitEntity(targetId);
              unitCommands.delete(id);
            }
            continue;
          }

          if (command.targetEntityKind === 'resource') {
            const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
            const targetResource = activeWorld.getComponent<ResourceComponent>(targetId, 'resource');
            const targetWildlife = wildlifeStates.get(targetId);
            if (!targetPosition || !targetResource || !targetWildlife?.isAlive) {
              unitCommands.delete(id);
              continue;
            }

            if (manhattanDistance(position, targetPosition) > attackerCombat.attackRange) {
              const wildlifeRangePlan = findUnitRangePlan(
                id,
                targetPosition,
                attackerCombat.attackRange,
                activeWorld,
              );
              if (!wildlifeRangePlan) {
                unitCommands.delete(id);
                continue;
              }
              moveUnitOneSubgridStep(id, wildlifeRangePlan.nextStep, activeWorld);
              continue;
            }

            if (attackerCombat.cooldownTicks > 0) {
              continue;
            }

            targetWildlife.currentHp -= attackerCombat.attackDamage;
            targetWildlife.targetEntityRef = getEntityRef(id);
            attackerCombat.cooldownTicks = attackerCombat.reloadTicks;
            markOutOfBandRenderChange();

            if (targetWildlife.currentHp <= 0) {
              killWildlifeEntity(targetId);
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
            const buildingApproachPlan = findBuildingApproachPlan(
              id,
              targetId,
              attackerCombat.attackRange,
              activeWorld,
            );
            if (!buildingApproachPlan) {
              unitCommands.delete(id);
              continue;
            }
            moveUnitOneSubgridStep(id, buildingApproachPlan.nextStep, activeWorld);
            continue;
          }

          if (attackerCombat.cooldownTicks > 0) {
            continue;
          }

          targetHealth.currentHp -= attackerCombat.attackDamage;
          attackerCombat.cooldownTicks = attackerCombat.reloadTicks;
          markOutOfBandRenderChange();

          if (targetHealth.currentHp <= 0) {
            destroyBuildingEntity(targetId);
            unitCommands.delete(id);
          }
          continue;
        }

        if (command.type === 'move') {
          const movePlan = findMovePlan(id, command.target, activeWorld);
          if (!movePlan) {
            unitCommands.delete(id);
            continue;
          }

          if (isUnitAtTarget(id, movePlan.destination, activeWorld)) {
            unitCommands.delete(id);
            continue;
          }

          moveUnitOneSubgridStep(id, movePlan.nextStep, activeWorld);
          continue;
        }

        const buildingId = currentEntityId(activeWorld, command.buildingRef);
        if (buildingId === null) {
          unitCommands.delete(id);
          continue;
        }

        const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
        const construction = constructionStates.get(buildingId);
        const buildingApproachPlan = findBuildingApproachPlan(id, buildingId, 1, activeWorld);
        if (!building || !construction || construction.isComplete || !buildingApproachPlan) {
          unitCommands.delete(id);
          continue;
        }

        if (!isUnitAtTarget(id, buildingApproachPlan.destination, activeWorld)) {
          moveUnitOneSubgridStep(id, buildingApproachPlan.nextStep, activeWorld);
          continue;
        }

        construction.buildProgressTicks += 1;
        if (construction.buildProgressTicks >= construction.totalBuildTicks) {
          construction.buildProgressTicks = construction.totalBuildTicks;
          construction.isComplete = true;

          const renderable = activeWorld.getComponent<RenderableComponent>(buildingId, 'renderable');
          if (renderable) {
            renderable.tint = buildingTint(building.buildingType, building.owner, true);
            renderable.visualVariant = 'complete';
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
    after: ['prototypePlayerCommands'],
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
        if (entry.remainingTicks > 0) {
          entry.remainingTicks -= 1;
          if (entry.remainingTicks > 0) {
            continue;
          }
        }

        if (entry.kind === 'unit' && entry.unitType) {
          const spawnPosition = findBuildingSpawnPosition(position, building.buildingType);
          if (!spawnPosition) {
            entry.isBlocked = true;
            entry.remainingTicks = 0;
            continue;
          }

          const unitId = addUnitEntity(building.owner, entry.unitType, spawnPosition, {
            playerId: building.owner,
            radius: unitVisionRadius(entry.unitType),
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
    after: ['prototypePlayerCommands'],
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'velocity', 'wanderBounds')) {
        if (unitCommands.has(id)) {
          continue;
        }

        const position = activeWorld.getComponent<Position>(id, 'position');
        const velocity = activeWorld.getComponent<VelocityComponent>(id, 'velocity');
        const bounds = activeWorld.getComponent<WanderBoundsComponent>(id, 'wanderBounds');
        const transform = activeWorld.getComponent<UnitTransformComponent>(id, 'unitTransform');
        if (!position || !velocity || !bounds) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!unit || unit.unitType !== 'scout' || unit.owner === HUMAN_PLAYER_ID) {
          continue;
        }

        const slottedPosition = getUnitTargetTransformForCell(id, position);
        const currentFineX = transform?.fineX ?? slottedPosition.fineX;
        const currentFineY = transform?.fineY ?? slottedPosition.fineY;
        const nextX = currentFineX + velocity.dx * UNIT_SUBGRID_STEP_PER_TICK;
        const nextY = currentFineY + velocity.dy * UNIT_SUBGRID_STEP_PER_TICK;

        if (
          nextX < bounds.minX * UNIT_SUBGRID_RESOLUTION
          || nextX > bounds.maxX * UNIT_SUBGRID_RESOLUTION
        ) {
          velocity.dx *= -1;
        }
        if (
          nextY < bounds.minY * UNIT_SUBGRID_RESOLUTION
          || nextY > bounds.maxY * UNIT_SUBGRID_RESOLUTION
        ) {
          velocity.dy *= -1;
        }

        if (transform) {
          transform.fineX = clamp(
            currentFineX + velocity.dx * UNIT_SUBGRID_STEP_PER_TICK,
            bounds.minX * UNIT_SUBGRID_RESOLUTION,
            bounds.maxX * UNIT_SUBGRID_RESOLUTION,
          );
          transform.fineY = clamp(
            currentFineY + velocity.dy * UNIT_SUBGRID_STEP_PER_TICK,
            bounds.minY * UNIT_SUBGRID_RESOLUTION,
            bounds.maxY * UNIT_SUBGRID_RESOLUTION,
          );
          const nextGridPosition = gridPositionFromUnitTransform(transform);
          if (
            (nextGridPosition.x !== position.x || nextGridPosition.y !== position.y)
            && isCellPassableForUnit(id, nextGridPosition.x, nextGridPosition.y, activeWorld)
          ) {
            activeWorld.setPosition(id, nextGridPosition);
          } else if (
            nextGridPosition.x !== position.x
            || nextGridPosition.y !== position.y
          ) {
            syncUnitTransformToPosition(id, position, activeWorld);
          }
          continue;
        }

        const nextPosition = {
          x: clamp(position.x + velocity.dx, bounds.minX, bounds.maxX),
          y: clamp(position.y + velocity.dy, bounds.minY, bounds.maxY),
        };
        if (isCellPassableForUnit(id, nextPosition.x, nextPosition.y, activeWorld)) {
          activeWorld.setPosition(id, nextPosition);
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypeVillagerEconomy',
    phase: 'update',
    after: ['prototypePlayerCommands'],
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

        if (gatherer.task === 'idle' && shouldMaintainGatheringOrder(unit.owner, gatherer)) {
          assignNearestResource(activeWorld, id, gatherer, unit.owner);
        }

        if (gatherer.task === 'to-resource') {
          const targetResource = gatherer.targetResourceId === null
            ? null
            : activeWorld.getComponent<ResourceComponent>(gatherer.targetResourceId, 'resource');
          const resourceApproachPlan = gatherer.targetResourceId === null
            ? null
            : findResourceApproachPlan(id, gatherer.targetResourceId, activeWorld);

          if (
            !targetResource
            || !isHarvestableResource(gatherer.targetResourceId ?? -1, targetResource)
            || !resourceApproachPlan
          ) {
            gatherer.task = gatherer.carriedAmount > 0 ? 'to-dropoff' : 'idle';
            gatherer.targetResourceId = null;
          } else if (isUnitAtTarget(id, resourceApproachPlan.destination, activeWorld)) {
            gatherer.task = 'gathering';
            gatherer.gatherProgressTicks = 0;
            // A villager that has reached a sheep to harvest pins the sheep in place.
            // Any outstanding player move order on that sheep would otherwise keep
            // walking the sheep away each tick, thrashing the gather loop between
            // 'gathering' and 're-approach'. The player can re-issue the move order
            // after the villager finishes the sheep or moves off. Guard on the
            // resource type so the delete is a no-op for non-sheep gather targets
            // (ids are globally unique so it would be a no-op anyway, but the
            // guarded version makes intent explicit).
            if (
              gatherer.targetResourceId !== null
              && targetResource.resourceType === 'sheep'
            ) {
              sheepMoveOrders.delete(gatherer.targetResourceId);
            }
          } else {
            moveUnitOneSubgridStep(id, resourceApproachPlan.nextStep, activeWorld);
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
            const resourceApproachPlan = findResourceApproachPlan(
              id,
              gatherer.targetResourceId,
              activeWorld,
            );

            if (
              !targetPosition
              || !targetResource
              || !isHarvestableResource(gatherer.targetResourceId, targetResource)
              || !resourceApproachPlan
              || !isUnitAtTarget(id, resourceApproachPlan.destination, activeWorld)
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
                const carriedResource = resourceKindToEconomyResource(targetResource.resourceType);
                if (carriedResource === null) {
                  gatherer.task = 'idle';
                  gatherer.targetResourceId = null;
                  continue;
                }
                const gatherAmount = Math.min(
                  gatherAmountFor(targetResource.resourceType),
                  targetResource.amount,
                  gatherer.carryCapacity - gatherer.carriedAmount,
                );
                targetResource.amount -= gatherAmount;
                gatherer.carriedResource = carriedResource;
                gatherer.carriedAmount += gatherAmount;

                if (targetResource.amount <= 0) {
                  const depletedResourceId = gatherer.targetResourceId;
                  gatherer.targetResourceId = null;
                  if (depletedResourceId !== null) {
                    destroyResourceEntity(depletedResourceId);
                  }
                }

                if (targetResource.amount <= 0 || gatherer.carriedAmount >= gatherer.carryCapacity) {
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
          const dropOffPlan = dropOffId === null
            ? null
            : findBuildingApproachPlan(id, dropOffId, 1, activeWorld);

          if (!dropOffPlan || gatherer.carriedResource === null || gatherer.carriedAmount <= 0) {
            gatherer.task = 'idle';
            gatherer.carriedAmount = 0;
            gatherer.carriedResource = null;
          } else if (isUnitAtTarget(id, dropOffPlan.destination, activeWorld)) {
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
            moveUnitOneSubgridStep(id, dropOffPlan.nextStep, activeWorld);
          }
        }

        if (gatherer.task === 'idle' && shouldMaintainGatheringOrder(unit.owner, gatherer)) {
          assignNearestResource(activeWorld, id, gatherer, unit.owner);
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypeWildlifeCombat',
    phase: 'update',
    after: ['prototypeVillagerEconomy'],
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'resource')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
        const wildlife = wildlifeStates.get(id);
        if (!position || !resource || !wildlife?.isAlive) {
          continue;
        }

        if (wildlife.cooldownTicks > 0) {
          wildlife.cooldownTicks -= 1;
        }

        let targetId = currentEntityId(activeWorld, wildlife.targetEntityRef);
        let targetPosition = targetId === null
          ? null
          : activeWorld.getComponent<Position>(targetId, 'position');
        let targetCombat = targetId === null ? null : combatStates.get(targetId);

        if (!targetPosition || !targetCombat || targetCombat.currentHp <= 0) {
          wildlife.targetEntityRef = null;
          targetId = null;
        }

        if (targetId === null && wildlife.autoAggro) {
          targetId = findNearestHostileWildlifeTarget(position, wildlife.aggroRange, activeWorld);
          wildlife.targetEntityRef = targetId === null ? null : getEntityRef(targetId);
          targetPosition = targetId === null
            ? null
            : activeWorld.getComponent<Position>(targetId, 'position');
          targetCombat = targetId === null ? null : combatStates.get(targetId);
        }

        if (!targetId || !targetPosition || !targetCombat) {
          continue;
        }

        if (manhattanDistance(position, targetPosition) > wildlife.attackRange) {
          const movePlan = findWildlifeRangePlan(id, targetPosition, wildlife.attackRange, activeWorld);
          if (!movePlan) {
            wildlife.targetEntityRef = null;
            continue;
          }

          activeWorld.setPosition(id, movePlan.nextStep);
          continue;
        }

        if (wildlife.cooldownTicks > 0) {
          continue;
        }

        targetCombat.currentHp -= wildlife.attackDamage;
        wildlife.cooldownTicks = wildlife.reloadTicks;
        markOutOfBandRenderChange();

        if (targetCombat.currentHp <= 0) {
          destroyUnitEntity(targetId);
          wildlife.targetEntityRef = null;
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypeHerdableOwnership',
    phase: 'update',
    after: ['prototypeWildlifeCombat'],
    execute(activeWorld) {
      if (updateSheepOwnership(activeWorld)) {
        markOutOfBandRenderChange();
      }
    },
  });

  world.registerSystem({
    name: 'prototypeHerdableMovement',
    phase: 'update',
    before: ['prototypePlayerCommands'],
    execute(activeWorld) {
      for (const [sheepId, target] of [...sheepMoveOrders.entries()]) {
        const resource = activeWorld.getComponent<ResourceComponent>(sheepId, 'resource');
        const transform = getUnitTransform(sheepId, activeWorld);
        if (
          !resource
          || !transform
          || resource.resourceType !== 'sheep'
          || resource.amount <= 0
          || resource.owner === null
        ) {
          sheepMoveOrders.delete(sheepId);
          continue;
        }

        if (isUnitTransformAtTarget(transform, sheepId, target)) {
          sheepMoveOrders.delete(sheepId);
          continue;
        }

        const start = gridPositionFromUnitTransform(transform);
        const plan = findMovementPlan(
          sheepId,
          start,
          getNearestMoveCandidates(target),
          false,
          activeWorld,
          isCellPassableForWildlife,
        );
        if (!plan) {
          sheepMoveOrders.delete(sheepId);
          continue;
        }

        // The path planner picks the nearest passable cell when the requested
        // target is itself blocked. If we have already arrived at that planner
        // destination, treat the order as complete instead of re-planning the
        // same dead-end every tick.
        if (isUnitTransformAtTarget(transform, sheepId, plan.destination)) {
          sheepMoveOrders.delete(sheepId);
          continue;
        }

        moveUnitOneSubgridStep(sheepId, plan.nextStep, activeWorld, SHEEP_SUBGRID_STEP_PER_TICK);
        markOutOfBandRenderChange();
      }
    },
  });

  world.registerSystem({
    name: 'prototypeVisibility',
    phase: 'update',
    after: ['prototypeHerdableOwnership'],
    execute(activeWorld) {
      syncVisibilitySources(activeWorld, visibility, trackedVisibilitySources);
    },
  });

  world.registerSystem({
    name: 'prototypeFogMemory',
    phase: 'update',
    after: ['prototypeVisibility'],
    execute(activeWorld) {
      const humanMemory = getOrCreateMemoryMap(HUMAN_PLAYER_ID);

      // Refresh every building the human player currently sees. Buildings span a
      // footprint; visibility is tested on the anchor cell, which matches how the
      // projector itself decides whether an entity is visible.
      for (const id of activeWorld.query('position', 'building', 'renderable')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
        const renderable = activeWorld.getComponent<RenderableComponent>(id, 'renderable');
        if (!position || !building || !renderable) {
          continue;
        }
        if (!visibility.isVisible(HUMAN_PLAYER_ID, position.x, position.y)) {
          continue;
        }
        humanMemory.set(id, {
          kind: 'building',
          entityType: building.buildingType,
          position: { x: position.x, y: position.y },
          footprintWidth: renderable.footprintWidth,
          footprintHeight: renderable.footprintHeight,
          tint: renderable.tint,
          owner: building.owner,
          size: renderable.size,
          visualVariant: renderable.visualVariant,
          lastSeenTick: activeWorld.tick,
        });
      }

      // Refresh every static resource the human player currently sees. Sheep,
      // boars, wolves, and fish are movable or otherwise mobile and therefore
      // excluded — their last-seen position would go stale the moment they leave
      // vision and walk away. Only tree / berry-bush / gold-mine / stone-mine
      // qualify (see `isStaticMemorableResourceType`).
      for (const id of activeWorld.query('position', 'resource', 'renderable')) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
        const renderable = activeWorld.getComponent<RenderableComponent>(id, 'renderable');
        if (!position || !resource || !renderable) {
          continue;
        }
        if (!isStaticMemorableResourceType(resource.resourceType)) {
          continue;
        }
        if (!visibility.isVisible(HUMAN_PLAYER_ID, position.x, position.y)) {
          continue;
        }
        humanMemory.set(id, {
          kind: 'resource',
          entityType: resource.resourceType,
          position: { x: position.x, y: position.y },
          footprintWidth: renderable.footprintWidth,
          footprintHeight: renderable.footprintHeight,
          tint: renderable.tint,
          owner: resource.owner,
          size: renderable.size,
          visualVariant: renderable.visualVariant,
          lastSeenTick: activeWorld.tick,
        });
      }

      // Forget memories of entities that no longer exist (resource depleted, building
      // destroyed) AND whose last-known cell is currently visible — i.e. the player
      // saw it disappear. If the entity simply walked out of vision, we keep the
      // stale snapshot. Map iterators are safe against deletion during iteration,
      // so iterate the Map directly instead of materializing an entries array.
      for (const [entityId, entry] of humanMemory) {
        const stillExists = activeWorld.getComponent<Position>(entityId, 'position') !== undefined;
        if (stillExists) {
          continue;
        }
        if (visibility.isVisible(HUMAN_PLAYER_ID, entry.position.x, entry.position.y)) {
          humanMemory.delete(entityId);
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypeTowerCombat',
    phase: 'update',
    after: ['prototypeVisibility'],
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
          markOutOfBandRenderChange();
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
        health: null,
        attack: null,
        armor: null,
        faction: null,
        civ: null,
        inventory: null,
        x: null,
        y: null,
        tileX: null,
        tileY: null,
        tileEntityIndex: null,
        tileEntityCount: 0,
        resourceAmount: null,
        resourceMaxAmount: null,
        actionOptions: [],
        buildOptions: [],
        marketOptions: [],
        trainOptions: [],
        visibleResearchOptions: [],
        researchOptions: [],
        queue: [],
        placementMode,
      };
    }

    const position = world.getComponent<Position>(selectedEntityId, 'position');
    const unit = world.getComponent<UnitComponent>(selectedEntityId, 'unit');
    const building = world.getComponent<BuildingComponent>(selectedEntityId, 'building');
    const resource = world.getComponent<ResourceComponent>(selectedEntityId, 'resource');
    if (!position || (!unit && !building && !resource)) {
      selectedEntityRefs = [];
      selectionFocusCell = null;
      return getSelectionState();
    }

    const selectionTile = resolveSelectionTile(selectedEntityId, position);
    const tileEntities =
      selectedEntityIds.length === 1
        ? getSelectableEntitiesAtCell(selectionTile.x, selectionTile.y)
        : [];
    const tileEntityIndex =
      selectedEntityIds.length === 1
        ? (() => {
          const index = tileEntities.findIndex((candidate) => candidate.id === selectedEntityId);
          return index >= 0 ? index + 1 : null;
        })()
        : null;

    const selectedUnits = selectedEntityIds
      .map((id) => ({
        id,
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter((entry): entry is { id: number; unit: UnitComponent } => entry.unit !== undefined);
    // Owned sheep can ride along in a drag-box selection alongside units; for the
    // purpose of build/train eligibility they should be transparent — the unit
    // members of the selection still drive the available actions.
    const ownedSheepCountInSelection = selectedEntityIds.filter((id) => {
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      return (
        resource !== undefined
        && resource.resourceType === 'sheep'
        && resource.owner === HUMAN_PLAYER_ID
      );
    }).length;
    const nonSheepNonUnitMembers =
      selectedEntityIds.length - selectedUnits.length - ownedSheepCountInSelection;
    const selectedUnitsAndOwnedSheepCoverSelection = nonSheepNonUnitMembers === 0;
    const allSelectedUnitsAreHumanVillagers =
      selectedUnitsAndOwnedSheepCoverSelection
      && selectedUnits.length > 0
      && selectedUnits.every((entry) => entry.unit.owner === HUMAN_PLAYER_ID && entry.unit.unitType === 'villager');
    const allSelectedUnitsShareType =
      selectedUnitsAndOwnedSheepCoverSelection
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
    const visibleResearchOptions: ResearchableTechnologyType[] =
      building?.owner === HUMAN_PLAYER_ID
        ? getVisibleResearchOptions(building.owner, building.buildingType)
        : [];
    const selectedKind = unit ? 'unit' : building ? 'building' : 'resource';
    const owner = unit?.owner ?? building?.owner ?? resource?.owner ?? null;

    return {
      selectedEntityId,
      selectedEntityIds,
      selectedCount: selectedEntityIds.length,
      selectedKind,
      selectedEntityType:
        selectedEntityIds.length > 1 && !allSelectedUnitsShareType
          ? null
          : unit?.unitType ?? building?.buildingType ?? resource?.resourceType ?? null,
      owner,
      health: selectedEntityIds.length === 1 ? getSelectionHealth(selectedEntityId) : null,
      attack: selectedEntityIds.length === 1 ? getSelectionAttack(selectedEntityId, unit, building, resource) : null,
      armor: selectedEntityIds.length === 1 ? getSelectionArmor(unit, building, resource, selectedEntityId) : null,
      faction: selectedEntityIds.length === 1 ? factionName(owner) : null,
      civ: selectedEntityIds.length === 1 ? getSelectionCiv(owner, selectedKind) : null,
      inventory:
        selectedEntityIds.length === 1
          ? getSelectionInventory(selectedEntityId, unit, building, resource)
          : null,
      x: position.x,
      y: position.y,
      tileX: selectionTile.x,
      tileY: selectionTile.y,
      tileEntityIndex,
      tileEntityCount: tileEntities.length,
      resourceAmount: resource?.amount ?? null,
      resourceMaxAmount: resource?.maxAmount ?? null,
      actionOptions,
      buildOptions,
      marketOptions,
      trainOptions,
      visibleResearchOptions,
      researchOptions,
      queue: building ? cloneQueue(productionQueues.get(selectedEntityId) ?? []) : [],
      placementMode,
    };
  }

  function getPlacementPreview(x: number, y: number): PlacementPreviewState | null {
    if (placementMode === null) {
      return null;
    }

    const selectedVillagerId = getSelectedHumanVillagerIds()[0] ?? null;
    if (selectedVillagerId === null) {
      return null;
    }

    const unit = world.getComponent<UnitComponent>(selectedVillagerId, 'unit');
    if (!unit || unit.owner !== HUMAN_PLAYER_ID || unit.unitType !== 'villager') {
      return null;
    }

    const anchor = {
      x: clamp(x, 0, MAP_WIDTH - 1),
      y: clamp(y, 0, MAP_HEIGHT - 1),
    };
    const footprint = buildingFootprint(placementMode);

    return {
      active: true,
      buildingType: placementMode,
      cellX: anchor.x,
      cellY: anchor.y,
      width: footprint.width,
      height: footprint.height,
      isValid: !isPlacementBlocked(anchor.x, anchor.y, footprint.width, footprint.height),
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
    const hostileWildlifeId = findHostileWildlifeAtCell(target.x, target.y);

    if (ownedGarrisonBuildingId !== null) {
      return garrisonUnit(unitId, ownedGarrisonBuildingId);
    }

    if (hostileUnitId !== null) {
      return issueUnitAttackCommand(unitId, hostileUnitId, 'unit');
    }

    if (hostileBuildingId !== null) {
      return issueUnitAttackCommand(unitId, hostileBuildingId, 'building');
    }

    if (hostileWildlifeId !== null) {
      return issueUnitAttackCommand(unitId, hostileWildlifeId, 'resource');
    }

    if (resourceId === null) {
      return issueUnitMoveCommand(unitId, target);
    }

    if (!issueUnitGatherCommand(unitId, resourceId)) {
      return issueUnitMoveCommand(unitId, target);
    }

    return true;
  }

  function issueUnitGatherCommand(unitId: number, resourceId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const gatherer = world.getComponent<GathererComponent>(unitId, 'gatherer');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    const targetPosition = world.getComponent<Position>(resourceId, 'position');
    if (!unit || !gatherer || !resource || !targetPosition) {
      return false;
    }

    const economyResource = resourceKindToEconomyResource(resource.resourceType);
    if (economyResource === null || !isHarvestableResource(resourceId, resource)) {
      return false;
    }

    clearGathererOrder(unitId);
    gatherer.hasExplicitGatherOrder = true;
    unitCommands.delete(unitId);
    gatherer.desiredResource = economyResource;
    gatherer.task = 'to-resource';
    gatherer.targetResourceId = resourceId;
    gatherer.dropOffBuildingId = findNearestDropOffBuilding(
      world,
      unit.owner,
      economyResource,
      targetPosition,
    );
    gatherer.gatherProgressTicks = 0;
    return true;
  }

  function issueUnitContextCommandAtEntity(unitId: number, targetEntityId: number): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    const targetPosition = world.getComponent<Position>(targetEntityId, 'position');
    if (!unit || unit.owner !== HUMAN_PLAYER_ID || !targetPosition) {
      return false;
    }

    const targetUnit = world.getComponent<UnitComponent>(targetEntityId, 'unit');
    if (targetUnit && targetUnit.owner !== unit.owner) {
      return issueUnitAttackCommand(unitId, targetEntityId, 'unit');
    }

    const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
    if (targetBuilding) {
      if (targetBuilding.owner !== unit.owner) {
        return issueUnitAttackCommand(unitId, targetEntityId, 'building');
      }

      const construction = constructionStates.get(targetEntityId);
      if (
        canGarrisonAt(targetBuilding.buildingType, unit.unitType)
        && (!construction || construction.isComplete)
      ) {
        return garrisonUnit(unitId, targetEntityId);
      }
    }

    const targetResource = world.getComponent<ResourceComponent>(targetEntityId, 'resource');
    const wildlife = wildlifeStates.get(targetEntityId);
    if (targetResource && wildlife?.isAlive) {
      return issueUnitAttackCommand(unitId, targetEntityId, 'resource');
    }

    if (unit.unitType === 'villager' && issueUnitGatherCommand(unitId, targetEntityId)) {
      return true;
    }

    return issueUnitMoveCommand(unitId, targetPosition);
  }

  function selectEntityAtCell(x: number, y: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectableEntities = getSelectableEntitiesAtCell(x, y);
    const currentSelectionIds = getSelectedEntityIds();
    const currentSelectionId = currentSelectionIds.length === 1 ? currentSelectionIds[0] : null;
    const lastClickedSameCell =
      selectionFocusCell !== null
      && selectionFocusCell.x === x
      && selectionFocusCell.y === y;
    let nextSelection = selectableEntities[0]?.id ?? null;

    if (lastClickedSameCell && currentSelectionId !== null && selectableEntities.length > 1) {
      const currentIndex = selectableEntities.findIndex((candidate) => candidate.id === currentSelectionId);
      if (currentIndex >= 0) {
        nextSelection = selectableEntities[(currentIndex + 1) % selectableEntities.length]?.id ?? null;
      }
    }

    selectedEntityRefs =
      nextSelection === null
        ? []
        : [getEntityRef(nextSelection)].filter((ref): ref is EntityRef => ref !== null);
    if (nextSelection === null) {
      selectionFocusCell = null;
      placementMode = null;
      return false;
    }

    selectionFocusCell = { x, y };
    placementMode = null;
    return selectedEntityRefs.length > 0;
  }

  function clearSelection(): void {
    selectedEntityRefs = [];
    selectionFocusCell = null;
    placementMode = null;
  }

  function issueMoveCommand(x: number, y: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const ownedSheepIds = getSelectedOwnedSheepIds();
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (ownedSheepIds.length === 0 && selectedUnitIds.length === 0) {
      return false;
    }

    placementMode = null;
    let didIssue = false;
    for (const unitId of selectedUnitIds) {
      didIssue = issueUnitMoveCommand(unitId, { x, y }) || didIssue;
    }
    for (const sheepId of ownedSheepIds) {
      didIssue = issueSheepMoveCommand(sheepId, { x, y }) || didIssue;
    }

    return didIssue;
  }

  function issueContextCommand(x: number, y: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const selectedEntityId = getSelectedEntityId();
    if (selectedEntityId !== null) {
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
    }

    const ownedSheepIds = getSelectedOwnedSheepIds();
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (ownedSheepIds.length === 0 && selectedUnitIds.length === 0) {
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
    for (const sheepId of ownedSheepIds) {
      didIssue = issueSheepMoveCommand(sheepId, target) || didIssue;
    }

    return didIssue;
  }

  function issueContextCommandAtEntityInternal(entityId: number): boolean {
    if (!isMatchRunning()) {
      return false;
    }

    const targetPosition = world.getComponent<Position>(entityId, 'position');
    if (!targetPosition) {
      return false;
    }

    // Memory entities (explored-but-not-visible) can show up in the projector's render
    // frame, which means hit-testing in the scene can resolve a fog-hidden entity id.
    // Reject those commands here so the player cannot gather, attack, or otherwise
    // interact with anything they cannot currently see. Owned entities skip this
    // check via `isEntityFootprintVisibleToHuman`.
    if (!isEntityVisibleToHuman(entityId)) {
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
        x: clamp(targetPosition.x, 0, MAP_WIDTH - 1),
        y: clamp(targetPosition.y, 0, MAP_HEIGHT - 1),
      });
      placementMode = null;
      return true;
    }

    const ownedSheepIds = getSelectedOwnedSheepIds();
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (ownedSheepIds.length === 0 && selectedUnitIds.length === 0) {
      return false;
    }

    placementMode = null;
    let didIssue = false;
    for (const unitId of selectedUnitIds) {
      didIssue = issueUnitContextCommandAtEntity(unitId, entityId) || didIssue;
    }
    for (const sheepId of ownedSheepIds) {
      didIssue = issueSheepMoveCommand(sheepId, targetPosition) || didIssue;
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
            owner: resource.owner,
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
          const footprint = buildingFootprint(building.buildingType);
          return {
            id,
            owner: building.owner,
            buildingType: building.buildingType,
            x: position.x,
            y: position.y,
            footprintWidth: footprint.width,
            footprintHeight: footprint.height,
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
    getPlacementPreview,
    getEntityHealth,
    selectEntityAtCell,
    selectOwnedUnitsByTypeInRect,
    selectUnitsInBox,
    clearSelection,
    issueContextCommand,
    issueContextCommandAtEntity: issueContextCommandAtEntityInternal,
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
    consumeOutOfBandRenderChange() {
      const didChange = hasOutOfBandRenderChange;
      hasOutOfBandRenderChange = false;
      return didChange;
    },
    getFogMemoryEntities,
    getHumanFogMemorySize,
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
    getPlacementPreview,
    getEntityHealth,
    selectEntityAtCell,
    selectOwnedUnitsByTypeInRect,
    selectUnitsInBox,
    clearSelection,
    issueContextCommand,
    issueContextCommandAtEntity: issueContextCommandAtEntityInternal,
    issueMoveCommand,
    issueAction,
    queueTrainUnit,
    queueResearch,
    issueMarketAction,
    beginBuildingPlacement,
    confirmBuildingPlacement,
    isSelected,
    consumeOutOfBandRenderChange,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  } =
    createWorld(seed, visibility);
  const renderStore = new RenderStore();
  const debuggerView = new WorldDebugger({ world });
  const renderAdapter = new RenderAdapter({
    world,
    projector: createProjector(visibility, HUMAN_PLAYER_ID, seed, isSelected, getEntityHealth),
    debug: debuggerView,
    send(message) {
      renderStore.apply(message);
    },
  });

  renderAdapter.connect();

  function refreshRenderProjection(): void {
    renderAdapter.disconnect();
    renderAdapter.connect();
  }

  function flushOutOfBandRenderChange(): void {
    if (consumeOutOfBandRenderChange()) {
      refreshRenderProjection();
    }
  }

  let accumulatorMs = 0;

  const issueContextCommandAtEntity = (entityId: number): boolean => {
    const didIssue = issueContextCommandAtEntityInternal(entityId);
    if (!didIssue) {
      return false;
    }
    flushOutOfBandRenderChange();
    return true;
  };

  return {
    step(deltaMs: number) {
      flushOutOfBandRenderChange();
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
      flushOutOfBandRenderChange();
      // The render adapter only re-projects entities on component changes, so a static
      // enemy building or resource's projected view can linger in the render store after
      // it has left the human player's vision. Filter those out here so they can be
      // surfaced as memory entities instead. Units are NOT filtered: they update their
      // transform each tick, so the adapter re-runs the visibility check on them as a
      // side-effect of component changes. Sheep carry a fractional subgrid x/y when
      // moving, so floor to an integer cell before querying the visibility grid.
      // Buildings can span multiple cells, so check the full footprint — a Town
      // Center with one corner in vision must render as live, not memory.
      //
      // `renderStore.getEntities()` already returns a sorted array. We preserve that
      // order so the common no-memory path returns the live list as-is without
      // building a dedupe Set, projecting memory views, or re-sorting. Each one of
      // those would otherwise allocate every frame for no benefit in the common case.
      const liveEntitiesRaw = renderStore.getEntities();
      const liveEntities = liveEntitiesRaw.filter((entity) => {
        if (entity.kind !== 'building' && entity.kind !== 'resource') {
          return true;
        }
        if (entity.owner === HUMAN_PLAYER_ID) {
          return true;
        }
        return isFootprintVisible(
          visibility,
          HUMAN_PLAYER_ID,
          entity.x,
          entity.y,
          entity.footprintWidth,
          entity.footprintHeight,
        );
      });

      // Fast path: if the human player has no fog memory at all, skip the dedupe
      // Set, the memory projection, and the merge sort entirely. This is the
      // common case every frame after warmup.
      if (getHumanFogMemorySize() === 0) {
        return {
          tick: renderStore.getTick(),
          entities: liveEntities,
          frame: renderStore.getFrame(),
        };
      }

      const liveIds = new Set<number>();
      for (const entity of liveEntities) {
        liveIds.add(entity.id);
      }
      const memoryEntities = getFogMemoryEntities(liveIds);
      if (memoryEntities.length === 0) {
        return {
          tick: renderStore.getTick(),
          entities: liveEntities,
          frame: renderStore.getFrame(),
        };
      }

      // Merge live and memory entries into one sorted array. Live entries are
      // already sorted by (layer, y, x); memory entries are not, so a single sort
      // of the combined array is the simplest way to keep the rendering layer
      // order intact. The comparator is hoisted to module scope so we don't
      // allocate a fresh closure each frame.
      const merged = liveEntities.slice();
      for (const entity of memoryEntities) {
        merged.push(entity);
      }
      merged.sort(compareProjectedRenderEntities);
      return {
        tick: renderStore.getTick(),
        entities: merged,
        frame: renderStore.getFrame(),
      };
    },
    getRenderInterpolationAlpha() {
      const tickMs = 1000 / TPS;
      if (tickMs <= 0) {
        return 1;
      }

      return clamp(accumulatorMs / tickMs, 0, 1);
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
    getPlacementPreview,
    selectEntityAtCell,
    selectOwnedUnitsByTypeInRect,
    selectUnitsInBox,
    clearSelection,
    issueContextCommand(x: number, y: number) {
      const didIssue = issueContextCommand(x, y);
      flushOutOfBandRenderChange();
      return didIssue;
    },
    issueContextCommandAtEntity,
    issueMoveCommand,
    issueAction(actionType: ActionType) {
      const didIssue = issueAction(actionType);
      flushOutOfBandRenderChange();
      return didIssue;
    },
    queueTrainUnit,
    queueResearch,
    issueMarketAction,
    beginBuildingPlacement,
    confirmBuildingPlacement(x: number, y: number) {
      const didConfirm = confirmBuildingPlacement(x, y);
      flushOutOfBandRenderChange();
      return didConfirm;
    },
  };
}
