import type Phaser from 'phaser';

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
  CameraState,
  GameScene,
  PlacementPreviewViewState,
  PlacementPreviewVisualState,
  SelectionBoxState,
} from '../../phaser/scenes/GameScene';
import type { RecordingService } from '../../game/recording/RecordingService';
import type { AgentStateSnapshot, CommandDispatchResult } from '../../game/playtest/types';
import { buildAgentSnapshot } from '../../game/playtest/agentSnapshot';
import { validateAgentCommandShape } from './agentCommandValidator';

interface BrowserTestBridge {
  step(deltaMs: number): void;
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
  // dispatchAgentCommand can shape-validate + push.
  pendingCommands: Array<{ type: string; data: Record<string, unknown> }>;
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
}

export interface BrowserTestSnapshot {
  hudState: HudState;
  renderState: RenderState;
  economyState: EconomyState;
  selectionState: SelectionState;
  cameraState: CameraState | null;
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

// LLM-agent harness surface (Phase 1.B). Methods used by
// `scripts/playtest-llm.mjs` Playwright runner. Production app does
// not call any of them.
export interface AgentDispatchEventLog {
  commandType: string;
  accepted: boolean;
  rejectionReason?: string;
  rejectionMessage?: string;
}

export interface BrowserTestAgentApi {
  /** Bounded state view shaped for prompt-token efficiency.
   *  See `docs/threads/current/llm-agent-playtest/DESIGN.md` §1.
   *  Phase-6.B (impl-2 M7): `enemies` is filtered by per-owner
   *  visibility (engine `VisibilityMap`) by default. Pass
   *  `{omniscient: true}` to revert to cheat-mode global ground-truth
   *  — appropriate for a single-LLM-vs-passive-human smoke baseline
   *  where fog isn't meaningful. */
  snapshotForAgent(ownerId: number, options?: { omniscient?: boolean }): AgentStateSnapshot;
  /** On-page canvas bounding box in CSS pixels. The runner calls
   *  `page.screenshot({ clip: bbox })` with this. */
  getCanvasBboxForScreenshot(): { x: number; y: number; width: number; height: number };
  /** Push a structured command onto pendingCommands; shape-only validation. */
  dispatchAgentCommand(command: unknown): Promise<CommandDispatchResult>;
  /** Live RecordingService.bundle(). Use exportRecorderBundleToFile
   *  for 30k-tick bundles to avoid the JSON-RPC payload limit. */
  getRecorderBundle(): import('civ-engine').SessionBundle;
  /** Serialize bundle to a Blob; return a blob: URL the runner can
   *  fetch as bytes. Avoids the ~1MB JSON-RPC payload limit. */
  exportRecorderBundleToFile(): Promise<{ blobUrl: string; size: number }>;
  /** Drain accumulated dispatch events (one per command processed
   *  through `drainPendingCommands` since the last call). The runner
   *  calls this after each `advanceTicks` to correlate dispatched
   *  commands with semantic rejections — does NOT compete with the
   *  HUD's `consumeCommandRejection` FIFO. (impl-1 H1.) */
  drainAgentDispatchLog(): AgentDispatchEventLog[];
  /** Phase-6.D: per-owner unit/building counts at the current tick.
   *  Used by the winner oracle to score the game outcome. Reads from
   *  the bridge's existing economy-state surface — no engine-internal
   *  coupling. */
  getEntityCountsByOwner(): Record<number, { units: number; buildings: number }>;
}

export interface BrowserTestApi {
  isBooted(): boolean;
  getHudState(): HudState;
  getRenderState(): RenderState;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  getCameraState(): CameraState | null;
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
   *  `agent.getRecorderBundle()` / `agent.exportRecorderBundleToFile()`
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
    advanceTicks: (count: number, deltaMs = 100) => {
      const safeCount = Math.max(0, Math.floor(count));
      const safeDeltaMs = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 100;
      const liveBridge = getBridge();
      for (let index = 0; index < safeCount; index += 1) {
        liveBridge.step(safeDeltaMs);
      }

      scene.syncFromBridge(true);
      return getSnapshot(liveBridge, scene);
    },
    replay: options.replay,
    agent: makeAgentApi(getBridge, scene, options.getRecording),
  };
  target.__AOE2_TEST__ = Object.freeze(api);
}

