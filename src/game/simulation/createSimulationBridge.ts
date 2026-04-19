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
  getPopulationState(playerId: number): PopulationState;
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
const MONASTERY_BUILD_TIME_TICKS = 280;
const MONK_TRAIN_TIME_TICKS = 510;
// Slice 6: Castle is a much larger structure than a Siege Workshop or TC and
// takes longer to erect. Longbowman is a Britons civ unique ranged unit that
// trains at the Castle when the owner's civ is Britons.
const CASTLE_BUILD_TIME_TICKS = 560;
const LONGBOWMAN_TRAIN_TIME_TICKS = 300;
// Deterministic per-tick increments for Monk conversion and heal (Slice 5).
// Conversion flips target ownership at 50 progress; heal restores 1 HP per
// 10 ticks. These values are intentionally v1 "easy-to-observe" rates — real
// AoE2 uses per-tick conversion chance plus faith; out-of-scope here.
const MONK_HEAL_TICK_INTERVAL = 10;
const MONK_HEAL_HP_PER_INTERVAL = 1;
const MONK_CONVERT_PROGRESS_PER_TICK = 1;
const MONK_CONVERT_FLIP_THRESHOLD = 50;
const MONK_ACTION_RANGE = 4;
const MONK_VISION_RADIUS = 9;
const CROSSBOWMAN_UPGRADE_RESEARCH_TIME_TICKS = 350;
const PIKEMAN_UPGRADE_RESEARCH_TIME_TICKS = 450;
const LIGHT_CAVALRY_UPGRADE_RESEARCH_TIME_TICKS = 450;
// Slice 7: Imperial Age age-up research mirrors the Feudal → Castle research
// pattern at the Town Center and typically takes a touch longer in AoE2 DE.
// Kept within the same scale as the Castle Age research so the gate tests stay
// readable without ballooning step counts.
const IMPERIAL_AGE_RESEARCH_TIME_TICKS = 1900;
// Slice 7A: placeholder durations for the Imperial unit-line upgrades. The
// actual wire-up (callback into applyTechnology, train-menu swap, etc.) lands
// in 7B/7C/7D — 7A just needs valid numbers so the research-time switch is
// exhaustive and `npx tsc --noEmit` passes. Values roughly mirror the Castle
// Age upgrades they succeed.
const ARBALEST_UPGRADE_RESEARCH_TIME_TICKS = 450;
const HALBERDIER_UPGRADE_RESEARCH_TIME_TICKS = 500;
const HUSSAR_UPGRADE_RESEARCH_TIME_TICKS = 500;
const HEAVY_CAVALRY_ARCHER_UPGRADE_RESEARCH_TIME_TICKS = 550;
const CAVALIER_UPGRADE_RESEARCH_TIME_TICKS = 500;
const CHAMPION_UPGRADE_RESEARCH_TIME_TICKS = 550;
const ELITE_LONGBOWMAN_UPGRADE_RESEARCH_TIME_TICKS = 550;
const ONAGER_UPGRADE_RESEARCH_TIME_TICKS = 600;
const HEAVY_SCORPION_UPGRADE_RESEARCH_TIME_TICKS = 550;
const SIEGE_RAM_UPGRADE_RESEARCH_TIME_TICKS = 600;
const BRACER_RESEARCH_TIME_TICKS = 500;
const BLAST_FURNACE_RESEARCH_TIME_TICKS = 600;
const PLATE_MAIL_ARMOR_RESEARCH_TIME_TICKS = 600;
const PLATE_BARDING_RESEARCH_TIME_TICKS = 600;
// Slice 7A: Imperial unit train times. Mostly mirror their Castle-Age
// predecessors where one exists; Bombard Cannon and Trebuchet (Imperial-only,
// no predecessor) get their own longer values to reflect the heavier siege.
const ARBALEST_TRAIN_TIME_TICKS = 270;
const HALBERDIER_TRAIN_TIME_TICKS = 220;
const HUSSAR_TRAIN_TIME_TICKS = 300;
const HEAVY_CAVALRY_ARCHER_TRAIN_TIME_TICKS = 340;
const CAVALIER_TRAIN_TIME_TICKS = 300;
const CHAMPION_TRAIN_TIME_TICKS = 210;
const ELITE_LONGBOWMAN_TRAIN_TIME_TICKS = 300;
const ONAGER_TRAIN_TIME_TICKS = 460;
const HEAVY_SCORPION_TRAIN_TIME_TICKS = 300;
const SIEGE_RAM_TRAIN_TIME_TICKS = 360;
const BOMBARD_CANNON_TRAIN_TIME_TICKS = 560;
const TREBUCHET_TRAIN_TIME_TICKS = 500;
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

// Slice 5 Monk task. A Monk can heal a friendly wounded unit, convert an
// enemy unit, pick up a neutral relic, or deposit a carried relic in a
// friendly Monastery. The task encodes the target by stable EntityRef so
// cleanup is automatic when the target is destroyed.
interface MonkTask {
  kind: 'heal' | 'convert' | 'pickup' | 'deposit';
  targetEntityRef: EntityRef;
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
    // Relics are not harvestable — they carry no inventory amount. This
    // branch should never fire because getSelectionInventory is only called
    // for resource entities with an amount, but the exhaustive switch needs
    // to cover every ResourceKind.
    case 'relic':
      return 'relic';
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
    // Relics are picked up by Monks via dedicated pickup/deposit commands;
    // they are not part of the gather-drop economy loop.
    case 'relic':
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
    case 'relic':
      throw new Error('Relics are not harvestable resources; use the Monk pickup flow.');
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
    case 'relic':
      throw new Error('Relics are not harvestable resources; use the Monk pickup flow.');
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
    relic: 0xf5d680,
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
    case 'monastery':
    case 'castle':
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
    case 'monastery':
      return MONASTERY_BUILD_TIME_TICKS;
    case 'castle':
      return CASTLE_BUILD_TIME_TICKS;
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
    case 'monastery':
      return 1.2;
    case 'town-center':
      return 1.4;
    case 'castle':
      return 1.5;
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

  if (buildingType === 'monastery') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0xcfc3a8 : 0x6f6757
      : isComplete ? 0xc3a8b6 : 0x6e5862;
  }

  if (buildingType === 'castle') {
    return owner === HUMAN_PLAYER_ID
      ? isComplete ? 0xa09f9c : 0x605d59
      : isComplete ? 0xaa7a7a : 0x604545;
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
    case 'hussar':
      // Imperial upgrade of Light Cavalry. Cost mirrors the Light Cavalry line
      // food-only cost (80 food, no gold).
      return { food: 80 };
    case 'militia':
      return { food: 60, gold: 20 };
    case 'champion':
      // Imperial Militia-line upgrade. AoE2 DE Champion costs 60 food / 20 gold.
      return { food: 60, gold: 20 };
    case 'spearman':
    case 'skirmisher':
    case 'pikeman':
      return { food: 35, wood: 25 };
    case 'halberdier':
      // Imperial Pikeman-line upgrade. Same food/wood split as Pikeman.
      return { food: 35, wood: 25 };
    case 'archer':
    case 'crossbowman':
    case 'arbalest':
      return { wood: 25, gold: 45 };
    case 'knight':
      return { food: 60, gold: 75 };
    case 'cavalier':
      // Imperial Knight-line upgrade.
      return { food: 60, gold: 75 };
    case 'camel':
      return { food: 55, gold: 60 };
    case 'cavalry-archer':
    case 'heavy-cavalry-archer':
      return { wood: 40, gold: 70 };
    case 'mangonel':
    case 'onager':
      return { wood: 160, gold: 135 };
    case 'scorpion':
    case 'heavy-scorpion':
      return { wood: 80, gold: 60 };
    case 'battering-ram':
    case 'siege-ram':
      return { wood: 160, gold: 75 };
    case 'bombard-cannon':
      // Imperial-only Siege Workshop unit. No predecessor upgrade line.
      return { wood: 225, gold: 225 };
    case 'trebuchet':
      // Imperial-only Castle unit. Long-range siege; trains from the Castle.
      return { wood: 200, gold: 200 };
    case 'monk':
      return { gold: 100 };
    case 'longbowman':
      // Britons-unique; AoE2 DE Castle-Age Longbowman costs 35 food / 40 gold.
      return { food: 35, gold: 40 };
    case 'elite-longbowman':
      // Imperial Britons-unique upgrade. Same training cost profile.
      return { food: 35, gold: 40 };
  }
}

