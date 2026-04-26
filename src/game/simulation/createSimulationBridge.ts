import {
  RenderAdapter,
  VisibilityMap,
  World,
  WorldDebugger,
  createTileGrid,
  type EntityRef,
  type Position,
} from 'civ-engine';

import {
  clamp,
  rebuildTileGridFromWorld,
  currentEntityId,
  cloneResources,
  defaultCivilizationName,
  createInitialMarketRates,
  shouldMaintainGatheringOrder,
  isResourceCandidate,
  isEconomyVillager,
  isEconomyResourceEntry,
  cloneQueue,
  manhattanDistance,
  buildingFootprint,
  isFootprintVisible,
  compareProjectedRenderEntities,
  UNIT_SUBGRID_RESOLUTION,
  type GameEvents,
  type GameCommands,
  type GameComponents,
  type GameWorld,
} from './bridge/pureHelpers';
import {
  createProjector,
  syncVisibilitySources,
  updateSheepOwnership,
} from './bridge/visibility';
import { createTrebuchetStateOps } from './bridge/trebuchetState';
import { createFogMemoryOps } from './bridge/fogMemoryOps';
import { createMonkTaskOps } from './bridge/monkTaskOps';
import { createTechnologyOps } from './bridge/technologyOps';
import { createMatchEndOps } from './bridge/matchEndOps';
import { createAiDecisionOps } from './bridge/aiDecisionOps';
import { createPlacementOps } from './bridge/placementOps';
import { createSaveGameOps } from './bridge/saveGameOps';
import { createEntityDestroyOps } from './bridge/entityDestroyOps';
import { createCombatStateFactory } from './bridge/combatStateFactory';
import { createEntityCreateOps } from './bridge/entityCreateOps';
import { createHumanInputOps } from './bridge/humanInputOps';
import { createCellPassability } from './bridge/cellPassability';
import { createTransformOps } from './bridge/transformOps';
import { createVisibilityQueries } from './bridge/visibilityQueries';
import { createSelectionInputOps } from './bridge/selectionInputOps';
import { createTrainingMarketOps } from './bridge/trainingMarketOps';
import { createUnitCommandOps } from './bridge/unitCommandOps';
import { createMovementPlanOps } from './bridge/movementPlanOps';
import { createOptionsRules } from './bridge/optionsRules';
import { createPlayerQueries } from './bridge/playerQueries';
import { createSelectionStateOps } from './bridge/selectionStateOps';
import { createTargetFindingOps } from './bridge/targetFindingOps';
import type { RelicCountdownEntry, WonderCountdownEntry } from './bridge/countdownTypes';
import type { MemoryEntry } from './bridge/memoryTypes';
import { registerAiSystem } from './bridge/systems/aiSystem';
import { registerAutoAggressionSystem } from './bridge/systems/autoAggressionSystem';
import { registerConquestOutcomeSystem } from './bridge/systems/conquestOutcomeSystem';
import { registerFogMemorySystem } from './bridge/systems/fogMemorySystem';
import { registerHerdableMovementSystem } from './bridge/systems/herdableMovementSystem';
import { registerHerdableOwnershipSystem } from './bridge/systems/herdableOwnershipSystem';
import { registerMonkBehaviorSystem } from './bridge/systems/monkBehaviorSystem';
import { registerPlayerCommandsSystem } from './bridge/systems/playerCommandsSystem';
import { registerProductionQueueSystem } from './bridge/systems/productionQueueSystem';
import { registerScoutMovementSystem } from './bridge/systems/scoutMovementSystem';
import { registerTowerCombatSystem } from './bridge/systems/towerCombatSystem';
import { registerVillagerEconomySystem } from './bridge/systems/villagerEconomySystem';
import { registerWildlifeCombatSystem } from './bridge/systems/wildlifeCombatSystem';
import { registerRelicCountdownSystem } from './bridge/systems/relicCountdownSystem';
import { registerRelicGoldSystem } from './bridge/systems/relicGoldSystem';
import { registerVisibilitySystem } from './bridge/systems/visibilitySystem';
import { registerWinConditionResolverSystem } from './bridge/systems/winConditionResolverSystem';
import { registerWonderCountdownSystem } from './bridge/systems/wonderCountdownSystem';
import {
  DEFAULT_SEED,
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
  TPS,
  createPrototypeScenario,
} from './prototypeScenario';
import {
  buildingBuildTimeTicks,
  buildingPopulationProvided,
} from './prototypeBuildingRules';
import { resourceKindToEconomyResource } from './prototypeEconomyRules';
import {
  unitAttackDamage,
  unitAttackRange,
  unitTint,
} from './prototypeUnitRules';
import { RenderStore } from './renderStore';
import { SAVE_SCHEMA_VERSION, type SaveBlob } from './saveSchema';
import { findSafeSpawnWithEgress } from './spawn';
import { createWorldOccupancy } from './worldOccupancy';
import {
  AI_MONK_HEAL_HP_FRACTION,
  AI_WATCH_TOWER_FORWARD_STEP,
  DEFAULT_DIFFICULTY,
  planForAge,
  villagerTargetsForAge,
  type AiPlan,
  type AiState,
  type DifficultyLevel,
} from './ai';
import type {
  ActionType,
  AgeType,
  BuildableBuildingType,
  BuildingType,
  BuildingComponent,
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
  SelectionState,
  SimulationDebugSnapshot,
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

// MemoryEntry has moved to `bridge/memoryTypes` — re-export so external
// consumers of this module's types still resolve.
export type { MemoryEntry } from './bridge/memoryTypes';

export interface SimulationBridge {
  step(deltaMs: number): void;
  getRenderState(): RenderState;
  getRenderInterpolationAlpha(): number;
  getHudState(): HudState;
  getEconomyState(): EconomyState;
  getPopulationState(playerId: number): PopulationState;
  getSelectionState(): SelectionState;
  getMatchState(): MatchState;
  getPlacementPreview(x: number, y: number): PlacementPreviewState | null;
  // FU4: probe an entity's current/max HP. Reads the canonical combat
  // (unit) or building-health side-map directly so vitest cases can
  // assert AI-side healing / damage without routing through fog
  // visibility. Returns `null` when the entity has no associated
  // health tracking (e.g., resources, terrain).
  getEntityHealth(id: number): { currentHp: number; maxHp: number } | null;
  selectEntityAtCell(x: number, y: number): boolean;
  selectEntityById(id: number): boolean;
  selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean;
  filterSelectableUnitIds(ids: number[]): number[];
  selectUnitsByIds(ids: number[]): boolean;
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
  // Slice 11: drain the oldest pending command-rejection reason, if any.
  // The HUD polls this every update frame and renders a toast with the
  // returned copy. Returns `null` when no rejection is pending.
  consumeCommandRejection(): string | null;
  // Slice 11: snapshot for the F2 debug overlay. Returns the per-frame
  // data the overlay draws: pathing targets keyed by unit id, AI plan
  // summaries per owner, and tick-level perf metrics. Cheap to call; the
  // overlay renderer pulls this every frame.
  getDebugSnapshot(): SimulationDebugSnapshot;
  saveGame(): SaveBlob;
}

const STANDARD_STARTING_RESOURCES: PlayerResources = {
  food: 200,
  wood: 200,
  gold: 100,
  stone: 200,
};

const STANDARD_POPULATION_CAP = 5;
const WONDER_COUNTDOWN_TICKS = 2000;
// Slice 8: Relic victory requires holding every relic on the map in one
// player's Monasteries for the full countdown. Mirrors Wonder countdown.
const RELIC_COUNTDOWN_TICKS = 2000;
// Deterministic per-tick increments for Monk conversion and heal (Slice 5).
// Conversion flips target ownership at 50 progress; heal restores 1 HP per
// 10 ticks. These values are intentionally v1 "easy-to-observe" rates — real
// AoE2 uses per-tick conversion chance plus faith; out-of-scope here.
const MONK_HEAL_TICK_INTERVAL = 10;
const MONK_HEAL_HP_PER_INTERVAL = 1;
const MONK_CONVERT_PROGRESS_PER_TICK = 1;
const MONK_CONVERT_FLIP_THRESHOLD = 50;
// MONK_ACTION_RANGE moved to bridge/systems/monkBehaviorSystem.
const MARKET_TRANSACTION_AMOUNT = 100;
const MARKET_FEE_RATE = 0.3;
const MARKET_RATE_STEP = 3;
const MARKET_MIN_RATE = 20;
// SHEEP_SUBGRID_STEP_PER_TICK moved to bridge/systems/herdableMovementSystem.
const CARDINAL_NEIGHBOR_OFFSETS: Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export interface UnitCommand {
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
export interface MonkTask {
  kind: 'heal' | 'convert' | 'pickup' | 'deposit';
  targetEntityRef: EntityRef;
}

export interface ConstructionState {
  isComplete: boolean;
  buildProgressTicks: number;
  totalBuildTicks: number;
  populationProvided: number;
  width: number;
  height: number;
}

// FU7: Trebuchet pack/unpack state. Each Trebuchet has a `packed` flag
// (mobile when true, stationary-fire when false) and a
// `transitionTicksRemaining` counter that is > 0 while a pack <-> unpack
// transition is in progress.
export interface TrebuchetPackState {
  packed: boolean;
  transitionTicksRemaining: number;
}

interface CombatState {
  currentHp: number;
  maxHp: number;
  attackDamage: number;
  attackRange: number;
  reloadTicks: number;
  cooldownTicks: number;
  // Additive armor granted by Blacksmith techs (Plate Mail Armor for infantry,
  // Plate Barding Armor for cavalry). Base unit types ship with armor 0; only
  // techs bump this value. Armor does not currently reduce damage in combat
  // calculations — this tracks the researched state so the HUD / tests can
  // surface the bonus. Damage-reduction hooks land in a later slice.
  armor: number;
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

interface WildlifeState extends CombatState {
  autoAggro: boolean;
  isAlive: boolean;
  corpsePersists: boolean;
  aggroRange: number;
  targetEntityRef: EntityRef | null;
}

interface ResolvedMovementPath {
  destination: Position;
  path: Position[];
}

interface CachedMovePath extends ResolvedMovementPath {
  nextPathIndex: number;
}

function createWorld(
  seed: string,
  visibility: VisibilityMap,
  savedGame: SaveBlob | undefined,
): {
  world: GameWorld;
  saveGame: () => SaveBlob;
  getEconomyState: () => EconomyState;
  getPopulationState: (playerId: number) => PopulationState;
  getPlayerAge: (playerId: number) => AgeType;
  getPlayerResources: (playerId: number) => PlayerResources;
  getMatchState: () => MatchState;
  getSelectionState: () => SelectionState;
  getPlacementPreview: (x: number, y: number) => PlacementPreviewState | null;
  getEntityHealth: (id: number) => { currentHp: number; maxHp: number } | null;
  selectEntityAtCell: (x: number, y: number) => boolean;
  selectEntityById: (id: number) => boolean;
  selectOwnedUnitsByTypeInRect: (
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) => boolean;
  filterSelectableUnitIds: (ids: number[]) => number[];
  selectUnitsByIds: (ids: number[]) => boolean;
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
  consumeCommandRejection: () => string | null;
  getDebugSnapshot: () => SimulationDebugSnapshot;
  getFogMemoryEntities: (liveEntityIds: Set<number>) => ProjectedEntityView[];
  getHumanFogMemorySize: () => number;
} {
  // Slice 9: when a save blob is provided, deserialize the world from
  // it. `World.deserialize` preserves entity ids and generations exactly
  // (`EntityManager.fromState`), so every `EntityRef` captured by the
  // saved side maps still resolves through `world.getEntityRef` after
  // hydration. The deserialized world also restores tick, rng, and
  // every component store; component bits and entity signatures are
  // recomputed via `rebuildComponentSignatures`. Because all components
  // are already present, we MUST skip the explicit `registerComponent`
  // calls below — they would throw on duplicate registration.
  const world: GameWorld = savedGame
    ? World.deserialize<GameEvents, GameCommands, GameComponents>(savedGame.worldSnapshot)
    : new World<GameEvents, GameCommands, GameComponents>({
        gridWidth: MAP_WIDTH,
        gridHeight: MAP_HEIGHT,
        tps: TPS,
        seed,
      });
  const worldOccupancy = createWorldOccupancy(MAP_WIDTH, MAP_HEIGHT);
  worldOccupancy.attachWorld(world);
  let isBootstrappingScenario = !savedGame;

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
  // Transient move-order routes live outside `unitCommands` so save/load keeps
  // serializing only durable intent (command kind + target/entity refs).
  const movePathCache = new Map<number, CachedMovePath>();
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
  const trebuchetPackStates = new Map<number, TrebuchetPackState>();
  // Slice 8: Wonder victory state. Countdown starts as soon as a player's
  // Wonder completes construction; decrements every tick. At 0 the owner
  // wins by Wonder victory. If the Wonder is destroyed the countdown
  // resets to null and must restart from scratch when a new Wonder is
  // built. Countdown length defaults to WONDER_COUNTDOWN_TICKS but a
  // per-player scenario override (`wonderCountdownOverrideTicks`) can
  // shrink it for test speed. Entry shape lives in `bridge/countdownTypes`.
  const wonderCountdowns = new Map<number, WonderCountdownEntry>();
  const wonderCountdownOverrides = new Map<number, number>();
  // Slice 8: Relic victory state. Countdown starts as soon as one owner
  // holds every relic on the map inside their Monasteries. Decrements
  // every tick. At 0 the owner wins by Relic victory. If the ownership
  // picture changes (a relic drops, a relic is picked up by another
  // Monk, etc.) the countdown resets to null. Entry shape lives in
  // `bridge/countdownTypes`.
  const relicCountdowns = new Map<number, RelicCountdownEntry>();
  const relicCountdownOverrides = new Map<number, number>();
  // Slice 8: per-owner score counters incremented on game-event ticks.
  // The final score is computed in `finalizeMatchEnd` using the weights
  // documented in `computePlayerScore`.
  interface PlayerScoreCounters {
    unitsProduced: number;
    buildingsProduced: number;
    resourcesGathered: number;
    // FU7: military kills (enemy units destroyed by this player's units or
    // buildings). Rewards combat play so a defensive booming economy does
    // not trivially outscore a raiding army at match end.
    unitsKilled: number;
    wonderCompleted: boolean;
  }
  const playerScoreCounters = new Map<number, PlayerScoreCounters>();
  function ensurePlayerScoreCounters(owner: number): PlayerScoreCounters {
    let counters = playerScoreCounters.get(owner);
    if (!counters) {
      counters = {
        unitsProduced: 0,
        buildingsProduced: 0,
        resourcesGathered: 0,
        unitsKilled: 0,
        wonderCompleted: false,
      };
      playerScoreCounters.set(owner, counters);
    }
    return counters;
  }
  // FU7: helpers for the Trebuchet pack/unpack lifecycle. Centralized in
  // `bridge/trebuchetState` so every caller (attack pathway, move pathway,
  // save/load hydration) keeps a single source of truth for transition
  // semantics.
  const {
    advanceTrebuchetTransition,
    beginTrebuchetUnpack,
    beginTrebuchetPack,
    isTrebuchetStationary,
    isTrebuchetSilent,
  } = createTrebuchetStateOps(trebuchetPackStates);

  // Per-player last-seen snapshot of static buildings and resources (Item 3, Slice 1).
  // Keyed by playerId -> entityId -> snapshot. Refreshed every tick for entities currently
  // visible to the player; read at render-projection time for cells that are
  // explored-but-not-visible, so the player remembers enemy bases and resource patches that
  // have since left vision. Units are excluded in v1. Read helpers live in
  // `bridge/fogMemoryOps`; save/load hydration still writes through this map directly.
  const lastSeenStatic = new Map<number, Map<number, MemoryEntry>>();
  const {
    getOrCreateMemoryMap,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  } = createFogMemoryOps({
    fogMemory: lastSeenStatic,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
  });

  // Slice 11: snapshot for the F2 debug overlay. The HUD calls this every
  // frame in modes that request pathing / ai-state / perf. Readers pick
  // whichever slice they need; the arrays remain short because active
  // unit commands and AI entries cap at the handful of moving units /
  // non-human owners.
  function getDebugSnapshot(): SimulationDebugSnapshot {
    const unitPaths: SimulationDebugSnapshot['unitPaths'] = [];
    for (const [unitId, command] of unitCommands.entries()) {
      const position = world.getComponent<Position>(unitId, 'position');
      if (!position) {
        continue;
      }
      unitPaths.push({
        id: unitId,
        fromX: position.x,
        fromY: position.y,
        toX: command.target.x,
        toY: command.target.y,
        commandType: command.type,
      });
    }

    const aiSummaries: SimulationDebugSnapshot['aiSummaries'] = [];
    for (const [owner, state] of aiStates.entries()) {
      aiSummaries.push({
        owner,
        difficulty: state.difficulty,
        plan: state.plan,
        villagerTargets: { ...state.villagerTargets } as Partial<Record<string, number>>,
        attackGroupSize: state.attackGroup.length,
      });
    }

    // Slice 12 Task D: coarse-vs-fine probe. Every unit with both a
    // `Position` (coarse integer cell) and a `UnitTransform` (fine
    // sub-grid coordinates) contributes one entry. Fine coordinates are
    // reported in whole-cell units so the renderer can draw the line
    // directly without rescaling.
    const coarseVsFine: SimulationDebugSnapshot['coarseVsFine'] = [];
    for (const unitId of world.query('position', 'unit', 'unitTransform')) {
      const position = world.getComponent<Position>(unitId, 'position');
      const transform = world.getComponent<UnitTransformComponent>(unitId, 'unitTransform');
      if (!position || !transform) {
        continue;
      }
      coarseVsFine.push({
        id: unitId,
        coarseX: position.x,
        coarseY: position.y,
        fineX: transform.fineX / UNIT_SUBGRID_RESOLUTION,
        fineY: transform.fineY / UNIT_SUBGRID_RESOLUTION,
      });
    }

    return {
      tick: world.tick,
      // Per-tick ms, entity count, and visible cell count flow through the
      // HUD via `getHudState()`; the debug overlay can surface those
      // directly from the HUD snapshot without touching the world again.
      tickDurationMs: 0,
      entityCount: 0,
      unitPaths,
      aiSummaries,
      coarseVsFine,
    };
  }
  const garrisonedByBuilding = new Map<number, number[]>();
  const garrisonedUnitToBuilding = new Map<number, number>();
  const garrisonedUnitVisionSources = new Map<number, VisionSourceComponent>();
  // Slice 10: per-owner AI state. Keyed by player id (non-human owners
  // get an entry at scenario bootstrap via `ensureAiState`). The
  // `prototypeAi` system reads this to drive a planner-style decision
  // loop; save/load serializes it through the same side-map boundary
  // as every other piece of runtime state (see `SerializedSideMaps`).
  const aiStates = new Map<number, AiState>();

  function clearUnitCommand(unitId: number): void {
    unitCommands.delete(unitId);
    movePathCache.delete(unitId);
  }

  function setUnitCommand(unitId: number, command: UnitCommand): void {
    movePathCache.delete(unitId);
    unitCommands.set(unitId, command);
  }

  function ensureAiState(
    owner: number,
    difficulty: DifficultyLevel = DEFAULT_DIFFICULTY,
  ): AiState {
    let state = aiStates.get(owner);
    if (!state) {
      const age = playerAges.get(owner) ?? 'dark-age';
      state = {
        difficulty,
        plan: planForAge(age),
        villagerTargets: { ...villagerTargetsForAge(age) },
        attackGroup: [],
        lastDecisionTick: -1,
        lastEnemySightingTick: -1,
        lastEnemySightingPosition: null,
      };
      aiStates.set(owner, state);
    }
    return state;
  }
  // Slice 5 Monk runtime counters. Hoisted to the top of `createWorld`
  // alongside the other side maps so the Slice 9 save/load path can
  // both serialize and rehydrate them. The original declaration site
  // was inside the prototypeMonkBehavior system body; the system still
  // closes over these maps via the surrounding closure.
  const monkHealCounters = new Map<number, number>();
  // Per-tick "already progressed this tick" guard for convert. Cleared at
  // the start of every prototypeMonkBehavior pass, so it never holds
  // cross-tick state worth saving.
  const monkConvertProcessedThisTick = new Set<number>();
  const productionQueues = new Map<number, ProductionQueueEntry[]>();
  const constructionStates = new Map<number, ConstructionState>();
  const combatStates = new Map<number, CombatState>();
  const buildingHealthStates = new Map<number, BuildingHealthState>();
  const buildingCombatStates = new Map<number, BuildingCombatState>();
  const wildlifeStates = new Map<number, WildlifeState>();
  // Iter-3 V3-5: per-gatherer "stuck since" tick. The H2-2 fix
  // preserves the carry when findBuildingApproachPlan is null, but
  // the prior implementation re-ran findNearestDropOffBuilding + the
  // A* search every tick for every stuck villager. This map throttles
  // the retry to GATHER_DROPOFF_RETRY_INTERVAL ticks. Entries are
  // dropped on successful re-plan, on `clearGathererOrder`, on unit
  // destruction, and on save/load (scratch state, not serialized).
  const gathererDropOffStuckSinceTick = new Map<number, number>();
  // GATHER_DROPOFF_RETRY_INTERVAL moved to bridge/systems/villagerEconomySystem.
  // Iter-3 V3-6: per-owner set of in-flight research technologies. The
  // iter-2 H2-1 cost-dedupe scanned every owned producer's queue per
  // enqueueResearch call (O(producers × queue depth)); this side map
  // makes the lookup O(1). Updated on every queue push and queue
  // shift. Rebuildable from `productionQueues`, so we don't serialize
  // it — the load path walks the loaded queues and re-populates the
  // set instead.
  const inFlightTechByOwner = new Map<number, Set<ResearchableTechnologyType>>();
  function inFlightTechSetFor(owner: number): Set<ResearchableTechnologyType> {
    let set = inFlightTechByOwner.get(owner);
    if (!set) {
      set = new Set<ResearchableTechnologyType>();
      inFlightTechByOwner.set(owner, set);
    }
    return set;
  }
  const matchState: MatchState = {
    outcome: 'running',
    summary: '',
    winCondition: null,
    scores: null,
    wonderCountdownTicks: null,
    relicCountdownTicks: null,
  };
  // Match-end + score pipeline lives in `bridge/matchEndOps`. The factory
  // closes over matchState + every side map involved in win-condition
  // resolution so the bridge file keeps the side-map declarations but not
  // the aggregation / score-tally logic.
  const {
    finalizeMatchEnd,
    currentRelicHoldingOwner,
    getHumanWonderCountdownTicks,
    getHumanRelicCountdownTicks,
    playerHasConquestPresence,
  } = createMatchEndOps({
    world,
    matchState,
    humanPlayerId: HUMAN_PLAYER_ID,
    playerScoreCounters,
    relicsInMonastery,
    wonderCountdowns,
    relicCountdowns,
    monkCarriedRelic,
    playerResources,
  });
  // Selection state holder. Mutated by `bridge/selectionInputOps` and by
  // the small number of flows in this file that still touch selection
  // directly (garrison clear, scenario reload). Single source of truth so
  // every read/write stays consistent across the extraction surface.
  const selection: { refs: EntityRef[]; focusCell: Position | null } = {
    refs: [],
    focusCell: null,
  };
  // Mutable holder shared with `bridge/placementOps`. The ops read and
  // write `placementMode.current`; every non-placement interaction in
  // the bridge (select, context-click, move, garrison) clears the slot
  // back to null through the same holder.
  const placementMode: { current: BuildableBuildingType | null } = { current: null };
  let hasOutOfBandRenderChange = false;
  // Slice 11: ring-buffered queue of command-rejection reasons. Command
  // entry points enqueue a short string whenever they short-circuit so the
  // HUD can toast the reason. `consumeCommandRejection()` drains the oldest
  // pending reason; the queue is capped to avoid unbounded growth if the
  // HUD ever pauses consumption.
  const MAX_REJECTION_QUEUE = 8;
  const commandRejectionReasons: string[] = [];
  function enqueueRejection(reason: string): void {
    if (reason.length === 0) {
      return;
    }
    commandRejectionReasons.push(reason);
    if (commandRejectionReasons.length > MAX_REJECTION_QUEUE) {
      commandRejectionReasons.splice(0, commandRejectionReasons.length - MAX_REJECTION_QUEUE);
    }
  }
  function consumeCommandRejection(): string | null {
    return commandRejectionReasons.shift() ?? null;
  }

  function markOutOfBandRenderChange(): void {
    hasOutOfBandRenderChange = true;
  }

  // The deserialized world already has every component registered
  // (deserialize copied each `componentStores` entry from the snapshot),
  // so registerComponent would throw. Skip when loading.
  if (!savedGame) {
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
  }

  const scenario = createPrototypeScenario(seed);
  // The terrain grid + every entity already exists inside the
  // deserialized world. The scenario bootstrap loop below would create
  // duplicate tiles + duplicate units / buildings / resources, so skip
  // the player-start + terrain population entirely when loading. Side
  // maps are repopulated from the blob below.
  // `createTileGrid` allocates one entity per cell. When loading, the
  // tiles are already in the deserialized world (with the same ids,
  // because deserialize preserves the EntityManager state), so we
  // recreate the lookup grid from the existing terrain components
  // rather than calling `createTileGrid` (which would allocate a fresh
  // set of duplicate tile entities). The fresh path uses the raw
  // helper.
  const tiles: number[][] = savedGame
    ? rebuildTileGridFromWorld(world)
    : createTileGrid(world);

  if (!savedGame) {
  for (const start of scenario.starts) {
    playerAges.set(start.owner, start.startingAge ?? 'dark-age');
    playerCivilizations.set(start.owner, start.civilization ?? defaultCivilizationName(start.owner));
    // FU1: seed per-player researched-techs with the scenario's
    // `startingResearchedTechnologies` (if any). This is a passive-only
    // hook — applyTechnology side effects (age-up, unit upgrades) do NOT
    // fire here; fixtures should use `startingAge` for age seeding. The
    // seed is consumed by `createCombatState` so newly-spawned units in
    // the same scenario pick up tech bonuses (Chemistry, Fletching, etc.).
    researchedTechnologies.set(
      start.owner,
      new Set(start.startingResearchedTechnologies ?? []),
    );
    playerResources.set(
      start.owner,
      cloneResources(start.startingResources ?? STANDARD_STARTING_RESOURCES),
    );
    population.set(start.owner, {
      current: 0,
      cap: STANDARD_POPULATION_CAP,
    });
    villagerOrdinals.set(start.owner, 0);
    if (typeof start.wonderCountdownOverrideTicks === 'number') {
      wonderCountdownOverrides.set(
        start.owner,
        Math.max(1, start.wonderCountdownOverrideTicks),
      );
    }
    if (typeof start.relicCountdownOverrideTicks === 'number') {
      relicCountdownOverrides.set(
        start.owner,
        Math.max(1, start.relicCountdownOverrideTicks),
      );
    }
    // Slice 10: every non-human player gets an AiState so the planner
    // loop has somewhere to track plan phase + decision cadence. The
    // human player intentionally stays out of this map — the bridge's
    // `prototypeAi` system keys off `aiStates` membership. Fixtures
    // opt out via `disableAi: true` so the planner never issues
    // commands for that player's units (auto-aggression test fixtures
    // need a static, passive enemy).
    if (start.owner !== HUMAN_PLAYER_ID && !start.disableAi) {
      ensureAiState(start.owner, start.difficulty ?? DEFAULT_DIFFICULTY);
    }
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
  } // end if (!savedGame) — fresh-start bootstrap

  function getCurrentEntityId(ref: EntityRef | null): number | null {
    return currentEntityId(world, ref);
  }

  function getEntityRef(id: number): EntityRef | null {
    return world.getEntityRef(id);
  }

  // Selection-state assembly + entity health lookup live in
  // `bridge/selectionStateOps`. The factory closes over every side map
  // selection-state assembly reads. `clearSelection` is provided as a
  // collaborator so the recursive "selection got stale" path keeps the
  // single source of truth for clearing.
  const { getEntityHealth, getSelectionState } = createSelectionStateOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    wildlifeStates,
    garrisonedByBuilding,
    playerCivilizations,
    productionQueues,
    unitCommands,
    monkTasks,
    trebuchetPackStates,
    constructionStates,
    placementMode,
    getSelectedEntityIds: () => getSelectedEntityIds(),
    resolveSelectionTile: (id, position) => resolveSelectionTile(id, position),
    getSelectableEntitiesAtCell: (x, y) => getSelectableEntitiesAtCell(x, y),
    getCurrentEntityId: (ref) => getCurrentEntityId(ref),
    clearSelection: () => {
      selection.refs = [];
      selection.focusCell = null;
    },
    getActionOptions: (owner, buildingType, buildingId) => getActionOptions(owner, buildingType, buildingId),
    getTrainOptions: (owner, buildingType) => getTrainOptions(owner, buildingType),
    getMarketOptions: (owner, buildingType) => getMarketOptions(owner, buildingType),
    getBuildOptions: (owner, unitType) => getBuildOptions(owner, unitType),
    getResearchOptions: (owner, buildingType) => getResearchOptions(owner, buildingType),
    getVisibleResearchOptions: (owner, buildingType) => getVisibleResearchOptions(owner, buildingType),
  });


  // Unit-transform + occupancy ops live in `bridge/transformOps`.
  const {
    getUnitTransform,
    syncUnitTransformToPosition,
    moveUnitOneSubgridStep,
    isUnitAtTarget,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncSpawnedEntityOccupancy,
    rebuildWorldOccupancyFromWorld,
  } = createTransformOps({
    world,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    worldOccupancy,
    tiles,
    constructionStates,
    isBootstrappingScenario: () => isBootstrappingScenario,
  });

  // Player-state queries live in `bridge/playerQueries`. The factory closes
  // over the per-player side maps + the world; the AI planner / option
  // lookups / selection state all read through the returned ops.
  const {
    hasTechnology,
    findOwnedBuilding,
    findOwnedUnit,
    findAvailableVillager,
    countQueuedUnits,
    countOwnedUnits,
    hasCompletedBuilding,
    isConstructingBuilding,
    hasOwnedWonder,
    getPlayerAge,
    getPlayerCivilization,
    isAtLeastAge,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    latestResearchedInChain,
  } = createPlayerQueries({
    world,
    unitCommands,
    productionQueues,
    constructionStates,
    playerAges,
    playerCivilizations,
    researchedTechnologies,
  });

  // Combat state factory lives in `bridge/combatStateFactory`. Closes over
  // `hasTechnology` so per-tech stat stacking stays in one place.
  const createCombatState = createCombatStateFactory({ hasTechnology });

  // (occupancy + spawn-occupancy + rebuild moved to `bridge/transformOps`
  //  alongside the unit-transform helpers.)

  // Entity creation lives in `bridge/entityCreateOps`. The factory closes
  // over every side map an entity-creation path may write to.
  const {
    addUnitEntity,
    addBuildingEntity,
    addResourceEntity,
    onBuildingConstructionComplete,
  } = createEntityCreateOps({
    world,
    wonderCountdownTicks: WONDER_COUNTDOWN_TICKS,
    population,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    trebuchetPackStates,
    villagerOrdinals,
    productionQueues,
    constructionStates,
    townCenterRefs,
    wonderCountdowns,
    wonderCountdownOverrides,
    wildlifeStates,
    ensurePlayerScoreCounters,
    createCombatState,
    syncSpawnedEntityOccupancy,
    getEntityRef,
  });


  // Cell passability + occupancy queries live in `bridge/cellPassability`.
  // Wired here, BEFORE the scenario spawn loop, because that loop calls
  // `buildingOccupiesCell` / `isTerrainPassableForUnit` /
  // `isCellBlockedByBuilding` / `isCellBlockedByResource` during fixture
  // validation.
  const {
    buildingOccupiesCell,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    isCellPassableForSpawn,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    isPlacementBlocked,
    isGarrisonedUnit,
    getActionOptions,
  } = createCellPassability({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    worldOccupancy,
    tiles,
    constructionStates,
    wildlifeStates,
    garrisonedByBuilding,
    garrisonedUnitToBuilding,
  });

  // Skip the entity-spawn loop when loading from a save blob — every
  // entity is already in the deserialized world. Side-map population
  // happens further below from `savedGame.sideMaps`.
  if (!savedGame) {
  // Slice 12 Task B: entity ids whose spawn spec set
  // `allowOverlappingSpawn: true`. The fixture-validation pass skips
  // these when checking for unit-in-building and building-overlap
  // wedges so test fixtures that intentionally stack otherwise-illegal
  // entities (e.g., the tile-selection-cycle UX fixture) can keep
  // doing so without false positives.
  const overlapWhitelist = new Set<number>();
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
      || spawn.kind === 'wonder'
      || spawn.kind === 'stone-wall'
      || spawn.kind === 'palisade-wall'
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
      if (spawn.allowOverlappingSpawn) {
        overlapWhitelist.add(buildingId);
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
      // FU2: militia-line intermediate tiers + Paladin + Heavy Camel
      // are spawnable directly from fixture specs.
      || spawn.kind === 'man-at-arms'
      || spawn.kind === 'long-swordsman'
      || spawn.kind === 'two-handed-swordsman'
      || spawn.kind === 'paladin'
      || spawn.kind === 'heavy-camel'
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
      // FU4: pre-damage a starting unit so the AI Monk-heal path fires
      // on the first decision tick without needing a wildlife encounter
      // to wound the unit first. Mirrors the building `startHp`
      // pattern from Slice 6's siege fixtures.
      if (typeof spawn.startHp === 'number') {
        const combat = combatStates.get(unitId);
        if (combat) {
          combat.currentHp = Math.max(1, Math.min(combat.maxHp, spawn.startHp));
        }
      }
      if (spawn.allowOverlappingSpawn) {
        overlapWhitelist.add(unitId);
      }
      continue;
    }

    const resourceId = addResourceEntity(
      spawn.kind,
      { x: spawn.x, y: spawn.y },
      spawn.amount ?? 0,
      spawn.baseOwner,
    );
    if (spawn.allowOverlappingSpawn) {
      overlapWhitelist.add(resourceId);
    }
  }

  updateSheepOwnership(world);

  // Slice 12 Task B: validate that the scenario spawns produced a legal
  // world. Each live building, unit, and resource must sit inside the
  // map, on passable terrain, and not overlap another building's
  // footprint. The scenario-spawn loop above has special-cased
  // `requiresSafeSpawn` for units, but a badly-authored fixture can
  // still wedge a unit directly on top of a building footprint or place
  // two buildings so their footprints collide — this pass catches those
  // cases at boot, before they produce an opaque downstream crash.
  //
  // Buildings: every footprint cell must be inside the map bounds and
  // not overlap another building's footprint.
  for (const buildingId of world.query('building', 'position')) {
    const position = world.getComponent<Position>(buildingId, 'position');
    const building = world.getComponent<BuildingComponent>(buildingId, 'building');
    if (!position || !building) {
      continue;
    }
    const footprint = buildingFootprint(building.buildingType);
    for (let offsetY = 0; offsetY < footprint.height; offsetY += 1) {
      for (let offsetX = 0; offsetX < footprint.width; offsetX += 1) {
        const cellX = position.x + offsetX;
        const cellY = position.y + offsetY;
        if (cellX < 0 || cellX >= MAP_WIDTH || cellY < 0 || cellY >= MAP_HEIGHT) {
          throw new Error(
            `Scenario '${scenario.seed}': ${building.buildingType} anchored at (${position.x},${position.y}) extends past map bounds at cell (${cellX},${cellY}).`,
          );
        }
        // Detect building-on-building overlap by finding any other
        // building whose footprint also covers this cell. Skip when
        // either side of the pair is marked `allowOverlappingSpawn`.
        if (overlapWhitelist.has(buildingId)) {
          continue;
        }
        for (const otherId of world.query('building', 'position')) {
          if (otherId === buildingId || overlapWhitelist.has(otherId)) {
            continue;
          }
          if (buildingOccupiesCell(otherId, cellX, cellY)) {
            const otherBuilding = world.getComponent<BuildingComponent>(otherId, 'building');
            throw new Error(
              `Scenario '${scenario.seed}': ${building.buildingType} at (${position.x},${position.y}) overlaps ${otherBuilding?.buildingType ?? 'another building'} at cell (${cellX},${cellY}).`,
            );
          }
        }
      }
    }
  }

  // Units: each unit's cell must be inside bounds, on passable terrain,
  // and not on top of a building footprint. The scenario loop may have
  // already relocated units with `requiresSafeSpawn`, so we read the
  // unit's final `Position` here rather than the spawn spec.
  for (const unitId of world.query('unit', 'position')) {
    const position = world.getComponent<Position>(unitId, 'position');
    const unit = world.getComponent<UnitComponent>(unitId, 'unit');
    if (!position || !unit) {
      continue;
    }
    if (position.x < 0 || position.x >= MAP_WIDTH || position.y < 0 || position.y >= MAP_HEIGHT) {
      throw new Error(
        `Scenario '${scenario.seed}': ${unit.unitType} (owner ${unit.owner}) spawns outside map bounds at (${position.x},${position.y}).`,
      );
    }
    if (!isTerrainPassableForUnit(position.x, position.y)) {
      throw new Error(
        `Scenario '${scenario.seed}': ${unit.unitType} (owner ${unit.owner}) spawns on impassable terrain at (${position.x},${position.y}).`,
      );
    }
    if (overlapWhitelist.has(unitId)) {
      continue;
    }
    if (isCellBlockedByBuilding(position.x, position.y)) {
      throw new Error(
        `Scenario '${scenario.seed}': ${unit.unitType} (owner ${unit.owner}) spawns inside a building footprint at (${position.x},${position.y}).`,
      );
    }
  }

  // Resources: cells must be inside bounds, on passable terrain (except
  // shoreline fish which ride water — fish are not blocked by water),
  // and not on a building footprint.
  for (const resourceId of world.query('resource', 'position')) {
    const position = world.getComponent<Position>(resourceId, 'position');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    if (!position || !resource) {
      continue;
    }
    if (position.x < 0 || position.x >= MAP_WIDTH || position.y < 0 || position.y >= MAP_HEIGHT) {
      throw new Error(
        `Scenario '${scenario.seed}': ${resource.resourceType} resource spawns outside map bounds at (${position.x},${position.y}).`,
      );
    }
    if (overlapWhitelist.has(resourceId)) {
      continue;
    }
    if (isCellBlockedByBuilding(position.x, position.y)) {
      throw new Error(
        `Scenario '${scenario.seed}': ${resource.resourceType} resource at (${position.x},${position.y}) overlaps a building footprint.`,
      );
    }
  }

  // Resource-on-resource overlaps: no two resource entities may share a
  // cell. This matches the building-on-building pass above. The
  // overlapWhitelist escape hatch still applies for fixtures that
  // deliberately stack resources (none today, but the opt-out stays
  // consistent across kinds).
  const resourceByCell = new Map<string, { id: number; kind: string }>();
  for (const resourceId of world.query('resource', 'position')) {
    if (overlapWhitelist.has(resourceId)) {
      continue;
    }
    const position = world.getComponent<Position>(resourceId, 'position');
    const resource = world.getComponent<ResourceComponent>(resourceId, 'resource');
    if (!position || !resource) {
      continue;
    }
    const key = `${position.x},${position.y}`;
    const existing = resourceByCell.get(key);
    if (existing) {
      throw new Error(
        `Scenario '${scenario.seed}': ${resource.resourceType} resource at (${position.x},${position.y}) overlaps ${existing.kind} at the same cell.`,
      );
    }
    resourceByCell.set(key, { id: resourceId, kind: resource.resourceType });
  }
  } // end if (!savedGame) — fresh-start entity spawn

  // Slice 9: when loading from a save blob, hydrate every side map
  // declared at the top of `createWorld` from the snapshot. Entity
  // ids match the deserialized world's ids (because deserialize
  // preserves them), so every `EntityRef` is rebuilt via
  // `world.getEntityRef(id)` — that lookup returns null for entities
  // that were destroyed in the saved game, so the load path filters
  // those entries out (their referent no longer exists, and any system
  // that consumed the side map would also have dropped them).
  if (savedGame) {
    const blob = savedGame.sideMaps;
    const refFromSerialized = (s: { id: number; generation: number }): EntityRef | null => {
      const ref = world.getEntityRef(s.id);
      // Even if the id is alive, the generation must match exactly
      // — otherwise the entity has been destroyed and recycled to a
      // different live instance, and the saved ref must not resolve.
      if (!ref || ref.generation !== s.generation) {
        return null;
      }
      return ref;
    };

    for (const [k, v] of blob.trackedVisibilitySources) {
      trackedVisibilitySources.set(k, v);
    }
    for (const [owner, age] of blob.playerAges) {
      playerAges.set(owner, age as AgeType);
    }
    for (const [owner, civ] of blob.playerCivilizations) {
      playerCivilizations.set(owner, civ);
    }
    for (const [owner, techs] of blob.researchedTechnologies) {
      researchedTechnologies.set(owner, new Set(techs as ResearchableTechnologyType[]));
    }
    for (const [owner, res] of blob.playerResources) {
      playerResources.set(owner, { ...res });
    }
    marketExchangeRates.food = blob.marketExchangeRates.food;
    marketExchangeRates.wood = blob.marketExchangeRates.wood;
    marketExchangeRates.stone = blob.marketExchangeRates.stone;
    for (const [owner, pop] of blob.population) {
      population.set(owner, { ...pop });
    }
    for (const [owner, refData] of blob.townCenterRefs) {
      const ref = refFromSerialized(refData);
      if (ref) townCenterRefs.set(owner, ref);
    }
    for (const [owner, ord] of blob.villagerOrdinals) {
      villagerOrdinals.set(owner, ord);
    }
    for (const [id, cmd] of blob.unitCommands) {
      const restored: UnitCommand = {
        type: cmd.type,
        target: { x: cmd.target.x, y: cmd.target.y },
      };
      if (cmd.targetEntityKind) {
        restored.targetEntityKind = cmd.targetEntityKind;
      }
      if (cmd.targetEntityRef) {
        const ref = refFromSerialized(cmd.targetEntityRef);
        if (ref) restored.targetEntityRef = ref;
      }
      if (cmd.buildingRef) {
        const ref = refFromSerialized(cmd.buildingRef);
        if (ref) restored.buildingRef = ref;
      }
      setUnitCommand(id, restored);
    }
    for (const [id, pos] of blob.sheepMoveOrders) {
      sheepMoveOrders.set(id, { x: pos.x, y: pos.y });
    }
    for (const [id, pos] of blob.rallyPoints) {
      rallyPoints.set(id, { x: pos.x, y: pos.y });
    }
    for (const [id, task] of blob.monkTasks) {
      const ref = refFromSerialized(task.targetEntityRef);
      if (ref) monkTasks.set(id, { kind: task.kind, targetEntityRef: ref });
    }
    for (const [id, state] of blob.conversionState) {
      conversionState.set(id, { byOwner: state.byOwner, progress: state.progress });
    }
    for (const [id, relicId] of blob.monkCarriedRelic) {
      monkCarriedRelic.set(id, relicId);
    }
    for (const [id, count] of blob.monkHealCounters) {
      monkHealCounters.set(id, count);
    }
    for (const [id, count] of blob.relicsInMonastery) {
      relicsInMonastery.set(id, count);
    }
    for (const [id, entry] of blob.wonderCountdowns) {
      wonderCountdowns.set(id, {
        remainingTicks: entry.remainingTicks,
        totalTicks: entry.totalTicks,
        // FU7: tolerate older saves that lacked `lastCompletedTick` —
        // mid-flight countdowns default back to null.
        lastCompletedTick: entry.lastCompletedTick ?? null,
      });
    }
    for (const [owner, ticks] of blob.wonderCountdownOverrides) {
      wonderCountdownOverrides.set(owner, ticks);
    }
    for (const [owner, entry] of blob.relicCountdowns) {
      relicCountdowns.set(owner, {
        remainingTicks: entry.remainingTicks,
        totalTicks: entry.totalTicks,
        lastCompletedTick: entry.lastCompletedTick ?? null,
      });
    }
    for (const [owner, ticks] of blob.relicCountdownOverrides) {
      relicCountdownOverrides.set(owner, ticks);
    }
    for (const [owner, counters] of blob.playerScoreCounters) {
      // FU7: back-fill `unitsKilled` for saves written before the field
      // existed (schema-tolerant hydrate of an optional-looking field).
      // Older saves implicitly have zero kills.
      playerScoreCounters.set(owner, {
        unitsProduced: counters.unitsProduced,
        buildingsProduced: counters.buildingsProduced,
        resourcesGathered: counters.resourcesGathered,
        unitsKilled: counters.unitsKilled ?? 0,
        wonderCompleted: counters.wonderCompleted,
      });
    }
    // FU7: hydrate Trebuchet pack states. Absent-on-old-save is fine —
    // the trebuchets will be treated as packed by the init path below
    // when a scenario is fresh; on save/load we replay whatever the
    // blob stored.
    for (const [id, state] of blob.trebuchetPackStates ?? []) {
      trebuchetPackStates.set(id, {
        packed: state.packed,
        transitionTicksRemaining: state.transitionTicksRemaining,
      });
    }
    for (const [playerId, innerEntries] of blob.lastSeenStatic) {
      const inner = new Map<number, MemoryEntry>();
      for (const [entityId, entry] of innerEntries) {
        inner.set(entityId, {
          kind: entry.kind,
          entityType: entry.entityType as MemoryEntry['entityType'],
          position: { x: entry.position.x, y: entry.position.y },
          footprintWidth: entry.footprintWidth,
          footprintHeight: entry.footprintHeight,
          tint: entry.tint,
          owner: entry.owner,
          size: entry.size,
          visualVariant: entry.visualVariant as MemoryEntry['visualVariant'],
          lastSeenTick: entry.lastSeenTick,
        });
      }
      lastSeenStatic.set(playerId, inner);
    }
    for (const [id, list] of blob.garrisonedByBuilding) {
      garrisonedByBuilding.set(id, [...list]);
    }
    for (const [id, buildingId] of blob.garrisonedUnitToBuilding) {
      garrisonedUnitToBuilding.set(id, buildingId);
    }
    for (const [id, src] of blob.garrisonedUnitVisionSources) {
      garrisonedUnitVisionSources.set(id, { playerId: src.playerId, radius: src.radius });
    }
    // Review H-3: every entry in `garrisonedByBuilding[b] = [...units]`
    // must mirror `garrisonedUnitToBuilding[u] === b` and vice versa. A
    // partial or drifted blob (corruption, schema drift, incomplete
    // export) would otherwise boot the bridge into a silently inconsistent
    // state. Throw with the same `Save schema mismatch:`-style descriptive
    // shape the existing schema-version guard uses.
    for (const [buildingId, list] of garrisonedByBuilding) {
      for (const unitId of list) {
        const reverse = garrisonedUnitToBuilding.get(unitId);
        if (reverse !== buildingId) {
          throw new Error(
            `Save invariant violated: garrison cross-reference mismatch for unit ${unitId} / building ${buildingId} (garrisonedUnitToBuilding=${reverse ?? 'absent'}).`,
          );
        }
      }
    }
    for (const [unitId, buildingId] of garrisonedUnitToBuilding) {
      const list = garrisonedByBuilding.get(buildingId);
      if (!list || !list.includes(unitId)) {
        throw new Error(
          `Save invariant violated: garrison cross-reference mismatch for unit ${unitId} / building ${buildingId} (not present in garrisonedByBuilding).`,
        );
      }
    }
    for (const [id, queue] of blob.productionQueues) {
      productionQueues.set(
        id,
        queue.map((entry) => ({
          kind: entry.kind,
          label: entry.label,
          ...(entry.unitType !== undefined ? { unitType: entry.unitType as TrainableUnitType } : {}),
          ...(entry.technologyType !== undefined
            ? { technologyType: entry.technologyType as ResearchableTechnologyType }
            : {}),
          remainingTicks: entry.remainingTicks,
          totalTicks: entry.totalTicks,
          isBlocked: entry.isBlocked,
        })),
      );
    }
    // Iter-3 V3-6: rebuild inFlightTechByOwner from the loaded
    // production queues — it's derivable cache, not authoritative
    // state, so we don't store it in the blob.
    for (const [buildingId, queue] of productionQueues.entries()) {
      const building = world.getComponent<BuildingComponent>(buildingId, 'building');
      if (!building) {
        continue;
      }
      for (const entry of queue) {
        if (entry.kind === 'technology' && entry.technologyType) {
          inFlightTechSetFor(building.owner).add(entry.technologyType);
        }
      }
    }
    for (const [id, state] of blob.constructionStates) {
      constructionStates.set(id, { ...state });
    }
    for (const [id, state] of blob.combatStates) {
      combatStates.set(id, { ...state });
    }
    for (const [id, state] of blob.buildingHealthStates) {
      buildingHealthStates.set(id, { ...state });
    }
    for (const [id, state] of blob.buildingCombatStates) {
      buildingCombatStates.set(id, { ...state });
    }
    for (const [owner, state] of blob.aiStates ?? []) {
      aiStates.set(owner, {
        difficulty: state.difficulty,
        plan: state.plan as AiPlan,
        villagerTargets: { ...state.villagerTargets },
        attackGroup: [...state.attackGroup],
        lastDecisionTick: state.lastDecisionTick,
        lastEnemySightingTick: state.lastEnemySightingTick,
        lastEnemySightingPosition: state.lastEnemySightingPosition
          ? { x: state.lastEnemySightingPosition.x, y: state.lastEnemySightingPosition.y }
          : null,
      });
    }
    for (const [id, state] of blob.wildlifeStates) {
      const ref = state.targetEntityRef ? refFromSerialized(state.targetEntityRef) : null;
      wildlifeStates.set(id, {
        currentHp: state.currentHp,
        maxHp: state.maxHp,
        attackDamage: state.attackDamage,
        attackRange: state.attackRange,
        reloadTicks: state.reloadTicks,
        cooldownTicks: state.cooldownTicks,
        armor: state.armor,
        autoAggro: state.autoAggro,
        isAlive: state.isAlive,
        corpsePersists: state.corpsePersists,
        aggroRange: state.aggroRange,
        targetEntityRef: ref,
      });
    }

    matchState.outcome = savedGame.matchState.outcome;
    matchState.summary = savedGame.matchState.summary;
    matchState.winCondition = savedGame.matchState.winCondition;
    matchState.scores = savedGame.matchState.scores
      ? { ...savedGame.matchState.scores }
      : null;
    matchState.wonderCountdownTicks = savedGame.matchState.wonderCountdownTicks;
    matchState.relicCountdownTicks = savedGame.matchState.relicCountdownTicks;

    // Iter-3 V3-8: post-load entity-id key validation. Iter-1 H-3
    // closed this gap for the garrison cross-reference; this widens
    // the invariant to every entity-id-keyed side map. Orphans (keys
    // that don't resolve via world.getEntityRef) are silently
    // dropped — consumer code already guards against null components,
    // so the orphans were functionally harmless, but a partially
    // corrupt blob no longer leaks ghost state into the live world.
    const pruneOrphanEntityKeys = (sideMap: Map<number, unknown>): void => {
      for (const id of [...sideMap.keys()]) {
        if (!world.getEntityRef(id)) {
          sideMap.delete(id);
        }
      }
    };
    pruneOrphanEntityKeys(unitCommands);
    pruneOrphanEntityKeys(sheepMoveOrders);
    pruneOrphanEntityKeys(rallyPoints);
    pruneOrphanEntityKeys(monkTasks);
    pruneOrphanEntityKeys(conversionState);
    pruneOrphanEntityKeys(monkCarriedRelic);
    pruneOrphanEntityKeys(monkHealCounters);
    pruneOrphanEntityKeys(relicsInMonastery);
    pruneOrphanEntityKeys(wonderCountdowns);
    pruneOrphanEntityKeys(trebuchetPackStates);
    pruneOrphanEntityKeys(productionQueues);
    pruneOrphanEntityKeys(constructionStates);
    pruneOrphanEntityKeys(combatStates);
    pruneOrphanEntityKeys(buildingHealthStates);
    pruneOrphanEntityKeys(buildingCombatStates);
    pruneOrphanEntityKeys(wildlifeStates);
    pruneOrphanEntityKeys(garrisonedUnitVisionSources);
    // garrisonedByBuilding is keyed by building id; garrisonedUnitToBuilding
    // is keyed by unit id. Both need entity-id validation.
    pruneOrphanEntityKeys(garrisonedByBuilding);
    pruneOrphanEntityKeys(garrisonedUnitToBuilding);
  }

  isBootstrappingScenario = false;
  rebuildWorldOccupancyFromWorld();

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

  // (Cell passability factory call moved up to before the scenario spawn
  //  loop so its outputs are in scope at spawn-validation time.)

  // Movement plan ops live in `bridge/movementPlanOps`. The factory closes
  // over the per-unit path cache and the two passability predicates
  // (`isCellPassableForUnit` for units / `isCellPassableForWildlife` for
  // sheep/wildlife). Exposes the same set of plan helpers + the spatial
  // utility queries (uniquePositions, getCellsWithinRange,
  // getApproachCellsForFootprint, getNearestMoveCandidates).
  const {
    uniquePositions,
    getApproachCellsForFootprint,
    getNearestMoveCandidates,
    findMovementPlan,
    resolveMovePlanFromCache,
    findResourceApproachPlan,
    findBuildingApproachPlan,
    findUnitRangePlan,
    findWildlifeRangePlan,
  } = createMovementPlanOps({
    world,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    movePathCache,
    isCellPassableForUnit,
    isCellPassableForWildlife,
  });


  function findSafeSpawnPosition(candidates: Position[]): Position | null {
    // Slice 12 Task A: delegate the "cell passable + at least one passable
    // neighbor" rule to `findSafeSpawnWithEgress` so the scenario-spawn,
    // producer-spawn, and ungarrison flows share one egress definition.
    return findSafeSpawnWithEgress({
      candidates: uniquePositions(candidates),
      isCellPassable: (x, y) => isCellPassableForSpawn(x, y),
      neighborOffsets: CARDINAL_NEIGHBOR_OFFSETS,
    });
  }

  function findScenarioSpawnPosition(
    origin: Position,
  ): Position | null {
    return findSafeSpawnPosition(getNearestMoveCandidates(origin));
  }

  function findBuildingSpawnPosition(
    anchor: Position,
    buildingType: BuildingType,
  ): Position | null {
    const footprint = buildingFootprint(buildingType);
    return findSafeSpawnPosition(getApproachCellsForFootprint(anchor, footprint.width, footprint.height, 1));
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
    // Iter-3 V3-5: drop the throttle marker too so a brand-new gather
    // order from the player or AI doesn't inherit the previous order's
    // stuck window.
    gathererDropOffStuckSinceTick.delete(id);
  }

  // Visibility queries (isVisibleToHuman / isEntityFootprintVisibleToHuman /
  // getEntityVisibilityProbe / isEntityVisibleToHuman) live in
  // `bridge/visibilityQueries`.
  const {
    isVisibleToHuman,
    isEntityFootprintVisibleToHuman,
    isEntityVisibleToHuman,
  } = createVisibilityQueries({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
  });

  // Selection input ops + spatial-context helpers live in
  // `bridge/selectionInputOps`. The factory closes over the `selection`
  // holder so reads/writes go through one shared object.
  const {
    getSelectableEntitiesAtCell,
    filterSelectableUnitIds,
    selectUnitsByIds,
    selectUnitsInBox,
    selectOwnedUnitsByTypeInRect,
    getSelectedEntityIds,
    getSelectedEntityId,
    removeSelectedEntity,
    findResourceAtCell,
    resolveSelectionTile,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    findOwnedGarrisonBuildingAtCell,
    distanceToBuilding,
  } = createSelectionInputOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    visibility,
    constructionStates,
    wildlifeStates,
    selection,
    placementMode,
    isMatchRunning,
    isVisibleToHuman: (position, owner) => isVisibleToHuman(position, owner),
    isEntityFootprintVisibleToHuman: (position, owner, w, h) =>
      isEntityFootprintVisibleToHuman(position, owner, w, h),
    buildingOccupiesCell: (id, x, y) => buildingOccupiesCell(id, x, y),
    getEntityRef,
    getCurrentEntityId,
  });


  // Destroy ops live in `bridge/entityDestroyOps`. The factory closes over
  // every side map an entity might leave bookkeeping in.
  const {
    destroyUnitEntity,
    destroyBuildingEntity,
    killWildlifeEntity,
    destroyResourceEntity,
  } = createEntityDestroyOps({
    world,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    garrisonedUnitToBuilding,
    garrisonedByBuilding,
    garrisonedUnitVisionSources,
    population,
    combatStates,
    monkTasks,
    monkCarriedRelic,
    conversionState,
    monkHealCounters,
    trebuchetPackStates,
    gathererDropOffStuckSinceTick,
    townCenterRefs,
    productionQueues,
    rallyPoints,
    constructionStates,
    buildingHealthStates,
    buildingCombatStates,
    wonderCountdowns,
    relicsInMonastery,
    inFlightTechByOwner,
    wildlifeStates,
    sheepMoveOrders,
    removeSelectedEntity,
    clearUnitCommand,
    getApproachCellsForFootprint,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    addResourceEntity,
    markOutOfBandRenderChange,
  });


  // issueUnitMoveCommand / issueSheepMoveCommand / getSelectedOwnedSheepIds
  // / issueUnitAttackCommand moved to `bridge/unitCommandOps`. The factory
  // is invoked below after monkOps + trainingMarketOps + targetFindingOps
  // expose their own ops.

  // Training / research / market / construction / garrison ops live in
  // `bridge/trainingMarketOps`. Selection-clearing on garrison is provided
  // as a `clearSelection` collaborator so the side-state writes stay in
  // one place.
  const {
    enqueueTraining,
    enqueueResearch,
    executeMarketAction,
    garrisonUnit,
    ungarrisonBuilding,
    startConstruction,
    findBuildPlacementNear,
  } = createTrainingMarketOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    marketFeeRate: MARKET_FEE_RATE,
    marketTransactionAmount: MARKET_TRANSACTION_AMOUNT,
    marketRateStep: MARKET_RATE_STEP,
    marketMinRate: MARKET_MIN_RATE,
    playerResources,
    productionQueues,
    constructionStates,
    garrisonedByBuilding,
    garrisonedUnitToBuilding,
    garrisonedUnitVisionSources,
    marketExchangeRates,
    placementMode,
    inFlightTechSetFor,
    getSelectedEntityId: () => getSelectedEntityId(),
    getTrainOptions: (owner, buildingType) => getTrainOptions(owner, buildingType),
    getResearchOptions: (owner, buildingType) => getResearchOptions(owner, buildingType),
    getMarketOptions: (owner, buildingType) => getMarketOptions(owner, buildingType),
    getBuildOptions: (owner, unitType) => getBuildOptions(owner, unitType),
    isPlacementBlocked,
    isGarrisonedUnit,
    clearGathererOrder,
    clearUnitCommand,
    clearSelection: () => {
      selection.refs = [];
      selection.focusCell = null;
    },
    setUnitCommand,
    addBuildingEntity,
    findBuildingSpawnPosition,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
    getEntityRef,
    markOutOfBandRenderChange,
  });


  // Slice 7: train / research / market / build menus moved to
  // `bridge/optionsRules`. The factory closes over the same predicates the
  // rest of the bridge already exposes (age / civ / has-tech / has-building /
  // wonder presence) so the lookup logic stays identical.
  const {
    getTrainOptions,
    getResearchOptions,
    getVisibleResearchOptions,
    getMarketOptions,
    getBuildOptions,
  } = createOptionsRules({
    latestResearchedInChain,
    hasTechnology,
    getPlayerAge,
    isAtLeastAge,
    getPlayerCivilization,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    hasCompletedBuilding,
    hasOwnedWonder,
  });


  // Phase 3 target-finding ops. `targetPriority`,
  // `buildingTargetPriority`, and the `findPreferred*` /
  // `findNearest*` helpers live in `bridge/targetFindingOps`. The
  // factory closes over world + visibility + the three side maps
  // these helpers inspect.
  const {
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    findPreferredVisibleEnemyBuilding,
    findNearestDropOffBuilding,
    findNearestHostileWildlifeTarget,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
  } = createTargetFindingOps({
    world,
    visibility,
    combatStates,
    constructionStates,
    buildingHealthStates,
  });

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

  // Technology application + predecessor-line rewrites live in
  // `bridge/technologyOps`. The factory closes over the side maps
  // createWorld owns; the returned `applyTechnology` drives every
  // research-completion side effect.
  const { applyTechnology } = createTechnologyOps({
    world,
    researchedTechnologies,
    playerAges,
    combatStates,
    productionQueues,
    createCombatState,
    markOutOfBandRenderChange,
  });

  // Slice 10 AI decision helpers live in `bridge/aiDecisionOps`. The
  // factory closes over constructionStates + productionQueues (the two
  // side maps these helpers read) and receives findBuildPlacementNear
  // as a collaborator so Watch Tower placement keeps a single anchor-
  // computation site.
  const {
    isAiMilitaryUnit,
    findOwnedMilitaryUnits,
    ownedMilitaryUnitIds,
    pickWatchTowerPlacement,
    findIdleProducer,
    villagerRebalance,
  } = createAiDecisionOps({
    world,
    constructionStates,
    productionQueues,
    findBuildPlacementNear,
    aiWatchTowerForwardStep: AI_WATCH_TOWER_FORWARD_STEP,
  });

  // FU4: Monk task subsystem. Lives in `bridge/monkTaskOps` — the factory
  // closes over every side map and collaborator this subsystem mutates, so
  // the bridge file keeps only the side-map declarations, save/load
  // hydration, and destroy-entity cleanup hooks in one place. The 12
  // methods returned drive AI-side Monk task assignment, apply handlers
  // for each task kind, and the human-side context-click routing.
  const monkOps = createMonkTaskOps({
    world,
    monkTasks,
    monkCarriedRelic,
    monkHealCounters,
    monkConvertProcessedThisTick,
    conversionState,
    relicsInMonastery,
    combatStates,
    constructionStates,
    unitCommands,
    population,
    clearUnitCommand,
    clearGathererOrder,
    markOutOfBandRenderChange,
    getEntityRef,
    destroyResourceEntity,
    buildingOccupiesCell,
    issueUnitMoveCommand: (unitId, target) => issueUnitMoveCommand(unitId, target),
    isAiMilitaryUnit,
    isVisibleToOwner: (owner, x, y) => visibility.isVisible(owner, x, y),
    currentEntityId,
    unitTint,
    aiMonkHealHpFraction: AI_MONK_HEAL_HP_FRACTION,
    monkHealTickInterval: MONK_HEAL_TICK_INTERVAL,
    monkHealHpPerInterval: MONK_HEAL_HP_PER_INTERVAL,
    monkConvertProgressPerTick: MONK_CONVERT_PROGRESS_PER_TICK,
    monkConvertFlipThreshold: MONK_CONVERT_FLIP_THRESHOLD,
  });
  const {
    assignAiMonkTasks,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
    clearMonkTask,
    findMonkContextTargetAtCell,
    issueMonkContextCommandAtEntity,
  } = monkOps;

  // Per-unit command issuance + selectEntity{AtCell,ById}/clearSelection
  // live in `bridge/unitCommandOps`. These are the lower-level helpers
  // both the human-input surface and the AI call into. Wired here because
  // the factory's deps (monkOps, trainingMarketOps, targetFindingOps) are
  // all destructured above.
  const {
    issueUnitMoveCommand,
    issueSheepMoveCommand,
    getSelectedOwnedSheepIds,
    issueUnitAttackCommand,
    getSelectedHumanUnitIds,
    getSelectedHumanVillagerIds,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    selectEntityAtCell,
    selectEntityById,
    clearSelection,
  } = createUnitCommandOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    selection,
    placementMode,
    sheepMoveOrders,
    monkTasks,
    wildlifeStates,
    constructionStates,
    isMatchRunning,
    isEntityVisibleToHuman: (id) => isEntityVisibleToHuman(id),
    getSelectedEntityIds: () => getSelectedEntityIds(),
    getSelectableEntitiesAtCell: (x, y) => getSelectableEntitiesAtCell(x, y),
    findResourceAtCell: (x, y) => findResourceAtCell(x, y),
    findOwnedGarrisonBuildingAtCell: (x, y, owner, unitType) =>
      findOwnedGarrisonBuildingAtCell(x, y, owner, unitType),
    findHostileUnitAtCell: (x, y, owner) => findHostileUnitAtCell(x, y, owner),
    findHostileBuildingAtCell: (x, y, owner) => findHostileBuildingAtCell(x, y, owner),
    findHostileWildlifeAtCell: (x, y) => findHostileWildlifeAtCell(x, y),
    findMonkContextTargetAtCell,
    issueMonkContextCommandAtEntity,
    clearMonkTask,
    garrisonUnit,
    isHarvestableResource,
    findNearestDropOffBuilding,
    clearGathererOrder,
    clearUnitCommand,
    setUnitCommand,
    getEntityRef,
  });

  registerAiSystem({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
    townCenterRefs,
    aiStates,
    population,
    playerResources,
    constructionStates,
    productionQueues,
    unitCommands,
    wildlifeStates,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    findOwnedBuilding,
    findAvailableVillager,
    findOwnedUnit,
    findIdleProducer,
    ownedMilitaryUnitIds,
    findOwnedMilitaryUnits,
    hasOwnedWonder,
    isConstructingBuilding,
    pickWatchTowerPlacement,
    startConstruction,
    findBuildPlacementNear,
    countOwnedUnits,
    countQueuedUnits,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    enqueueResearch,
    enqueueTraining,
    getTrainOptions,
    getResearchOptions,
    assignAiMonkTasks,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    issueUnitAttackCommand,
    issueUnitMoveCommand,
  });


  registerAutoAggressionSystem({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    unitCommands,
    aiStates,
    combatStates,
    isGarrisonedUnit,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    issueUnitAttackCommand,
  });

  registerPlayerCommandsSystem({
    world,
    unitCommands,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    constructionStates,
    wildlifeStates,
    population,
    clearUnitCommand,
    currentEntityId,
    distanceToBuilding,
    advanceTrebuchetTransition,
    isTrebuchetStationary,
    isTrebuchetSilent,
    beginTrebuchetUnpack,
    beginTrebuchetPack,
    findUnitRangePlan,
    findBuildingApproachPlan,
    moveUnitOneSubgridStep,
    isUnitAtTarget,
    resolveMovePlanFromCache,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
    destroyUnitEntity,
    killWildlifeEntity,
    destroyBuildingEntity,
    getEntityRef,
    onBuildingConstructionComplete,
  });


  // (monkHealCounters + monkConvertProcessedThisTick are hoisted to the
  // top of `createWorld` so save/load can serialize the heal counter.
  // applyMonkHeal / applyMonkConvert / applyMonkPickup / applyMonkDeposit
  // live in `bridge/monkTaskOps`; they close over the same side maps.)


  registerMonkBehaviorSystem({
    world,
    monkTasks,
    monkConvertProcessedThisTick,
    monkCarriedRelic,
    distanceToBuilding,
    findBuildingApproachPlan,
    findUnitRangePlan,
    moveUnitOneSubgridStep,
    setPositionAndSyncOccupancy,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
  });

  registerRelicGoldSystem({ world, relicsInMonastery, playerResources });

  registerProductionQueueSystem({
    world,
    productionQueues,
    population,
    rallyPoints,
    inFlightTechByOwner,
    findBuildingSpawnPosition,
    addUnitEntity,
    issueUnitMoveCommand,
    applyTechnology,
  });

  registerScoutMovementSystem({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    unitCommands,
    isCellPassableForUnit,
    setPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
  });

  registerVillagerEconomySystem({
    world,
    unitCommands,
    sheepMoveOrders,
    gathererDropOffStuckSinceTick,
    playerResources,
    aiStates,
    shouldMaintainGatheringOrder,
    assignNearestResource,
    findResourceApproachPlan,
    isHarvestableResource,
    isUnitAtTarget,
    moveUnitOneSubgridStep,
    destroyResourceEntity,
    findNearestDropOffBuilding,
    findBuildingApproachPlan,
    ensurePlayerScoreCounters,
  });

  registerWildlifeCombatSystem({
    world,
    wildlifeStates,
    combatStates,
    currentEntityId,
    getEntityRef,
    findNearestHostileWildlifeTarget,
    findWildlifeRangePlan,
    setPositionAndSyncOccupancy,
    destroyUnitEntity,
    markOutOfBandRenderChange,
  });

  registerHerdableOwnershipSystem({ world, markOutOfBandRenderChange });

  registerHerdableMovementSystem({
    world,
    sheepMoveOrders,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    isCellPassableForWildlife,
    moveUnitOneSubgridStep,
    markOutOfBandRenderChange,
  });

  registerVisibilitySystem({ world, visibility, trackedVisibilitySources });

  registerFogMemorySystem({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
    getOrCreateMemoryMap,
  });

  registerTowerCombatSystem({
    world,
    constructionStates,
    buildingCombatStates,
    combatStates,
    garrisonedByBuilding,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    destroyUnitEntity,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
  });

  // Slice 8 + FU7 tune: score weights for the end-of-match summary.
  //
  //   units produced      × 10     (kept)
  //   buildings produced  × 50     (FU7: up from 25 — buildings last the
  //                                 whole game and represent the bulk of
  //                                 an economy's footprint, not just
  //                                 transient unit throughput.)
  //   resources gathered  × 0.02   (FU7: down from 0.05 — a raw-gather
  //                                 boom should not overwhelm combat.)
  //   relics held at end  × 50     (kept)
  //   enemy units killed  × 20     (FU7: NEW — rewards actually engaging
  //                                 enemy forces rather than just
  //                                 pumping out villagers.)
  //   wonder completed    × 500    (FU7: up from 200 — Wonder is the
  //                                 ultimate commit and deserves a
  //                                 bigger trophy.)
  //
  // These are intentionally simple so the summary is legible at a glance.
  // The weights are stable across win conditions — e.g. a conquest victor
  // who also completed a Wonder still gets the Wonder-bonus points.
  // Slice 8 + FU7: Wonder countdown decrement. Each owner's completed
  // Wonder ticks down a per-owner counter; when it reaches zero the entry
  // records `lastCompletedTick = world.tick`. The combined
  // `prototypeWinConditionResolver` downstream decides who actually wins
  // (Wonder / Relic) so the "first to complete" rule is explicit instead
  // of implicit system-registration order.
  registerWonderCountdownSystem({ world, wonderCountdowns, isMatchRunning });

  // Relic countdown system: see `bridge/systems/relicCountdownSystem`.
  registerRelicCountdownSystem({
    world,
    relicCountdowns,
    relicCountdownOverrides,
    currentRelicHoldingOwner,
    defaultRelicCountdownTicks: RELIC_COUNTDOWN_TICKS,
    isMatchRunning,
  });

  registerWinConditionResolverSystem({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    wonderCountdowns,
    relicCountdowns,
    isMatchRunning,
    finalizeMatchEnd,
  });

  registerConquestOutcomeSystem({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    playerResources,
    playerHasConquestPresence,
    isMatchRunning,
    finalizeMatchEnd,
  });

  syncVisibilitySources(world, visibility, trackedVisibilitySources);


  // getSelectedHumanUnitIds / getSelectedHumanVillagerIds /
  // issueUnitContextCommand / issueUnitGatherCommand /
  // issueUnitContextCommandAtEntity / selectEntityAtCell / selectEntityById
  // / clearSelection moved to `bridge/unitCommandOps` (see factory call
  // above the AI system registration).

  // Human-input command surface (issueMoveCommand / issueContextCommand /
  // issueContextCommandAtEntityInternal / queueTrainUnit / queueResearch /
  // issueAction / issueMarketAction) lives in `bridge/humanInputOps`. Each
  // wraps a lower-level helper with the match-running gate, the rally-point
  // branch for selected own buildings, and per-action rejection messages.
  const {
    issueMoveCommand,
    issueContextCommand,
    issueContextCommandAtEntityInternal,
    queueTrainUnit,
    queueResearch,
    issueAction,
    issueMarketAction,
  } = createHumanInputOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    playerResources,
    rallyPoints,
    constructionStates,
    placementMode,
    isMatchRunning,
    getSelectedEntityId: () => getSelectedEntityId(),
    getSelectedEntityIds: () => getSelectedEntityIds(),
    getSelectedOwnedSheepIds: () => getSelectedOwnedSheepIds(),
    getSelectedHumanUnitIds: () => getSelectedHumanUnitIds(),
    isEntityVisibleToHuman: (id) => isEntityVisibleToHuman(id),
    enqueueRejection,
    issueUnitMoveCommand,
    issueUnitContextCommand: (unitId, target) => issueUnitContextCommand(unitId, target),
    issueUnitContextCommandAtEntity: (unitId, targetEntityId) =>
      issueUnitContextCommandAtEntity(unitId, targetEntityId),
    issueSheepMoveCommand,
    enqueueTraining,
    enqueueResearch,
    executeMarketAction,
    ungarrisonBuilding,
  });


  // Phase 3 placement ops. The factory closes over the mutable
  // `placementMode` holder plus the bridge-local collaborators
  // (isMatchRunning, selection accessor, occupancy check, startConstruction,
  // enqueueRejection) so the three ops below match the pre-extraction
  // semantics byte-for-byte.
  const {
    getPlacementPreview,
    beginBuildingPlacement,
    confirmBuildingPlacement,
  } = createPlacementOps({
    world,
    playerResources,
    placementMode,
    isMatchRunning,
    getSelectedHumanVillagerIds,
    isPlacementBlocked,
    startConstruction,
    enqueueRejection,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
  });

  // Slice 9 + Phase 3: full-game serialization lives in
  // `bridge/saveGameOps`. The factory takes every persisted side map +
  // matchState + world/visibility references createWorld owns; the
  // returned `saveGame` produces the same blob as the pre-extraction
  // inline implementation.
  const { saveGame } = createSaveGameOps({
    world,
    visibility,
    getSeed: () => seed,
    matchState,
    trackedVisibilitySources,
    playerAges,
    playerCivilizations,
    researchedTechnologies,
    playerResources,
    marketExchangeRates,
    population,
    townCenterRefs,
    villagerOrdinals,
    unitCommands,
    sheepMoveOrders,
    rallyPoints,
    monkTasks,
    conversionState,
    monkCarriedRelic,
    monkHealCounters,
    relicsInMonastery,
    wonderCountdowns,
    wonderCountdownOverrides,
    relicCountdowns,
    relicCountdownOverrides,
    playerScoreCounters,
    trebuchetPackStates,
    lastSeenStatic,
    garrisonedByBuilding,
    garrisonedUnitToBuilding,
    garrisonedUnitVisionSources,
    productionQueues,
    constructionStates,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    wildlifeStates,
    aiStates,
  });

  return {
    world,
    saveGame,
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
            id,
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
            armor: combat?.armor ?? 0,
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
      // Mirror the authoritative matchState but always surface live
      // countdown values. The running-match path never writes the
      // countdown fields; the end-of-match `finalizeMatchEnd` path clears
      // them to null. Reading them lazily here keeps the HUD timer
      // current without needing to fan out from every countdown system.
      return {
        ...matchState,
        wonderCountdownTicks:
          matchState.outcome === 'running' ? getHumanWonderCountdownTicks() : null,
        relicCountdownTicks:
          matchState.outcome === 'running' ? getHumanRelicCountdownTicks() : null,
      };
    },
    getSelectionState,
    getPlacementPreview,
    getEntityHealth,
    selectEntityAtCell,
    selectEntityById,
    selectOwnedUnitsByTypeInRect,
    filterSelectableUnitIds,
    selectUnitsByIds,
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
    consumeCommandRejection,
    getDebugSnapshot,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  };
}