function makeAgentApi(
  getBridge: () => BrowserTestBridge,
  scene: GameScene,
  getRecording: () => RecordingService,
): BrowserTestAgentApi {
  // Per-runner dispatch log. The agent observer fires once per drained
  // command between ticks; we accumulate into this array and drain on
  // demand. The observer is reattached lazily on every dispatch so a
  // bridge swap (save/load) doesn't strand the subscription.
  let dispatchLog: AgentDispatchEventLog[] = [];
  function ensureObserverAttached(): void {
    getBridge().setAgentDispatchObserver((event) => {
      dispatchLog.push({
        commandType: String(event.commandType),
        accepted: event.accepted,
        rejectionReason: event.rejectionReason,
        rejectionMessage: event.rejectionMessage,
      });
    });
  }

  return {
    snapshotForAgent: (
      ownerId: number,
      options?: { omniscient?: boolean },
    ): AgentStateSnapshot => {
      scene.syncFromBridge(true);
      const bridge = getBridge();
      const economy = bridge.getEconomyState();
      const selection = bridge.getSelectionState();
      const renderTick = bridge.getRenderState().tick;
      // Camera bbox in world coords; pixel bbox + worldToScreen sample
      // table for the visible cells (caps at 64 entries to keep prompt
      // tokens bounded).
      const camera = scene.getCameraState();
      const canvasRect = getCanvasRect();
      // CameraState.viewX/Y/Width/Height is the world-coords viewport
      // exposed by GameScene.getCameraState — convert to integer cell
      // bbox for the snapshot.
      const worldBbox = camera
        ? {
            minX: Math.floor(camera.viewX),
            minY: Math.floor(camera.viewY),
            maxX: Math.ceil(camera.viewX + camera.viewWidth),
            maxY: Math.ceil(camera.viewY + camera.viewHeight),
          }
        : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      const worldToScreenSamples: Array<{
        cellX: number;
        cellY: number;
        pixelX: number;
        pixelY: number;
      }> = [];
      const STEP = 4;
      for (let cy = worldBbox.minY; cy <= worldBbox.maxY; cy += STEP) {
        for (let cx = worldBbox.minX; cx <= worldBbox.maxX; cx += STEP) {
          if (worldToScreenSamples.length >= 64) break;
          const pt = scene.getScreenPointForCell(cx, cy);
          if (pt) worldToScreenSamples.push({ cellX: cx, cellY: cy, pixelX: pt.x, pixelY: pt.y });
        }
      }
      // Phase-6.B (impl-2 M7): per-owner visibility probe via the
      // bridge's new isCellVisibleForOwner. Pure pass-through to the
      // engine's VisibilityMap; combined with `omniscient` flag in
      // buildAgentSnapshot to honor the cheat-mode cap.
      const visibility = (
        probeOwnerId: number,
        x: number,
        y: number,
      ): boolean => bridge.isCellVisibleForOwner(probeOwnerId, x, y);
      return buildAgentSnapshot({
        ownerId,
        tick: renderTick,
        tps: 50,
        economy,
        selection,
        screenMapping: {
          worldBbox,
          pixelBbox: canvasRect,
          worldToScreen: worldToScreenSamples,
        },
        visibility,
        omniscient: options?.omniscient ?? false,
      });
    },

    getCanvasBboxForScreenshot: () => getCanvasRect(),

    dispatchAgentCommand: async (command: unknown): Promise<CommandDispatchResult> => {
      const result = validateAgentCommandShape(command, {
        ownerRangeInclusive: { min: 1, max: 8 },
      });
      if (!result.accepted) return result;
      ensureObserverAttached();
      const bridge = getBridge();
      bridge.pendingCommands.push({
        type: result.commandKind as string,
        data: result.normalized,
      });
      return result;
    },

    drainAgentDispatchLog: () => {
      const events = dispatchLog;
      dispatchLog = [];
      return events;
    },

    getRecorderBundle: () => {
      const recording = getRecording();
      const bundle = recording.bundle();
      if (!bundle) {
        throw new Error('No recorder bundle yet — start() must complete before getRecorderBundle().');
      }
      return bundle;
    },

    exportRecorderBundleToFile: async () => {
      const recording = getRecording();
      const bundle = recording.bundle();
      if (!bundle) {
        throw new Error('No recorder bundle yet — start() must complete before exportRecorderBundleToFile().');
      }
      const json = JSON.stringify(bundle);
      const blob = new Blob([json], { type: 'application/json' });
      const blobUrl = URL.createObjectURL(blob);
      return { blobUrl, size: blob.size };
    },

    getEntityCountsByOwner: () => {
      // Phase-6.D: aggregate live unit/building counts from the
      // bridge's economy-state surface. Pure read; no engine-internal
      // coupling. The winner oracle in `src/game/playtest/winnerOracle.ts`
      // consumes this shape.
      const economy = getBridge().getEconomyState();
      const counts: Record<number, { units: number; buildings: number }> = {};
      for (const u of economy.units) {
        const slot = counts[u.owner] ?? { units: 0, buildings: 0 };
        slot.units += 1;
        counts[u.owner] = slot;
      }
      for (const b of economy.buildings) {
        const slot = counts[b.owner] ?? { units: 0, buildings: 0 };
        slot.buildings += 1;
        counts[b.owner] = slot;
      }
      return counts;
    },
  };
}

function getCanvasRect(): { x: number; y: number; width: number; height: number } {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };
  const rect = canvas.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}