function researchCost(technologyType: ResearchableTechnologyType): Partial<PlayerResources> {
  switch (technologyType) {
    case 'feudal-age':
      return { food: 500 };
    case 'castle-age':
      return { food: 800, gold: 200 };
    case 'imperial-age':
      // AoE2 DE Imperial Age research cost: 1000 food + 800 gold.
      return { food: 1000, gold: 800 };
    case 'fletching':
      return { food: 100, gold: 50 };
    case 'crossbowman-upgrade':
      return { food: 125, gold: 75 };
    case 'pikeman-upgrade':
      return { food: 215, gold: 90 };
    case 'light-cavalry-upgrade':
      return { food: 150, gold: 50 };
    case 'arbalest-upgrade':
      return { food: 300, gold: 300 };
    case 'halberdier-upgrade':
      return { food: 300, gold: 600 };
    case 'hussar-upgrade':
      return { food: 500, gold: 600 };
    case 'heavy-cavalry-archer-upgrade':
      return { food: 750, gold: 600 };
    case 'cavalier-upgrade':
      return { food: 300, gold: 300 };
    case 'champion-upgrade':
      return { food: 1000, gold: 450 };
    case 'elite-longbowman-upgrade':
      return { food: 850, gold: 750 };
    case 'onager-upgrade':
      return { food: 800, wood: 500 };
    case 'heavy-scorpion-upgrade':
      return { food: 1000, wood: 1100 };
    case 'siege-ram-upgrade':
      return { food: 1000, wood: 800 };
    case 'bracer':
      return { food: 450, gold: 300 };
    case 'blast-furnace':
      return { food: 275, gold: 225 };
    case 'plate-mail-armor':
      return { food: 300, gold: 150 };
    case 'plate-barding':
      return { food: 350, gold: 200 };
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
    case 'monastery':
      return { wood: 175 };
    case 'castle':
      return { stone: 650 };
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
    case 'monk':
      return MONK_TRAIN_TIME_TICKS;
    case 'longbowman':
      return LONGBOWMAN_TRAIN_TIME_TICKS;
    case 'arbalest':
      return ARBALEST_TRAIN_TIME_TICKS;
    case 'halberdier':
      return HALBERDIER_TRAIN_TIME_TICKS;
    case 'hussar':
      return HUSSAR_TRAIN_TIME_TICKS;
    case 'heavy-cavalry-archer':
      return HEAVY_CAVALRY_ARCHER_TRAIN_TIME_TICKS;
    case 'cavalier':
      return CAVALIER_TRAIN_TIME_TICKS;
    case 'champion':
      return CHAMPION_TRAIN_TIME_TICKS;
    case 'elite-longbowman':
      return ELITE_LONGBOWMAN_TRAIN_TIME_TICKS;
    case 'onager':
      return ONAGER_TRAIN_TIME_TICKS;
    case 'heavy-scorpion':
      return HEAVY_SCORPION_TRAIN_TIME_TICKS;
    case 'siege-ram':
      return SIEGE_RAM_TRAIN_TIME_TICKS;
    case 'bombard-cannon':
      return BOMBARD_CANNON_TRAIN_TIME_TICKS;
    case 'trebuchet':
      return TREBUCHET_TRAIN_TIME_TICKS;
  }
}

function researchTimeTicks(technologyType: ResearchableTechnologyType): number {
  switch (technologyType) {
    case 'feudal-age':
      return FEUDAL_AGE_RESEARCH_TIME_TICKS;
    case 'castle-age':
      return CASTLE_AGE_RESEARCH_TIME_TICKS;
    case 'imperial-age':
      return IMPERIAL_AGE_RESEARCH_TIME_TICKS;
    case 'fletching':
      return FLETCHING_RESEARCH_TIME_TICKS;
    case 'crossbowman-upgrade':
      return CROSSBOWMAN_UPGRADE_RESEARCH_TIME_TICKS;
    case 'pikeman-upgrade':
      return PIKEMAN_UPGRADE_RESEARCH_TIME_TICKS;
    case 'light-cavalry-upgrade':
      return LIGHT_CAVALRY_UPGRADE_RESEARCH_TIME_TICKS;
    case 'arbalest-upgrade':
      return ARBALEST_UPGRADE_RESEARCH_TIME_TICKS;
    case 'halberdier-upgrade':
      return HALBERDIER_UPGRADE_RESEARCH_TIME_TICKS;
    case 'hussar-upgrade':
      return HUSSAR_UPGRADE_RESEARCH_TIME_TICKS;
    case 'heavy-cavalry-archer-upgrade':
      return HEAVY_CAVALRY_ARCHER_UPGRADE_RESEARCH_TIME_TICKS;
    case 'cavalier-upgrade':
      return CAVALIER_UPGRADE_RESEARCH_TIME_TICKS;
    case 'champion-upgrade':
      return CHAMPION_UPGRADE_RESEARCH_TIME_TICKS;
    case 'elite-longbowman-upgrade':
      return ELITE_LONGBOWMAN_UPGRADE_RESEARCH_TIME_TICKS;
    case 'onager-upgrade':
      return ONAGER_UPGRADE_RESEARCH_TIME_TICKS;
    case 'heavy-scorpion-upgrade':
      return HEAVY_SCORPION_UPGRADE_RESEARCH_TIME_TICKS;
    case 'siege-ram-upgrade':
      return SIEGE_RAM_UPGRADE_RESEARCH_TIME_TICKS;
    case 'bracer':
      return BRACER_RESEARCH_TIME_TICKS;
    case 'blast-furnace':
      return BLAST_FURNACE_RESEARCH_TIME_TICKS;
    case 'plate-mail-armor':
      return PLATE_MAIL_ARMOR_RESEARCH_TIME_TICKS;
    case 'plate-barding':
      return PLATE_BARDING_RESEARCH_TIME_TICKS;
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
    case 'monastery':
      return 2100;
    case 'town-center':
      return 2400;
    case 'castle':
      return 4800;
  }
}

