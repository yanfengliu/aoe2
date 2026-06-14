export type TerrainKind = 'grass' | 'forest' | 'water' | 'hill';
export type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
export type UnitType =
  | 'villager'
  | 'scout'
  | 'militia'
  | 'spearman'
  | 'archer'
  | 'skirmisher'
  | 'knight'
  | 'crossbowman'
  | 'pikeman'
  | 'light-cavalry'
  | 'camel'
  | 'cavalry-archer'
  | 'mangonel'
  | 'scorpion'
  | 'battering-ram'
  | 'monk'
  | 'longbowman'
  | 'arbalest'
  | 'halberdier'
  | 'hussar'
  | 'heavy-cavalry-archer'
  | 'cavalier'
  | 'champion'
  | 'elite-longbowman'
  | 'onager'
  | 'heavy-scorpion'
  | 'siege-ram'
  | 'bombard-cannon'
  | 'trebuchet'
  // FU2: Militia-line intermediate tiers inserted between Militia and
  // Champion (Man-at-Arms / Long Swordsman / Two-Handed Swordsman) plus
  // the Cavalier → Paladin and Camel → Heavy Camel Imperial upgrades.
  | 'man-at-arms'
  | 'long-swordsman'
  | 'two-handed-swordsman'
  | 'paladin'
  | 'heavy-camel';
export type TrainableUnitType =
  | 'villager'
  | 'scout'
  | 'militia'
  | 'spearman'
  | 'archer'
  | 'skirmisher'
  | 'knight'
  | 'crossbowman'
  | 'pikeman'
  | 'light-cavalry'
  | 'camel'
  | 'cavalry-archer'
  | 'mangonel'
  | 'scorpion'
  | 'battering-ram'
  | 'monk'
  | 'longbowman'
  | 'arbalest'
  | 'halberdier'
  | 'hussar'
  | 'heavy-cavalry-archer'
  | 'cavalier'
  | 'champion'
  | 'elite-longbowman'
  | 'onager'
  | 'heavy-scorpion'
  | 'siege-ram'
  | 'bombard-cannon'
  | 'trebuchet'
  // FU2: Militia-line intermediates + Paladin + Heavy Camel.
  | 'man-at-arms'
  | 'long-swordsman'
  | 'two-handed-swordsman'
  | 'paladin'
  | 'heavy-camel';
export type ResearchableTechnologyType =
  | 'feudal-age'
  | 'castle-age'
  | 'imperial-age'
  | 'fletching'
  | 'crossbowman-upgrade'
  | 'pikeman-upgrade'
  | 'light-cavalry-upgrade'
  | 'arbalest-upgrade'
  | 'halberdier-upgrade'
  | 'hussar-upgrade'
  | 'heavy-cavalry-archer-upgrade'
  | 'cavalier-upgrade'
  | 'champion-upgrade'
  | 'elite-longbowman-upgrade'
  | 'onager-upgrade'
  | 'heavy-scorpion-upgrade'
  | 'siege-ram-upgrade'
  | 'bracer'
  | 'blast-furnace'
  | 'plate-mail-armor'
  | 'plate-barding'
  // FU1: Feudal Blacksmith tier.
  | 'forging'
  | 'scale-mail-armor'
  | 'scale-barding-armor'
  | 'padded-archer-armor'
  // FU1: Castle Blacksmith tier.
  | 'iron-casting'
  | 'chain-mail-armor'
  | 'chain-barding-armor'
  | 'leather-archer-armor'
  | 'bodkin-arrow'
  // FU1: Imperial Blacksmith tier additions.
  | 'ring-archer-armor'
  | 'chemistry'
  // FU2: Militia-line intermediate tiers + Paladin + Heavy Camel
  // Imperial upgrades. Each mutates the predecessor unit in place
  // (same upgradeOwnedUnits + rewriteQueuedPredecessorUnits pattern
  // as the Slice 2 / Slice 7 upgrades).
  | 'man-at-arms-upgrade'
  | 'long-swordsman-upgrade'
  | 'two-handed-swordsman-upgrade'
  | 'paladin-upgrade'
  | 'heavy-camel-upgrade'
  // Economy gather-rate techs (AoE2 "Work Rate ×N"). Lumber Camp (wood) +
  // Mining Camp (gold/stone). No side-map mutation: the rate multiplier is
  // derived from the owner's researched-tech set at gather time
  // (see gatherRateMultiplier / ticksToGatherCarry in economyTechEffects).
  | 'double-bit-axe'
  | 'bow-saw'
  | 'two-man-saw'
  | 'gold-mining'
  | 'gold-shaft-mining'
  | 'stone-mining'
  | 'stone-shaft-mining'
  // Economy carry-capacity techs (Town Center). Like the gather-rate techs the
  // carry multiplier is derived from the researched-tech set at gather time
  // (see carryCapacityMultiplier / effectiveCarryCapacity in economyTechEffects).
  | 'wheelbarrow'
  | 'hand-cart';
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
  | 'market'
  | 'siege-workshop'
  | 'monastery'
  | 'castle'
  | 'wonder'
  // FU3: real wall buildings. Stone Wall is Castle-Age, 1x1, HP 2000,
  // cost 5 stone — replaces the Arena map's stone-mine wall proxy.
  // Palisade Wall is its Feudal-Age cheaper cousin (HP 250, cost 2 wood).
  | 'stone-wall'
  | 'palisade-wall';
