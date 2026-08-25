import type { ThreeCaptureResult, ThreeRenderMetrics } from 'voxel/three';

import type {
  UnitType,
  EconomyState,
  HudState,
  PlacementPreviewState,
  RenderState,
  SelectionState,
} from '../../game/simulation/types';
import type { ProjectileState } from '../../game/simulation/bridge/projectileTypes';
import type {
  BuildingVisualState,
  DisplayedEntityState,
  EntityHealthBarState,
  CameraState,
  PlacementPreviewViewState,
  PlacementPreviewVisualState,
  SelectionBoxState,
} from '../../rendering/viewTypes';
import type { AoeVoxelGameView } from '../AoeVoxelGameView';
import type { RecordingService } from '../../game/recording/RecordingService';
import { makeAgentApi, type BrowserTestAgentApi } from './browserTestAgentApi';
import { hasSingleThreeIdentity } from '../../rendering/voxel/threeIdentity';
import type { AoeUnitMotionHistory } from '../../rendering/voxel/aoeVoxelUnitAnimation';
import type { PresentedVoxelPartMatrix } from '../../rendering/voxel/AoeVoxelWorldRenderer';
import type { OccludedUnitState } from '../../rendering/voxel/aoeVoxelOcclusionSilhouettes';

export interface BrowserTestBridge {
  step(deltaMs: number): void;
  // playtest-fixes C: manual-pause flag (already on SimulationBridge);
  // declared here for the structurally-typed facade.
  setPaused(paused: boolean): void;
  getHudState(): HudState;
  getRenderState(): RenderState;
  getRenderInterpolationAlpha(): number;
  getEconomyState(): EconomyState;
  getMapSize(): { width: number; height: number };
  /** Spec §10.4: shots in the air, for projectile capture/inspection. */
  getInFlightProjectiles(): readonly ProjectileState[];
  /** Standing orders per unit, for asserting what an interaction produced. */
  getDebugSnapshot(): import('../../game/simulation/types').SimulationDebugSnapshot;
  getSelectionState(): SelectionState;
  getPlacementPreview(x: number, y: number): PlacementPreviewState | null;
  /** Arm placement mode for a building type — the build-menu half of the
   *  placement pair, exposed so captures can stage real constructions. */
  beginBuildingPlacement(buildingType: import('../../game/simulation/types').BuildableBuildingType): boolean;
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
  /** M6 formations: lets a capture script show each shape (spec §9.5). */
  setSelectionFormation(
    formation: import('../../game/simulation/unitFormation').UnitFormation,
  ): boolean;
  clearSelection(): void;
  issueContextCommand(x: number, y: number, garrison?: boolean): boolean;
  issueMoveCommand(x: number, y: number): boolean;
  issueAttackMoveCommand(x: number, y: number): boolean;
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
  readonly mode: 'voxel';
  readonly metrics: ThreeRenderMetrics;
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
  /** Spec §10.4: shots in the air, for projectile capture/inspection. */
  getInFlightProjectiles(): readonly ProjectileState[];
  /** Standing orders per unit, for asserting what an interaction produced. */
  getDebugSnapshot(): import('../../game/simulation/types').SimulationDebugSnapshot;
  getSelectionState(): SelectionState;
  getCameraState(): CameraState | null;
  getWorldRendererState(): BrowserWorldRendererState;
  inspectVoxelUnitMotion(identity: string): AoeUnitMotionHistory | null;
  inspectPresentedVoxelPartMatrix(
    identity: string,
    partSuffix: string,
  ): PresentedVoxelPartMatrix | null;
  hasSingleThreeIdentity(): boolean;
  captureFrame(): BrowserCaptureState;
  captureWorldFrame(): ThreeCaptureResult;
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
  getDisplayedEntities(): DisplayedEntityState[];
  getOccludedUnitStates(): readonly OccludedUnitState[];
  worldToScreen(cellX: number, cellY: number): { x: number; y: number };
  beginBuildingPlacement(buildingType: import('../../game/simulation/types').BuildableBuildingType): boolean;
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
  /** M6 formations: lets a capture script show each shape (spec §9.5). */
  setSelectionFormation(
    formation: import('../../game/simulation/unitFormation').UnitFormation,
  ): boolean;
  clearSelection(): void;
  /** Center the camera on a world cell — lets a capture frame off-center action. */
  centerCameraOnWorldPosition(worldX: number, worldY: number): void;
  /** The map this match is on, in tiles — the browser suite asserts against a
   *  size that §4's ladder chooses from the player count. */
  getMapSize(): { width: number; height: number };
  /** Zoom the camera, so one capture run can sweep several zoom levels.
   *  Returns the zoom the camera's own clamp accepted, which is not the
   *  requested one past the 0.7–2.4 range. */
  setCameraZoom(zoom: number): number;
  issueContextCommand(cellX: number, cellY: number, garrison?: boolean): boolean;
  issueContextCommandAtWorldPosition(worldX: number, worldY: number): boolean;
  issueMoveCommand(cellX: number, cellY: number): boolean;
  issueAttackMoveCommand(cellX: number, cellY: number): boolean;
  getSnapshot(): BrowserTestSnapshot;
  advanceTicks(count: number, deltaMs?: number): BrowserTestSnapshot;
  /** playtest-fixes C: manual-pause pass-through (`bridge.setPaused`).
   *  While paused, `bridge.step` is a no-op, so the view's frame loop
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
  view: AoeVoxelGameView,
): BrowserTestSnapshot {
  view.syncFromBridge(true);
  return {
    hudState: bridge.getHudState(),
    renderState: bridge.getRenderState(),
    economyState: bridge.getEconomyState(),
    selectionState: bridge.getSelectionState(),
    cameraState: view.getCameraState(),
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

interface BrowserTestApiInstallation {
  readonly previous: BrowserTestApi | undefined;
  disposed: boolean;
}

// Symbol metadata stays attached to the frozen API object across HMR module
// replacement, so a newer disposer can skip older installations that already
// tore down out of order instead of resurrecting a dead view.
const BROWSER_TEST_API_INSTALLATION = Symbol.for('aoe2.browser-test-api-installation');

function installationOf(api: BrowserTestApi): BrowserTestApiInstallation | undefined {
  return (api as unknown as Record<symbol, BrowserTestApiInstallation | undefined>)[
    BROWSER_TEST_API_INSTALLATION
  ];
}

export function installBrowserTestApi(
  target: Window,
  getBridge: () => BrowserTestBridge,
  view: AoeVoxelGameView,
  options: BrowserTestApiInstallOptions,
): () => void {
  // Iter-3 V3-25 follow-up: do NOT short-circuit when an API is
  // already installed. Re-install replaces the object so a full
  // app-bootstrap (HMR, multi-instance test harness) sees the new
  // game-view closures. The original V3-25 concern (stale-bridge-on-
  // load) is solved by the `getBridge` thunk, which always resolves
  // to createApp's live `bridge` cell — so handleLoadGame doesn't
  // need to re-install at all (and now doesn't).
  const previous = target.__AOE2_TEST__;
  let pausedThroughTestApi = false;
  const api: BrowserTestApi = {
    isBooted: () => view.isBooted(),
    getHudState: () => getBridge().getHudState(),
    getRenderState: () => getBridge().getRenderState(),
    getEconomyState: () => getBridge().getEconomyState(),
    getInFlightProjectiles: () => getBridge().getInFlightProjectiles(),
    getDebugSnapshot: () => getBridge().getDebugSnapshot(),
    getSelectionState: () => getBridge().getSelectionState(),
    getCameraState: () => {
      view.syncFromBridge(true);
      return view.getCameraState();
    },
    getWorldRendererState: () => view.getWorldRendererState(),
    inspectVoxelUnitMotion: (identity: string) => {
      view.syncFromBridge(true);
      return view.inspectVoxelUnitMotion(identity);
    },
    inspectPresentedVoxelPartMatrix: (identity: string, partSuffix: string) => (
      view.inspectPresentedVoxelPartMatrix(identity, partSuffix)
    ),
    hasSingleThreeIdentity,
    captureFrame: () => {
      const capture = view.getWorldCapture();
      return {
        dataUrl: capture.dataUrl,
        width: capture.width,
        height: capture.height,
      };
    },
    captureWorldFrame: () => view.getWorldCapture(),
    getSelectionBoxState: () => view.getSelectionBoxState(),
    getPlacementPreviewState: () => {
      view.syncFromBridge(true);
      return view.getPlacementPreviewState();
    },
    getPlacementPreviewVisualState: () => {
      view.syncFromBridge(true);
      return view.getPlacementPreviewVisualState();
    },
    getPlacementPreviewAt: (cellX: number, cellY: number) => {
      // Iter-3 V3-17: parity with the other getters in this API; tests
      // calling this immediately after a command (without manually
      // advancing ticks) would otherwise observe a stale preview
      // through the view-cached path. The bridge call itself is the
      // authoritative source so the value isn't wrong without the
      // sync, but the asymmetry is a correctness footgun.
      view.syncFromBridge(true);
      return getBridge().getPlacementPreview(cellX, cellY);
    },
    getBuildingVisualStates: () => {
      view.syncFromBridge(true);
      return view.getBuildingVisualStates();
    },
    getEntityHealthBarStates: () => {
      view.syncFromBridge(true);
      return view.getEntityHealthBarStates();
    },
    getDisplayedEntities: () => {
      view.syncFromBridge(true);
      return view.getDisplayedEntities();
    },
    getOccludedUnitStates: () => {
      view.syncFromBridge(true);
      return view.getOccludedUnitStates();
    },
    worldToScreen: (cellX: number, cellY: number) => {
      view.syncFromBridge(true);
      const point = view.getScreenPointForCell(cellX, cellY);
      if (!point) {
        throw new Error('Voxel game view is not ready to project screen coordinates.');
      }
      return point;
    },
    selectEntityAtCell: (cellX: number, cellY: number) => {
      const didSelect = getBridge().selectEntityAtCell(cellX, cellY);
      view.syncFromBridge(true);
      return didSelect;
    },
    selectEntityAtWorldPosition: (worldX: number, worldY: number) => {
      const didSelect = view.selectEntityAtWorldPosition(worldX, worldY);
      view.syncFromBridge(true);
      return didSelect;
    },
    selectOwnedUnitsByTypeInRect: (unitType, minX, minY, maxX, maxY) => {
      const didSelect = getBridge().selectOwnedUnitsByTypeInRect(unitType, minX, minY, maxX, maxY);
      view.syncFromBridge(true);
      return didSelect;
    },
    selectUnitsInBox: (minX, minY, maxX, maxY) => {
      const didSelect = getBridge().selectUnitsInBox(minX, minY, maxX, maxY);
      view.syncFromBridge(true);
      return didSelect;
    },
    setSelectionFormation: (formation) => getBridge().setSelectionFormation(formation),
    beginBuildingPlacement: (buildingType) => getBridge().beginBuildingPlacement(buildingType),
    confirmBuildingPlacement: (cellX: number, cellY: number) => {
      const didPlace = getBridge().confirmBuildingPlacement(cellX, cellY);
      view.syncFromBridge(true);
      return didPlace;
    },
    clearSelection: () => {
      getBridge().clearSelection();
      view.syncFromBridge(true);
    },
    getMapSize: () => getBridge().getMapSize(),
    centerCameraOnWorldPosition: (worldX: number, worldY: number) => {
      view.centerCameraOnWorldPosition(worldX, worldY);
      view.syncFromBridge(true);
    },
    setCameraZoom: (zoom: number) => {
      const applied = view.setCameraZoom(zoom);
      view.syncFromBridge(true);
      return applied;
    },
    issueContextCommand: (cellX: number, cellY: number, garrison?: boolean) => {
      const didIssue = getBridge().issueContextCommand(cellX, cellY, garrison);
      view.syncFromBridge(true);
      return didIssue;
    },
    issueContextCommandAtWorldPosition: (worldX: number, worldY: number) => {
      const didIssue = view.issueContextCommandAtWorldPosition(worldX, worldY);
      view.syncFromBridge(true);
      return didIssue;
    },
    issueAttackMoveCommand: (cellX: number, cellY: number) => {
      const didIssue = getBridge().issueAttackMoveCommand(cellX, cellY);
      view.syncFromBridge(true);
      return didIssue;
    },
    issueMoveCommand: (cellX: number, cellY: number) => {
      const didIssue = getBridge().issueMoveCommand(cellX, cellY);
      view.syncFromBridge(true);
      return didIssue;
    },
    getSnapshot: () => getSnapshot(getBridge(), view),
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

      view.syncFromBridge(true);
      return getSnapshot(liveBridge, view);
    },
    replay: options.replay,
    agent: makeAgentApi(getBridge, view, options.getRecording),
  };
  const installation: BrowserTestApiInstallation = { previous, disposed: false };
  Object.defineProperty(api, BROWSER_TEST_API_INSTALLATION, { value: installation });
  const installed = Object.freeze(api);
  target.__AOE2_TEST__ = installed;
  return () => {
    installation.disposed = true;
    if (target.__AOE2_TEST__ !== installed) return;
    let replacement = installation.previous;
    while (replacement && installationOf(replacement)?.disposed) {
      replacement = installationOf(replacement)?.previous;
    }
    if (replacement === undefined) delete target.__AOE2_TEST__;
    else target.__AOE2_TEST__ = replacement;
  };
}
