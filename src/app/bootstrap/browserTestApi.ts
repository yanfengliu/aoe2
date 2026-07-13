import type Phaser from 'phaser';
import type { ThreeCaptureResult, ThreeRenderMetrics } from 'voxel/three';

import type {
  UnitType,
  EconomyState,
  HudState,
  PlacementPreviewState,
  RenderState,
  SelectionState,
} from '../../game/simulation/types';
import type {
  BuildingVisualState,
  DisplayedEntityState,
  EntityHealthBarState,
  OccludedUnitState,
  CameraState,
  GameScene,
  PlacementPreviewViewState,
  PlacementPreviewVisualState,
  SelectionBoxState,
} from '../../phaser/scenes/GameScene';
import type { RecordingService } from '../../game/recording/RecordingService';
import { makeAgentApi, type BrowserTestAgentApi } from './browserTestAgentApi';
import { hasSingleThreeIdentity } from '../../rendering/voxel/threeIdentity';
import type { AoeUnitMotionHistory } from '../../rendering/voxel/aoeVoxelUnitAnimation';

export interface BrowserTestBridge {
  step(deltaMs: number): void;
  // playtest-fixes C: manual-pause flag (already on SimulationBridge);
  // declared here for the structurally-typed facade.
  setPaused(paused: boolean): void;
  getHudState(): HudState;
  getRenderState(): RenderState;
  getRenderInterpolationAlpha(): number;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  getPlacementPreview(x: number, y: number): PlacementPreviewState | null;
  confirmBuildingPlacement(x: number, y: number): boolean;
  selectEntityAtCell(x: number, y: number): boolean;
  selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean;
  selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean;
  clearSelection(): void;
  issueContextCommand(x: number, y: number): boolean;
  issueMoveCommand(x: number, y: number): boolean;
  // LLM-agent harness needs the in-place pendingCommands queue so
  // dispatchAgentCommand can shape-validate + push. `agentIssued` tags
  // agent submissions so the dispatch observer can scope its log.
  pendingCommands: Array<{ type: string; data: Record<string, unknown>; agentIssued?: boolean }>;
  // playtest-fixes iter-1 (Codex HIGH): ownership enforcement reads the
  // acting entity's owner component before queueing agent commands.
  readonly world: {
    getComponent<T>(entityId: number, kind: 'unit' | 'building' | 'resource'): T | undefined | null;
  };
  // Drains any pending semantic rejection (string reason) — already on
  // SimulationBridge; kept here for the structurally-typed
  // BrowserTestBridge facade.
  consumeCommandRejection: () => string | null;
  setAgentDispatchObserver: (
    observer: import('../../game/simulation/dispatcher').AgentDispatchObserver | null,
  ) => void;
  // Phase-6.B (impl-2 M7): per-owner visibility probe used by the
  // agent snapshot's enemy-filtering path. Pure pass-through to the
  // engine's VisibilityMap.
  isCellVisibleForOwner: (ownerId: number, x: number, y: number) => boolean;
  // agent-affordances B/C: per-building options (+ locked reasons) and
  // fog-gated open-anchor search, composed into the agent snapshot.
  getAgentBuildingOptions: (
    ownerId: number,
  ) => import('../../game/simulation/createSimulationBridge').AgentBuildingOptions;
  findOpenPlacementAnchorsNear: (
    ownerId: number,
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    max: number,
  ) => Array<{ x: number; y: number }>;
}

export interface BrowserTestSnapshot {
  hudState: HudState;
  renderState: RenderState;
  economyState: EconomyState;
  selectionState: SelectionState;
  cameraState: CameraState | null;
}

export interface BrowserWorldRendererState {
  readonly mode: 'voxel' | 'phaser';
  readonly metrics: ThreeRenderMetrics | null;
}

