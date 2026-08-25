import { RenderAdapter, VisibilityMap } from 'civ-engine';
import type { EntityRef } from 'civ-engine';

import { clamp, toEngineWorld } from './bridge/pureHelpers';
import { createProjector } from './bridge/visibility';
import { createWorld } from './bridge/createWorld';
import { visibilityStateFromSave } from './saveBlobReaders';
import { createRenderStateOps } from './bridge/renderStateOps';
import { createTickHaltState, tryTick } from './bridge/tickHaltGuard';
import { drainPendingCommands } from './dispatcher';
import { DEFAULT_SEED, HUMAN_PLAYER_ID, TPS, createPrototypeScenario } from './prototypeScenario';
import { RenderStore } from './renderStore';
import { createRenderMetricsCapture } from './renderMetricsCapture';
import {
  SAVE_SCHEMA_VERSION,
  isSupportedSaveSchema,
} from './saveSchema';

// MemoryEntry has moved to `bridge/memoryTypes` — re-export so external
// consumers of this module's types still resolve.
import type { CreateSimulationBridgeOptions } from './createSimulationBridgeOptions';
// The SimulationBridge contract lives in `simulationBridgeTypes.ts`; the
// re-export keeps every existing `from './createSimulationBridge'` import.
export type { SimulationBridge } from './simulationBridgeTypes';
import type { SimulationBridge } from './simulationBridgeTypes';
import type { ActionType } from './types';
export type { MemoryEntry } from './bridge/memoryTypes';

// agent-affordances B: payload types for getAgentBuildingOptions,
// re-exported so SimulationBridge consumers import from the facade.
export type {
  AgentBuildingOptions,
  AgentBuildingTypeOptions,
  AgentBuildOption,
  AgentLockedResearch,
  AgentResearchOption,
} from './bridge/buildingOptionsOps';


// Bridge constants live in `bridge/bridgeConstants.ts`.

// V4-19: shared bridge-side types live in `bridge/sharedTypes.ts`. The
// orchestrator re-exports them so external `SimulationBridge` consumers
// keep their existing import paths.
export type {
  UnitCommand,
  MonkTask,
  ConstructionState,
  TrebuchetPackState,
} from './bridge/sharedTypes';

// CombatState / BuildingCombatState / BuildingHealthState / WildlifeState
// shapes live in `bridge/systems/systemTypes` (shared with the per-system
// factories). CachedMovePath shape lives in `bridge/bridgeState`.

export type { CreateSimulationBridgeOptions };