function buildingVisionRadius(buildingType: BuildingType): number | null {
  switch (buildingType) {
    case 'town-center':
      return 7;
    case 'watch-tower':
      return 8;
    case 'castle':
      return 11;
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

  // Castle fires a strong pierce arrow at long range. Canonical AoE2 DE is
  // 11 damage / range 8 / ~2s reload. The defensive-fire loop itself lives
  // in `prototypeTowerCombat`, which routes every building with a combat
  // state through the same target-pick + shoot logic; extending this helper
  // is enough to make Castles shoot.
  if (buildingType === 'castle') {
    return {
      attackDamage: 11,
      attackRange: 8,
      reloadTicks: 20,
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
    case 'castle':
      return 20;
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
    case 'castle':
      // Castle fires a strong arrow even without garrison. Canonical AoE2 DE
      // has garrisoned archers each add an extra arrow (max 5 visible), but
      // that garrisoned-archer-extra-arrows behavior is explicitly out of
      // scope in Slice 6 — Slice 7 follow-up.
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
    || (buildingType === 'barracks' && unitType === 'halberdier')
    || (buildingType === 'barracks' && unitType === 'champion')
    || (buildingType === 'stable' && unitType === 'scout')
    || (buildingType === 'stable' && unitType === 'knight')
    || (buildingType === 'stable' && unitType === 'light-cavalry')
    || (buildingType === 'stable' && unitType === 'hussar')
    || (buildingType === 'stable' && unitType === 'cavalier')
    || (buildingType === 'stable' && unitType === 'camel')
    || (buildingType === 'archery-range' && unitType === 'archer')
    || (buildingType === 'archery-range' && unitType === 'skirmisher')
    || (buildingType === 'archery-range' && unitType === 'crossbowman')
    || (buildingType === 'archery-range' && unitType === 'cavalry-archer')
    || (buildingType === 'archery-range' && unitType === 'arbalest')
    || (buildingType === 'archery-range' && unitType === 'heavy-cavalry-archer')
    || (buildingType === 'siege-workshop' && unitType === 'mangonel')
    || (buildingType === 'siege-workshop' && unitType === 'scorpion')
    || (buildingType === 'siege-workshop' && unitType === 'battering-ram')
    || (buildingType === 'siege-workshop' && unitType === 'onager')
    || (buildingType === 'siege-workshop' && unitType === 'heavy-scorpion')
    || (buildingType === 'siege-workshop' && unitType === 'siege-ram')
    || (buildingType === 'siege-workshop' && unitType === 'bombard-cannon')
    || (buildingType === 'monastery' && unitType === 'monk')
    || (buildingType === 'castle' && unitType === 'longbowman')
    || (buildingType === 'castle' && unitType === 'elite-longbowman')
    || (buildingType === 'castle' && unitType === 'trebuchet')
  );
}

function canResearchAt(
  buildingType: BuildingType,
  technologyType: ResearchableTechnologyType,
): boolean {
  return (
    (buildingType === 'town-center' && technologyType === 'feudal-age')
    || (buildingType === 'town-center' && technologyType === 'castle-age')
    || (buildingType === 'town-center' && technologyType === 'imperial-age')
    || (buildingType === 'blacksmith' && technologyType === 'fletching')
    || (buildingType === 'archery-range' && technologyType === 'crossbowman-upgrade')
    || (buildingType === 'archery-range' && technologyType === 'arbalest-upgrade')
    || (buildingType === 'archery-range' && technologyType === 'heavy-cavalry-archer-upgrade')
    || (buildingType === 'barracks' && technologyType === 'pikeman-upgrade')
    || (buildingType === 'barracks' && technologyType === 'halberdier-upgrade')
    || (buildingType === 'barracks' && technologyType === 'champion-upgrade')
    || (buildingType === 'stable' && technologyType === 'light-cavalry-upgrade')
    || (buildingType === 'stable' && technologyType === 'hussar-upgrade')
    || (buildingType === 'stable' && technologyType === 'cavalier-upgrade')
    || (buildingType === 'castle' && technologyType === 'elite-longbowman-upgrade')
    || (buildingType === 'siege-workshop' && technologyType === 'onager-upgrade')
    || (buildingType === 'siege-workshop' && technologyType === 'heavy-scorpion-upgrade')
    || (buildingType === 'siege-workshop' && technologyType === 'siege-ram-upgrade')
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
    case 'monk':
      return 30;
    case 'longbowman':
      return 35;
    case 'arbalest':
      return 40;
    case 'halberdier':
      return 60;
    case 'hussar':
      return 75;
    case 'heavy-cavalry-archer':
      return 60;
    case 'cavalier':
      return 120;
    case 'champion':
      return 70;
    case 'elite-longbowman':
      return 40;
    case 'onager':
      return 60;
    case 'heavy-scorpion':
      return 50;
    case 'siege-ram':
      return 270;
    case 'bombard-cannon':
      return 80;
    case 'trebuchet':
      return 150;
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
    // Monks have no combat damage; they heal and convert via dedicated
    // per-tick systems, not the standard attack loop. Returning 0 keeps the
    // attack branch harmless if a Monk is ever assigned an attack command
    // (the combat state still exists but the hit does nothing).
    case 'monk':
      return 0;
    case 'longbowman':
      return 6;
    case 'arbalest':
      return 6;
    case 'halberdier':
      return 6;
    case 'hussar':
      return 7;
    case 'heavy-cavalry-archer':
      return 7;
    case 'cavalier':
      return 12;
    case 'champion':
      return 13;
    case 'elite-longbowman':
      return 7;
    case 'onager':
      return 50;
    case 'heavy-scorpion':
      return 16;
    case 'siege-ram':
      return 3;
    case 'bombard-cannon':
      return 40;
    case 'trebuchet':
      return 200;
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
    // Monks never trigger the combat attack branch (attackDamage 0, range 0)
    // so the reload value is irrelevant; pick a small positive number to keep
    // the CombatState non-zero and avoid spurious divide-by-zero risk.
    case 'monk':
      return 10;
    case 'longbowman':
      return 20;
    // Slice 7A Imperial units. Values at TPS=10: 2s = 20 ticks, 1.8s = 18,
    // 3s = 30, 3.5s = 35, 5s = 50, 6s = 60, 7s = 70, 10s = 100.
    case 'arbalest':
      return 20;
    case 'halberdier':
      return 30;
    case 'hussar':
      return 20;
    case 'heavy-cavalry-archer':
      return 20;
    case 'cavalier':
      return 18;
    case 'champion':
      return 20;
    case 'elite-longbowman':
      return 20;
    case 'onager':
      return 60;
    case 'heavy-scorpion':
      return 35;
    case 'siege-ram':
      return 50;
    case 'bombard-cannon':
      return 70;
    case 'trebuchet':
      return 100;
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
    case 'arbalest':
      // Arbalest shares Crossbowman's range (5) with +1 attack and Fletching
      // still stacks downstream. Spec: range 5.
      return 5;
    case 'heavy-cavalry-archer':
      // Upgraded Cavalry Archer; range 4 per spec.
      return 4;
    case 'longbowman':
      // Britons-unique Longbowman gets range 6 at Castle Age (Imperial
      // Elite Longbowman reaches 7 in Slice 7). This is the Castle Age value.
      return 6;
    case 'elite-longbowman':
      // Imperial upgrade of the Longbowman. Canonical +1 range over Castle
      // Age Longbowman, ending at range 6 in this prototype. Spec value: 6.
      return 6;
    case 'mangonel':
    case 'scorpion':
      return 7;
    case 'onager':
      // Onager is the Imperial Mangonel upgrade; bigger range and damage.
      return 8;
    case 'heavy-scorpion':
      // Heavy Scorpion gains +1 attack; range unchanged from Scorpion.
      return 7;
    case 'siege-ram':
      // Siege Ram is a melee-range Battering Ram upgrade; still range 1.
      return MELEE_ATTACK_RANGE;
    case 'bombard-cannon':
      // Imperial-only siege; long-range shot with minimum range 5. See
      // unitMinAttackRange below.
      return 12;
    case 'trebuchet':
      // Very long range (stationary in v1). Simplified pack/unpack is a
      // follow-up; the range value itself is canonical.
      return 16;
    // Monks never close to attack (damage is 0) — the heal/convert systems
    // read MONK_ACTION_RANGE directly, not this function.
    case 'monk':
      return 0;
    case 'halberdier':
    case 'hussar':
    case 'cavalier':
    case 'champion':
      return MELEE_ATTACK_RANGE;
  }
}

// Minimum attack range ("dead zone" under which a ranged attacker must hold
// fire). Mangonel / Onager boulders cannot land at adjacent cells; Bombard
// Cannon has a similar minimum under the spec for v1. Returns 0 for every
// other unit so the combat-tick check below is a no-op for them.
function unitMinAttackRange(unitType: UnitType): number {
  if (unitType === 'mangonel' || unitType === 'onager') {
    return 3;
  }
  if (unitType === 'bombard-cannon') {
    return 5;
  }
  return 0;
}

// Fletching is a one-shot Blacksmith upgrade that buffs the entire archer line
// (+1 attack / +1 range). When Crossbowman (or a future Arbalest) upgrade
// arrives, createCombatState is re-run for the new unitType so the buff must
// still fire for any archer-line unitType, not just `archer`. Cavalry Archer
// is in the archer family too (same weapon profile), so Fletching and the
// Skirmisher +4 anti-archer bonus both apply.
function isArcherLineUnit(unitType: UnitType): boolean {
  return (
    unitType === 'archer'
    || unitType === 'crossbowman'
    || unitType === 'cavalry-archer'
    || unitType === 'longbowman'
    || unitType === 'arbalest'
    || unitType === 'heavy-cavalry-archer'
    || unitType === 'elite-longbowman'
  );
}

function isWildlifeResourceType(resourceType: ResourceKind): resourceType is 'boar' | 'wolf' {
  return resourceType === 'boar' || resourceType === 'wolf';
}

// A "static" resource sits on its cell forever (until depleted) and is therefore
// safe to cache in fog memory. Sheep and any wildlife (boar, wolf) are movable
// and would yield a stale ghost at their old cell once they leave vision; fish
// stay put but are also excluded so the predicate stays explicit and exhaustive.
// Relics are also excluded — while neutral relics stay put, a carried relic
// tracks the Monk and would leave a stale ghost at its last-seen cell.
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
    case 'relic':
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
    case 'monk':
      return isHuman ? 0xe3d9b5 : 0xd6aab6;
    case 'longbowman':
      return isHuman ? 0x5f9057 : 0xa86d91;
    // Slice 7A Imperial-tier tints. Each picks a slightly deeper variant of
    // the predecessor tint so the two lines stay visually related on the
    // minimap and main field. Bombard Cannon and Trebuchet are new lines.
    case 'arbalest':
      return isHuman ? 0x4f82b0 : 0x7f58b0;
    case 'halberdier':
      return isHuman ? 0x5a8848 : 0xa35744;
    case 'hussar':
      return isHuman ? 0xa3824e : 0xab7250;
    case 'heavy-cavalry-archer':
      return isHuman ? 0x637693 : 0x8a5a7c;
    case 'cavalier':
      return isHuman ? 0x8d8770 : 0x9a6553;
    case 'champion':
      return isHuman ? 0xbe8b4c : 0xbc6a5c;
    case 'elite-longbowman':
      return isHuman ? 0x4d7645 : 0x8f5578;
    case 'onager':
      return isHuman ? 0x77593a : 0x76493b;
    case 'heavy-scorpion':
      return isHuman ? 0x836c3a : 0x81503f;
    case 'siege-ram':
      return isHuman ? 0x574230 : 0x5a3830;
    case 'bombard-cannon':
      return isHuman ? 0x2f2f34 : 0x3d2a2a;
    case 'trebuchet':
      return isHuman ? 0x6c553a : 0x6a3d31;
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
    case 'monk':
      return 0.48;
    case 'longbowman':
      return 0.5;
    // Slice 7A Imperial-tier sizes. One tier up from the predecessor.
    case 'arbalest':
      return 0.5;
    case 'halberdier':
      return 0.52;
    case 'hussar':
      return 0.57;
    case 'heavy-cavalry-archer':
      return 0.57;
    case 'cavalier':
      return 0.6;
    case 'champion':
      return 0.52;
    case 'elite-longbowman':
      return 0.52;
    case 'onager':
      return 0.72;
    case 'heavy-scorpion':
      return 0.62;
    case 'siege-ram':
      return 0.8;
    case 'bombard-cannon':
      return 0.72;
    case 'trebuchet':
      return 0.85;
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
    case 'monk':
      return MONK_VISION_RADIUS;
    case 'longbowman':
      return 7;
    // Slice 7A Imperial-tier vision. Mostly preserves the predecessor's
    // vision; Hussar earns a big vision bump (11) per AoE2 DE canon, and
    // Elite Longbowman / Onager / Heavy Scorpion / Bombard / Trebuchet
    // also pick up slight or large vision increases.
    case 'arbalest':
      return 5;
    case 'halberdier':
      return 3;
    case 'hussar':
      return 11;
    case 'heavy-cavalry-archer':
      return 5;
    case 'cavalier':
      return 4;
    case 'champion':
      return 4;
    case 'elite-longbowman':
      return 8;
    case 'onager':
      return 10;
    case 'heavy-scorpion':
      return 9;
    case 'siege-ram':
      return 3;
    case 'bombard-cannon':
      return 13;
    case 'trebuchet':
      return 16;
  }
}

