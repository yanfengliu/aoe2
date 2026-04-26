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
import { createEntityDestroyOps } from './bridge/entityDestroyOps';
import { createOptionsRules } from './bridge/optionsRules';
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
  createWildlifeState,
  isArcherLineUnit,
  isCavalryUnit,
  isGunpowderUnit,
  isInfantryUnit,
  isMeleeUnit,
  isWildlifeResourceType,
  unitAttackDamage,
  unitAttackRange,
  unitMaxHp,
  unitReloadTicks,
  unitSize,
  unitTint,
} from './prototypeUnitRules';
import { RenderStore } from './renderStore';
import { SAVE_SCHEMA_VERSION, type SaveBlob } from './saveSchema';
import { findSafeSpawnWithEgress } from './spawn';
import {
  latestResearchedInChain as latestResearchedInChainExternal,
  type UpgradeChainEntry,
} from './upgradeChains';
import { createWorldOccupancy } from './worldOccupancy';
import {
  computeUnitActivity,
  getBuildingActivity,
  getSelectionActivityBreakdown,
  type SelectionActivitySources,
} from './selectionActivity';
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
    // Iter-3 V3-5: drop the throttle marker too so a brand-new gather
    // order from the player or AI doesn't inherit the previous order's
    // stuck window.
    gathererDropOffStuckSinceTick.delete(id);
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
      const renderable = world.getComponent<RenderableComponent>(id, 'renderable');
      if (
        position
        && building
        && renderable
        && buildingOccupiesCell(id, x, y)
        // Iter-3 V3-2: footprint visibility instead of anchor-only so a
        // partially-visible 4x4 Castle/TC/Wonder is still selectable when
        // the player clicks the visible edge cell. Mirrors the iter-2
        // M2-1 fix in target finding.
        && isEntityFootprintVisibleToHuman(
          position,
          building.owner,
          renderable.footprintWidth,
          renderable.footprintHeight,
        )
      ) {
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

    // Iter-2 verify follow-up + Iter-3 V3-6: dedupe across ALL owned
    // producer queues. The H2-1 fix made applyTechnology idempotent on
    // the bonus side; this guard prevents the cost being charged twice
    // when a player race-queues the same tech at two producer
    // buildings. The lookup is O(1) via inFlightTechByOwner instead of
    // O(producers × queue depth).
    if (inFlightTechSetFor(building.owner).has(technologyType)) {
      return false;
    }

    const queue = productionQueues.get(buildingId) ?? [];

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
    inFlightTechSetFor(building.owner).add(technologyType);
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
    chain: UpgradeChainEntry,
  ): TrainableUnitType {
    return latestResearchedInChainExternal(owner, chain, hasTechnology);
  }

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