export function createSimulationBridge(
  seed = DEFAULT_SEED,
  options: CreateSimulationBridgeOptions = {},
): SimulationBridge {
  const savedGame = options.savedGame;
  if (savedGame && !isSupportedSaveSchema(savedGame.schema)) {
    throw new Error(
      `Save schema mismatch: expected 1 or ${SAVE_SCHEMA_VERSION}, got ${savedGame.schema}.`,
    );
  }
  // When loading, the seed comes from the blob so the new World's
  // deterministic rng matches the original simulation byte-for-byte.
  const effectiveSeed = savedGame ? savedGame.seed : seed;
  // Built here, not inside createWorld, because the fog map has to be the same
  // size as the world — and both take it from THIS scenario, since generating
  // the seed twice would be two maps that merely look alike.
  const freshScenario = savedGame
    ? null
    : createPrototypeScenario(effectiveSeed, options.playerCount);
  const visibility = savedGame
    ? VisibilityMap.fromState(visibilityStateFromSave(savedGame))
    : new VisibilityMap(freshScenario!.width, freshScenario!.height);
  const {
    world,
    saveGame,
    getEconomyState,
    getPopulationState,
    countIdleVillagers,
    selectNextIdleVillager,
    assignControlGroup,
    recallControlGroup,
    getPlayerAge,
    getPlayerResources,
    getSharedVisionOwners,
    getPlayerCivilization,
    getConstructionCost,
    getMatchState,
    getInFlightProjectiles,
    setSelectionStance,
    setSelectionFormation,
    issueAttackMoveCommand,
    issueAttackGroundCommand,
    issuePatrolCommand,
    getSelectionState,
    getPlacementPreview,
    getAgentBuildingOptions,
    findOpenPlacementAnchorsNear,
    getEntityHealth, getWildlifeAlive, getUnitActiveVerb, getRecentUnitDeaths, getRecentUnitAttacks,
    selectEntityAtCell,
    selectEntityById,
    selectOwnedUnitsByTypeInRect,
    filterSelectableUnitIds,
    selectUnitsByIds,
    selectByRefs,
    selectUnitsInBox,
    clearSelection,
    issueContextCommand,
    issueContextCommandAtEntity: issueContextCommandAtEntityInternal,
    issueMoveCommand,
    issueAction,
    queueTrainUnit,
    queueResearch,
    issueMarketAction,
    sendTribute,
    listTributeTargets,
    humanTributeFeeRate,
    beginBuildingPlacement,
    confirmBuildingPlacement,
    isSelected,
    consumeOutOfBandRenderChange,
    consumeCommandRejection,
    getDebugSnapshot,
    getFogMemoryEntities,
    getHumanFogMemorySize,
    getSelectedEntityRefs,
    pendingCommands,
  } =
    createWorld(effectiveSeed, visibility, savedGame, 'live', {
      disableAiForOwners: options.disableAiForOwners,
      forceAiForOwners: options.forceAiForOwners,
      playerCount: options.playerCount,
      gameLength: options.gameLength,
      civilizationsByOwner: options.civilizationsByOwner,
      teamsByOwner: options.teamsByOwner,
      difficulty: options.difficulty,
      victory: options.victory,
      resourcePreset: options.resourcePreset,
      populationCap: options.populationCap,
      scenario: freshScenario ?? undefined,
    });
  const renderStore = new RenderStore();
  const renderAdapter = new RenderAdapter({
    world: toEngineWorld(world),
    projector: createProjector(
      visibility, HUMAN_PLAYER_ID, effectiveSeed, isSelected, getEntityHealth,
      getRecentUnitDeaths, getRecentUnitAttacks, getWildlifeAlive, getUnitActiveVerb,
      getInFlightProjectiles,
      // Cartography: the human sees its allies' vision once it is researched.
      // Read per frame so researching it mid-match takes effect immediately.
      () => getSharedVisionOwners(HUMAN_PLAYER_ID),
      // v0.3.105: buildings carry their owner's building set.
      (owner) => getPlayerCivilization(owner),
    ),
    debug: createRenderMetricsCapture(world),
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

  function flushOutOfBandRenderChange(): void {
    if (consumeOutOfBandRenderChange()) {
      refreshRenderProjection();
      renderStoreVersion += 1;
    }
  }

  // Render-state assembly + per-tick memo lives in `bridge/renderStateOps`.
  // v0.3.116: live-facade tally of successful bell rings — audio-only, not
  // sim state, not persisted; replays return 0 and stay silent.
  let townBellRings = 0;
  const { getRenderState: getRenderStateInternal } = createRenderStateOps({
    visibility,
    humanPlayerId: HUMAN_PLAYER_ID,
    renderStore,
    getHumanFogMemorySize,
    getFogMemoryEntities,
    getRecentUnitAttacks,
    getRenderStoreVersion: () => renderStoreVersion,
  });

  let accumulatorMs = 0;
  // Stops the tick loop when the engine throws WorldTickFailureError. The
  // engine's fail-fast contract (since v0.4.0) marks the world as poisoned
  // on any tick failure; calling step() again would either throw repeatedly
  // or run on inconsistent state. We surface the halt via getHudState() so
  // the failure is visible instead of silently degrading.
  const haltState = createTickHaltState();

  // Spec 2 (annotation-ui v0.1.5) AO-2: a separate manual-pause state bag,
  // distinct from haltState (which carries EngineHaltDetails for actual
  // engine failures). pausedManually is toggled by setPaused(boolean) and
  // gated in step() AFTER flushOutOfBandRenderChange (so render projections
  // continue to flow while paused) and BEFORE the haltState/match-outcome
  // checks. Reusing haltState here would surface manual pause as a tick
  // failure via getHudState().engineHalted.
  const pauseState: { pausedManually: boolean } = { pausedManually: false };
  // LLM-agent harness observer slot (Phase 1 impl-1 H1).
  let agentDispatchObserver: import('./dispatcher').AgentDispatchObserver | null = null;

  const issueContextCommandAtEntity = (entityId: number, options?: { garrison?: boolean; forceAttack?: boolean }): boolean => {
    const didIssue = issueContextCommandAtEntityInternal(
      entityId, options?.garrison ?? false, options?.forceAttack ?? false,
    );
    if (!didIssue) {
      return false;
    }
    flushOutOfBandRenderChange();
    return true;
  };

  return {
    getMapSize: () => ({ width: world.grid.width, height: world.grid.height }),
    countIdleVillagers,
    selectNextIdleVillager,
    assignControlGroup,
    recallControlGroup,
    getSharedVisionOwners,
    getPlayerCivilization,
    getConstructionCost,
    step(deltaMs: number) {
      flushOutOfBandRenderChange();
      // Spec 2 AO-2: manual pause gate. Placed AFTER flushOutOfBandRenderChange
      // so render projections continue to flow while paused, and BEFORE the
      // existing haltState / match-outcome checks so the HUD's engineHalted
      // (which reads haltState.halted) doesn't reflect manual pause.
      if (pauseState.pausedManually) {
        return;
      }
      if (haltState.halted) {
        return;
      }
      if (getMatchState().outcome !== 'running') {
        return;
      }

      accumulatorMs += deltaMs;
      const tickMs = 1000 / TPS;

      while (accumulatorMs >= tickMs) {
        // Phase 1A: drain AI intention queue between ticks (DESIGN v17 §6.5).
        // AI-decision systems push intentions during execute; this pre-step
        // call submits any previous tick's intentions via world.submitWithResult
        // so they process at the start of this tick. Intentions pushed by this
        // tick stay bridge-owned until the next tick, which lets saveGame()
        // persist the one-tick command-boundary window.
        drainPendingCommands(world, pendingCommands, agentDispatchObserver ?? undefined);
        if (!tryTick(() => world.step(), haltState)) {
          accumulatorMs = 0;
          break;
        }
        accumulatorMs -= tickMs;
      }
    },
    // Spec 2 AO-2: world getter — exposes the engine World instance for
    // RecordingService / AnnotationController / MarkerListPanel.
    get world() {
      return world;
    },
    setPaused(paused: boolean) {
      pauseState.pausedManually = paused;
    },
    isCellVisibleForOwner(ownerId: number, x: number, y: number): boolean {
      return visibility.isVisible(ownerId, x, y);
    },
    getSelectedEntityRefs,
    // Spec 2 AO-2 (impl-1 review fix): return void per DESIGN §7 contract.
    // Callers pre-filter through world.isCurrent so a "did anything
    // select?" boolean isn't part of the contract; selectByRefs's internal
    // boolean is opaque to public consumers.
    select(refs: readonly EntityRef[]) {
      selectByRefs(refs);
    },
    getRenderState() {
      flushOutOfBandRenderChange();
      return getRenderStateInternal();
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
        visibleEntities: getRenderStateInternal().entities.length,
        visibleCells: frame?.visibleCells.length ?? 0,
        exploredCells: frame?.exploredCells.length ?? 0,
        tickDurationMs,
        fpsTarget: TPS,
        worldSize: `${String(world.grid.width)}x${String(world.grid.height)}`,
        seed: effectiveSeed,
        currentAge: getPlayerAge(HUMAN_PLAYER_ID),
        playerResources: getPlayerResources(HUMAN_PLAYER_ID),
        population: getPopulationState(HUMAN_PLAYER_ID),
        matchState: getMatchState(),
        engineHalted: haltState.halted,
      };
    },
    getEconomyState,
    getPopulationState,
    getSelectionState,
    getMatchState,
    getInFlightProjectiles,
    getRecentUnitAttacks,
    // Delete key (v0.3.114): one entity per press — the PRIMARY selection —
    // and only your own; the validator re-enforces ownership at the door.
    deleteSelectedEntity(): boolean {
      const id = getSelectionState().selectedEntityId;
      if (id === null) return false;
      const result = world.submitWithResult('entity.delete', {
        entityId: id,
        requestedBy: HUMAN_PLAYER_ID,
      });
      return result.accepted;
    },
    setSelectionStance,
    setSelectionFormation,
    issueAttackMoveCommand,
    issueAttackGroundCommand,
    issuePatrolCommand,
    getPlacementPreview,
    getAgentBuildingOptions,
    findOpenPlacementAnchorsNear,
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
    issueContextCommand(x: number, y: number, garrison?: boolean) {
      const didIssue = issueContextCommand(x, y, garrison);
      flushOutOfBandRenderChange();
      return didIssue;
    },
    issueContextCommandAtEntity,
    issueMoveCommand,
    issueAction(actionType: ActionType) {
      const didIssue = issueAction(actionType);
      if (didIssue && actionType === 'ring-town-bell') townBellRings += 1;
      flushOutOfBandRenderChange();
      return didIssue;
    },
    getTownBellRings: () => townBellRings,
    queueTrainUnit,
    queueResearch,
    issueMarketAction,
    sendTribute,
    listTributeTargets,
    humanTributeFeeRate,
    beginBuildingPlacement,
    confirmBuildingPlacement(x: number, y: number) {
      const didConfirm = confirmBuildingPlacement(x, y);
      flushOutOfBandRenderChange();
      return didConfirm;
    },
    consumeCommandRejection,
    getDebugSnapshot,
    saveGame,
    pendingCommands,
    setAgentDispatchObserver(observer) {
      agentDispatchObserver = observer;
    },
  };
}
