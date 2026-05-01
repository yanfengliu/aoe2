import {
  RenderAdapter,
  VisibilityMap,
  WorldDebugger,
} from 'civ-engine';
import type { EntityRef } from 'civ-engine';

import { clamp } from './bridge/pureHelpers';
import type { GameWorld } from './bridge/pureHelpers';
import { createProjector } from './bridge/visibility';
import { createWorld } from './bridge/createWorld';
import { createRenderStateOps } from './bridge/renderStateOps';
import { createTickHaltState, tryTick } from './bridge/tickHaltGuard';
import { drainPendingCommands } from './dispatcher';
import { DEFAULT_SEED, HUMAN_PLAYER_ID, MAP_HEIGHT, MAP_WIDTH, TPS } from './prototypeScenario';
import { RenderStore } from './renderStore';
import { SAVE_SCHEMA_VERSION, type SaveBlob } from './saveSchema';
import type {
  ActionType,
  BuildableBuildingType,
  EconomyState,
  HudState,
  MarketActionType,
  MatchState,
  PlacementPreviewState,
  PopulationState,
  ResearchableTechnologyType,
  RenderState,
  SelectionState,
  SimulationDebugSnapshot,
  TrainableUnitType,
  UnitType,
} from './types';

// MemoryEntry has moved to `bridge/memoryTypes` — re-export so external
// consumers of this module's types still resolve.
export type { MemoryEntry } from './bridge/memoryTypes';

export interface SimulationBridge {
  step(deltaMs: number): void;
  // Spec 2 (annotation-ui v0.1.5) AO-2: read-only access to the engine
  // World instance. Required by RecordingService (binds the SessionRecorder
  // to this World) and AnnotationController.worldRef. Stable for THIS
  // bridge's lifetime — the live bridge cell is reassigned on save/load,
  // so consumers must call `bridgeRef().world` (or equivalent indirection)
  // rather than capturing this reference once.
  readonly world: GameWorld;
  // Spec 2 (annotation-ui v0.1.5) AO-2: manual pause/resume gate. Toggles
  // a NEW closure-local `pauseState.pausedManually` flag (NOT haltState).
  // step() early-returns when pausedManually is true; render projections
  // continue to flow because the pause gate is placed AFTER
  // flushOutOfBandRenderChange. getHudState().engineHalted continues to
  // reflect failure-halt only.
  setPaused(paused: boolean): void;
  getRenderState(): RenderState;
  getRenderInterpolationAlpha(): number;
  getHudState(): HudState;
  getEconomyState(): EconomyState;
  getPopulationState(playerId: number): PopulationState;
  getSelectionState(): SelectionState;
  // Spec 2 (annotation-ui v0.1.5) AO-2: parallel selection getters /
  // setters that preserve EntityRef.generation. Used by AnnotationController
  // to resolve the current selection to MarkerRefs.entities, and by
  // MarkerListPanel row clicks to re-select previously-recorded entities.
  // `select` returns void; callers pre-filter stale refs and don't need
  // a "selected anything" signal.
  getSelectedEntityRefs(): readonly EntityRef[];
  select(refs: readonly EntityRef[]): void;
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

  function flushOutOfBandRenderChange(): void {
    if (consumeOutOfBandRenderChange()) {
      refreshRenderProjection();
      renderStoreVersion += 1;
    }
  }

  // Render-state assembly + per-tick memo lives in `bridge/renderStateOps`.
  const { getRenderState: getRenderStateInternal } = createRenderStateOps({
    visibility,
    humanPlayerId: HUMAN_PLAYER_ID,
    renderStore,
    getHumanFogMemorySize,
    getFogMemoryEntities,
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
        if (!tryTick(() => world.step(), haltState)) {
          accumulatorMs = 0;
          break;
        }
        // Phase 1A: drain AI intention queue between ticks (DESIGN v17 §6.5).
        // AI-decision systems push intentions during execute; this between-step
        // call submits each via world.submitWithResult so the recorder captures
        // them with submissionTick = world.tick (post-step). No-op while the
        // queue is empty (Phase 1B fills it as AI systems are refactored).
        drainPendingCommands(world, pendingCommands);
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
        engineHalted: haltState.halted,
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
