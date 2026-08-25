import {
  RenderAdapter,
} from 'civ-engine';
import type { EntityRef } from 'civ-engine';

import type { SimulationBridge } from '../createSimulationBridge';
import { createProjector } from '../bridge/visibility';
import { createRenderStateOps } from '../bridge/renderStateOps';
import type { GameWorld } from '../bridge/pureHelpers';
import { toEngineWorld } from '../bridge/pureHelpers';
import { HUMAN_PLAYER_ID, TPS } from '../prototypeScenario';
import { RenderStore } from '../renderStore';
import { createRenderMetricsCapture } from '../renderMetricsCapture';
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
  // replay-fog-owner (2026-06-12): which player's fog perspective the
  // replay renders. Defaults to the human observer (player 1). This is
  // a FOG toggle, not a POV switch: only visibility projection +
  // entity filtering follow the owner; HUD panels stay human-bound,
  // and "last seen" fog-memory ghosts render only for the human owner
  // because the engine records that memory for the human player alone.
  fogOwner?: number;
}

// replay-fog-owner iter-1 (Codex HIGH / Claude MED / Gemini): the replay
// bridge's RenderAdapter registers a world.onDiff listener at
// construction. Scrub commits re-materialize the world (old listeners
// die with it), but fog switches rebuild the bridge over the SAME
// world — without an explicit teardown every toggle would leak a
// connected adapter that clones diffs and projects into an abandoned
// store on each tick. ReplayController calls this on every outgoing
// replay bridge after a successful swap.
export interface ReplayBridge extends SimulationBridge {
  disposeReplayRenderAdapter(): void;
}

export function makeReplayBridge(
  world: GameWorld,
  options: ReplayBridgeOptions = {},
): ReplayBridge {
  const context = getReplayWorldContext(world);
  if (!context || !context.api) {
    throw new Error('Replay bridge requires a world created by createReplayWorldOnly.');
  }
  const api = context.api;
  const fogOwner = options.fogOwner ?? HUMAN_PLAYER_ID;

  const renderStore = new RenderStore();
  const renderAdapter = new RenderAdapter({
    world: toEngineWorld(world),
    projector: createProjector(
      context.visibility,
      fogOwner,
      context.seed,
      api.isSelected,
      api.getEntityHealth,
      api.getRecentUnitDeaths,
      api.getRecentUnitAttacks,
      api.getWildlifeAlive,
      api.getUnitActiveVerb,
      api.getInFlightProjectiles,
    ),
    debug: createRenderMetricsCapture(world),
    send(message) {
      renderStore.apply(message);
    },
  });

  renderAdapter.connect();

  // iter-2 hardening: a disposed bridge must never self-reconnect via
  // the refresh path (both bridges over one world share the api's
  // out-of-band flag, so a stale consumer could otherwise re-attach the
  // dead adapter AND steal the flag from the live bridge).
  let renderAdapterDisposed = false;

  function refreshRenderProjection(): void {
    if (renderAdapterDisposed) return;
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

  // `humanPlayerId` here is really "perspective owner": it gates the
  // building/resource footprint-visibility filter. Fog-memory ghosts
  // exist only for the human player's recorded memory, so non-human
  // perspectives get zeroed getters (live visibility, no ghosts).
  const { getRenderState: getRenderStateInternal } = createRenderStateOps({
    visibility: context.visibility,
    humanPlayerId: fogOwner,
    renderStore,
    getHumanFogMemorySize:
      fogOwner === HUMAN_PLAYER_ID ? api.getHumanFogMemorySize : () => 0,
    getFogMemoryEntities:
      fogOwner === HUMAN_PLAYER_ID ? api.getFogMemoryEntities : () => [],
    getRecentUnitAttacks: api.getRecentUnitAttacks,
    getRenderStoreVersion: () => renderStoreVersion,
  });

  return {
    // A replay's map is whatever the recorded world was built at.
    getMapSize: () => ({ width: world.grid.width, height: world.grid.height }),
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
    getInFlightProjectiles() {
      return api.getInFlightProjectiles();
    },
    issueAttackMoveCommand() {
      // Replay is playback: orders come from the recorded stream.
      return false;
    },
    issuePatrolCommand() {
      // Replay is playback: orders come from the recorded stream.
      return false;
    },
    setSelectionStance() {
      // Replay is playback: stance changes come from the recorded stream, not
      // from the viewer.
      return false;
    },
    setSelectionFormation() {
      // Replay is playback: stance changes come from the recorded stream, not
      // from the viewer.
      return false;
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
        visibleEntities: getRenderStateInternal().entities.length,
        visibleCells: frame?.visibleCells.length ?? 0,
        exploredCells: frame?.exploredCells.length ?? 0,
        tickDurationMs: metrics?.durationMs.total ?? 0,
        fpsTarget: TPS,
        worldSize: `${String(world.grid.width)}x${String(world.grid.height)}`,
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
    // agent-affordances B/C: read-side pass-throughs (replay worlds
    // carry the same wired ops as live worlds).
    getAgentBuildingOptions(ownerId: number) {
      return api.getAgentBuildingOptions(ownerId);
    },
    findOpenPlacementAnchorsNear(
      ownerId: number,
      centerX: number,
      centerY: number,
      width: number,
      height: number,
      max: number,
    ) {
      return api.findOpenPlacementAnchorsNear(ownerId, centerX, centerY, width, height, max);
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
    sendTribute(toPlayerId: number, resource: import('../types').EconomyResourceKind, amount: number) {
      void toPlayerId; void resource; void amount;
      return replayCommandRejected();
    },
    listTributeTargets: () => [],
    humanTributeFeeRate: () => 0.3,
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
    disposeReplayRenderAdapter() {
      renderAdapterDisposed = true;
      renderAdapter.disconnect();
    },
  };
}
