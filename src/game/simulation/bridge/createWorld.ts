import {
  VisibilityMap,
  World,
  createTileGrid,
  type EntityRef,
  type Position,
} from 'civ-engine';

import {
  rebuildTileGridFromWorld,
  currentEntityId,
  cloneResources,
  shouldMaintainGatheringOrder,
  buildingFootprint,
  type GameEvents,
  type GameCommands,
  type GameComponents,
  type GameWorld,
} from './pureHelpers';
import { syncVisibilitySources } from './visibility';
import { createTrebuchetStateOps } from './trebuchetState';
import { createFogMemoryOps } from './fogMemoryOps';
import { createMonkTaskOps } from './monkTaskOps';
import { createTechnologyOps } from './technologyOps';
import { createMatchEndOps } from './matchEndOps';
import { createAiDecisionOps } from './aiDecisionOps';
import { createPlacementOps } from './placementOps';
import { createSaveGameOps } from './saveGameOps';
import { createEntityDestroyOps } from './entityDestroyOps';
import { createCombatStateFactory } from './combatStateFactory';
import { createEntityCreateOps } from './entityCreateOps';
import { createHumanInputOps } from './humanInputOps';
import { createBridgeState, type BridgeState } from './bridgeState';
import { createCellPassability } from './cellPassability';
import { registerAllSystems } from './registerAllSystems';
import {
  hydrateFromSavedGame,
  registerComponentTypes,
  seedPlayerStarts,
  seedScenarioEntities,
  seedTerrain,
} from './scenarioSeedOps';
import { createDebugSnapshotOps } from './debugSnapshotOps';
import { createEconomyStateOps } from './economyStateOps';
import { createTransformOps } from './transformOps';
import { createVisibilityQueries } from './visibilityQueries';
import { createSelectionInputOps } from './selectionInputOps';
import { createTrainingMarketOps } from './trainingMarketOps';
import { createUnitCommandOps } from './unitCommandOps';
import { createMovementPlanOps } from './movementPlanOps';
import { createOptionsRules } from './optionsRules';
import { createPlayerQueries } from './playerQueries';
import { createSelectionStateOps } from './selectionStateOps';
import { createTargetFindingOps } from './targetFindingOps';
import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
  TPS,
  createPrototypeScenario,
} from '../prototypeScenario';
import { unitTint } from '../prototypeUnitRules';
import type { SaveBlob } from '../saveSchema';
import { findSafeSpawnWithEgress } from '../spawn';
import { createWorldOccupancy } from '../worldOccupancy';
import {
  AI_MONK_HEAL_HP_FRACTION,
  AI_WATCH_TOWER_FORWARD_STEP,
  DEFAULT_DIFFICULTY,
  planForAge,
  villagerTargetsForAge,
  type AiState,
  type DifficultyLevel,
} from '../ai';
import type {
  ActionType,
  AgeType,
  BuildableBuildingType,
  BuildingType,
  EconomyState,
  GathererComponent,
  MarketActionType,
  MatchState,
  PlayerResources,
  PlacementPreviewState,
  PopulationState,
  ProjectedEntityView,
  ResearchableTechnologyType,
  SelectionState,
  SimulationDebugSnapshot,
  TrainableUnitType,
  UnitTaskState,
  UnitType,
} from '../types';

// Type aliases / interfaces from createSimulationBridge.
import type { UnitCommand } from '../createSimulationBridge';
import {
  CARDINAL_NEIGHBOR_OFFSETS,
  MARKET_FEE_RATE,
  MARKET_MIN_RATE,
  MARKET_RATE_STEP,
  MARKET_TRANSACTION_AMOUNT,
  MONK_CONVERT_FLIP_THRESHOLD,
  MONK_CONVERT_PROGRESS_PER_TICK,
  MONK_HEAL_HP_PER_INTERVAL,
  MONK_HEAL_TICK_INTERVAL,
  RELIC_COUNTDOWN_TICKS,
  STANDARD_POPULATION_CAP,
  STANDARD_STARTING_RESOURCES,
  WONDER_COUNTDOWN_TICKS,
} from './bridgeConstants';