export type BuildingType = 'town-center' | BuildableBuildingType;
export type ResourceKind =
  | 'berry-bush'
  | 'gold-mine'
  | 'stone-mine'
  | 'boar'
  | 'fish'
  | 'sheep'
  | 'wolf'
  | 'tree'
  | 'relic';
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
  owner: number | null;
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
  currentHp: number | null;
  maxHp: number | null;
  // Memory entities are last-seen snapshots of static buildings or resources from
  // cells that are now explored-but-not-visible. They render at reduced opacity and
  // do not participate in selection or live HUD interactions.
  isMemory: boolean;
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
    id: number;
    resourceType: ResourceKind;
    amount: number;
    maxAmount: number;
    owner: number | null;
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
    armor: number;
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
  health: {
    current: number;
    max: number;
  } | null;
  attack: number | null;
  armor: number | null;
  faction: string | null;
  civ: string | null;
  inventory: string | null;
  activity: {
    verb: string;
    target: {
      kind: 'unit' | 'building' | 'resource' | 'relic' | 'economy-resource' | 'technology';
      type: string;
    } | null;
  } | null;
  activityBreakdown: {
    entries: { label: string; count: number }[];
    overflow: number;
  } | null;
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
  visibleResearchOptions: ResearchableTechnologyType[];
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

export interface EngineHaltDetails {
  tick: number;
  phase: string;
  code: string;
  systemName: string | null;
  message: string;
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
  engineHalted: EngineHaltDetails | null;
}

// Slice 11: debug-overlay snapshot. Each field populated so the HUD can
// safely downsample modes that it hasn't activated. All coordinates are
// in cell space (x, y in [0, MAP_WIDTH/HEIGHT)).
export interface SimulationDebugSnapshot {
  tick: number;
  tickDurationMs: number;
  entityCount: number;
  unitPaths: Array<{
    id: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    commandType: 'move' | 'build' | 'attack';
  }>;
  aiSummaries: Array<{
    owner: number;
    difficulty: string;
    plan: string;
    villagerTargets: Partial<Record<string, number>>;
    attackGroupSize: number;
  }>;
  // Slice 12 Task D: per-unit probe for the "coarse-vs-fine" debug
  // overlay. `coarseX/Y` is the integer simulation cell; `fineX/Y` is
  // the interpolated render position (in whole-cell units). The scene
  // draws a line from coarse → fine for every entry.
  coarseVsFine: Array<{
    id: number;
    coarseX: number;
    coarseY: number;
    fineX: number;
    fineY: number;
  }>;
}

export type WinCondition = 'conquest' | 'wonder' | 'relic';

export interface MatchState {
  outcome: 'running' | 'victory' | 'defeat' | 'draw';
  summary: string;
  // Populated when `outcome !== 'running'`. Null while the match is live.
  winCondition: WinCondition | null;
  // Per-owner score snapshot at match end. Null while the match is live.
  // Keyed by ownerId -> total score.
  scores: Record<number, number> | null;
  // Remaining ticks on an in-flight Wonder countdown for the human player,
  // or null if no countdown is active. Surfaced so the HUD can render a
  // running timer alongside age / pop.
  wonderCountdownTicks: number | null;
  // Remaining ticks on an in-flight Relic countdown for the human player,
  // or null if no countdown is active.
  relicCountdownTicks: number | null;
}