// Returns true when the target is classified as cavalry for the purposes of
// anti-cavalry bonus damage (Spearman, Pikeman, Camel). The mounted-but-not-
// cavalry units (Camel, Cavalry Archer) are explicitly excluded so Camels
// themselves don't trigger the bonus, matching AoE2 DE canon. Imperial
// successors (Hussar → Light Cavalry line, Cavalier → Knight line) stay
// classified as cavalry.
function isCavalryTarget(targetType: UnitType): boolean {
  return (
    targetType === 'scout'
    || targetType === 'light-cavalry'
    || targetType === 'knight'
    || targetType === 'hussar'
    || targetType === 'cavalier'
  );
}

// Mangonel splash damage is modeled as single-target in v1 (Slice 7 will
// revisit with real AoE when Onager arrives). The scaling-vs-infantry
// fantasy is approximated with a flat +10 bonus against foot units the
// boulder would realistically flatten in AoE2 DE — militia / spearman /
// pikeman lines and villagers. Archers / skirmishers / cavalry / siege
// are deliberately excluded: an archer line that clumps hurts more, but
// pre-AoE the single-target damage model makes the bonus feel too strong
// if it extends to them. The narrow list keeps the anti-infantry design
// note honest without turning the Mangonel into a universal counter.
function isMangonelInfantryTarget(targetType: UnitType): boolean {
  return (
    targetType === 'militia'
    || targetType === 'spearman'
    || targetType === 'pikeman'
    || targetType === 'villager'
  );
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

  // Halberdier inherits the anti-cavalry counter-role from Pikeman but with a
  // uniformly larger bonus that scales across every cavalry tier (Scout /
  // Light Cav / Hussar / Knight / Cavalier). Using the isCavalryTarget helper
  // keeps the Imperial successors (Hussar, Cavalier) covered without adding
  // more cases, and the flat +28 is strictly greater than Pikeman's tiered
  // +19 / +22 so Halberdiers are a clear upgrade in every matchup.
  if (attackerType === 'halberdier' && isCavalryTarget(targetType)) {
    return 28;
  }

  if (attackerType === 'skirmisher' && isArcherLineUnit(targetType)) {
    return 4;
  }

  if (attackerType === 'camel' && isCavalryTarget(targetType)) {
    return 9;
  }

  if (attackerType === 'mangonel' && isMangonelInfantryTarget(targetType)) {
    return 10;
  }

  return 0;
}

