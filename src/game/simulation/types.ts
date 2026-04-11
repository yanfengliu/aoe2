export type TerrainKind = 'grass' | 'forest' | 'water' | 'hill';
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
}

export interface UnitComponent {
  owner: number;
  unitType: 'villager' | 'scout';
}

export interface BuildingComponent {
  owner: number;
  buildingType: 'town-center';
}

export interface ResourceComponent {
  resourceType: ResourceKind;
  amount: number;
  maxAmount: number;
  baseOwner: number | null;
}

export interface GathererComponent {
  desiredResource: EconomyResourceKind;
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
  kind: 'tile' | 'unit' | 'building' | 'resource';
  layer: 'terrain' | 'resource' | 'building' | 'unit';
  entityType: TerrainKind | UnitComponent['unitType'] | BuildingComponent['buildingType'] | ResourceKind;
  owner: number | null;
  x: number;
  y: number;
  tint: number;
  size: number;
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

export interface EconomyState {
  playerResources: Record<number, PlayerResources>;
  population: Record<number, PopulationState>;
  villagers: Array<{
    owner: number;
    task: GatherTaskState;
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
  playerResources: PlayerResources;
  population: PopulationState;
}