export interface CreateSimulationBridgeOptions {
  // Slice 9: when present, hydrate the new bridge from this save blob
  // instead of running the normal scenario bootstrap. The blob's
  // `schema` must equal `SAVE_SCHEMA_VERSION` exactly — the loader
  // throws on mismatch.
  savedGame?: SaveBlob;
}

export function createSimulationBridge(
  seed = DEFAULT_SEED,
  options: CreateSimulationBridgeOptions = {},
): SimulationBridge {
  const savedGame = options.savedGame;
  if (savedGame && savedGame.schema !== SAVE_SCHEMA_VERSION) {
    throw new Error(
      `Save schema mismatch: expected ${SAVE_SCHEMA_VERSION}, got ${savedGame.schema}.`,
    );
  }
  // When loading, the seed comes from the blob so the new World's
  // deterministic rng matches the original simulation byte-for-byte.
  const effectiveSeed = savedGame ? savedGame.seed : seed;
  const visibility = savedGame
    ? VisibilityMap.fromState(savedGame.visibility)
    : new VisibilityMap(MAP_WIDTH, MAP_HEIGHT);
  const {
    world,
    saveGame,
    getEconomyState,
    getPopulationState,
    getPlayerAge,
    getPlayerResources,
    getMatchState,
    getSelectionState,
    getPlacementPreview,
    getEntityHealth,
    selectEntityAtCell,
    selectEntityById,
    selectOwnedUnitsByTypeInRect,
    filterSelectableUnitIds,
    selectUnitsByIds,
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
    consumeCommandRejection,
    getDebugSnapshot,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  } =
    createWorld(effectiveSeed, visibility, savedGame);
  const renderStore = new RenderStore();
  const debuggerView = new WorldDebugger({ world });
  const renderAdapter = new RenderAdapter({
    world,
    projector: createProjector(visibility, HUMAN_PLAYER_ID, effectiveSeed, isSelected, getEntityHealth),
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

  // Iter-3 V3-19 / iter-1 H-4: per-tick memo for getRenderState. Bumped
  // every time the projector re-runs (out-of-band change consumed)
  // OR every world-tick (handled at the start of step()). The cache
  // key in getRenderState includes this counter so any change to the
  // projected entities invalidates the cache automatically.
  let renderStoreVersion = 0;
  let renderStateCache: {
    tick: number;
    renderStoreVersion: number;
    fogMemorySize: number;
    value: { tick: number; entities: ProjectedEntityView[]; frame: ProjectedFrameView | null };
  } | null = null;

  function flushOutOfBandRenderChange(): void {
    if (consumeOutOfBandRenderChange()) {
      refreshRenderProjection();
      renderStoreVersion += 1;
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

      // Iter-3 V3-19 (and prior iter-1 H-4): per-tick memo. Multiple
      // callers (HUD RAF, GameScene.syncFromBridge, browserTestApi
      // getSnapshot) call this within the same tick, and the work
      // below — filter every entity by isFootprintVisible, build a
      // dedupe Set, possibly merge memory entries, possibly re-sort
      // — is not cheap. A no-state-changed second call returns the
      // cached result.
      //
      // Cache key: (tick, renderStoreVersion, fogMemorySize). The
      // version counter is bumped whenever flushOutOfBandRenderChange
      // re-runs the projector (selection / construction-complete /
      // tech-upgrade / similar), so the cache is invalidated for any
      // mid-tick change that could affect the projected list.
      const currentTick = renderStore.getTick();
      const currentFogMemorySize = getHumanFogMemorySize();
      if (
        renderStateCache !== null
        && renderStateCache.tick === currentTick
        && renderStateCache.renderStoreVersion === renderStoreVersion
        && renderStateCache.fogMemorySize === currentFogMemorySize
      ) {
        return renderStateCache.value;
      }

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
      if (currentFogMemorySize === 0) {
        const value = {
          tick: currentTick,
          entities: liveEntities,
          frame: renderStore.getFrame(),
        };
        renderStateCache = {
          tick: currentTick,
          renderStoreVersion,
          fogMemorySize: currentFogMemorySize,
          value,
        };
        return value;
      }

      const liveIds = new Set<number>();
      for (const entity of liveEntities) {
        liveIds.add(entity.id);
      }
      const memoryEntities = getFogMemoryEntities(liveIds);
      if (memoryEntities.length === 0) {
        const value = {
          tick: currentTick,
          entities: liveEntities,
          frame: renderStore.getFrame(),
        };
        renderStateCache = {
          tick: currentTick,
          renderStoreVersion,
          fogMemorySize: currentFogMemorySize,
          value,
        };
        return value;
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
      const value = {
        tick: currentTick,
        entities: merged,
        frame: renderStore.getFrame(),
      };
      renderStateCache = {
        tick: currentTick,
        renderStoreVersion,
        fogMemorySize: currentFogMemorySize,
        value,
      };
      return value;
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
        seed: effectiveSeed,
        currentAge: getPlayerAge(HUMAN_PLAYER_ID),
        playerResources: getPlayerResources(HUMAN_PLAYER_ID),
        population: getPopulationState(HUMAN_PLAYER_ID),
        matchState: getMatchState(),
      };
    },
    getEconomyState,
    getPopulationState,
    getSelectionState,
    getMatchState,
    getPlacementPreview,
    // FU4: re-export `getEntityHealth` so vitest cases can probe AI-
    // owned unit health without going through the human-fog selection
    // path. Useful for AI-driven heal / convert / damage assertions
    // against entities the HUMAN_PLAYER_ID can't see.
    getEntityHealth,
    selectEntityAtCell,
    selectEntityById,
    selectOwnedUnitsByTypeInRect,
    filterSelectableUnitIds,
    selectUnitsByIds,
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
    consumeCommandRejection,
    getDebugSnapshot,
    saveGame,
  };
}
