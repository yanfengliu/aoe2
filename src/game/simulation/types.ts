export type TerrainKind = 'grass' | 'forest' | 'water' | 'hill';
export type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
export type UnitType = 'villager' | 'scout' | 'militia' | 'spearman' | 'archer' | 'skirmisher' | 'knight';
export type TrainableUnitType = 'villager' | 'scout' | 'militia' | 'spearman' | 'archer' | 'skirmisher' | 'knight';
export type ResearchableTechnologyType = 'feudal-age' | 'castle-age' | 'fletching';
export type ActionType = 'ungarrison';
export type MarketActionType =
  | 'buy-food'
  | 'sell-food'
  | 'buy-wood'
  | 'sell-wood'
  | 'buy-stone'
  | 'sell-stone';
export type BuildableBuildingType =
  | 'town-center'
  | 'house'
  | 'mill'
  | 'lumber-camp'
  | 'mining-camp'
  | 'barracks'
  | 'watch-tower'
  | 'stable'
  | 'archery-range'
  | 'blacksmith'
  | 'market';
export type BuildingType = 'town-center' | BuildableBuildingType;
export type ResourceKind =
  | 'berry-bush'
  | 'gold-mine'
  | 'stone-mine'
  | 'boar'
  | 'sheep'
  | 'tree';
export type EconomyResourceKind = 'food' | 'wood' | 'gold' | 'stone';
export type GatherTaskState =
  | 'idle'
  | 'to-resource'
  | 'gathering'
  | 'to-dropoff';
export type RenderVisualVariant = 'default' | 'construction' | 'complete';

export interface TerrainComponent {
  kind: TerrainKind;
  buildable: boolean;
  elevation: number;
}

export interface RenderableComponent {
  kind: 'tile' | 'unit' | 'building' | 'resource';
  layer: 'terrain' | 'resource' | 'building' | 'unit';
  tint: number;
  size: number;
  footprintWidth: number;
  footprintHeight: number;
  visualVariant: RenderVisualVariant;
}

export interface UnitComponent {
  owner: number;
  unitType: UnitType;
}

export interface BuildingComponent {
  owner: number;
  buildingType: BuildingType;
}

export interface ResourceComponent {
  resourceType: ResourceKind;
  amount: number;
  maxAmount: number;
  baseOwner: number | null;
}

export interface GathererComponent {
  desiredResource: EconomyResourceKind;
  hasExplicitGatherOrder: boolean;
  task: GatherTaskState;
  targetResourceId: number | null;
  dropOffBuildingId: number | null;
  carriedResource: EconomyResourceKind | null;
  carriedAmount: number;
  carryCapacity: number;
  gatherProgressTicks: number;
}

export interface VelocityComponent {
  dx: number;
  dy: number;
}

export interface UnitTransformComponent {
  fineX: number;
  fineY: number;
}

export interface VisionSourceComponent {
  playerId: number;
  radius: number;
}

export interface WanderBoundsComponent {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface ProjectedEntityView {
  id: number;
  kind: 'tile' | 'unit' | 'building' | 'resource';
  layer: 'terrain' | 'resource' | 'building' | 'unit';
  entityType: TerrainKind | UnitComponent['unitType'] | BuildingComponent['buildingType'] | ResourceKind;
  owner: number | null;
  x: number;
  y: number;
  tint: number;
  size: number;
  footprintWidth: number;
  footprintHeight: number;
  visualVariant: RenderVisualVariant;
  selected: boolean;
}

export interface ProjectedFrameView {
  tick: number;
  playerId: number;
  seed: string;
  mapWidth: number;
  mapHeight: number;
  visibleCells: number[];
  exploredCells: number[];
}

export interface RenderState {
  tick: number;
  entities: ProjectedEntityView[];
  frame: ProjectedFrameView | null;
}

export interface PlayerResources {
  food: number;
  wood: number;
  gold: number;
  stone: number;
}

export interface PopulationState {
  current: number;
  cap: number;
}

export type UnitTaskState = GatherTaskState | 'moving' | 'building' | 'attacking' | 'garrisoned';
export type UnitOrBuildingActionType = ActionType;

export interface ProductionQueueEntry {
  kind: 'unit' | 'technology';
  label: string;
  unitType?: TrainableUnitType;
  technologyType?: ResearchableTechnologyType;
  remainingTicks: number;
  totalTicks: number;
  isBlocked: boolean;
}

export interface EconomyState {
  ages: Record<number, AgeType>;
  playerResources: Record<number, PlayerResources>;
  population: Record<number, PopulationState>;
  villagers: Array<{
    owner: number;
    task: UnitTaskState;
    desiredResource: EconomyResourceKind;
    carriedResource: EconomyResourceKind | null;
    carriedAmount: number;
  }>;
  resources: Array<{
    resourceType: ResourceKind;
    amount: number;
    maxAmount: number;
    baseOwner: number | null;
    x: number;
    y: number;
  }>;
  units: Array<{
    id: number;
    owner: number;
    unitType: UnitType;
    x: number;
    y: number;
    task: UnitTaskState;
    attackDamage: number;
    attackRange: number;
  }>;
  buildings: Array<{
    id: number;
    owner: number;
    buildingType: BuildingType;
    x: number;
    y: number;
    footprintWidth: number;
    footprintHeight: number;
    isComplete: boolean;
    buildProgressTicks: number;
    totalBuildTicks: number;
    populationProvided: number;
    queue: ProductionQueueEntry[];
  }>;
}

export interface SelectionState {
  selectedEntityId: number | null;
  selectedEntityIds: number[];
  selectedCount: number;
  selectedKind: 'unit' | 'building' | 'resource' | null;
  selectedEntityType: UnitType | BuildingType | ResourceKind | null;
  owner: number | null;
  x: number | null;
  y: number | null;
  tileX: number | null;
  tileY: number | null;
  tileEntityIndex: number | null;
  tileEntityCount: number;
  resourceAmount: number | null;
  resourceMaxAmount: number | null;
  actionOptions: UnitOrBuildingActionType[];
  buildOptions: BuildableBuildingType[];
  marketOptions: MarketActionType[];
  trainOptions: TrainableUnitType[];
  researchOptions: ResearchableTechnologyType[];
  queue: ProductionQueueEntry[];
  placementMode: BuildableBuildingType | null;
}

export interface PlacementPreviewState {
  active: boolean;
  buildingType: BuildableBuildingType;
  cellX: number;
  cellY: number;
  width: number;
  height: number;
  isValid: boolean;
}

export interface HudState {
  tick: number;
  entityCount: number;
  visibleEntities: number;
  visibleCells: number;
  exploredCells: number;
  tickDurationMs: number;
  fpsTarget: number;
  worldSize: string;
  seed: string;
  currentAge: AgeType;
  playerResources: PlayerResources;
  population: PopulationState;
  matchState: MatchState;
}

export interface MatchState {
  outcome: 'running' | 'victory' | 'defeat';
  summary: string;
}
