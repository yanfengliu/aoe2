import type { UnitMovementPersistence } from './movementPersistenceTypes';

export type TerrainKind = 'grass' | 'forest' | 'water' | 'hill';
export type AgeType = 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
// The unit roster union lives in ./unitTypes (extracted to keep this file under
// the 500-LOC budget); re-exported so existing `from './types'` imports work.
export type { TrainableUnitType, UnitType } from './unitTypes';
import type { TrainableUnitType, UnitType } from './unitTypes';
// ResearchableTechnologyType lives in ./technologyTypes (extracted to keep this
// file under the 500-LOC budget); imported for internal use and re-exported so
// existing `from './types'` imports keep working.
import type { ResearchableTechnologyType } from './technologyTypes';
import type { UnitStance } from './unitStance';
export type { ResearchableTechnologyType };
export type { ProjectedUnitAttackAnimationView, ProjectedUnitAttackView } from './attackAnimationTypes';
export type ActionType = 'ungarrison' | 'ring-town-bell' | 'back-to-work';
// The work a unit is visibly doing (spec §14.5): drives the renderer's swing
// arc. 'gathering' survives as the legacy alias no new code emits.
export type UnitActiveVerb = 'building' | 'gathering' | 'chopping' | 'mining' | 'foraging';
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
  // Imperial defensive tower, unlocked by the University's Bombard Tower
  // technology. Fires a cannon: 120 damage on a 6-second reload.
  | 'bombard-tower'
  | 'stable'
  | 'archery-range'
  | 'blacksmith'
  | 'market'
  | 'siege-workshop'
  | 'monastery'
  // University (Castle Age): the research home for Ballistics. Research-only —
  // it trains no units.
  | 'university'
  | 'castle'
  | 'wonder'
  // FU3: real wall buildings. Stone Wall is Castle-Age, 1x1, HP 2000,
  // cost 5 stone — replaces the Arena map's stone-mine wall proxy.
  // Palisade Wall is its Feudal-Age cheaper cousin (HP 250, cost 2 wood).
  | 'stone-wall'
  | 'palisade-wall'
  // Gates. A wall you cannot open is a wall you have to demolish to leave, so
  // a walled base is only playable with these: a gate blocks the enemy exactly
  // as its wall does, and its owner's units walk through it. Each sits in the
  // wall line it belongs to — Palisade Gate with Palisade Wall, Gate with
  // Stone Wall (structures.csv "Gate": 30 stone, 2750 HP, Feudal).
  | 'stone-gate'
  | 'palisade-gate'
  // M1 Farms: a built Farm is a building+resource HYBRID (also in ResourceKind).
  | 'farm'
  // M5 naval: trains ships and receives fish. The only building that must be
  // placed against water (see shorePlacement.ts).
  | 'dock'
  // Dark-Age eye: 25 wood + 10 stone for a 1x1 post that sees a long way and
  // fights not at all (structures.csv "Outpost": 500 HP, line of sight 6).
  // Its whole job is to watch ground you do not hold.
  | 'outpost'
  // The naval Farm: a building+resource HYBRID like the Farm, but on WATER and
  // built by a Fishing Ship (structures.csv "Fish Trap": Dark Age, 100 wood,
  // 50 HP, "Gives 715 Food"). It is the only renewable food at sea.
  | 'fish-trap';
export type BuildingType = 'town-center' | BuildableBuildingType;
export type ResourceKind =
  | 'berry-bush'
  | 'gold-mine'
  | 'stone-mine'
  | 'boar'
  // Spec §5.6's third huntable. Unlike sheep and boar it FLEES an approaching
  // unit, which is the whole reason a player lures it with a scout instead of
  // walking villagers at it.
  | 'deer'
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
export type RenderVisualVariant = 'default' | 'construction' | 'complete' | 'damaged';

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

export interface UnitTransformComponent extends UnitMovementPersistence {
  fineX: number;
  fineY: number;
  // Persist the assigned occupancy destination separately from the moving fine
  // root. Legacy schema-v2 saves omit it and receive a one-time fallback.
  occupancySlotX?: number;
  occupancySlotY?: number;
  // Preserve an authoritative no-slot result; rebuild it after numeric slots
  // so entity-id order cannot promote overflow units on load.
  occupancySlotOverflow?: true;
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
  // Generation keeps recycled ids from inheriting stale projection state.
  generation?: number;
  kind: 'tile' | 'unit' | 'building' | 'resource';
  layer: 'terrain' | 'resource' | 'building' | 'unit';
  entityType: TerrainKind | UnitComponent['unitType'] | BuildingComponent['buildingType'] | ResourceKind;
  owner: number | null;
  x: number;
  y: number;
  // Vertical terrain level for 3D/isometric renderers. Optional so existing
  // projected-view fixtures and external consumers remain source-compatible;
  // live projection always emits a concrete value.
  elevation?: number;
  tint: number;
  size: number;
  footprintWidth: number;
  footprintHeight: number;
  visualVariant: RenderVisualVariant;
  /** Building set the owner's civilization wears (v0.3.105); absent for
   *  units/terrain/resources and for pre-architecture snapshots — the
   *  renderer reads absent as the western-european default. */
  architecture?: import('./architectureStyles').ArchitectureStyle;
  selected: boolean;
  currentHp: number | null;
  maxHp: number | null;
  attackAnimation?: import('./attackAnimationTypes').ProjectedUnitAttackAnimationView;
  // Wildlife life state (spec §14.5 carcass): true live, false for a
  // persisted corpse, absent for non-wildlife. Explicit on purpose —
  // `currentHp === null` is a health-display convention shared with every
  // other resource, so the carcass look must not key off it.
  wildlifeAlive?: boolean;
  // Active work verb (spec §14.5 construction animation). Derived, never
  // recorded: same predicate the HUD's selection panel reads.
  activeVerb?: UnitActiveVerb;
  // Last-seen snapshot of a static building/resource in explored-but-not-visible fog:
  // renders at reduced opacity, excluded from selection and live HUD interactions.
  isMemory: boolean;
}

