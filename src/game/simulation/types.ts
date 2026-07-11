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
  // FU2: Militia-line intermediates (Man-at-Arms/Long Swordsman/Two-Handed Swordsman) + Paladin + Heavy Camel.
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
// ResearchableTechnologyType lives in ./technologyTypes (extracted to keep this
// file under the 500-LOC budget); imported for internal use and re-exported so
// existing `from './types'` imports keep working.
import type { ResearchableTechnologyType } from './technologyTypes';
export type { ResearchableTechnologyType };
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
  | 'palisade-wall'
  // M1 Farms: a built Farm is a building+resource HYBRID (also in ResourceKind).
  | 'farm';
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
  | 'relic'
  | 'farm'; // M1 Farms: a built Farm carries a 'farm' food resource.
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
  // Banked fractional movement entitlement in hundredths of a fine unit (the
  // movementTechEffects carry accumulator). Written only while a unit moves at
  // a speed percent ≠ 100 (e.g. Husbandry); pre-speed-model saves and un-teched
  // units read `?? 0` — additive like pierceArmorBonus, no schema bump.
  moveCarryHundredths?: number;
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
  // Entity-ref generation (civ-engine recycles ids; the generation bumps on
  // reuse). Present for live-projected entities (visibility.projectEntity);
  // omitted for fog-memory ghosts, which are static and never interpolated.
  // The render layer keys per-unit interpolation/facing caches by id:generation
  // so a recycled id can't inherit the destroyed entity's previous position.
  generation?: number;
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
  // Last-seen snapshot of a static building/resource in explored-but-not-visible fog:
  // renders at reduced opacity, excluded from selection and live HUD interactions.
  isMemory: boolean;
}

// One unit death, as surfaced to the render layer (v0.1.129 death feedback).
// Emitted at the sim's destroyUnitEntity chokepoint and fog-filtered per
// viewing player before it reaches a frame, because present→absent diffing on
// the entity view cannot distinguish death from fog exit or garrisoning.
// x/y are the unit's PROJECTED (sub-cell fine) coordinates at death so the
// effect plays exactly where the unit visually stood.
export interface ProjectedUnitDeathView {
  id: number;
  tick: number;
  x: number;
  y: number;
  owner: number;
  unitType: UnitComponent['unitType'];
  tint: number;
  size: number;
  // Players who could see the death cell AT THE MOMENT OF DEATH (captured
  // before the unit is destroyed and vision recomputed). The death cue is
  // gated on THIS, not on current visibility: you see a death you witnessed
  // and only that one — a kill in your fog never surfaces when you later
  // uncover the cell, and your own lone unit's death still shows even though
  // losing it re-fogs its cell the same tick.
  witnessedBy: number[];
}

export interface ProjectedFrameView {
  tick: number;
  playerId: number;
  seed: string;
  mapWidth: number;
  mapHeight: number;
  visibleCells: number[];
  exploredCells: number[];
  // Deaths from the last DEATH_FEED_TICKS at cells this player can currently
  // see. TRANSIENT render info: never persisted (a load drops in-flight
  // animations), re-emitted naturally during replays.
  recentUnitDeaths: ProjectedUnitDeathView[];
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
  // cap = deriveCap(rawSupply) (stored; invariant holds). rawSupply is the
  // honest unclamped housing sum (+=/-= at build/destroy); see bridgeConstants.
  cap: number;
  rawSupply: number;
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
  armor: number | null; // melee armor-tech bonus
  pierceArmor: number | null; // pierce armor-tech bonus (incl. asymmetric +); spec §11.8
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

// Slice 11: debug-overlay snapshot. Each field populated so the HUD can safely
// downsample modes it hasn't activated. Coordinates in cell space (x, y in [0, MAP_WIDTH/HEIGHT)).
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
    commandType: 'move' | 'build' | 'attack' | 'repair';
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

export type WinCondition = 'conquest' | 'wonder' | 'relic' | 'score';

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