export interface BrowserCaptureState {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

// Slice 6 (replay-load-and-e2e v0.1.13): replay-related test surface.
// Lets Playwright assert replay mode + current tick + open the dialog
// programmatically without poking at internal HUD/dialog markup.
//
// Deferred follow-up (v0.1.15): `seedPriorSession()` rolls a save+load
// round-trip so the live recorder closes its current session and IDB
// gets a prior session that the dialog's Prior tab can pick up.
// Fulfils the "prior-session e2e" deferred item from the v0.1.12
// thread close — without it the spec needs an external IDB seed.
export interface BrowserTestReplayApi {
  getReplayMode(): 'live' | 'replay';
  getReplayCurrentTick(): number;
  openReplayLoadDialog(): void;
  seedPriorSession(): Promise<void>;
}



export interface BrowserTestApi {
  isBooted(): boolean;
  getHudState(): HudState;
  getRenderState(): RenderState;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  getCameraState(): CameraState | null;
  getWorldRendererState(): BrowserWorldRendererState;
  inspectVoxelUnitMotion(identity: string): AoeUnitMotionHistory | null;
  hasSingleThreeIdentity(): boolean;
  captureCompositeFrame(): BrowserCaptureState | null;
  captureWorldFrame(): ThreeCaptureResult | null;
  /** Phase 1.B (llm-agent-playtest). Five methods scoped to the
   *  LLM-agent harness; production app never calls them. */
  agent: BrowserTestAgentApi;
  /** Slice 6: replay test surface. Required at runtime — `createApp`
   *  always installs it. The field is non-optional in the type so
   *  Playwright specs can read `api.replay.getReplayMode()` without
   *  optional-chaining at every call site. */
  replay: BrowserTestReplayApi;
  getSelectionBoxState(): SelectionBoxState | null;
  getPlacementPreviewState(): PlacementPreviewViewState | null;
  getPlacementPreviewVisualState(): PlacementPreviewVisualState | null;
  getPlacementPreviewAt(cellX: number, cellY: number): PlacementPreviewState | null;
  getBuildingVisualStates(): BuildingVisualState[];
  getEntityHealthBarStates(): EntityHealthBarState[];
  getOccludedUnitStates(): OccludedUnitState[];
  getDisplayedEntities(): DisplayedEntityState[];
  worldToScreen(cellX: number, cellY: number): { x: number; y: number };
  confirmBuildingPlacement(cellX: number, cellY: number): boolean;
  selectEntityAtWorldPosition(worldX: number, worldY: number): boolean;
  selectEntityAtCell(cellX: number, cellY: number): boolean;
  selectOwnedUnitsByTypeInRect(
    unitType: UnitType | 'sheep',
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): boolean;
  selectUnitsInBox(minX: number, minY: number, maxX: number, maxY: number): boolean;
  clearSelection(): void;
  issueContextCommand(cellX: number, cellY: number): boolean;
  issueContextCommandAtWorldPosition(worldX: number, worldY: number): boolean;
  issueMoveCommand(cellX: number, cellY: number): boolean;
  getSnapshot(): BrowserTestSnapshot;
  advanceTicks(count: number, deltaMs?: number): BrowserTestSnapshot;
  /** playtest-fixes C: manual-pause pass-through (`bridge.setPaused`).
   *  While paused, `bridge.step` is a no-op, so the scene's frame loop
   *  cannot advance the sim — `advanceTicks` (which the pausing host
   *  wraps in an atomic unpause→step→repause task) becomes the only
   *  tick source during LLM playtests. */
  setPaused(paused: boolean): void;
}

declare global {
  interface Window {
    __AOE2_TEST__?: BrowserTestApi;
  }
}

function getSnapshot(
  bridge: BrowserTestBridge,
  scene: GameScene,
): BrowserTestSnapshot {
  scene.syncFromBridge(true);
  return {
    hudState: bridge.getHudState(),
    renderState: bridge.getRenderState(),
    economyState: bridge.getEconomyState(),
    selectionState: bridge.getSelectionState(),
    cameraState: scene.getCameraState(),
  };
}

// Iter-3 V3-25: install once, resolve bridge dynamically. Pre-fix,
// `installBrowserTestApi` captured the bridge at install time and was
// re-called on each load — leaving any test that captured a reference
// to the prior `window.__AOE2_TEST__` object pointing at a stale
// bridge. The Playwright suite always re-resolves
// `window.__AOE2_TEST__` per call, so it didn't bite — but a future
// test holding a long-lived ref would silently observe pre-load state.
//
// New shape: pass a `getBridge: () => BrowserTestBridge` thunk.
// createApp owns the live bridge cell; the API closures resolve via
// the thunk every call. Subsequent loads only need to update the cell;
// no re-install is required. Object.freeze hardens against accidental
// mutation by tests.
export interface BrowserTestApiInstallOptions {
  /** Slice 6: replay surface wired through to replayController. Required
   *  — every install site must provide it. */
  replay: BrowserTestReplayApi;
  /** Phase 1.B (llm-agent-playtest). Resolves the live recorder so
   *  `agent.getRecorderBundle()`
   *  can call `recording.bundle()`. Required — every install site
   *  must provide it. */
  getRecording: () => RecordingService;
}

export function installBrowserTestApi(
  target: Window,
  game: Phaser.Game,
  getBridge: () => BrowserTestBridge,
  scene: GameScene,
  options: BrowserTestApiInstallOptions,
): void {
  // Iter-3 V3-25 follow-up: do NOT short-circuit when an API is
  // already installed. Re-install replaces the object so a full
  // app-bootstrap (HMR, multi-instance test harness) sees the new
  // game/scene closures. The original V3-25 concern (stale-bridge-on-
  // load) is solved by the `getBridge` thunk, which always resolves
  // to createApp's live `bridge` cell — so handleLoadGame doesn't
  // need to re-install at all (and now doesn't).
  let pausedThroughTestApi = false;
  const api: BrowserTestApi = {
    isBooted: () => game.isBooted && scene.scene.isActive(),
    getHudState: () => getBridge().getHudState(),
    getRenderState: () => getBridge().getRenderState(),
    getEconomyState: () => getBridge().getEconomyState(),
    getSelectionState: () => getBridge().getSelectionState(),
    getCameraState: () => {
      scene.syncFromBridge(true);
      return scene.getCameraState();
    },
    getWorldRendererState: () => scene.getWorldRendererState(),
    inspectVoxelUnitMotion: (identity: string) => {
      scene.syncFromBridge(true);
      return scene.inspectVoxelUnitMotion(identity);
    },
    hasSingleThreeIdentity,
    captureCompositeFrame: () => {
      const canvas = scene.getCaptureCanvas();
      if (!canvas) return null;
      return {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      };
    },
    captureWorldFrame: () => scene.getWorldCapture(),
    getSelectionBoxState: () => scene.getSelectionBoxState(),
    getPlacementPreviewState: () => {
      scene.syncFromBridge(true);
      return scene.getPlacementPreviewState();
    },
    getPlacementPreviewVisualState: () => {
      scene.syncFromBridge(true);
      return scene.getPlacementPreviewVisualState();
    },
    getPlacementPreviewAt: (cellX: number, cellY: number) => {
      // Iter-3 V3-17: parity with the other getters in this API; tests
      // calling this immediately after a command (without manually
      // advancing ticks) would otherwise observe a stale preview
      // through the scene-cached path. The bridge call itself is the
      // authoritative source so the value isn't wrong without the
      // sync, but the asymmetry is a correctness footgun.
      scene.syncFromBridge(true);
      return getBridge().getPlacementPreview(cellX, cellY);
    },
    getBuildingVisualStates: () => {
      scene.syncFromBridge(true);
      return scene.getBuildingVisualStates();
    },
    getEntityHealthBarStates: () => {
      scene.syncFromBridge(true);
      return scene.getEntityHealthBarStates();
    },
    getOccludedUnitStates: () => {
      scene.syncFromBridge(true);
      return scene.getOccludedUnitStates();
    },
    getDisplayedEntities: () => {
      scene.syncFromBridge(true);
      return scene.getDisplayedEntities();
    },
    worldToScreen: (cellX: number, cellY: number) => {
      scene.syncFromBridge(true);
      const point = scene.getScreenPointForCell(cellX, cellY);
      if (!point) {
        throw new Error('Game scene is not ready to project screen coordinates.');
      }
      return point;
    },
    selectEntityAtCell: (cellX: number, cellY: number) => {
      const didSelect = getBridge().selectEntityAtCell(cellX, cellY);
      scene.syncFromBridge(true);
      return didSelect;
    },
    selectEntityAtWorldPosition: (worldX: number, worldY: number) => {
      const didSelect = scene.selectEntityAtWorldPosition(worldX, worldY);
      scene.syncFromBridge(true);
      return didSelect;
    },
    selectOwnedUnitsByTypeInRect: (unitType, minX, minY, maxX, maxY) => {
      const didSelect = getBridge().selectOwnedUnitsByTypeInRect(unitType, minX, minY, maxX, maxY);
      scene.syncFromBridge(true);
      return didSelect;
    },
    selectUnitsInBox: (minX, minY, maxX, maxY) => {
      const didSelect = getBridge().selectUnitsInBox(minX, minY, maxX, maxY);
      scene.syncFromBridge(true);
      return didSelect;
    },
    confirmBuildingPlacement: (cellX: number, cellY: number) => {
      const didPlace = getBridge().confirmBuildingPlacement(cellX, cellY);
      scene.syncFromBridge(true);
      return didPlace;
    },
    clearSelection: () => {
      getBridge().clearSelection();
      scene.syncFromBridge(true);
    },
    issueContextCommand: (cellX: number, cellY: number) => {
      const didIssue = getBridge().issueContextCommand(cellX, cellY);
      scene.syncFromBridge(true);
      return didIssue;
    },
    issueContextCommandAtWorldPosition: (worldX: number, worldY: number) => {
      const didIssue = scene.issueContextCommandAtWorldPosition(worldX, worldY);
      scene.syncFromBridge(true);
      return didIssue;
    },
    issueMoveCommand: (cellX: number, cellY: number) => {
      const didIssue = getBridge().issueMoveCommand(cellX, cellY);
      scene.syncFromBridge(true);
      return didIssue;
    },
    getSnapshot: () => getSnapshot(getBridge(), scene),
    setPaused: (paused: boolean) => {
      pausedThroughTestApi = paused;
      getBridge().setPaused(paused);
    },
    advanceTicks: (count: number, deltaMs = 100) => {
      const safeCount = Math.max(0, Math.floor(count));
      const safeDeltaMs = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 100;
      const liveBridge = getBridge();
      if (pausedThroughTestApi) liveBridge.setPaused(false);
      try {
        for (let index = 0; index < safeCount; index += 1) {
          liveBridge.step(safeDeltaMs);
        }
      } finally {
        if (pausedThroughTestApi) liveBridge.setPaused(true);
      }

      scene.syncFromBridge(true);
      return getSnapshot(liveBridge, scene);
    },
    replay: options.replay,
    agent: makeAgentApi(getBridge, scene, options.getRecording),
  };
  target.__AOE2_TEST__ = Object.freeze(api);
}