export type {
  ProjectedUnitDeathView,
  ProjectedProjectileView,
  ProjectedFrameView,
  RenderState,
} from './renderViewTypes';

export interface PlayerResources {
  food: number;
  wood: number;
  gold: number;
  stone: number;
}

export interface PopulationState {
  current: number;
  // cap = deriveCap(rawSupply); rawSupply is the honest unclamped housing sum.
  cap: number;
  rawSupply: number;
}

export type UnitTaskState = GatherTaskState | 'moving' | 'building' | 'attacking' | 'garrisoned' | 'trading';
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
    reloadTicks: number;
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
  // M6 control: the stances offerable for this selection (empty unless the
  // player has their OWN units selected), and the one they currently share —
  // null for a mixed selection, so the HUD highlights nothing rather than
  // lying about one of them.
  stanceOptions: UnitStance[];
  stance: UnitStance | null;
  formationOptions: import('./unitFormation').UnitFormation[];
  /** The whole selection's formation, or null when it disagrees. */
  formation: import('./unitFormation').UnitFormation | null;
  buildOptions: BuildableBuildingType[];
  marketOptions: MarketActionType[];
  trainOptions: TrainableUnitType[];
  visibleResearchOptions: ResearchableTechnologyType[];
  researchOptions: ResearchableTechnologyType[];
  /** Why each command the card is about to draw cannot be used right now.
   *  Only the blocked ones appear; a command missing from this list is one
   *  nothing is currently wrong with. The HUD hangs each reason on the
   *  matching control, so a refusal explains itself where the player is
   *  looking rather than only after a click (and a DISABLED control, which
   *  cannot be clicked at all, has no other way to say anything). */
  unavailableCommands: UnavailableCommand[];
  queue: ProductionQueueEntry[];
  placementMode: BuildableBuildingType | null;
}

/** One blocked command and the thing it is missing. `kind`-`id` is the
 *  HUD's own `data-command` hook ("research-feudal-age", "build-house"). */
export interface UnavailableCommand {
  kind: 'research' | 'train' | 'build' | 'market';
  id: string;
  /** One short sentence naming what is missing — never a bare refusal. */
  reason: string;
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
    commandType: 'move' | 'attack-move' | 'attack-ground' | 'build' | 'attack' | 'repair' | 'garrison' | 'trade';
  }>;
  aiSummaries: Array<{
    owner: number;
    difficulty: string;
    plan: string;
    villagerTargets: Partial<Record<string, number>>;
    attackGroupSize: number;
  }>;
  // Slice 12 Task D: per-unit probe for the "coarse-vs-fine" debug overlay.
  // `coarseX/Y` is the integer simulation cell; `fineX/Y` the interpolated
  // render position (whole-cell units); the scene draws coarse → fine.
  coarseVsFine: Array<{
    id: number;
    coarseX: number;
    coarseY: number;
    fineX: number;
    fineY: number;
  }>;
  /** The drop-off walk field's cost so far (dropOffWalkField.ts): how many
   *  times it was rebuilt, how many asks a built field answered, and the wall
   *  time the rebuilds took. Absent on a bridge with no field wired. */
  walkFields?: { computed: number; served: number; computeMs: number };
  /** The placement-reachability labelling's cost (builderReachability.ts): how
   *  many times it was flood-filled, how many asks a built labelling answered,
   *  and the wall time the fills took — the feature's OWN timer, which is what
   *  a cost claim has to rest on. Absent on a bridge with none wired. */
  builderReach?: { computed: number; served: number; computeMs: number };
}

export type WinCondition = 'conquest' | 'wonder' | 'relic' | 'score';

export interface MatchState {
  outcome: 'running' | 'victory' | 'defeat' | 'draw';
  summary: string;
  // Populated when `outcome !== 'running'`. Null while the match is live.
  winCondition: WinCondition | null;
  // Per-owner score snapshot at match end (ownerId -> total); null while live.
  scores: Record<number, number> | null;
  // Remaining ticks on an in-flight Wonder countdown for the human player, or
  // null if none — surfaced so the HUD can render a timer beside age / pop.
  wonderCountdownTicks: number | null;
  // Remaining ticks on an in-flight Relic countdown for the human player,
  // or null if no countdown is active.
  relicCountdownTicks: number | null;
}