export function createWorld(
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

  // Side-map state lives in `bridge/bridgeState`. Destructured locally so
  // the rest of createWorld reads them as bare names.
  const state = createBridgeState();
  const {
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
    movePathCache,
    sheepMoveOrders,
    rallyPoints,
    monkTasks,
    conversionState,
    monkCarriedRelic,
    relicsInMonastery,
    trebuchetPackStates,
    wonderCountdowns,
    wonderCountdownOverrides,
    relicCountdowns,
    relicCountdownOverrides,
    playerScoreCounters,
    lastSeenStatic,
    garrisonedByBuilding,
    garrisonedUnitToBuilding,
    garrisonedUnitVisionSources,
    aiStates,
    monkHealCounters,
    monkConvertProcessedThisTick,
    productionQueues,
    constructionStates,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    wildlifeStates,
    inFlightTechByOwner,
    gathererDropOffStuckSinceTick,
  } = state;
  function ensurePlayerScoreCounters(
    owner: number,
  ): BridgeState['playerScoreCounters'] extends Map<number, infer V> ? V : never {
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

  // Read helpers for the per-player fog memory snapshot. The bridge owns
  // `state.lastSeenStatic`; this factory bundles the read accessors.
  const {
    getOrCreateMemoryMap,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  } = createFogMemoryOps({
    fogMemory: lastSeenStatic,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
  });

  // Debug snapshot lives in `bridge/debugSnapshotOps`.
  const { getDebugSnapshot } = createDebugSnapshotOps({
    world,
    unitCommands,
    aiStates,
  });

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
    let aiState = aiStates.get(owner);
    if (!aiState) {
      const age = playerAges.get(owner) ?? 'dark-age';
      aiState = {
        difficulty,
        plan: planForAge(age),
        villagerTargets: { ...villagerTargetsForAge(age) },
        attackGroup: [],
        lastDecisionTick: -1,
        lastEnemySightingTick: -1,
        lastEnemySightingPosition: null,
      };
      aiStates.set(owner, aiState);
    }
    return aiState;
  }

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

  if (!savedGame) {
    registerComponentTypes(world);
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

  // (Player-start seeding + terrain laying moved to
  // `bridge/scenarioSeedOps.ts`; both run only on fresh start. Both
  // factory calls happen further down once their deps are wired.)

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
    getSelectedEntityIds: (): number[] => getSelectedEntityIds(),
    resolveSelectionTile: (id: number, position) => resolveSelectionTile(id, position),
    getSelectableEntitiesAtCell: (x: number, y: number) => getSelectableEntitiesAtCell(x, y),
    getCurrentEntityId: (ref: import('civ-engine').EntityRef | null) => getCurrentEntityId(ref),
    clearSelection: () => {
      selection.refs = [];
      selection.focusCell = null;
    },
    getActionOptions: (owner: number, buildingType: import('../types').BuildingType, buildingId: number) => getActionOptions(owner, buildingType, buildingId),
    getTrainOptions: (owner: number, buildingType: import('../types').BuildingType) => getTrainOptions(owner, buildingType),
    getMarketOptions: (owner: number, buildingType: import('../types').BuildingType) => getMarketOptions(owner, buildingType),
    getBuildOptions: (owner: number, unitType: import('../types').UnitType) => getBuildOptions(owner, unitType),
    getResearchOptions: (owner: number, buildingType: import('../types').BuildingType) => getResearchOptions(owner, buildingType),
    getVisibleResearchOptions: (owner: number, buildingType: import('../types').BuildingType) => getVisibleResearchOptions(owner, buildingType),
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
  // Scenario seed + save-load hydration live in bridge/scenarioSeedOps.
  // Both branches close over the bridge's side maps + helper closures.
  // findScenarioSpawnPosition is declared via `function` further down so
  // its hoisting puts it in scope; arrow wraps below pin the lookup at
  // call time.
  if (!savedGame) {
    seedPlayerStarts({
      world,
      scenario,
      tiles,
      humanPlayerId: HUMAN_PLAYER_ID,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      standardStartingResources: STANDARD_STARTING_RESOURCES,
      standardPopulationCap: STANDARD_POPULATION_CAP,
      defaultDifficulty: DEFAULT_DIFFICULTY,
      playerAges,
      playerCivilizations,
      researchedTechnologies,
      playerResources,
      population,
      villagerOrdinals,
      wonderCountdownOverrides,
      relicCountdownOverrides,
      buildingHealthStates,
      combatStates,
      relicsInMonastery,
      ensureAiState,
      addBuildingEntity,
      addUnitEntity,
      addResourceEntity,
      findScenarioSpawnPosition: (origin: import('civ-engine').Position) => findScenarioSpawnPosition(origin),
      buildingOccupiesCell: (id: number, x: number, y: number) => buildingOccupiesCell(id, x, y),
      isTerrainPassableForUnit: (x: number, y: number) => isTerrainPassableForUnit(x, y),
      isCellBlockedByBuilding: (x: number, y: number) => isCellBlockedByBuilding(x, y),
    });
    seedTerrain({
      world,
      scenario,
      tiles,
      humanPlayerId: HUMAN_PLAYER_ID,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      standardStartingResources: STANDARD_STARTING_RESOURCES,
      standardPopulationCap: STANDARD_POPULATION_CAP,
      defaultDifficulty: DEFAULT_DIFFICULTY,
      playerAges,
      playerCivilizations,
      researchedTechnologies,
      playerResources,
      population,
      villagerOrdinals,
      wonderCountdownOverrides,
      relicCountdownOverrides,
      buildingHealthStates,
      combatStates,
      relicsInMonastery,
      ensureAiState,
      addBuildingEntity,
      addUnitEntity,
      addResourceEntity,
      findScenarioSpawnPosition: (origin: import('civ-engine').Position) => findScenarioSpawnPosition(origin),
      buildingOccupiesCell: (id: number, x: number, y: number) => buildingOccupiesCell(id, x, y),
      isTerrainPassableForUnit: (x: number, y: number) => isTerrainPassableForUnit(x, y),
      isCellBlockedByBuilding: (x: number, y: number) => isCellBlockedByBuilding(x, y),
    });
    seedScenarioEntities({
      world,
      scenario,
      tiles,
      humanPlayerId: HUMAN_PLAYER_ID,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      standardStartingResources: STANDARD_STARTING_RESOURCES,
      standardPopulationCap: STANDARD_POPULATION_CAP,
      defaultDifficulty: DEFAULT_DIFFICULTY,
      playerAges,
      playerCivilizations,
      researchedTechnologies,
      playerResources,
      population,
      villagerOrdinals,
      wonderCountdownOverrides,
      relicCountdownOverrides,
      buildingHealthStates,
      combatStates,
      relicsInMonastery,
      ensureAiState,
      addBuildingEntity,
      addUnitEntity,
      addResourceEntity,
      findScenarioSpawnPosition: (origin: import('civ-engine').Position) => findScenarioSpawnPosition(origin),
      buildingOccupiesCell: (id: number, x: number, y: number) => buildingOccupiesCell(id, x, y),
      isTerrainPassableForUnit: (x: number, y: number) => isTerrainPassableForUnit(x, y),
      isCellBlockedByBuilding: (x: number, y: number) => isCellBlockedByBuilding(x, y),
    });
  }

  if (savedGame) {
    hydrateFromSavedGame({
      world,
      savedGame,
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
      setUnitCommand,
      inFlightTechSetFor,
    });
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
    isVisibleToHuman: (position: import('civ-engine').Position, owner: number | null) => isVisibleToHuman(position, owner),
    isEntityFootprintVisibleToHuman: (position: import('civ-engine').Position, owner: number | null, w: number, h: number) =>
      isEntityFootprintVisibleToHuman(position, owner, w, h),
    buildingOccupiesCell: (id: number, x: number, y: number) => buildingOccupiesCell(id, x, y),
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
    getSelectedEntityId: (): number | null => getSelectedEntityId(),
    getTrainOptions: (owner: number, buildingType: import('../types').BuildingType) => getTrainOptions(owner, buildingType),
    getResearchOptions: (owner: number, buildingType: import('../types').BuildingType) => getResearchOptions(owner, buildingType),
    getMarketOptions: (owner: number, buildingType: import('../types').BuildingType) => getMarketOptions(owner, buildingType),
    getBuildOptions: (owner: number, unitType: import('../types').UnitType) => getBuildOptions(owner, unitType),
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

  // assignNearestResource moved into bridge/systems/villagerEconomySystem
  // (its only caller).

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
    isEntityVisibleToHuman: (id: number) => isEntityVisibleToHuman(id),
    getSelectedEntityIds: (): number[] => getSelectedEntityIds(),
    getSelectableEntitiesAtCell: (x: number, y: number) => getSelectableEntitiesAtCell(x, y),
    findResourceAtCell: (x: number, y: number) => findResourceAtCell(x, y),
    findOwnedGarrisonBuildingAtCell: (x: number, y: number, owner: number, unitType: import('../types').UnitType) =>
      findOwnedGarrisonBuildingAtCell(x, y, owner, unitType),
    findHostileUnitAtCell: (x: number, y: number, owner: number) => findHostileUnitAtCell(x, y, owner),
    findHostileBuildingAtCell: (x: number, y: number, owner: number) => findHostileBuildingAtCell(x, y, owner),
    findHostileWildlifeAtCell: (x: number, y: number) => findHostileWildlifeAtCell(x, y),
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

  registerAllSystems({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
    defaultRelicCountdownTicks: RELIC_COUNTDOWN_TICKS,
    townCenterRefs,
    aiStates,
    population,
    playerResources,
    constructionStates,
    productionQueues,
    unitCommands,
    wildlifeStates,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    monkTasks,
    monkConvertProcessedThisTick,
    monkCarriedRelic,
    relicsInMonastery,
    rallyPoints,
    inFlightTechByOwner,
    sheepMoveOrders,
    gathererDropOffStuckSinceTick,
    trackedVisibilitySources,
    garrisonedByBuilding,
    wonderCountdowns,
    relicCountdowns,
    relicCountdownOverrides,
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
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    findNearestHostileWildlifeTarget,
    issueUnitAttackCommand,
    issueUnitMoveCommand,
    clearUnitCommand,
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
    destroyResourceEntity,
    getEntityRef,
    onBuildingConstructionComplete,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
    setPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
    findBuildingSpawnPosition,
    addUnitEntity,
    applyTechnology,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    shouldMaintainGatheringOrder,
    findResourceApproachPlan,
    findNearestDropOffBuilding,
    findWildlifeRangePlan,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    isGarrisonedUnit,
    isMatchRunning,
    isAiMilitaryUnit,
    getOrCreateMemoryMap,
    currentRelicHoldingOwner,
    finalizeMatchEnd,
    playerHasConquestPresence,
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
    getSelectedEntityId: (): number | null => getSelectedEntityId(),
    getSelectedEntityIds: (): number[] => getSelectedEntityIds(),
    getSelectedOwnedSheepIds: (): number[] => getSelectedOwnedSheepIds(),
    getSelectedHumanUnitIds: (): number[] => getSelectedHumanUnitIds(),
    isEntityVisibleToHuman: (id: number) => isEntityVisibleToHuman(id),
    enqueueRejection,
    issueUnitMoveCommand,
    issueUnitContextCommand: (unitId: number, target: import('civ-engine').Position) => issueUnitContextCommand(unitId, target),
    issueUnitContextCommandAtEntity: (unitId: number, targetEntityId: number) =>
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

  // Economy snapshot lives in `bridge/economyStateOps`.
  const { getEconomyState } = createEconomyStateOps({
    world,
    combatStates,
    constructionStates,
    productionQueues,
    playerAges,
    playerResources,
    population,
    getUnitTaskState: (id: number) => getUnitTaskState(id),
  });

  return {
    world,
    saveGame,
    getEconomyState,
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
