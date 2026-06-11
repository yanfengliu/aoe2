import {
  RenderAdapter,
  WorldDebugger,
} from 'civ-engine';
import type { EntityRef } from 'civ-engine';

import type { SimulationBridge } from '../createSimulationBridge';
import { createProjector } from '../bridge/visibility';
import { createRenderStateOps } from '../bridge/renderStateOps';
import type { GameWorld } from '../bridge/pureHelpers';
import { toEngineWorld } from '../bridge/pureHelpers';
import { HUMAN_PLAYER_ID, MAP_HEIGHT, MAP_WIDTH, TPS } from '../prototypeScenario';
import { RenderStore } from '../renderStore';
import type {
  ActionType,
  BuildableBuildingType,
  MarketActionType,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../types';
import { getReplayWorldContext } from './replayWorldContext';

function replayCommandRejected(): false {
  return false;
}

export interface ReplayBridgeOptions {
  getRenderInterpolationAlpha?: () => number;
}

export function makeReplayBridge(
  world: GameWorld,
  options: ReplayBridgeOptions = {},
): SimulationBridge {
  const context = getReplayWorldContext(world);
  if (!context || !context.api) {
    throw new Error('Replay bridge requires a world created by createReplayWorldOnly.');
  }
  const api = context.api;

  const renderStore = new RenderStore();
  const debuggerView = new WorldDebugger({ world: toEngineWorld(world) });
  const renderAdapter = new RenderAdapter({
    world: toEngineWorld(world),
    projector: createProjector(
      context.visibility,
      HUMAN_PLAYER_ID,
      context.seed,
      api.isSelected,
      api.getEntityHealth,
    ),
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

  let renderStoreVersion = 0;

  function flushOutOfBandRenderChange(): void {
    if (api.consumeOutOfBandRenderChange()) {
      refreshRenderProjection();
      renderStoreVersion += 1;
    }
  }

  const { getRenderState: getRenderStateInternal } = createRenderStateOps({
    visibility: context.visibility,
    humanPlayerId: HUMAN_PLAYER_ID,
    renderStore,
    getHumanFogMemorySize: api.getHumanFogMemorySize,
    getFogMemoryEntities: api.getFogMemoryEntities,
    getRenderStoreVersion: () => renderStoreVersion,
  });

  return {
    step() {
      flushOutOfBandRenderChange();
    },
    get world() {
      return world;
    },
    setPaused() {
      // Replay playback is owned by ReplayController, not by scene frames.
    },
    getSelectedEntityRefs() {
      return api.getSelectedEntityRefs();
    },
    select(refs: readonly EntityRef[]) {
      api.selectByRefs(refs);
      flushOutOfBandRenderChange();
    },
    getRenderState() {
      flushOutOfBandRenderChange();
      return getRenderStateInternal();
    },
    getRenderInterpolationAlpha() {
      return options.getRenderInterpolationAlpha?.() ?? 0;
    },
    getHudState() {
      const debugState = renderStore.getDebug();
      const frame = renderStore.getFrame();
      const metrics = debugState?.metrics;
      return {
        tick: renderStore.getTick(),
        entityCount: debugState?.entityCount ?? 0,
        visibleEntities: renderStore.getEntities().length,
        visibleCells: frame?.visibleCells.length ?? 0,
        exploredCells: frame?.exploredCells.length ?? 0,
        tickDurationMs: metrics?.durationMs.total ?? 0,
        fpsTarget: TPS,
        worldSize: `${MAP_WIDTH}x${MAP_HEIGHT}`,
        seed: context.seed,
        currentAge: api.getPlayerAge(HUMAN_PLAYER_ID),
        playerResources: api.getPlayerResources(HUMAN_PLAYER_ID),
        population: api.getPopulationState(HUMAN_PLAYER_ID),
        matchState: api.getMatchState(),
        engineHalted: null,
      };
    },
    getEconomyState() {
      return api.getEconomyState();
    },
    getPopulationState(playerId: number) {
      return api.getPopulationState(playerId);
    },
    getSelectionState() {
      return api.getSelectionState();
    },
    getMatchState() {
      return api.getMatchState();
    },
    getPlacementPreview(x: number, y: number) {
      return api.getPlacementPreview(x, y);
    },
    getEntityHealth(id: number) {
      return api.getEntityHealth(id);
    },
    selectEntityAtCell(x: number, y: number) {
      const selected = api.selectEntityAtCell(x, y);
      flushOutOfBandRenderChange();
      return selected;
    },
    selectEntityById(id: number) {
      const selected = api.selectEntityById(id);
      flushOutOfBandRenderChange();
      return selected;
    },
    selectOwnedUnitsByTypeInRect(unitType, minX, minY, maxX, maxY) {
      return api.selectOwnedUnitsByTypeInRect(unitType, minX, minY, maxX, maxY);
    },
    filterSelectableUnitIds(ids: number[]) {
      return api.filterSelectableUnitIds(ids);
    },
    selectUnitsByIds(ids: number[]) {
      const selected = api.selectUnitsByIds(ids);
      flushOutOfBandRenderChange();
      return selected;
    },
    selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number) {
      const selected = api.selectUnitsInBox(minX, minY, maxX, maxY);
      flushOutOfBandRenderChange();
      return selected;
    },
    clearSelection() {
      api.clearSelection();
      flushOutOfBandRenderChange();
    },
    issueContextCommand: replayCommandRejected,
    issueContextCommandAtEntity: replayCommandRejected,
    issueMoveCommand: replayCommandRejected,
    issueAction(actionType: ActionType) {
      void actionType;
      return replayCommandRejected();
    },
    queueTrainUnit(unitType: TrainableUnitType) {
      void unitType;
      return replayCommandRejected();
    },
    queueResearch(technologyType: ResearchableTechnologyType) {
      void technologyType;
      return replayCommandRejected();
    },
    issueMarketAction(actionType: MarketActionType) {
      void actionType;
      return replayCommandRejected();
    },
    beginBuildingPlacement(buildingType: BuildableBuildingType) {
      void buildingType;
      return replayCommandRejected();
    },
    confirmBuildingPlacement: replayCommandRejected,
    consumeCommandRejection() {
      return api.consumeCommandRejection();
    },
    getDebugSnapshot() {
      return api.getDebugSnapshot();
    },
    saveGame() {
      return api.saveGame();
    },
    // LLM-agent harness exposes pendingCommands on SimulationBridge.
    // Replay mode never accepts new agent commands, so expose an
    // empty mutable array — pushing into it is a no-op for replay
    // playback (the replay drain in `aoe2ReplayPendingCommandDrain`
    // clears any hydrated entries before each step).
    pendingCommands: [],
    // Replay mode has no agent dispatch path; observer setter is a
    // no-op for type-shape parity.
    setAgentDispatchObserver() {
      /* no-op in replay */
    },
    // Replay does not run the LLM-agent harness; surface a permissive
    // probe so type-shape parity holds. (No external caller of replay
    // bridges should hit this in practice.)
    isCellVisibleForOwner() {
      return true;
    },
  };
}
