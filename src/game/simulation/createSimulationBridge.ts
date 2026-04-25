import {
  findGridPath,
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
  isSameEntity,
  currentEntityId,
  cloneResources,
  defaultCivilizationName,
  factionName,
  inventoryResourceName,
  economyResourceLabel,
  createInitialMarketRates,
  isAtTarget,
  clonePosition,
  getUnitTargetTransformForCell,
  clampUnitTransformToMap,
  gridPositionFromUnitTransform,
  isUnitTransformAtTarget,
  stepUnitTransformToward,
  assignVillagerRole,
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
  UNIT_SUBGRID_STEP_PER_TICK,
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
import { createTargetFindingOps } from './bridge/targetFindingOps';
import {
  DEFAULT_SEED,
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
  TPS,
  createPrototypeScenario,
} from './prototypeScenario';
import {
  buildingArrowCount,
  buildingBuildTimeTicks,
  buildingGarrisonCapacity,
  buildingMaxHp,
  buildingPopulationProvided,
  buildingSize,
  buildingTint,
  buildingVisionRadius,
  canGarrisonAt,
  canResearchAt,
  canTrainAt,
  createBuildingCombatState,
  isCastleAgePrerequisiteBuilding,
  isDarkAgePrerequisiteBuilding,
  isFeudalAgePrerequisiteBuilding,
} from './prototypeBuildingRules';
import {
  canAfford,
  constructionCost,
  gatherAmountFor,
  gatherTicksFor,
  isBuyMarketAction,
  marketCommodityForAction,
  researchCost,
  researchTimeTicks,
  resourceKindToEconomyResource,
  resourceTint,
  resourcesMissing,
  spendResources,
  trainingCost,
  trainingTimeTicks,
} from './prototypeEconomyRules';
import {
  attackBonusAgainstBuilding,
  attackBonusAgainstUnit,
  createWildlifeState,
  isArcherLineUnit,
  isCavalryUnit,
  isGunpowderUnit,
  isInfantryUnit,
  isMeleeUnit,
  isStaticMemorableResourceType,
  isWildlifeResourceType,
  unitAttackDamage,
  unitAttackRange,
  unitMaxHp,
  unitMinAttackRange,
  unitReloadTicks,
  unitSize,
  unitTint,
  unitVisionRadius,
} from './prototypeUnitRules';
import { RenderStore } from './renderStore';
import { SAVE_SCHEMA_VERSION, type SaveBlob } from './saveSchema';
import { findSafeSpawnWithEgress } from './spawn';
import { latestResearchedInChain as latestResearchedInChainExternal } from './upgradeChains';
import { createWorldOccupancy } from './worldOccupancy';
import {
  computeUnitActivity,
  getBuildingActivity,
  getSelectionActivityBreakdown,
  type SelectionActivitySources,
} from './selectionActivity';
import {
  AI_BASE_VISION_RADIUS,
  AI_MONK_COUNT_CAP,
  AI_MONK_HEAL_HP_FRACTION,
  AI_WATCH_TOWER_FORWARD_STEP,
  DEFAULT_DIFFICULTY,
  ageUpResourceBuffer,
  attackGroupSize,
  decisionIntervalTicks,
  gatherMultiplier,
  pickNextAgeResearch,
  pickNextBuildTarget,
  pickUnitMix,
  planForAge,
  shouldPursueWonder,
  villagerTargetsEqual,
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
  ResearchableTechnologyType,
  RenderState,
  RenderableComponent,
  ResourceComponent,
  ResourceKind,
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

// Snapshot of a static entity (building or resource) captured the last time the player saw
// it. Used by fog memory rendering. Purely a data value — no ECS component involved — so it
// survives after the source entity is destroyed or leaves vision.
export interface MemoryEntry {
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
const MONK_ACTION_RANGE = 4;
const MARKET_TRANSACTION_AMOUNT = 100;
const MARKET_FEE_RATE = 0.3;
const MARKET_RATE_STEP = 3;
const MARKET_MIN_RATE = 20;
const SHEEP_SUBGRID_STEP_PER_TICK = 1;
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
  // shrink it for test speed.
  interface WonderCountdownEntry {
    remainingTicks: number;
    totalTicks: number;
    // FU7: records the `world.tick` at which the countdown hit zero.
    // Null while a countdown is still in flight. Read by the combined
    // Wonder/Relic winner resolver so the "first to complete" rule is
    // explicit rather than implicit system-registration order.
    lastCompletedTick: number | null;
  }
  const wonderCountdowns = new Map<number, WonderCountdownEntry>();
  const wonderCountdownOverrides = new Map<number, number>();
  // Slice 8: Relic victory state. Countdown starts as soon as one owner
  // holds every relic on the map inside their Monasteries. Decrements
  // every tick. At 0 the owner wins by Relic victory. If the ownership
  // picture changes (a relic drops, a relic is picked up by another
  // Monk, etc.) the countdown resets to null.
  interface RelicCountdownEntry {
    remainingTicks: number;
    totalTicks: number;
    // FU7: see WonderCountdownEntry.lastCompletedTick.
    lastCompletedTick: number | null;
  }
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
  let selectedEntityRefs: EntityRef[] = [];
  let selectionFocusCell: Position | null = null;
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
    if (unit) {
      return combatStates.get(id)?.armor ?? 0;
    }

    if (building) {
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
      setPositionAndSyncOccupancy(id, nextGridPosition, activeWorld);
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
      armor: 0,
    };

    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'fletching')) {
      state.attackDamage += 1;
      state.attackRange += 1;
    }
    // FU1: Castle archer-line attack/range tech. Stacks on top of Fletching.
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'bodkin-arrow')) {
      state.attackDamage += 1;
      state.attackRange += 1;
    }

    // Slice 7E Blacksmith Imperial tier. Each tech stacks independently on
    // top of the base stats so a player who has researched Fletching + Bracer
    // sees +2 atk / +2 range on any archer-line unit (newly trained or
    // mutated by an Imperial upgrade).
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'bracer')) {
      state.attackDamage += 1;
      state.attackRange += 1;
    }
    if (isMeleeUnit(unitType) && hasTechnology(owner, 'blast-furnace')) {
      state.attackDamage += 2;
    }
    if (isInfantryUnit(unitType) && hasTechnology(owner, 'plate-mail-armor')) {
      state.armor += 1;
    }
    if (isCavalryUnit(unitType) && hasTechnology(owner, 'plate-barding')) {
      state.armor += 1;
    }

    // FU1: Feudal melee attack tech. Stacks with Iron Casting + Blast Furnace.
    if (isMeleeUnit(unitType) && hasTechnology(owner, 'forging')) {
      state.attackDamage += 1;
    }
    // FU1: Castle melee attack tech. Stacks with Forging + Blast Furnace.
    if (isMeleeUnit(unitType) && hasTechnology(owner, 'iron-casting')) {
      state.attackDamage += 1;
    }
    // FU1: Feudal / Castle infantry armor chain.
    if (isInfantryUnit(unitType) && hasTechnology(owner, 'scale-mail-armor')) {
      state.armor += 1;
    }
    if (isInfantryUnit(unitType) && hasTechnology(owner, 'chain-mail-armor')) {
      state.armor += 1;
    }
    // FU1: Feudal / Castle cavalry armor chain.
    if (isCavalryUnit(unitType) && hasTechnology(owner, 'scale-barding-armor')) {
      state.armor += 1;
    }
    if (isCavalryUnit(unitType) && hasTechnology(owner, 'chain-barding-armor')) {
      state.armor += 1;
    }
    // FU1: Feudal / Castle / Imperial archer armor chain.
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'padded-archer-armor')) {
      state.armor += 1;
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'leather-archer-armor')) {
      state.armor += 1;
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'ring-archer-armor')) {
      state.armor += 1;
    }
    // FU1: Chemistry grants +1 attack to archer-line and gunpowder units.
    if (
      (isArcherLineUnit(unitType) || isGunpowderUnit(unitType))
      && hasTechnology(owner, 'chemistry')
    ) {
      state.attackDamage += 1;
    }

    return state;
  }

  function syncOccupancyForEntity(
    entity: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): void {
    const position = activeWorld.getComponent<Position>(entity, 'position');
    if (!position) {
      worldOccupancy.release(entity);
      return;
    }

    const building = activeWorld.getComponent<BuildingComponent>(entity, 'building');
    if (building) {
      const construction = constructionStates.get(entity);
      const footprint = construction ?? buildingFootprint(building.buildingType);
      worldOccupancy.syncBuilding(entity, position, footprint);
      return;
    }

    if (activeWorld.getComponent<ResourceComponent>(entity, 'resource')) {
      worldOccupancy.syncResource(entity, position);
      return;
    }

    if (activeWorld.getComponent<UnitComponent>(entity, 'unit')) {
      worldOccupancy.syncUnit(entity, position);
      return;
    }

    worldOccupancy.release(entity);
  }

  function setPositionAndSyncOccupancy(
    entity: number,
    position: Position,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): void {
    activeWorld.setPosition(entity, position);
    syncOccupancyForEntity(entity, activeWorld);
  }

  function clearPositionAndSyncOccupancy(
    entity: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): void {
    worldOccupancy.release(entity);
    activeWorld.removeComponent(entity, 'position');
  }

  function syncSpawnedEntityOccupancy(entity: number): void {
    if (!isBootstrappingScenario) {
      syncOccupancyForEntity(entity);
      return;
    }

    try {
      syncOccupancyForEntity(entity);
    } catch {
      // Fresh-scenario validation should own the user-facing error for
      // invalid fixture spawns so the thrown message still names the
      // offending seed instead of leaking an occupancy-grid internals
      // error first.
    }
  }

  function rebuildWorldOccupancyFromWorld(): void {
    worldOccupancy.reset();

    const blockedTerrainCells: Position[] = [];
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const tile = tiles[y]?.[x];
        const terrain = tile === undefined ? null : world.getComponent<TerrainComponent>(tile, 'terrain');
        if (!terrain || (terrain.kind !== 'water' && terrain.kind !== 'forest')) {
          continue;
        }

        blockedTerrainCells.push({ x, y });
      }
    }
    worldOccupancy.blockTerrain(blockedTerrainCells);

    for (const entity of world.query('position', 'building')) {
      syncOccupancyForEntity(entity);
    }
    for (const entity of world.query('position', 'resource')) {
      syncOccupancyForEntity(entity);
    }
    for (const entity of world.query('position', 'unit')) {
      syncOccupancyForEntity(entity);
    }
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

    // Slice 8: count every unit that enters the world (scenario spawns +
    // trained units) toward the owner's score. This keeps fixtures with
    // pre-placed armies comparable to ones that grow from nothing.
    ensurePlayerScoreCounters(owner).unitsProduced += 1;

    combatStates.set(entity, createCombatState(owner, unitType));

    // FU7: a freshly-trained (or scenario-spawned) Trebuchet starts packed
    // so it can walk out of the producing Castle to a staging position
    // exactly like any other siege unit. The unpack transition is gated on
    // an attack order reaching a target within range.
    if (unitType === 'trebuchet') {
      trebuchetPackStates.set(entity, {
        packed: true,
        transitionTicksRemaining: 0,
      });
    }

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

    syncSpawnedEntityOccupancy(entity);

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
    } else {
      // Slice 8: fixtures can spawn a completed Wonder directly (skipping
      // the construction flow); propagate that into the score + countdown
      // state so the Wonder-victory pipeline is identical to the "player
      // just finished building their Wonder" path.
      onBuildingConstructionComplete(entity, owner, buildingType);
    }

    syncSpawnedEntityOccupancy(entity);

    return entity;
  }

  // Slice 8: invoked whenever a building transitions to complete — both at
  // scenario-spawn time (isComplete=true in addBuildingEntity) and from
  // the construction-progress loop in `prototypePlayerCommands`. Keeps the
  // score counter bumps and Wonder countdown-start logic in one place so
  // the two entry points cannot drift.
  function onBuildingConstructionComplete(
    buildingId: number,
    owner: number,
    buildingType: BuildingType,
  ): void {
    const counters = ensurePlayerScoreCounters(owner);
    counters.buildingsProduced += 1;
    if (buildingType === 'wonder') {
      counters.wonderCompleted = true;
      const totalTicks = wonderCountdownOverrides.get(owner) ?? WONDER_COUNTDOWN_TICKS;
      wonderCountdowns.set(buildingId, {
        remainingTicks: totalTicks,
        totalTicks,
        lastCompletedTick: null,
      });
    }
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

    syncSpawnedEntityOccupancy(entity);

    return entity;
  }

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

  function isCellBlockedByBuilding(x: number, y: number): boolean {
    return worldOccupancy.isCellBlockedByBuilding(x, y);
  }

  function isCellBlockedByResource(
    x: number,
    y: number,
    ignoredResourceId: number | null = null,
  ): boolean {
    return worldOccupancy.isCellBlockedByResource(x, y, ignoredResourceId);
  }

  function isCellPassableForSpawn(x: number, y: number): boolean {
    return worldOccupancy.isCellPassableForSpawn(x, y);
  }

  function isCellPassableForUnit(
    unitId: number,
    x: number,
    y: number,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): boolean {
    // Movement-planning helpers share an entity-aware callback shape even
    // though coarse-cell unit crowding is intentionally ignored for pathing.
    void unitId;
    void activeWorld;
    return isCellPassableForSpawn(x, y);
  }

  function isCellPassableForWildlife(
    resourceId: number,
    x: number,
    y: number,
  ): boolean {
    return worldOccupancy.isCellPassableForWildlife(resourceId, x, y);
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
    return worldOccupancy.isPlacementBlocked(x, y, width, height);
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

  function findMovementPathToCandidates(
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
  ): ResolvedMovementPath | null {
    const uniqueCandidates = uniquePositions(candidates).filter((candidate) =>
      isPassable(unitId, candidate.x, candidate.y, activeWorld),
    );

    if (preferCurrentCell) {
      const currentCellCandidate = uniqueCandidates.find(
        (candidate) => candidate.x === start.x && candidate.y === start.y,
      );
      if (currentCellCandidate) {
        return {
          destination: clonePosition(currentCellCandidate),
          path: [clonePosition(start)],
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
        destination: clonePosition(destination),
        // Clone the A* output before caching or shaping it so callers never
        // depend on civ-engine reusing returned Position objects or arrays.
        path: pathResult.path.map((step) => clonePosition(step)),
      };
    }

    return null;
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
    const movementPath = findMovementPathToCandidates(
      unitId,
      start,
      candidates,
      preferCurrentCell,
      activeWorld,
      isPassable,
    );
    if (movementPath) {
      return {
        destination: movementPath.destination,
        nextStep: movementPath.path[1] ?? movementPath.destination,
      };
    }

    return null;
  }

  function resolveMovePlanFromCache(
    unitId: number,
    target: Position,
    activeWorld: World<GameEvents, GameCommands> = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    if (!position) {
      movePathCache.delete(unitId);
      return null;
    }

    const cachedMovePath = movePathCache.get(unitId);
    if (cachedMovePath) {
      while (
        cachedMovePath.nextPathIndex < cachedMovePath.path.length
        && isAtTarget(position, cachedMovePath.path[cachedMovePath.nextPathIndex]!)
      ) {
        cachedMovePath.nextPathIndex += 1;
      }

      const previousPathIndex = Math.max(0, cachedMovePath.nextPathIndex - 1);
      const previousStep = cachedMovePath.path[previousPathIndex];
      if (!isAtTarget(cachedMovePath.destination, target)
        // This cache is intentionally move-only, so the "has the original
        // click target opened up?" check uses move-command passability.
        && isCellPassableForUnit(unitId, target.x, target.y, activeWorld)) {
        // A blocked click target can become free while the unit is still
        // following the old fallback route (for example when a tree is
        // chopped down). Drop the cached fallback immediately so we
        // re-solve toward the player's real click target on this tick.
        movePathCache.delete(unitId);
      } else if (
        previousStep
        && isAtTarget(position, previousStep)
      ) {
        const nextStep = cachedMovePath.path[cachedMovePath.nextPathIndex] ?? cachedMovePath.destination;
        if (
          isAtTarget(position, cachedMovePath.destination)
          && !isAtTarget(cachedMovePath.destination, target)
        ) {
          // If we cached a "nearest reachable fallback" because the clicked
          // cell was blocked earlier, re-check the real target once we reach
          // that fallback before deciding the move order is finished.
          movePathCache.delete(unitId);
        } else {
          // Move-command passability ignores other units, so validating the
          // immediate next cell is enough to keep the cached route honest
          // without re-solving the whole path every tick.
          if (
            isAtTarget(position, nextStep)
            || isCellPassableForUnit(unitId, nextStep.x, nextStep.y, activeWorld)
          ) {
            return {
              destination: cachedMovePath.destination,
              nextStep,
            };
          }
        }
      }
    }

    const refreshedMovementPath = findMovementPathToCandidates(
      unitId,
      position,
      getNearestMoveCandidates(target),
      false,
      activeWorld,
      isCellPassableForUnit,
    );
    if (!refreshedMovementPath) {
      movePathCache.delete(unitId);
      return null;
    }
    const refreshedMovePath: CachedMovePath = {
      destination: refreshedMovementPath.destination,
      path: refreshedMovementPath.path,
      nextPathIndex: refreshedMovementPath.path.length > 1 ? 1 : 0,
    };
    movePathCache.set(unitId, refreshedMovePath);

    return {
      destination: refreshedMovePath.destination,
      nextStep: refreshedMovePath.path[refreshedMovePath.nextPathIndex] ?? refreshedMovePath.destination,
    };
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
      placementMode.current = null;
      return false;
    }

    placementMode.current = null;
    return true;
  }

  function filterSelectableUnitIds(ids: number[]): number[] {
    if (!isMatchRunning()) {
      return [];
    }

    const dedupedIds: number[] = [];
    const seenIds = new Set<number>();
    for (const id of ids) {
      if (seenIds.has(id)) {
        continue;
      }
      seenIds.add(id);

      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (unit) {
        const position = world.getComponent<Position>(id, 'position');
        if (position && unit.owner === HUMAN_PLAYER_ID && isVisibleToHuman(position, unit.owner)) {
          dedupedIds.push(id);
        }
        continue;
      }

      const position = world.getComponent<Position>(id, 'position');
      const resource = world.getComponent<ResourceComponent>(id, 'resource');
      if (
        position
        && resource
        && resource.resourceType === 'sheep'
        && resource.owner === HUMAN_PLAYER_ID
        && resource.amount > 0
        && isVisibleToHuman(position, resource.owner)
      ) {
        dedupedIds.push(id);
      }
    }

    return dedupedIds;
  }

  function selectUnitsByIds(ids: number[]): boolean {
    return selectUnitIds(filterSelectableUnitIds(ids));
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
        placementMode.current = null;
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
      placementMode.current = null;
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
      placementMode.current = null;
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

    clearUnitCommand(id);
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
    // FU7: release trebuchet pack-state bookkeeping on destroy.
    trebuchetPackStates.delete(id);
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
    // Slice 8: a destroyed Wonder invalidates its owner's countdown. The
    // wonderCompleted score counter stays set (the player still earned
    // the "you committed to a Wonder" credit even if they lost it) but
    // the countdown is wiped so no Wonder victory fires from a ghost
    // entry. Clearing per-entity keeps the per-owner bookkeeping simple.
    wonderCountdowns.delete(id);
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
    setUnitCommand(unitId, {
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
    setUnitCommand(unitId, {
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
    clearUnitCommand(unitId);

    const visionSource = world.getComponent<VisionSourceComponent>(unitId, 'visionSource');
    if (visionSource) {
      garrisonedUnitVisionSources.set(unitId, { ...visionSource });
      world.removeComponent(unitId, 'visionSource');
    }

    clearPositionAndSyncOccupancy(unitId);
    garrisonedUnitToBuilding.set(unitId, buildingId);
    currentUnits.push(unitId);
    garrisonedByBuilding.set(buildingId, currentUnits);
    selectedEntityRefs = [];
    selectionFocusCell = null;
    placementMode.current = null;
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

      setPositionAndSyncOccupancy(unitId, spawnPosition);
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
    setUnitCommand(builderId, {
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

  // Slice 10 AI helper. Returns true if the owner has any in-progress
  // (not-yet-complete) building of the given type. Used by the AI's
  // build loop so it doesn't stack overlapping House placements while
  // one is already being raised. Construction-complete or unknown-
  // construction buildings do not count here.
  function isConstructingBuilding(owner: number, buildingType: BuildingType): boolean {
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!building || building.owner !== owner || building.buildingType !== buildingType) {
        continue;
      }
      const construction = constructionStates.get(id);
      if (construction && !construction.isComplete) {
        return true;
      }
    }
    return false;
  }

  // Slice 8: owner already has a Wonder on the board (in construction OR
  // complete). Used to cap the number of Wonders per player to one and to
  // drive the countdown-start/reset logic in `prototypeWonderCountdown`.
  // Both in-flight and finished Wonders count — otherwise the player could
  // queue up a replacement while the original is still standing, which
  // defeats the "commit and defend" tension of the Wonder victory path.
  function hasOwnedWonder(owner: number): boolean {
    for (const id of world.query('building')) {
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (building?.owner === owner && building.buildingType === 'wonder') {
        return true;
      }
    }
    return false;
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

  // Thin wrapper around the shared `latestResearchedInChain` helper that
  // binds the closure-local `hasTechnology` so callsites stay terse.
  function latestResearchedInChain(
    owner: number,
    chain: readonly [
      TrainableUnitType,
      ...Array<[TrainableUnitType, ResearchableTechnologyType]>,
    ],
  ): TrainableUnitType {
    return latestResearchedInChainExternal(owner, chain, hasTechnology);
  }

  function getTrainOptions(owner: number, buildingType: BuildingType): TrainableUnitType[] {
    switch (buildingType) {
      case 'town-center':
        return ['villager'];
      case 'barracks': {
        // FU2: Militia → Man-at-Arms → Long Swordsman → Two-Handed
        // Swordsman → Champion (five tiers). Spearman → Pikeman →
        // Halberdier (three tiers). Only the newest tier of each line
        // is exposed at any time so the menu always shows the latest
        // and drops the predecessor.
        const militiaLine = latestResearchedInChain(owner, [
          'militia',
          ['man-at-arms', 'man-at-arms-upgrade'],
          ['long-swordsman', 'long-swordsman-upgrade'],
          ['two-handed-swordsman', 'two-handed-swordsman-upgrade'],
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
        // Scout → Light Cavalry → Hussar (three tiers). Knight →
        // Cavalier → Paladin (three tiers in FU2). Camel → Heavy Camel
        // (two tiers in FU2).
        const scoutLine = latestResearchedInChain(owner, [
          'scout',
          ['light-cavalry', 'light-cavalry-upgrade'],
          ['hussar', 'hussar-upgrade'],
        ]);
        if (isAtLeastAge(owner, 'castle-age')) {
          const knightLine = latestResearchedInChain(owner, [
            'knight',
            ['cavalier', 'cavalier-upgrade'],
            ['paladin', 'paladin-upgrade'],
          ]);
          const camelLine = latestResearchedInChain(owner, [
            'camel',
            ['heavy-camel', 'heavy-camel-upgrade'],
          ]);
          return [scoutLine, knightLine, camelLine];
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
        // Bombard Cannon is Imperial-only, has no upgrade predecessor,
        // and is a gunpowder unit that requires Chemistry research
        // before it can be trained (matches AoE2 DE canon).
        if (isAtLeastAge(owner, 'imperial-age') && hasTechnology(owner, 'chemistry')) {
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

    if (buildingType === 'blacksmith' && getPlayerAge(owner) !== 'dark-age') {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'fletching')) {
        options.push('fletching');
      }
      // FU1: Feudal Blacksmith tier — independent one-shot upgrades.
      // Forging +1 melee attack, Scale Mail / Scale Barding / Padded
      // Archer each +1 armor to their respective unit bucket.
      if (!hasTechnology(owner, 'forging')) {
        options.push('forging');
      }
      if (!hasTechnology(owner, 'scale-mail-armor')) {
        options.push('scale-mail-armor');
      }
      if (!hasTechnology(owner, 'scale-barding-armor')) {
        options.push('scale-barding-armor');
      }
      if (!hasTechnology(owner, 'padded-archer-armor')) {
        options.push('padded-archer-armor');
      }
      // FU1: Castle Blacksmith tier — stacks on Feudal tier. Independent
      // of prerequisite (canonical AoE2 does NOT require the predecessor
      // tech).
      if (isAtLeastAge(owner, 'castle-age')) {
        if (!hasTechnology(owner, 'iron-casting')) {
          options.push('iron-casting');
        }
        if (!hasTechnology(owner, 'chain-mail-armor')) {
          options.push('chain-mail-armor');
        }
        if (!hasTechnology(owner, 'chain-barding-armor')) {
          options.push('chain-barding-armor');
        }
        if (!hasTechnology(owner, 'leather-archer-armor')) {
          options.push('leather-archer-armor');
        }
        if (!hasTechnology(owner, 'bodkin-arrow')) {
          options.push('bodkin-arrow');
        }
      }
      // Slice 7E + FU1: Imperial Blacksmith tier. Each independent
      // one-shot upgrade — researched order doesn't matter, bonuses
      // stack multiplicatively via createCombatState + the per-tech
      // callback.
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'bracer')) {
          options.push('bracer');
        }
        if (!hasTechnology(owner, 'blast-furnace')) {
          options.push('blast-furnace');
        }
        if (!hasTechnology(owner, 'plate-mail-armor')) {
          options.push('plate-mail-armor');
        }
        if (!hasTechnology(owner, 'plate-barding')) {
          options.push('plate-barding');
        }
        if (!hasTechnology(owner, 'ring-archer-armor')) {
          options.push('ring-archer-armor');
        }
        if (!hasTechnology(owner, 'chemistry')) {
          options.push('chemistry');
        }
      }
      if (options.length > 0) {
        return options;
      }
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

    // FU2: Barracks exposes the militia-line chain earlier than Castle
    // Age so the Feudal Man-at-Arms upgrade is reachable once Feudal
    // Age opens. Pikeman + Halberdier + Champion retain their original
    // Castle / Imperial gating.
    if (buildingType === 'barracks' && getPlayerAge(owner) !== 'dark-age') {
      const options: ResearchableTechnologyType[] = [];
      // Feudal Barracks — Man-at-Arms.
      if (!hasTechnology(owner, 'man-at-arms-upgrade')) {
        options.push('man-at-arms-upgrade');
      }
      if (isAtLeastAge(owner, 'castle-age')) {
        if (!hasTechnology(owner, 'pikeman-upgrade')) {
          options.push('pikeman-upgrade');
        }
        if (!hasTechnology(owner, 'long-swordsman-upgrade')) {
          options.push('long-swordsman-upgrade');
        }
      }
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'halberdier-upgrade')) {
          options.push('halberdier-upgrade');
        }
        if (!hasTechnology(owner, 'two-handed-swordsman-upgrade')) {
          options.push('two-handed-swordsman-upgrade');
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
        // FU2: Paladin research requires Cavalier already researched
        // (canonical AoE2 DE prerequisite chain). Heavy Camel has no
        // predecessor upgrade so it is available immediately in
        // Imperial Age. Both disappear from the list once researched.
        if (
          hasTechnology(owner, 'cavalier-upgrade')
          && !hasTechnology(owner, 'paladin-upgrade')
        ) {
          options.push('paladin-upgrade');
        }
        if (!hasTechnology(owner, 'heavy-camel-upgrade')) {
          options.push('heavy-camel-upgrade');
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
      // FU3: Palisade Wall unlocks in Feudal Age — the cheap wood wall
      // that shapes early-game pokes. Matches canonical AoE2 DE.
      options.push('palisade-wall');
    }

    if (getPlayerAge(owner) === 'castle-age' || getPlayerAge(owner) === 'imperial-age') {
      options.push('town-center');
      options.push('siege-workshop');
      options.push('monastery');
      options.push('castle');
      // FU3: Stone Wall unlocks in Castle Age. Arena-style maps rely on
      // this building replacing the legacy stone-mine wall proxy.
      options.push('stone-wall');
    }

    // Slice 8: Wonder is Imperial-only AND capped at one per owner. When
    // a Wonder already exists for this owner (construction-in-progress or
    // complete), hide it from placement options — the game-mechanism
    // guarantee that only one Wonder-countdown is ever in flight per
    // player. The current hasOwnedWonder() check counts both in-progress
    // and completed Wonders via the building component.
    if (getPlayerAge(owner) === 'imperial-age' && !hasOwnedWonder(owner)) {
      options.push('wonder');
    }

    return options;
  }

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
    issueUnitMoveCommand,
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

      const currentTick = activeWorld.tick;

      for (const [owner, state] of aiStates.entries()) {
        // Decision gating: the AI loop body runs once every N ticks.
        // Between decisions, military units stay on whatever attack
        // command the last decision issued — that carries the push
        // forward without the AI having to re-issue orders every tick.
        const interval = decisionIntervalTicks(state.difficulty);
        if (state.lastDecisionTick >= 0 && currentTick - state.lastDecisionTick < interval) {
          continue;
        }
        state.lastDecisionTick = currentTick;

        const ownerTownCenterId = currentEntityId(activeWorld, townCenterRefs.get(owner));
        const ownerTownCenterPosition =
          ownerTownCenterId === null
            ? null
            : activeWorld.getComponent<Position>(ownerTownCenterId, 'position');

        // Plan drifts to match the current age every decision tick.
        const currentAge = getPlayerAge(owner);
        const nextPlan = planForAge(currentAge);
        if (state.plan !== 'defend' && state.plan !== nextPlan) {
          state.plan = nextPlan;
        }

        // Keep the villager-targets entry in sync with the plan. The
        // bridge rebalances at most one villager per decision tick so
        // the economy nudges steadily toward the target without
        // whiplash.
        const desiredTargets = villagerTargetsForAge(currentAge);
        if (!villagerTargetsEqual(state.villagerTargets, desiredTargets)) {
          state.villagerTargets = { ...desiredTargets };
        }
        villagerRebalance(owner, state.villagerTargets);

        // Scouting response: scan for enemy units within the "near
        // base" radius. If any are visible, record the sighting so the
        // build-order loop below knows to commit a Watch Tower on the
        // way to the threat.
        if (ownerTownCenterPosition) {
          for (const enemyId of activeWorld.queryInRadius(
            ownerTownCenterPosition.x,
            ownerTownCenterPosition.y,
            AI_BASE_VISION_RADIUS,
            'position',
            'unit',
          )) {
            const enemyUnit = activeWorld.getComponent<UnitComponent>(enemyId, 'unit');
            const enemyPos = activeWorld.getComponent<Position>(enemyId, 'position');
            if (
              !enemyUnit
              || !enemyPos
              || enemyUnit.owner === owner
              || !visibility.isVisible(owner, enemyPos.x, enemyPos.y)
            ) {
              continue;
            }
            state.lastEnemySightingTick = currentTick;
            state.lastEnemySightingPosition = { x: enemyPos.x, y: enemyPos.y };
            break;
          }
        }

        const populationState = population.get(owner);
        const populationBlocked = Boolean(
          populationState && populationState.current >= populationState.cap,
        );

        // Build-order loop: pick the next missing building (houses,
        // gather camps, military buildings, age prerequisites) and
        // dispatch an idle villager to place it. The scouting-response
        // check wedges a Watch Tower into the build order when an
        // enemy has been spotted within the last decision interval.
        if (ownerTownCenterPosition) {
          const sightingFresh =
            state.lastEnemySightingTick >= 0
            && currentTick - state.lastEnemySightingTick <= interval * 2;
          if (
            sightingFresh
            && state.lastEnemySightingPosition
            && !findOwnedBuilding(owner, 'watch-tower')
            && hasCompletedBuilding(owner, 'blacksmith')
          ) {
            const builderId = findAvailableVillager(owner);
            const anchor = pickWatchTowerPlacement(
              ownerTownCenterPosition,
              state.lastEnemySightingPosition,
            );
            if (builderId !== null && anchor) {
              startConstruction(builderId, 'watch-tower', anchor);
            }
          }

          const missing = (buildingType: BuildableBuildingType): boolean => {
            if (buildingType === 'house') {
              // Houses are the exception to the "one is enough" rule —
              // we keep needing more as we grow. "Missing" here means
              // "population is blocked or near-blocked AND the owner
              // is not already constructing a House".
              if (populationBlocked) {
                return !isConstructingBuilding(owner, 'house');
              }
              return false;
            }
            // `findOwnedBuilding` catches both in-progress and
            // complete buildings — we only want to kick a new build
            // when neither exists. Otherwise the AI would assign
            // every spare villager to duplicate construction sites.
            return !findOwnedBuilding(owner, buildingType);
          };

          // Count ongoing villager builds so the AI doesn't pull
          // EVERY villager into construction mode — at least one
          // should stay gathering so the economy keeps flowing.
          let ongoingBuilds = 0;
          for (const [, cmd] of unitCommands.entries()) {
            if (cmd.type !== 'build') continue;
            const buildingRef = cmd.buildingRef;
            if (!buildingRef) continue;
            const bid = currentEntityId(activeWorld, buildingRef);
            if (bid === null) continue;
            const b = activeWorld.getComponent<BuildingComponent>(bid, 'building');
            if (b && b.owner === owner) ongoingBuilds += 1;
          }
          const totalVillagers = countOwnedUnits(owner, 'villager');
          // Cap at (totalVillagers - 1) so there's always at least one
          // gatherer left. Tiny AIs with 1 villager get 1 builder
          // (their single villager).
          const maxConcurrentBuilds = Math.max(1, totalVillagers - 1);

          // FU4: Imperial-Age Wonder pursuit takes priority over the
          // standard build-order list. Once the AI clears the
          // villager + resource thresholds the next idle villager
          // places the Wonder. After the Wonder is up the AI keeps
          // producing military to defend it (the Wonder-countdown
          // system handles the win condition); pickNextBuildTarget
          // continues to work for non-Wonder Imperial buildings.
          const aiResources = playerResources.get(owner);
          const wonderPursuit =
            ownerTownCenterPosition !== null
            && aiResources !== undefined
            && shouldPursueWonder(
              currentAge,
              hasOwnedWonder(owner),
              countOwnedUnits(owner, 'villager'),
              aiResources,
            );
          if (wonderPursuit && ongoingBuilds < maxConcurrentBuilds) {
            const builderId = findAvailableVillager(owner);
            const anchor = findBuildPlacementNear(ownerTownCenterPosition, 'wonder');
            if (builderId !== null && anchor) {
              startConstruction(builderId, 'wonder', anchor);
            }
          }

          const nextBuild = pickNextBuildTarget(currentAge, missing, populationBlocked);
          if (nextBuild && ongoingBuilds < maxConcurrentBuilds && !wonderPursuit) {
            const builderId = findAvailableVillager(owner);
            const anchor = findBuildPlacementNear(ownerTownCenterPosition, nextBuild);
            if (builderId !== null && anchor) {
              startConstruction(builderId, nextBuild, anchor);
            }
          }
        }

        // Age-up saving heuristic: hoisted above both the villager
        // training + military training blocks so they share the same
        // "don't burn food / gold when we're close to the age-up"
        // gate. Training that costs food or gold pauses when the AI
        // has >= 60% of the research cost on hand but isn't at the
        // full threshold yet. That narrow window lets the stockpile
        // climb over the line without food getting siphoned into
        // villagers + the unit mix. FU4: previously only military
        // training was gated; villagers (50 food each) could drain
        // the stockpile back below the Castle-Age cost even while
        // military was paused.
        const nextAgeTech: ResearchableTechnologyType | null =
          currentAge === 'dark-age' ? 'feudal-age'
          : currentAge === 'feudal-age' ? 'castle-age'
          : currentAge === 'castle-age' ? 'imperial-age'
          : null;
        const savingForAgeUp = ((): boolean => {
          if (!nextAgeTech) return false;
          const s = playerResources.get(owner);
          if (!s) return false;
          const cost = researchCost(nextAgeTech);
          const foodTarget = cost.food ?? 0;
          const goldTarget = cost.gold ?? 0;
          const foodProgress = foodTarget > 0 ? s.food / foodTarget : 1;
          const goldProgress = goldTarget > 0 ? s.gold / goldTarget : 1;
          const minProgress = Math.min(foodProgress, goldProgress);
          return minProgress >= 0.6 && !canAfford(s, cost);
        })();

        // Age-up loop: if the Town Center is idle and the age-up tech
        // is affordable, queue it. The AI also keeps a small safety
        // buffer (food + gold) so production does not stall during
        // the long research countdown.
        if (ownerTownCenterId !== null) {
          const tcConstruction = constructionStates.get(ownerTownCenterId);
          if (!tcConstruction || tcConstruction.isComplete) {
            const stockpile = playerResources.get(owner);
            const bufferCost = ageUpResourceBuffer(currentAge);
            const hasBuffer = stockpile ? canAfford(stockpile, bufferCost) : false;
            const nextAge = pickNextAgeResearch(
              currentAge,
              (tech) => {
                if (tech === 'feudal-age') return canAdvanceToFeudalAge(owner);
                if (tech === 'castle-age') return canAdvanceToCastleAge(owner);
                if (tech === 'imperial-age') return canAdvanceToImperialAge(owner);
                return false;
              },
              (tech) => {
                const s = playerResources.get(owner);
                return s ? canAfford(s, researchCost(tech)) : false;
              },
            );
            if (nextAge && hasBuffer) {
              // enqueueResearch dedupes by `entry.technologyType`
              // already — duplicate calls while the research is in
              // flight silently return false.
              enqueueResearch(ownerTownCenterId, nextAge);
            }

            // Villager training: keep the Town Center producing
            // villagers up to an age-scaled cap. Stops early when
            // population-blocked to avoid stacking queue entries
            // that sit isBlocked until a House completes. Also
            // pauses while saving for age-up so the 50-food villager
            // cost doesn't siphon the stockpile back below the Castle
            // / Imperial Age threshold once military has paused.
            // FU4: Imperial-Age cap bumped above 40 so the AI can
            // reach the Wonder-pursuit villager threshold.
            const tcQueue = productionQueues.get(ownerTownCenterId) ?? [];
            const villagerCap =
              currentAge === 'dark-age' ? 6
              : currentAge === 'imperial-age' ? 50
              : 14;
            const currentVillagers =
              countOwnedUnits(owner, 'villager') + countQueuedUnits(ownerTownCenterId, 'villager');
            if (
              !populationBlocked
              && !savingForAgeUp
              && currentVillagers < villagerCap
              && tcQueue.length < 2
            ) {
              enqueueTraining(ownerTownCenterId, 'villager');
            }
          }
        }

        // Military production: walk the per-age unit mix and enqueue
        // up to one unit per decision tick. Training pauses when the
        // AI has nearly enough for the next age-up — otherwise the
        // military lines eat all the food and the AI stalls between
        // ages. Each age only trains units the AI actually has
        // buildings for (pickNextBuildTarget ensures those buildings
        // get built in order).
        const mix = pickUnitMix(currentAge);
        if (!savingForAgeUp) {
          for (const { unitType, producer } of mix) {
            const producerId = findIdleProducer(owner, producer);
            if (producerId === null) continue;
            const stockpile = playerResources.get(owner);
            if (!stockpile) continue;
            if (!canAfford(stockpile, trainingCost(unitType))) continue;
            if (!getTrainOptions(owner, producer).includes(unitType)) continue;
            enqueueTraining(producerId, unitType);
          }
        }

        // Upgrades: if any research option is affordable and useful,
        // queue it. Cheap one-time upgrades (Fletching / Crossbowman
        // / Pikeman / Light Cavalry / etc.) pay off long-term and the
        // AI has plenty of spare resource once it enters Castle Age.
        // FU4: paused during age-up saving so blacksmith / range techs
        // (each 100-200 food) don't siphon the food stockpile back
        // below the Castle / Imperial Age research threshold.
        if (!savingForAgeUp) {
          for (const buildingType of [
            'blacksmith',
            'archery-range',
            'barracks',
            'stable',
            'siege-workshop',
            'castle',
          ] as const) {
            const buildingId = findIdleProducer(owner, buildingType);
            if (buildingId === null) continue;
            const options = getResearchOptions(owner, buildingType);
            if (options.length === 0) continue;
            const stockpile = playerResources.get(owner);
            if (!stockpile) continue;
            for (const tech of options) {
              if (canAfford(stockpile, researchCost(tech))) {
                enqueueResearch(buildingId, tech);
                break;
              }
            }
          }
        }

        // FU4: Monk training. Trains up to AI_MONK_COUNT_CAP Monks
        // from a completed Monastery in Castle / Imperial Age. Two-to-
        // three Monks suffice to heal the pushing army and ferry every
        // map relic back to the Monastery, while keeping gold spend
        // below the cavalry / archer line.
        if (
          !savingForAgeUp
          && (currentAge === 'castle-age' || currentAge === 'imperial-age')
        ) {
          const monasteryId = findIdleProducer(owner, 'monastery');
          if (monasteryId !== null) {
            const ownedMonks =
              countOwnedUnits(owner, 'monk') + countQueuedUnits(monasteryId, 'monk');
            const stockpile = playerResources.get(owner);
            if (
              ownedMonks < AI_MONK_COUNT_CAP
              && stockpile
              && canAfford(stockpile, trainingCost('monk'))
              && getTrainOptions(owner, 'monastery').includes('monk')
            ) {
              enqueueTraining(monasteryId, 'monk');
            }
          }
        }

        // FU4: Monk task assignment. Each owned Monk that has no
        // current task gets routed to: (1) deposit a carried relic at
        // the nearest friendly Monastery; (2) pick up the nearest
        // visible neutral relic; or (3) heal the nearest wounded
        // friendly military unit. Conversion (enemy-targeting) is
        // intentionally skipped in v1 — the spec defers it to a later
        // FU pass — so the AI Monk loop only reads the friendly-side
        // surface.
        assignAiMonkTasks(owner);

        // Attack-group management: prune destroyed / converted units,
        // then accumulate idle military into the group until the
        // age-gated threshold is met. Once met, dispatch the group at
        // the human's Town Center.
        const liveMilitary = ownedMilitaryUnitIds(owner);
        state.attackGroup = state.attackGroup.filter((id) => liveMilitary.has(id));
        const militaryUnits = findOwnedMilitaryUnits(owner);
        for (const { id } of militaryUnits) {
          if (!state.attackGroup.includes(id)) {
            state.attackGroup.push(id);
          }
        }

        const threshold = attackGroupSize(currentAge);
        const shouldPush = state.attackGroup.length >= threshold;

        for (const id of state.attackGroup) {
          const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
          const position = activeWorld.getComponent<Position>(id, 'position');
          if (!unit || !position) continue;

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

          // Units in the attack group always prefer an enemy in their
          // own vision; the group leader's sight usually drags the
          // target selection into the human base after the initial
          // move command. The human villager fallback preserves the
          // old Barracks-rush behavior — the AI-rush browser test
          // depends on the AI killing at least one human villager.
          const humanVillagerId = findOwnedUnit(HUMAN_PLAYER_ID, 'villager');
          if (shouldPush && humanVillagerId !== null && issueUnitAttackCommand(id, humanVillagerId, 'unit')) {
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

          if (shouldPush) {
            if (humanTownCenterId !== null && issueUnitAttackCommand(id, humanTownCenterId, 'building')) {
              continue;
            }

            if (humanTownCenterPosition) {
              issueUnitMoveCommand(id, humanTownCenterPosition);
            }
          }
        }
      }
    },
  });

  // Canonical-AoE2 stance defaults. Runs after `prototypeAi` (so the AI
  // owns the wider planner-style aggression for its push) and before
  // `prototypePlayerCommands` (so commands the AI / auto-aggression
  // issued this tick are processed in the same tick). The rule is per-
  // unit, not per-player: any unit whose `unitCommands` slot is empty,
  // not garrisoned, and alive, scans for an enemy in its personal LOS
  // and engages. Military uses `unitVisionRadius` (Aggressive Stance);
  // villager uses melee attack range = 1 (Defensive Stance: counter-
  // attack adjacent only). Monks and wildlife are skipped — Monks have
  // their own task subsystem, and wildlife is not in the `unit` query.
  // Players whose AI is explicitly disabled (`disableAi: true` on the
  // start spec) are also skipped here so test fixtures can spawn a
  // fully-passive enemy without the planner OR auto-aggression
  // animating its units.
  world.registerSystem({
    name: 'prototypeAutoAggression',
    phase: 'update',
    after: ['prototypeAi'],
    before: ['prototypePlayerCommands'],
    execute(activeWorld) {
      for (const id of activeWorld.query('position', 'unit')) {
        if (unitCommands.has(id)) {
          continue;
        }
        if (isGarrisonedUnit(id)) {
          continue;
        }

        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        const position = activeWorld.getComponent<Position>(id, 'position');
        if (!unit || !position) {
          continue;
        }
        if (unit.unitType === 'monk') {
          continue;
        }

        // Passive-player gate: only the human and AI-driven players
        // run auto-aggression on their units. The seeding site at the
        // top of `createWorld` (search `start.disableAi`) skips
        // `ensureAiState` when a fixture sets `disableAi: true`, so
        // those owners are missing from `aiStates`. Reusing the
        // `aiStates` map as the gate keeps the "is this owner active?"
        // check in one place — but it does mean: if any future code
        // path purges `aiStates` (e.g. on defeat), that owner's units
        // also lose auto-aggression. Document the coupling here and
        // revisit if a real player needs to lose AI but keep stance.
        if (unit.owner !== HUMAN_PLAYER_ID && !aiStates.has(unit.owner)) {
          continue;
        }

        const combat = combatStates.get(id);
        if (!combat || combat.currentHp <= 0) {
          continue;
        }

        // Honor active gather work as a "player order" equivalent: a
        // villager with a live `GathererComponent.task` (gathering /
        // returning a load / mid-drop-off) or an explicit gather order
        // from the player must NOT be yanked off its resource by an
        // adjacent enemy. Canonical AoE2 returns the villager to the
        // resource after the attacker leaves, but our `unitCommands`
        // model has no return-to-resource memory yet — clearing the
        // gather here would silently drop the player's order. Deferred:
        // a follow-up to swing back at the adjacent attacker AND keep
        // the gather order intact (would need a new transient retaliate
        // state alongside the gatherer task).
        if (unit.unitType === 'villager') {
          const gatherer = activeWorld.getComponent<GathererComponent>(id, 'gatherer');
          if (gatherer && (gatherer.task !== 'idle' || gatherer.hasExplicitGatherOrder)) {
            continue;
          }
        }

        // Read the unit's live vision source instead of the canonical
        // per-type table. Tech upgrades modify `visionSource.radius`
        // (e.g. Tracking on Scouts), and fixtures occasionally override
        // a unit's vision to keep it blind for a specific test setup —
        // both stay honored because we read the actual component here.
        // Villagers always get the Defensive-Stance radius of 1 (melee
        // attack range), regardless of their fog-of-war vision.
        const visionSource = activeWorld.getComponent<VisionSourceComponent>(id, 'visionSource');
        const radius =
          unit.unitType === 'villager'
            ? 1
            : visionSource?.radius ?? unitVisionRadius(unit.unitType);

        const enemyUnitId = findPreferredEnemyUnitInRadius(unit.owner, position, radius);
        if (enemyUnitId !== null) {
          issueUnitAttackCommand(id, enemyUnitId, 'unit');
          continue;
        }

        if (unit.unitType === 'villager') {
          // Villagers in Defensive Stance never pursue buildings on
          // their own — their canon behavior is "swing back at adjacent
          // attackers". A radius-1 building scan would also bias them
          // into attacking palisades they happen to brush past.
          continue;
        }

        const enemyBuildingId = findPreferredEnemyBuildingInRadius(
          unit.owner,
          position,
          radius,
        );
        if (enemyBuildingId !== null) {
          issueUnitAttackCommand(id, enemyBuildingId, 'building');
        }
      }
    },
  });

  world.registerSystem({
    name: 'prototypePlayerCommands',
    phase: 'update',
    after: ['prototypeAi', 'prototypeAutoAggression'],
    execute(activeWorld) {
      for (const [id, command] of [...unitCommands.entries()]) {
        const position = activeWorld.getComponent<Position>(id, 'position');
        const unit = activeWorld.getComponent<UnitComponent>(id, 'unit');
        if (!position || !unit) {
          clearUnitCommand(id);
          continue;
        }

        if (command.type === 'attack') {
          const attackerCombat = combatStates.get(id);
          const targetId = currentEntityId(activeWorld, command.targetEntityRef);
          if (targetId === null || !attackerCombat || !command.targetEntityKind) {
            clearUnitCommand(id);
            continue;
          }

          if (attackerCombat.cooldownTicks > 0) {
            attackerCombat.cooldownTicks -= 1;
          }

          // FU7: Trebuchet pack/unpack. If a Trebuchet is mid-transition,
          // burn a tick on the transition (no move, no fire) and move on.
          // The second phase — branching on packed vs unpacked per target
          // kind — is inlined in each sub-branch below after the distance
          // is computed, since "in range" differs for unit / resource /
          // building targets.
          if (unit.unitType === 'trebuchet' && advanceTrebuchetTransition(id)) {
            continue;
          }

          if (command.targetEntityKind === 'unit') {
            const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
            const targetUnit = activeWorld.getComponent<UnitComponent>(targetId, 'unit');
            const targetCombat = combatStates.get(targetId);
            if (!targetPosition || !targetUnit || !targetCombat || targetUnit.owner === unit.owner) {
              clearUnitCommand(id);
              continue;
            }

            if (manhattanDistance(position, targetPosition) > attackerCombat.attackRange) {
              // FU7: an unpacked Trebuchet is stationary — it cannot walk
              // toward an out-of-range target. Hold the attack command so
              // the player observes "nothing happens" rather than silently
              // clearing the order (they may re-pack later or the target
              // may return to range). A packed Trebuchet walks normally.
              if (isTrebuchetStationary(id)) {
                continue;
              }
              const unitRangePlan = findUnitRangePlan(
                id,
                targetPosition,
                attackerCombat.attackRange,
                activeWorld,
              );
              if (!unitRangePlan) {
                clearUnitCommand(id);
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

            // FU7: a packed Trebuchet cannot fire — it must unpack first.
            // Kick off the unpack transition; a later tick will clear the
            // pack flag and let the standard fire logic run.
            if (unit.unitType === 'trebuchet' && isTrebuchetSilent(id)) {
              beginTrebuchetUnpack(id);
              continue;
            }

            if (attackerCombat.cooldownTicks > 0) {
              continue;
            }

            // FU1: armor subtracts from attacker damage, floored at 1 so
            // that ever-larger armor stacks never heal or no-op a hit.
            // Matches AoE2 DE "minimum 1 damage" rule for unit-vs-unit.
            const rawDamage =
              attackerCombat.attackDamage + attackBonusAgainstUnit(unit.unitType, targetUnit.unitType);
            targetCombat.currentHp -= Math.max(1, rawDamage - targetCombat.armor);
            attackerCombat.cooldownTicks = attackerCombat.reloadTicks;
            markOutOfBandRenderChange();

            if (targetCombat.currentHp <= 0) {
              // FU7: credit the attacker's owner with a military kill.
              ensurePlayerScoreCounters(unit.owner).unitsKilled += 1;
              destroyUnitEntity(targetId);
              clearUnitCommand(id);
            }
            continue;
          }

          if (command.targetEntityKind === 'resource') {
            const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
            const targetResource = activeWorld.getComponent<ResourceComponent>(targetId, 'resource');
            const targetWildlife = wildlifeStates.get(targetId);
            if (!targetPosition || !targetResource || !targetWildlife?.isAlive) {
              clearUnitCommand(id);
              continue;
            }

            if (manhattanDistance(position, targetPosition) > attackerCombat.attackRange) {
              // FU7: unpacked Trebuchet holds ground — see the unit branch.
              if (isTrebuchetStationary(id)) {
                continue;
              }
              const wildlifeRangePlan = findUnitRangePlan(
                id,
                targetPosition,
                attackerCombat.attackRange,
                activeWorld,
              );
              if (!wildlifeRangePlan) {
                clearUnitCommand(id);
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

            // FU7: packed Trebuchet unpacks before firing.
            if (unit.unitType === 'trebuchet' && isTrebuchetSilent(id)) {
              beginTrebuchetUnpack(id);
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
              clearUnitCommand(id);
            }
            continue;
          }

          const targetPosition = activeWorld.getComponent<Position>(targetId, 'position');
          const targetBuilding = activeWorld.getComponent<BuildingComponent>(targetId, 'building');
          const targetHealth = buildingHealthStates.get(targetId);
          if (!targetPosition || !targetBuilding || !targetHealth || targetBuilding.owner === unit.owner) {
            clearUnitCommand(id);
            continue;
          }

          if (distanceToBuilding(targetId, position) > attackerCombat.attackRange) {
            // FU7: unpacked Trebuchet holds ground — see the unit branch.
            if (isTrebuchetStationary(id)) {
              continue;
            }
            const buildingApproachPlan = findBuildingApproachPlan(
              id,
              targetId,
              attackerCombat.attackRange,
              activeWorld,
            );
            if (!buildingApproachPlan) {
              clearUnitCommand(id);
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

          // FU7: packed Trebuchet unpacks before firing at a building.
          // Trebuchets are the canonical building-killer so this is the
          // most common path — position next to a Castle / TC, then
          // unpack over 50 ticks, then rain siege damage.
          if (unit.unitType === 'trebuchet' && isTrebuchetSilent(id)) {
            beginTrebuchetUnpack(id);
            continue;
          }

          if (attackerCombat.cooldownTicks > 0) {
            continue;
          }

          // FU1: buildings do not carry armor in v1, but floor the raw
          // damage at 0 so negative-armor-style shenanigans (future
          // engine changes) cannot heal a building via an attack.
          targetHealth.currentHp -= Math.max(
            0,
            attackerCombat.attackDamage + attackBonusAgainstBuilding(unit.unitType),
          );
          attackerCombat.cooldownTicks = attackerCombat.reloadTicks;
          markOutOfBandRenderChange();

          if (targetHealth.currentHp <= 0) {
            destroyBuildingEntity(targetId);
            clearUnitCommand(id);
          }
          continue;
        }

        if (command.type === 'move') {
          // FU7: Trebuchet pack/unpack. An unpacked Trebuchet must pack
          // before it can start walking toward a move target; during the
          // pack (or any in-flight transition) it stays put. This runs
          // BEFORE the movePlan lookup so a transient transition never
          // prematurely clears the move command on a blocked plan.
          if (unit.unitType === 'trebuchet') {
            if (advanceTrebuchetTransition(id)) {
              continue;
            }
            if (isTrebuchetStationary(id)) {
              beginTrebuchetPack(id);
              continue;
            }
          }

          const movePlan = resolveMovePlanFromCache(id, command.target, activeWorld);
          if (!movePlan) {
            clearUnitCommand(id);
            continue;
          }

          if (isUnitAtTarget(id, movePlan.destination, activeWorld)) {
            clearUnitCommand(id);
            continue;
          }

          moveUnitOneSubgridStep(id, movePlan.nextStep, activeWorld);
          continue;
        }

        const buildingId = currentEntityId(activeWorld, command.buildingRef);
        if (buildingId === null) {
          clearUnitCommand(id);
          continue;
        }

        const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
        const construction = constructionStates.get(buildingId);
        const buildingApproachPlan = findBuildingApproachPlan(id, buildingId, 1, activeWorld);
        if (!building || !construction || construction.isComplete || !buildingApproachPlan) {
          clearUnitCommand(id);
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

          // Slice 8: hook the generic completion path (score counters,
          // Wonder-countdown start). Must fire for every construction
          // completion, including non-Wonder buildings, so scores stay
          // accurate across the whole match.
          onBuildingConstructionComplete(buildingId, building.owner, building.buildingType);

          clearUnitCommand(id);
        }
      }
    },
  });

  // (monkHealCounters + monkConvertProcessedThisTick are hoisted to the
  // top of `createWorld` so save/load can serialize the heal counter.
  // applyMonkHeal / applyMonkConvert / applyMonkPickup / applyMonkDeposit
  // live in `bridge/monkTaskOps`; they close over the same side maps.)


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
          setPositionAndSyncOccupancy(
            relicId,
            { x: monkPosition.x, y: monkPosition.y },
            activeWorld,
          );
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
          // Score counter for trained units is incremented inside
          // `addUnitEntity`, covering both scenario spawns and production-
          // queue spawns uniformly.
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
            setPositionAndSyncOccupancy(id, nextGridPosition, activeWorld);
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
          setPositionAndSyncOccupancy(id, nextPosition, activeWorld);
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
            // Slice 10: AI difficulty modifies the gather-rate via a
            // per-player multiplier applied at drop-off time. Easy
            // AIs bank 70% of their carried amount, hard AIs bank 130%
            // — the worked simulation still walks villagers through
            // the full gather → return cycle, we only scale the
            // stockpile increment. Humans gather at 1.0.
            const aiState = aiStates.get(unit.owner);
            const multiplier = aiState ? gatherMultiplier(aiState.difficulty) : 1;
            const deposited = Math.round(gatherer.carriedAmount * multiplier);
            if (stockpile) {
              stockpile[gatherer.carriedResource] += deposited;
            }
            // Slice 8: track every unit of dropped-off resource toward the
            // end-of-match score. A small per-unit weight keeps the score
            // readable (1000 gathered ≈ 50 points; see computePlayerScore).
            ensurePlayerScoreCounters(unit.owner).resourcesGathered += deposited;
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

          setPositionAndSyncOccupancy(id, movePlan.nextStep, activeWorld);
          continue;
        }

        if (wildlife.cooldownTicks > 0) {
          continue;
        }

        // FU1: wildlife hits respect target armor, floored at 1 so a
        // heavily-armored unit still takes a scrape per hit.
        targetCombat.currentHp -= Math.max(1, wildlife.attackDamage - targetCombat.armor);
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

        const garrisonIds = garrisonedByBuilding.get(id) ?? [];
        // FU3: count archer-line garrison members for the Castle's
        // extra-arrows bonus. For Town Center / Watch Tower the archer
        // count is ignored — buildingArrowCount only reads it for Castle.
        let garrisonedArcherCount = 0;
        for (const garrisonedId of garrisonIds) {
          const garrisonedUnit = activeWorld.getComponent<UnitComponent>(garrisonedId, 'unit');
          if (garrisonedUnit && isArcherLineUnit(garrisonedUnit.unitType)) {
            garrisonedArcherCount += 1;
          }
        }

        const arrowCount = buildingArrowCount(
          building.buildingType,
          garrisonIds.length,
          garrisonedArcherCount,
        );
        // FU3: use the closest footprint cell to the target for range
        // checks on large buildings (e.g. a 4x4 Castle anchored at
        // top-left would otherwise need +3 more range to fire from its
        // opposite edge). `findPreferredVisibleEnemyUnitInRangeOfBuilding`
        // threads the footprint into the distance math.
        const footprint = buildingFootprint(building.buildingType);
        const targetId = findPreferredVisibleEnemyUnitInRangeOfBuilding(
          building.owner,
          position,
          footprint,
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

          // FU1: tower / TC / Castle arrows respect unit armor, floored
          // at 1 so heavily-armored Imperial units still take at least a
          // single point per arrow.
          activeTargetCombat.currentHp -= Math.max(
            1,
            buildingCombat.attackDamage - activeTargetCombat.armor,
          );
          markOutOfBandRenderChange();
          if (activeTargetCombat.currentHp <= 0) {
            // FU7: credit the firing tower's owner with the kill.
            ensurePlayerScoreCounters(building.owner).unitsKilled += 1;
            destroyUnitEntity(targetId);
            break;
          }
        }

        buildingCombat.cooldownTicks = buildingCombat.reloadTicks;
      }
    },
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
  world.registerSystem({
    name: 'prototypeWonderCountdown',
    phase: 'postUpdate',
    execute() {
      if (!isMatchRunning()) {
        return;
      }
      for (const [buildingId, entry] of [...wonderCountdowns.entries()]) {
        const building = world.getComponent<BuildingComponent>(buildingId, 'building');
        if (!building) {
          wonderCountdowns.delete(buildingId);
          continue;
        }
        // Skip entries that already hit zero — they keep their
        // `lastCompletedTick` stamp until the resolver fires.
        if (entry.lastCompletedTick !== null) {
          continue;
        }
        entry.remainingTicks -= 1;
        if (entry.remainingTicks <= 0) {
          entry.lastCompletedTick = world.tick;
        }
      }
    },
  });

  // Slice 8: Relic countdown. An owner who holds every relic on the map
  // in their Monasteries (zero live relics anywhere else) begins counting
  // down. `currentRelicHoldingOwner` lives in `bridge/matchEndOps` — the
  // factory closes over monkCarriedRelic + relicsInMonastery so the
  // in-flight vs deposited distinction stays in one place.
  world.registerSystem({
    name: 'prototypeRelicCountdown',
    phase: 'postUpdate',
    after: ['prototypeWonderCountdown'],
    execute() {
      if (!isMatchRunning()) {
        return;
      }
      const holdingOwner = currentRelicHoldingOwner();
      if (holdingOwner === null) {
        relicCountdowns.clear();
        return;
      }
      let entry = relicCountdowns.get(holdingOwner);
      if (!entry) {
        const totalTicks = relicCountdownOverrides.get(holdingOwner) ?? RELIC_COUNTDOWN_TICKS;
        entry = { remainingTicks: totalTicks, totalTicks, lastCompletedTick: null };
        relicCountdowns.set(holdingOwner, entry);
      }
      // Clear any stale entry belonging to a different owner (e.g. the
      // holding picture flipped between players without hitting the
      // liveRelicCount > 0 early-return).
      for (const existingOwner of [...relicCountdowns.keys()]) {
        if (existingOwner !== holdingOwner) {
          relicCountdowns.delete(existingOwner);
        }
      }
      // FU7: once completed, a relic countdown no longer ticks — the
      // resolver picks a winner below.
      if (entry.lastCompletedTick !== null) {
        return;
      }
      entry.remainingTicks -= 1;
      if (entry.remainingTicks <= 0) {
        entry.lastCompletedTick = world.tick;
      }
    },
  });

  // FU7: resolves Wonder vs Relic outcomes with an explicit
  // `lastCompletedTick`-based tie-break. Previously the outcome was
  // implicit in system-registration order (Wonder runs before Relic, so
  // Wonder won on simultaneous completion). Now the rule is:
  //   1. Whichever countdown's `lastCompletedTick` is smaller wins (the
  //      one that actually hit zero first in simulation time).
  //   2. On the same tick, Wonder beats Relic (stable, documented).
  // Decouples win-condition semantics from the system scheduling order.
  world.registerSystem({
    name: 'prototypeWinConditionResolver',
    phase: 'postUpdate',
    after: ['prototypeRelicCountdown'],
    execute() {
      if (!isMatchRunning()) {
        return;
      }
      // Find the earliest Wonder completion (there can be more than one
      // if multiple Wonders stood, though the one-per-owner rule makes
      // this rare). Smaller `lastCompletedTick` = earlier completion.
      let earliestWonderTick: number | null = null;
      let earliestWonderOwner: number | null = null;
      for (const [buildingId, entry] of wonderCountdowns.entries()) {
        if (entry.lastCompletedTick === null) {
          continue;
        }
        const building = world.getComponent<BuildingComponent>(buildingId, 'building');
        if (!building) {
          continue;
        }
        if (earliestWonderTick === null || entry.lastCompletedTick < earliestWonderTick) {
          earliestWonderTick = entry.lastCompletedTick;
          earliestWonderOwner = building.owner;
        }
      }
      // Find the earliest Relic completion.
      let earliestRelicTick: number | null = null;
      let earliestRelicOwner: number | null = null;
      for (const [owner, entry] of relicCountdowns.entries()) {
        if (entry.lastCompletedTick === null) {
          continue;
        }
        if (earliestRelicTick === null || entry.lastCompletedTick < earliestRelicTick) {
          earliestRelicTick = entry.lastCompletedTick;
          earliestRelicOwner = owner;
        }
      }
      if (earliestWonderTick === null && earliestRelicTick === null) {
        return;
      }
      // Decide which completion wins. On a true tie (same tick), Wonder
      // is the stable choice — it's the more expensive commit and
      // matches AoE2 convention that Wonder victories are showier.
      const wonderWins =
        earliestWonderTick !== null
        && (earliestRelicTick === null || earliestWonderTick <= earliestRelicTick);
      if (wonderWins && earliestWonderOwner !== null) {
        const winnerIsHuman = earliestWonderOwner === HUMAN_PLAYER_ID;
        finalizeMatchEnd(
          winnerIsHuman ? 'victory' : 'defeat',
          'wonder',
          winnerIsHuman
            ? 'Wonder Victory! Your Wonder endured the countdown.'
            : 'Wonder Defeat: an enemy Wonder endured the countdown.',
        );
        return;
      }
      if (earliestRelicOwner !== null) {
        const winnerIsHuman = earliestRelicOwner === HUMAN_PLAYER_ID;
        finalizeMatchEnd(
          winnerIsHuman ? 'victory' : 'defeat',
          'relic',
          winnerIsHuman
            ? 'Relic Victory! You held every relic for the full countdown.'
            : 'Relic Defeat: an opponent held every relic for the full countdown.',
        );
      }
    },
  });

  world.registerSystem({
    name: 'prototypeConquestOutcome',
    phase: 'postUpdate',
    after: ['prototypeWinConditionResolver'],
    execute() {
      if (!isMatchRunning()) {
        return;
      }

      if (!playerHasConquestPresence(HUMAN_PLAYER_ID)) {
        finalizeMatchEnd('defeat', 'conquest', 'All of your units and buildings have been destroyed.');
        return;
      }

      const enemyOwners = [...playerResources.keys()].filter((owner) => owner !== HUMAN_PLAYER_ID);
      if (enemyOwners.every((owner) => !playerHasConquestPresence(owner))) {
        finalizeMatchEnd('victory', 'conquest', 'All enemy forces have been eliminated.');
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
        activity: null,
        activityBreakdown: null,
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
        placementMode: placementMode.current,
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

    const activitySources: SelectionActivitySources = {
      world,
      humanPlayerId: HUMAN_PLAYER_ID,
      unitCommands,
      monkTasks,
      trebuchetPackStates,
      productionQueues,
      constructionStates,
      getCurrentEntityId: (ref) => getCurrentEntityId(ref),
    };

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
      activity:
        selectedEntityIds.length === 1 && unit && unit.owner === HUMAN_PLAYER_ID
          ? computeUnitActivity(activitySources, selectedEntityId, unit)
          : selectedEntityIds.length === 1 && building && building.owner === HUMAN_PLAYER_ID
          ? getBuildingActivity(activitySources, selectedEntityId)
          : null,
      activityBreakdown:
        selectedEntityIds.length > 1 ? getSelectionActivityBreakdown(activitySources, selectedEntityIds) : null,
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
      placementMode: placementMode.current,
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
    clearUnitCommand(unitId);
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
      placementMode.current = null;
      return false;
    }

    selectionFocusCell = { x, y };
    placementMode.current = null;
    return selectedEntityRefs.length > 0;
  }

  function selectEntityById(id: number): boolean {
    if (!isMatchRunning() || !isEntityVisibleToHuman(id)) {
      return false;
    }

    const entityRef = getEntityRef(id);
    if (!entityRef) {
      return false;
    }

    selectedEntityRefs = [entityRef];
    // Exact world-position selection owns its repeat-click memory in GameScene.
    // Keep the bridge's cell-cycle anchor empty so any later legacy/test-only
    // `selectEntityAtCell(...)` call is treated as a fresh tile click.
    selectionFocusCell = null;
    placementMode.current = null;
    return true;
  }

  function clearSelection(): void {
    selectedEntityRefs = [];
    selectionFocusCell = null;
    placementMode.current = null;
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

    placementMode.current = null;
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
        placementMode.current = null;
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
    placementMode.current = null;
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
      enqueueRejection('Target not visible.');
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
      placementMode.current = null;
      return true;
    }

    const ownedSheepIds = getSelectedOwnedSheepIds();
    const selectedUnitIds = getSelectedHumanUnitIds();
    if (ownedSheepIds.length === 0 && selectedUnitIds.length === 0) {
      return false;
    }

    placementMode.current = null;
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
      enqueueRejection('Building is still under construction.');
      return false;
    }

    const didEnqueue = enqueueTraining(selectedEntityId, unitType);
    if (!didEnqueue) {
      const stockpile = playerResources.get(HUMAN_PLAYER_ID);
      if (stockpile) {
        const missing = resourcesMissing(stockpile, trainingCost(unitType));
        if (missing) {
          enqueueRejection(`Not enough ${missing}.`);
          return false;
        }
      }
      enqueueRejection('Cannot train that unit here.');
    }
    return didEnqueue;
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
      enqueueRejection('Building is still under construction.');
      return false;
    }

    const didEnqueue = enqueueResearch(selectedEntityId, technologyType);
    if (!didEnqueue) {
      const stockpile = playerResources.get(HUMAN_PLAYER_ID);
      if (stockpile) {
        const missing = resourcesMissing(stockpile, researchCost(technologyType));
        if (missing) {
          enqueueRejection(`Not enough ${missing}.`);
          return false;
        }
      }
      enqueueRejection('Cannot research that here.');
    }
    return didEnqueue;
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

    const didTrade = executeMarketAction(actionType);
    if (!didTrade) {
      enqueueRejection('Market trade rejected. Check resources and selection.');
    }
    return didTrade;
  }

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