// Unit-vs-building bonus damage. The unit-vs-unit combat and unit-vs-building
// combat paths are separate in this codebase (different target-kind branches
// inside prototypePlayerCommands), so building bonuses are modeled separately
// from anti-unit bonuses. The Battering Ram carries the Castle-Age bonus
// (+75); Slice 7D extends this to the Imperial Siege Ram (+250 — a huge
// jump per spec) and Bombard Cannon (+80, Imperial-only no-predecessor
// siege). Trebuchet lands in the next Slice 7D commit.
function attackBonusAgainstBuilding(attackerType: UnitType): number {
  if (attackerType === 'battering-ram') {
    return 75;
  }
  if (attackerType === 'siege-ram') {
    return 250;
  }
  if (attackerType === 'bombard-cannon') {
    return 80;
  }
  if (attackerType === 'trebuchet') {
    return 200;
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

// Buildings that only unlock in Castle Age — Siege Workshop, Monastery, and
// Castle. The Imperial Age age-up gate at the Town Center requires two of
// these completed (mirrors the Feudal → Castle gate that requires two
// Feudal-prereq buildings). Town Centers are intentionally excluded: the
// starting Town Center already exists in Dark Age, so counting it would
// make the gate trivially pass and defeat the prereq's purpose.
function isCastleAgePrerequisiteBuilding(buildingType: BuildingType): boolean {
  return (
    buildingType === 'siege-workshop'
    || buildingType === 'monastery'
    || buildingType === 'castle'
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
  // Slice 5 Monk state. Monks operate outside the standard attack loop: the
  // `monkTasks` map records what each selected Monk should do on the next tick
  // (heal a friendly wounded unit, convert an enemy unit, pickup a neutral
  // relic, or deposit a carried relic in a friendly Monastery). The system
  // `prototypeMonkBehavior` reads these per tick.
  const monkTasks = new Map<number, MonkTask>();
  // Convert progress per target entity id. Ticks up by
  // `MONK_CONVERT_PROGRESS_PER_TICK` while a Monk is in range and targeting
  // the enemy; when progress reaches `MONK_CONVERT_FLIP_THRESHOLD` the target
  // flips to the Monk's owner and this map entry clears.
  const conversionState = new Map<number, { byOwner: number; progress: number }>();
  // Which relic entity (if any) each Monk is carrying. Per tick the relic
  // entity's position is moved to the Monk's cell.
  const monkCarriedRelic = new Map<number, number>();
  // Per-Monastery count of deposited relics. Per tick, every owner gets +1
  // gold for each relic deposited in their Monasteries (see prototypeRelicGold).
  const relicsInMonastery = new Map<number, number>();
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
      // Relics have no harvestable amount; show a flavor string instead of
      // "0 / 0" which would otherwise imply an empty resource patch.
      if (resource.resourceType === 'relic') {
        return 'Deposit in a Monastery for gold';
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
      || buildingType === 'siege-workshop'
      || buildingType === 'monastery'
      || buildingType === 'castle'
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
      relic: 0.5,
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
      || spawn.kind === 'monastery'
      || spawn.kind === 'castle'
    ) {
      const owner = spawn.owner ?? HUMAN_PLAYER_ID;
      const buildingId = addBuildingEntity(
        owner,
        spawn.kind,
        { x: spawn.x, y: spawn.y },
        true,
        spawn.vision,
      );
      // Test-only scenario knobs: lower starting HP (lets combat scenes
      // resolve in a few ticks) and seed relic count on a Monastery so
      // destroy-drop tests can skip the full pickup/deposit cycle.
      if (typeof spawn.startHp === 'number') {
        const healthState = buildingHealthStates.get(buildingId);
        if (healthState) {
          healthState.currentHp = Math.max(1, Math.min(healthState.maxHp, spawn.startHp));
        }
      }
      if (typeof spawn.startingRelicsInMonastery === 'number' && spawn.kind === 'monastery') {
        relicsInMonastery.set(buildingId, Math.max(0, spawn.startingRelicsInMonastery));
      }
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
      || spawn.kind === 'monk'
      || spawn.kind === 'longbowman'
      || spawn.kind === 'arbalest'
      || spawn.kind === 'halberdier'
      || spawn.kind === 'hussar'
      || spawn.kind === 'heavy-cavalry-archer'
      || spawn.kind === 'cavalier'
      || spawn.kind === 'champion'
      || spawn.kind === 'elite-longbowman'
      || spawn.kind === 'onager'
      || spawn.kind === 'heavy-scorpion'
      || spawn.kind === 'siege-ram'
      || spawn.kind === 'bombard-cannon'
      || spawn.kind === 'trebuchet'
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

    // Relics are never harvestable via the gather-drop economy; Monks pick
    // them up through a dedicated command flow (Slice 5).
    if (resource.resourceType === 'relic') {
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
    monkTasks.delete(id);
    // If the dying unit was a Monk carrying a relic, drop the relic at the
    // Monk's last cell so the carry state doesn't leak.
    const carriedRelicId = monkCarriedRelic.get(id);
    if (carriedRelicId !== undefined) {
      monkCarriedRelic.delete(id);
    }
    conversionState.delete(id);
    monkHealCounters.delete(id);
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
    // Destroyed Monastery stops generating relic gold. Any stored relics
    // spill back onto the map. Matches canonical AoE2 behavior. We must
    // guarantee that every stored relic survives — Codex P2 review caught
    // a path where a cramped layout (every approach cell within radius 2
    // blocked by trees / buildings / impassable terrain) silently lost
    // relics because the bookkeeping entry was deleted up front and the
    // search was capped at radius 2.
    //
    // Strategy: grow the search outward until enough free cells are
    // collected, capped at MAP_WIDTH + MAP_HEIGHT so we never spin on a
    // pathological scenario. If even that fails, fall back to stacking
    // every remaining relic on the destroyed Monastery's anchor cell —
    // relic resources don't claim unit occupancy, so visual overlap is
    // tolerated. relicsInMonastery is cleared only after the drop list
    // is built so the bookkeeping never gets ahead of the world.
    const storedRelicCount = relicsInMonastery.get(id) ?? 0;
    const relicDropPositions: Position[] = [];
    if (storedRelicCount > 0 && building) {
      const position = world.getComponent<Position>(id, 'position');
      if (position) {
        const footprint = buildingFootprint(building.buildingType);
        const maxSearchRange = MAP_WIDTH + MAP_HEIGHT;
        for (
          let searchRange = Math.max(2, Math.max(footprint.width, footprint.height));
          searchRange <= maxSearchRange && relicDropPositions.length < storedRelicCount;
          searchRange += 1
        ) {
          const candidates = getApproachCellsForFootprint(
            position,
            footprint.width,
            footprint.height,
            searchRange,
          );
          for (const candidate of candidates) {
            if (relicDropPositions.length >= storedRelicCount) {
              break;
            }
            if (!isTerrainPassableForUnit(candidate.x, candidate.y)) {
              continue;
            }
            if (isCellBlockedByBuilding(candidate.x, candidate.y)) {
              continue;
            }
            if (isCellBlockedByResource(candidate.x, candidate.y)) {
              continue;
            }
            if (relicDropPositions.some((p) => p.x === candidate.x && p.y === candidate.y)) {
              continue;
            }
            relicDropPositions.push(candidate);
          }
        }
        // Anchor-stacking fallback: if nothing on the map is free
        // (genuinely possible on a tiny test fixture or a fully walled-in
        // build), stack the remaining relics on the Monastery's anchor
        // cell. Relics are resources without unit-occupancy semantics, so
        // overlap is acceptable.
        while (relicDropPositions.length < storedRelicCount) {
          relicDropPositions.push({ x: position.x, y: position.y });
        }
      }
    }
    relicsInMonastery.delete(id);
    world.destroyEntity(id);
    // Spawn the dropped relics after the source entity is gone so the
    // building's cells are no longer blocked by its footprint.
    for (const dropPosition of relicDropPositions) {
      addResourceEntity('relic', dropPosition, 0, null);
    }
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
    // If any Monk was carrying this resource (relic), drop the carry state
    // so the follow loop doesn't dangle on a destroyed entity.
    for (const [monkId, carriedId] of monkCarriedRelic.entries()) {
      if (carriedId === id) {
        monkCarriedRelic.delete(monkId);
      }
    }
    world.destroyEntity(id);
    markOutOfBandRenderChange();
  }

  function issueUnitMoveCommand(unitId: number, target: Position): boolean {
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!unit) {
      return false;
    }

    clearGathererOrder(unitId);
    // A move order is a true override: cancel any active Monk task so the
    // Monk-behavior system does not pull the Monk back to a stale heal /
    // convert / pickup / deposit target on the next tick.
    monkTasks.delete(unitId);
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

  // Returns the owner's civilization name (as stored from the scenario
  // `starts` table). Used to gate civ-specific unique content (e.g.
  // Slice 6 Britons → Longbowman). Falls back to the default naming
  // scheme when unknown so the result is never `undefined`.
  function getPlayerCivilization(owner: number): string {
    return playerCivilizations.get(owner) ?? defaultCivilizationName(owner);
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

  // Slice 7A: Imperial Age research at the Town Center. Mirrors the
  // Feudal → Castle gate — the player must be in Castle Age and have at
  // least two Castle-Age-unlocked buildings completed (Siege Workshop,
  // Monastery, Castle).
  function canAdvanceToImperialAge(owner: number): boolean {
    if (getPlayerAge(owner) !== 'castle-age') {
      return false;
    }

    return countCompletedOwnedBuildings(owner, isCastleAgePrerequisiteBuilding) >= 2;
  }

  // Walks a tiered unit chain from head to tail (e.g., ['archer',
  // 'crossbowman', 'arbalest']) and returns the newest tier whose gating
  // upgrade is researched. Each chain tier after the head is paired with a
  // `ResearchableTechnologyType`; the first tier (`chain[0]`) is the default
  // fallback. Used by the Archery Range / Barracks / Stable / Castle train
  // menus so only the latest-researched tier is exposed at any time.
  function latestResearchedInChain(
    owner: number,
    chain: readonly [
      TrainableUnitType,
      ...Array<[TrainableUnitType, ResearchableTechnologyType]>,
    ],
  ): TrainableUnitType {
    let current: TrainableUnitType = chain[0];
    for (let index = 1; index < chain.length; index += 1) {
      const [unitType, technologyType] = chain[index] as [
        TrainableUnitType,
        ResearchableTechnologyType,
      ];
      if (hasTechnology(owner, technologyType)) {
        current = unitType;
      }
    }
    return current;
  }

  function getTrainOptions(owner: number, buildingType: BuildingType): TrainableUnitType[] {
    switch (buildingType) {
      case 'town-center':
        return ['villager'];
      case 'barracks': {
        // Militia → Champion (champion-upgrade); Spearman → Pikeman → Halberdier
        // (pikeman-upgrade → halberdier-upgrade). Only the newest tier of each
        // line is exposed at any time so the menu always shows the latest and
        // drops the predecessor.
        const militiaLine = latestResearchedInChain(owner, [
          'militia',
          ['champion', 'champion-upgrade'],
        ]);
        const options: TrainableUnitType[] = [militiaLine];
        if (getPlayerAge(owner) !== 'dark-age') {
          const spearmanLine = latestResearchedInChain(owner, [
            'spearman',
            ['pikeman', 'pikeman-upgrade'],
            ['halberdier', 'halberdier-upgrade'],
          ]);
          options.push(spearmanLine);
        }
        return options;
      }
      case 'stable': {
        if (getPlayerAge(owner) === 'dark-age') {
          return [];
        }
        // Scout → Light Cavalry → Hussar (three tiers). Knight → Cavalier
        // (two tiers). Camel remains standalone in v1.
        const scoutLine = latestResearchedInChain(owner, [
          'scout',
          ['light-cavalry', 'light-cavalry-upgrade'],
          ['hussar', 'hussar-upgrade'],
        ]);
        if (isAtLeastAge(owner, 'castle-age')) {
          const knightLine = latestResearchedInChain(owner, [
            'knight',
            ['cavalier', 'cavalier-upgrade'],
          ]);
          return [scoutLine, knightLine, 'camel'];
        }
        return [scoutLine];
      }
      case 'archery-range': {
        if (getPlayerAge(owner) === 'dark-age') {
          return [];
        }
        // Archer → Crossbowman → Arbalest. Cavalry Archer → Heavy Cavalry
        // Archer. Only the latest-researched tier is exposed at any time.
        const archerLine = latestResearchedInChain(owner, [
          'archer',
          ['crossbowman', 'crossbowman-upgrade'],
          ['arbalest', 'arbalest-upgrade'],
        ]);
        const options: TrainableUnitType[] = [archerLine, 'skirmisher'];
        if (isAtLeastAge(owner, 'castle-age')) {
          const cavArcherLine = latestResearchedInChain(owner, [
            'cavalry-archer',
            ['heavy-cavalry-archer', 'heavy-cavalry-archer-upgrade'],
          ]);
          options.push(cavArcherLine);
        }
        return options;
      }
      case 'siege-workshop': {
        // Siege Workshop is Castle-Age+ only; if the player somehow reaches
        // it earlier (shouldn't happen in v1 content) no units are trainable.
        if (!isAtLeastAge(owner, 'castle-age')) {
          return [];
        }
        // Mangonel → Onager, Scorpion → Heavy Scorpion, Battering Ram →
        // Siege Ram. Only the latest-researched tier is exposed at any
        // time, matching the Archery Range / Barracks / Stable / Castle
        // upgrade menus introduced in Slice 7B/7C.
        const mangonelLine = latestResearchedInChain(owner, [
          'mangonel',
          ['onager', 'onager-upgrade'],
        ]);
        const scorpionLine = latestResearchedInChain(owner, [
          'scorpion',
          ['heavy-scorpion', 'heavy-scorpion-upgrade'],
        ]);
        const ramLine = latestResearchedInChain(owner, [
          'battering-ram',
          ['siege-ram', 'siege-ram-upgrade'],
        ]);
        const options: TrainableUnitType[] = [mangonelLine, scorpionLine, ramLine];
        // Bombard Cannon is Imperial-only and has no upgrade predecessor.
        if (isAtLeastAge(owner, 'imperial-age')) {
          options.push('bombard-cannon');
        }
        return options;
      }
      case 'monastery': {
        // Monastery is Castle-Age+ only; Monks are the sole trainable unit
        // in v1 (research techs like Faith / Sanctity are out of scope).
        if (!isAtLeastAge(owner, 'castle-age')) {
          return [];
        }
        return ['monk'];
      }
      case 'castle': {
        // Castle is Castle-Age+. Trains the owner's civ unique unit (only
        // Britons / Longbowman ships today; other civs' Castles exist for
        // defense and garrison alone at Castle Age). At Imperial Age every
        // Castle also trains Trebuchet, the long-range siege, regardless
        // of civ.
        if (!isAtLeastAge(owner, 'castle-age')) {
          return [];
        }
        const options: TrainableUnitType[] = [];
        if (getPlayerCivilization(owner) === 'Britons') {
          options.push(
            latestResearchedInChain(owner, [
              'longbowman',
              ['elite-longbowman', 'elite-longbowman-upgrade'],
            ]),
          );
        }
        if (isAtLeastAge(owner, 'imperial-age')) {
          options.push('trebuchet');
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

    // Slice 7A: Imperial Age research option at the Town Center. Shown only
    // when the player is in Castle Age and has two Castle-Age buildings
    // complete.
    if (buildingType === 'town-center' && canAdvanceToImperialAge(owner)) {
      return ['imperial-age'];
    }

    if (buildingType === 'blacksmith' && getPlayerAge(owner) !== 'dark-age' && !hasTechnology(owner, 'fletching')) {
      return ['fletching'];
    }

    if (buildingType === 'archery-range' && isAtLeastAge(owner, 'castle-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'crossbowman-upgrade')) {
        options.push('crossbowman-upgrade');
      }
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'arbalest-upgrade')) {
          options.push('arbalest-upgrade');
        }
        if (!hasTechnology(owner, 'heavy-cavalry-archer-upgrade')) {
          options.push('heavy-cavalry-archer-upgrade');
        }
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'barracks' && isAtLeastAge(owner, 'castle-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'pikeman-upgrade')) {
        options.push('pikeman-upgrade');
      }
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'halberdier-upgrade')) {
          options.push('halberdier-upgrade');
        }
        if (!hasTechnology(owner, 'champion-upgrade')) {
          options.push('champion-upgrade');
        }
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'stable' && isAtLeastAge(owner, 'castle-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'light-cavalry-upgrade')) {
        options.push('light-cavalry-upgrade');
      }
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'hussar-upgrade')) {
          options.push('hussar-upgrade');
        }
        if (!hasTechnology(owner, 'cavalier-upgrade')) {
          options.push('cavalier-upgrade');
        }
      }
      if (options.length > 0) {
        return options;
      }
    }

    // Castle Imperial upgrade: Britons-gated Elite Longbowman. Matches the
    // Slice 6 Longbowman civ gate — only Britons owners ever see the option.
    if (
      buildingType === 'castle'
      && isAtLeastAge(owner, 'imperial-age')
      && getPlayerCivilization(owner) === 'Britons'
      && !hasTechnology(owner, 'elite-longbowman-upgrade')
    ) {
      return ['elite-longbowman-upgrade'];
    }

    // Siege Workshop Imperial upgrades (Slice 7D). Three parallel one-shot
    // upgrades: Mangonel → Onager, Scorpion → Heavy Scorpion, Battering Ram
    // → Siege Ram. All three become available once the owner reaches
    // Imperial Age and drop out of the list as they are researched.
    if (buildingType === 'siege-workshop' && isAtLeastAge(owner, 'imperial-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'onager-upgrade')) {
        options.push('onager-upgrade');
      }
      if (!hasTechnology(owner, 'heavy-scorpion-upgrade')) {
        options.push('heavy-scorpion-upgrade');
      }
      if (!hasTechnology(owner, 'siege-ram-upgrade')) {
        options.push('siege-ram-upgrade');
      }
      if (options.length > 0) {
        return options;
      }
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
      if (age === 'castle-age') {
        return ['imperial-age'];
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
      options.push('siege-workshop');
      options.push('monastery');
      options.push('castle');
    }

    return options;
  }

  // Lower number = higher priority. Siege ranks first so defensive buildings
  // and AI combat pickers turn their shots on the biggest backline threat
  // (Mangonel shelling a base, Scorpion bolting a cluster, Ram eating a
  // wall) before chewing on infantry that will still be there after the
  // siege is gone. Monks follow because they convert and heal and also
  // need to be silenced early. Ranged units sit above melee / cavalry
  // since hitting the archer line usually wins the engagement, and
  // villagers / scouts sit last — they are low-value kills compared to
  // losing the tower or a key army unit to siege fire.
  function targetPriority(unitType: UnitType): number {
    switch (unitType) {
      case 'mangonel':
      case 'scorpion':
      case 'battering-ram':
      // Slice 7A: the Imperial-tier siege units slot into the same top-of-
      // target-priority bucket as their Castle-Age predecessors. Bombard
      // Cannon and Trebuchet are Imperial-only newcomers but still count
      // as siege and get the same priority.
      case 'onager':
      case 'heavy-scorpion':
      case 'siege-ram':
      case 'bombard-cannon':
      case 'trebuchet':
        return 0;
      case 'monk':
        return 1;
      case 'archer':
      case 'crossbowman':
      case 'cavalry-archer':
      case 'skirmisher':
      case 'longbowman':
      case 'arbalest':
      case 'heavy-cavalry-archer':
      case 'elite-longbowman':
        return 2;
      case 'militia':
      case 'spearman':
      case 'pikeman':
      case 'knight':
      case 'camel':
      case 'scout':
      case 'light-cavalry':
      case 'halberdier':
      case 'hussar':
      case 'cavalier':
      case 'champion':
        return 3;
      case 'villager':
        return 4;
    }
  }

  // Per-buildingType targeting priority for AI / unit-vs-building target
  // selection. Lower numbers are picked first (after the priority sort,
  // ties break by Manhattan distance). Castles and Town Centers are
  // intentionally pushed to the bottom: they have huge HP pools and are
  // poor first-strikes (Gemini Medium review). Watch Towers are still
  // worth attacking quickly. Everything else stays in the middle so the
  // sort is stable for buildings without an explicit reason to defer.
  function buildingTargetPriority(buildingType: BuildingType): number {
    switch (buildingType) {
      case 'watch-tower':
        return 2;
      case 'town-center':
        return 9;
      case 'castle':
        return 10;
      default:
        return 5;
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
      .sort((left, right) => {
        const priorityDelta =
          buildingTargetPriority(left.building.buildingType)
          - buildingTargetPriority(right.building.buildingType);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return manhattanDistance(origin, left.position) - manhattanDistance(origin, right.position);
      });

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
      case 'imperial-age':
        // Slice 7A: flip the player to Imperial Age. Individual unit-line
        // upgrade callbacks (Arbalest / Halberdier / Hussar / etc.) land in
        // Slices 7B–7D; 7A only wires the age flip so the gate tests pass.
        playerAges.set(owner, 'imperial-age');
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
      // Slice 7B: Archery Range Imperial upgrades. Each mutates the
      // predecessor line in place and rewrites any queued predecessor
      // training entries so the research swap is effectively instant.
      case 'arbalest-upgrade':
        upgradeOwnedUnits(owner, 'crossbowman', 'arbalest');
        rewriteQueuedPredecessorUnits(owner, 'crossbowman', 'arbalest');
        break;
      case 'heavy-cavalry-archer-upgrade':
        upgradeOwnedUnits(owner, 'cavalry-archer', 'heavy-cavalry-archer');
        rewriteQueuedPredecessorUnits(owner, 'cavalry-archer', 'heavy-cavalry-archer');
        break;
      // Slice 7B: Barracks Imperial upgrades. Halberdier replaces Pikeman
      // and Champion replaces Militia directly (the intermediate Man-at-
      // Arms / Long Swordsman / Two-Handed tiers are compressed per the
      // Slice 7 spec's v1 simplification).
      case 'halberdier-upgrade':
        upgradeOwnedUnits(owner, 'pikeman', 'halberdier');
        rewriteQueuedPredecessorUnits(owner, 'pikeman', 'halberdier');
        break;
      case 'champion-upgrade':
        upgradeOwnedUnits(owner, 'militia', 'champion');
        rewriteQueuedPredecessorUnits(owner, 'militia', 'champion');
        break;
      // Slice 7C: Stable Imperial upgrades. Hussar replaces Light Cavalry
      // (the scout-line tail) and Cavalier replaces Knight.
      case 'hussar-upgrade':
        upgradeOwnedUnits(owner, 'light-cavalry', 'hussar');
        rewriteQueuedPredecessorUnits(owner, 'light-cavalry', 'hussar');
        break;
      case 'cavalier-upgrade':
        upgradeOwnedUnits(owner, 'knight', 'cavalier');
        rewriteQueuedPredecessorUnits(owner, 'knight', 'cavalier');
        break;
      // Slice 7C: Castle Imperial upgrade. Britons-gated Elite Longbowman
      // replaces the Longbowman. The research option is civ-filtered in
      // getResearchOptions so this branch only fires for Britons owners.
      case 'elite-longbowman-upgrade':
        upgradeOwnedUnits(owner, 'longbowman', 'elite-longbowman');
        rewriteQueuedPredecessorUnits(owner, 'longbowman', 'elite-longbowman');
        break;
      // Slice 7D: Siege Workshop Imperial upgrades. Each mutates the
      // predecessor siege line in place and rewrites any queued predecessor
      // training entries so the research swap is effectively instant.
      case 'onager-upgrade':
        upgradeOwnedUnits(owner, 'mangonel', 'onager');
        rewriteQueuedPredecessorUnits(owner, 'mangonel', 'onager');
        break;
      case 'heavy-scorpion-upgrade':
        upgradeOwnedUnits(owner, 'scorpion', 'heavy-scorpion');
        rewriteQueuedPredecessorUnits(owner, 'scorpion', 'heavy-scorpion');
        break;
      case 'siege-ram-upgrade':
        upgradeOwnedUnits(owner, 'battering-ram', 'siege-ram');
        rewriteQueuedPredecessorUnits(owner, 'battering-ram', 'siege-ram');
        break;
      // Slice 7A placeholder for the blacksmith techs — tier effects land
      // in Slice 7E.
      case 'bracer':
      case 'blast-furnace':
      case 'plate-mail-armor':
      case 'plate-barding':
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

            // Minimum-range dead zone: Mangonel arcs cannot land at
            // adjacent cells (min range 3). If the target is inside max
            // range but closer than the attacker's min range, simply
            // skip the tick — the target can walk out or close for melee
            // on its own; v1 does not auto-reposition the siege unit.
            if (
              manhattanDistance(position, targetPosition) < unitMinAttackRange(unit.unitType)
            ) {
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

            // Mangonel min-range dead zone (see the unit branch above) —
            // applies equally to wildlife / resource targets.
            if (
              manhattanDistance(position, targetPosition) < unitMinAttackRange(unit.unitType)
            ) {
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

          // Mangonel min-range dead zone (see the unit branch above) —
          // also applies when a Mangonel is targeting a building it
          // somehow ended up standing on top of.
          if (
            distanceToBuilding(targetId, position) < unitMinAttackRange(unit.unitType)
          ) {
            continue;
          }

          if (attackerCombat.cooldownTicks > 0) {
            continue;
          }

          targetHealth.currentHp -=
            attackerCombat.attackDamage + attackBonusAgainstBuilding(unit.unitType);
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

  // Monk heal counter per monk: ticks up each tick while in heal range of a
  // friendly wounded target, applies 1 HP every MONK_HEAL_TICK_INTERVAL ticks.
  const monkHealCounters = new Map<number, number>();
  // Per-tick "already progressed this tick" guard for convert. Multiple
  // Monks targeting the same enemy would otherwise stack progress each
  // tick, violating the fixed-rate contract in the spec. Cleared at the
  // start of every prototypeMonkBehavior pass.
  const monkConvertProcessedThisTick = new Set<number>();

  function applyMonkHeal(monkId: number, targetId: number, monkUnit: UnitComponent): void {
    const targetUnit = world.getComponent<UnitComponent>(targetId, 'unit');
    const targetCombat = combatStates.get(targetId);
    if (!targetUnit || !targetCombat || targetUnit.owner !== monkUnit.owner) {
      clearMonkTask(monkId);
      monkHealCounters.delete(monkId);
      return;
    }
    if (targetCombat.currentHp >= targetCombat.maxHp) {
      clearMonkTask(monkId);
      monkHealCounters.delete(monkId);
      return;
    }
    const counter = (monkHealCounters.get(monkId) ?? 0) + 1;
    if (counter >= MONK_HEAL_TICK_INTERVAL) {
      targetCombat.currentHp = Math.min(
        targetCombat.maxHp,
        targetCombat.currentHp + MONK_HEAL_HP_PER_INTERVAL,
      );
      markOutOfBandRenderChange();
      monkHealCounters.set(monkId, 0);
    } else {
      monkHealCounters.set(monkId, counter);
    }
  }

  function applyMonkConvert(
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void {
    const targetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
    if (!targetUnit || targetUnit.owner === monkUnit.owner) {
      clearMonkTask(monkId);
      conversionState.delete(targetId);
      return;
    }
    const state = conversionState.get(targetId) ?? { byOwner: monkUnit.owner, progress: 0 };
    // If a different player's Monk is already converting this target, reset
    // progress in favor of the latest converter so the ownership handoff is
    // deterministic.
    if (state.byOwner !== monkUnit.owner) {
      state.byOwner = monkUnit.owner;
      state.progress = 0;
    }
    // Only one Monk may add progress per tick. Additional Monks targeting
    // the same unit contribute nothing beyond keeping the target's progress
    // from timing out — the spec locks conversion to a fixed rate.
    if (monkConvertProcessedThisTick.has(targetId)) {
      conversionState.set(targetId, state);
      return;
    }
    monkConvertProcessedThisTick.add(targetId);
    state.progress += MONK_CONVERT_PROGRESS_PER_TICK;
    if (state.progress >= MONK_CONVERT_FLIP_THRESHOLD) {
      // Flip ownership. Move the living unit between population books: the
      // former owner loses a pop slot and the new owner gains one. Every
      // trainable unit we can realistically convert consumes exactly one pop
      // slot in `addUnitEntity`, so mirror that delta here.
      const previousOwner = targetUnit.owner;
      targetUnit.owner = monkUnit.owner;
      const previousPopulation = population.get(previousOwner);
      if (previousPopulation) {
        previousPopulation.current = Math.max(0, previousPopulation.current - 1);
      }
      const nextPopulation = population.get(monkUnit.owner);
      if (nextPopulation) {
        nextPopulation.current += 1;
      }
      // Reassign vision to the new owner. Without this, the converted unit
      // keeps lighting fog for its former owner and leaves the new owner
      // blind around it. `syncVisibilitySources` picks up the new playerId
      // on the next tick and re-maps the visibility source.
      const visionSource = activeWorld.getComponent<VisionSourceComponent>(
        targetId,
        'visionSource',
      );
      if (visionSource) {
        visionSource.playerId = monkUnit.owner;
      }
      const renderable = activeWorld.getComponent<RenderableComponent>(targetId, 'renderable');
      if (renderable) {
        renderable.tint = unitTint(targetUnit.unitType, monkUnit.owner);
      }
      // Post-conversion cleanup. Drop any order the now-friendly unit was
      // carrying out for its former owner and any task or command that
      // targeted it as an enemy:
      //   1. Its own unitCommands / monkTasks entries become meaningless
      //      (it no longer has an enemy to gather against or convert).
      //   2. Its GathererComponent resets to idle; a captured villager
      //      should not auto-resume harvesting a former-enemy resource.
      //   3. Any attack command from the NEW owner's units against this
      //      entity must be purged so they do not keep hitting a teammate.
      unitCommands.delete(targetId);
      monkTasks.delete(targetId);
      const targetGatherer = activeWorld.getComponent<GathererComponent>(targetId, 'gatherer');
      if (targetGatherer) {
        clearGathererOrder(targetId);
      }
      for (const [commanderId, command] of unitCommands) {
        if (command.type !== 'attack' || !command.targetEntityRef) {
          continue;
        }
        const resolved = currentEntityId(activeWorld, command.targetEntityRef);
        if (resolved !== targetId) {
          continue;
        }
        const commander = activeWorld.getComponent<UnitComponent>(commanderId, 'unit');
        if (commander && commander.owner === monkUnit.owner) {
          unitCommands.delete(commanderId);
        }
      }
      conversionState.delete(targetId);
      clearMonkTask(monkId);
      markOutOfBandRenderChange();
      return;
    }
    conversionState.set(targetId, state);
  }

  function applyMonkPickup(monkId: number, relicId: number): void {
    const relic = world.getComponent<ResourceComponent>(relicId, 'resource');
    if (!relic || relic.resourceType !== 'relic') {
      clearMonkTask(monkId);
      return;
    }
    // Record carry state; the per-tick follow loop keeps the relic glued to
    // the Monk. Clear any other Monk currently claiming this relic (should
    // not happen under v1 but guard for safety).
    for (const [otherMonkId, carriedId] of monkCarriedRelic.entries()) {
      if (carriedId === relicId && otherMonkId !== monkId) {
        monkCarriedRelic.delete(otherMonkId);
      }
    }
    monkCarriedRelic.set(monkId, relicId);
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

  function applyMonkDeposit(
    monkId: number,
    monasteryId: number,
    monkUnit: UnitComponent,
    activeWorld: World<GameEvents, GameCommands>,
  ): void {
    const relicId = monkCarriedRelic.get(monkId);
    const building = activeWorld.getComponent<BuildingComponent>(monasteryId, 'building');
    if (
      relicId === undefined
      || !building
      || building.buildingType !== 'monastery'
      || building.owner !== monkUnit.owner
    ) {
      clearMonkTask(monkId);
      return;
    }
    // Destroy the relic entity and credit the Monastery.
    destroyResourceEntity(relicId);
    monkCarriedRelic.delete(monkId);
    relicsInMonastery.set(monasteryId, (relicsInMonastery.get(monasteryId) ?? 0) + 1);
    clearMonkTask(monkId);
    markOutOfBandRenderChange();
  }

  world.registerSystem({
    name: 'prototypeMonkBehavior',
    phase: 'update',
    after: ['prototypePlayerCommands'],
    execute(activeWorld) {
      // Reset the per-tick "convert progress already applied" guard so
      // every target starts the tick eligible for exactly one progress
      // increment, no matter how many Monks are in range.
      monkConvertProcessedThisTick.clear();
      // Iterate over a snapshot because some tasks (deposit / pickup) mutate
      // the map (clear on completion or destroy the relic entity).
      for (const [monkId, task] of [...monkTasks.entries()]) {
        const monkUnit = activeWorld.getComponent<UnitComponent>(monkId, 'unit');
        const monkPosition = activeWorld.getComponent<Position>(monkId, 'position');
        if (!monkUnit || !monkPosition || monkUnit.unitType !== 'monk') {
          monkTasks.delete(monkId);
          continue;
        }

        const targetId = currentEntityId(activeWorld, task.targetEntityRef);
        if (targetId === null) {
          monkTasks.delete(monkId);
          continue;
        }

        const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
        if (!targetPosition) {
          monkTasks.delete(monkId);
          continue;
        }

        // Build-target deposit: the Monastery uses its footprint for range.
        const distance =
          task.kind === 'deposit'
            ? distanceToBuilding(targetId, monkPosition)
            : manhattanDistance(monkPosition, targetPosition);

        if (distance > MONK_ACTION_RANGE) {
          // Walk toward the target. For deposit we use the building-approach
          // plan so the Monk clears the footprint cells.
          const plan =
            task.kind === 'deposit'
              ? findBuildingApproachPlan(monkId, targetId, MONK_ACTION_RANGE, activeWorld)
              : findUnitRangePlan(monkId, targetPosition, MONK_ACTION_RANGE, activeWorld);
          if (!plan) {
            monkTasks.delete(monkId);
            continue;
          }
          moveUnitOneSubgridStep(monkId, plan.nextStep, activeWorld);
          continue;
        }

        if (task.kind === 'heal') {
          applyMonkHeal(monkId, targetId, monkUnit);
          continue;
        }

        if (task.kind === 'convert') {
          applyMonkConvert(monkId, targetId, monkUnit, activeWorld);
          continue;
        }

        if (task.kind === 'pickup') {
          applyMonkPickup(monkId, targetId);
          continue;
        }

        if (task.kind === 'deposit') {
          applyMonkDeposit(monkId, targetId, monkUnit, activeWorld);
          continue;
        }
      }

      // Relic follow: every Monk carrying a relic this tick moves the relic
      // entity to the Monk's current cell so the rendered position tracks.
      for (const [monkId, relicId] of [...monkCarriedRelic.entries()]) {
        const monkPosition = activeWorld.getComponent<Position>(monkId, 'position');
        const relicPosition = activeWorld.getComponent<Position>(relicId, 'position');
        if (!monkPosition || !relicPosition) {
          monkCarriedRelic.delete(monkId);
          continue;
        }
        if (relicPosition.x !== monkPosition.x || relicPosition.y !== monkPosition.y) {
          activeWorld.setPosition(relicId, { x: monkPosition.x, y: monkPosition.y });
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypeRelicGold',
    phase: 'update',
    after: ['prototypeMonkBehavior'],
    execute(activeWorld) {
      // Per tick, every owner with deposited relics gets +1 gold per relic.
      // Iterate Monasteries and accumulate into each owner's resource bank.
      for (const [monasteryId, count] of relicsInMonastery.entries()) {
        if (count <= 0) {
          continue;
        }
        const building = activeWorld.getComponent<BuildingComponent>(monasteryId, 'building');
        if (!building || building.buildingType !== 'monastery') {
          relicsInMonastery.delete(monasteryId);
          continue;
        }
        const stockpile = playerResources.get(building.owner);
        if (!stockpile) {
          continue;
        }
        stockpile.gold += count;
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

    // Monks: resolve cell targets into heal/convert/pickup/deposit by
    // inspecting what lives at that cell. Falls back to a plain move.
    // When the fallback fires we also drop any lingering monkTasks entry
    // so the Monk-behavior system doesn't immediately pull the Monk back
    // toward a previous heal / convert / pickup / deposit target.
    if (unit.unitType === 'monk') {
      const monkTargetEntityId = findMonkContextTargetAtCell(target.x, target.y, unit.owner);
      if (monkTargetEntityId !== null) {
        const monkTargetPosition = world.getComponent<Position>(monkTargetEntityId, 'position');
        if (monkTargetPosition) {
          return issueMonkContextCommandAtEntity(unitId, monkTargetEntityId, unit, monkTargetPosition);
        }
      }
      clearMonkTask(unitId);
      return issueUnitMoveCommand(unitId, target);
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

  // Resolves the cell a Monk context-clicked into a specific entity id.
  // Priority: friendly wounded unit (heal) > enemy unit (convert)
  //         > neutral relic (pickup) > friendly Monastery (deposit).
  // Two-pass iteration so an overlapping friendly+enemy on the same cell
  // prefers the heal target over the convert target (see Gemini review
  // finding). Pass-1 additionally requires the friendly to be wounded —
  // a healthy friendly is not a meaningful heal target and would
  // otherwise consume the click and short-circuit the convert pass,
  // leaving the Monk with a useless move-fallback (Codex P2 review).
  // Enemy targets are rejected if not currently visible to the Monk's
  // owner — the player shouldn't be able to convert fog-hidden
  // enemies. Friendly and owned targets skip the visibility guard (they're
  // the player's own units and always "visible" to them), and relic /
  // Monastery lookups likewise reference owned or world entities that fog
  // memory already surfaces.
  function findMonkContextTargetAtCell(
    x: number,
    y: number,
    monkOwner: number,
  ): number | null {
    // Pass 1: friendly wounded unit at this cell (heal priority). A
    // healthy friendly is skipped so an overlapping enemy can still be
    // picked up by pass 2.
    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!position || !unit || position.x !== x || position.y !== y) {
        continue;
      }
      if (unit.owner !== monkOwner) {
        continue;
      }
      const combat = combatStates.get(id);
      if (!combat || combat.currentHp >= combat.maxHp) {
        continue;
      }
      return id;
    }

    // Pass 2: enemy unit at this cell (convert) — only if currently visible
    // to the Monk's owner.
    for (const id of world.query('position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!position || !unit || position.x !== x || position.y !== y) {
        continue;
      }
      if (unit.owner === monkOwner) {
        continue;
      }
      if (!visibility.isVisible(monkOwner, x, y)) {
        continue;
      }
      return id;
    }

    // Building: only interesting if it's a friendly Monastery (deposit).
    for (const id of world.query('position', 'building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== monkOwner || building.buildingType !== 'monastery') {
        continue;
      }
      if (buildingOccupiesCell(id, x, y)) {
        return id;
      }
    }

    // Resource: relic.
    for (const id of world.query('position', 'resource')) {
      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (!position || !resource || position.x !== x || position.y !== y) {
        continue;
      }
      if (resource.resourceType === 'relic') {
        return id;
      }
    }

    return null;
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

    // Monks never enter the attack-command flow. Their context command routes
    // to heal (friendly wounded unit), convert (enemy unit), pickup (neutral
    // relic), or deposit (friendly Monastery). Anything that doesn't match
    // one of those falls back to a plain move order.
    if (unit.unitType === 'monk') {
      return issueMonkContextCommandAtEntity(unitId, targetEntityId, unit, targetPosition);
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

  function issueMonkContextCommandAtEntity(
    monkId: number,
    targetEntityId: number,
    monkUnit: UnitComponent,
    targetPosition: Position,
  ): boolean {
    const targetEntityRef = getEntityRef(targetEntityId);
    if (!targetEntityRef) {
      return false;
    }

    const targetUnit = world.getComponent<UnitComponent>(targetEntityId, 'unit');
    const targetBuilding = world.getComponent<BuildingComponent>(targetEntityId, 'building');
    const targetResource = world.getComponent<ResourceComponent>(targetEntityId, 'resource');

    if (targetUnit) {
      if (targetUnit.owner === monkUnit.owner) {
        const combat = combatStates.get(targetEntityId);
        if (combat && combat.currentHp < combat.maxHp) {
          return setMonkTask(monkId, 'heal', targetEntityRef);
        }
        return issueUnitMoveCommand(monkId, targetPosition);
      }

      // Enemy unit: convert. Skip conversion on other Monks (no canonical
      // rule against it but v1 keeps the target set simple — convert only
      // "normal" units).
      return setMonkTask(monkId, 'convert', targetEntityRef);
    }

    if (
      targetResource
      && targetResource.resourceType === 'relic'
      && monkCarriedRelic.get(monkId) === undefined
    ) {
      return setMonkTask(monkId, 'pickup', targetEntityRef);
    }

    if (
      targetBuilding
      && targetBuilding.owner === monkUnit.owner
      && targetBuilding.buildingType === 'monastery'
      && monkCarriedRelic.get(monkId) !== undefined
    ) {
      return setMonkTask(monkId, 'deposit', targetEntityRef);
    }

    return issueUnitMoveCommand(monkId, targetPosition);
  }

  function setMonkTask(
    monkId: number,
    kind: MonkTask['kind'],
    targetEntityRef: EntityRef,
  ): boolean {
    // Clear any lingering combat/move command on the Monk; the behaviour
    // system will drive movement for the duration of the task.
    unitCommands.delete(monkId);
    monkTasks.set(monkId, { kind, targetEntityRef });
    return true;
  }

  function clearMonkTask(monkId: number): void {
    monkTasks.delete(monkId);
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
    getPopulationState,
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
