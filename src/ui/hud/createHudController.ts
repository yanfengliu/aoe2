import type {
  ActionType,
  BuildableBuildingType,
  EconomyState,
  HudState,
  MarketActionType,
  ResearchableTechnologyType,
  RenderState,
  SelectionState,
  SimulationDebugSnapshot,
  TrainableUnitType,
} from '../../game/simulation/types';
import type { SaveBlob } from '../../game/simulation/saveSchema';
import { createTooltipController } from './tooltips';
import { HUD_TEMPLATE_HTML } from './hudTemplate';
import { createToastController } from './toast';
import {
  createDebugOverlayController,
  type DebugOverlayMode,
} from './debugOverlay';
import { createPostGameSummary } from './postGameSummary';
import { createSaveLoadPanel } from './saveLoadPanel';
import {
  formatAgeName,
  formatCountdownTicks,
  formatMatchTime,
} from './displayNames';
import {
  drawMinimap,
  getMinimapLayout,
  minimapCameraSignature,
  minimapContentSignature,
  minimapToCell,
} from './minimap';
import { createSelectionPanel } from './selectionPanel';
import { createGameMenu } from './gameMenu';

interface HudCameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
  viewX: number;
  viewY: number;
  viewWidth: number;
  viewHeight: number;
  // Visible iso-pixel rectangle's 4 corners in CELL space, polygon order (full-review M8).
  viewCorners: readonly { cellX: number; cellY: number }[];
}

interface HudBridge {
  getHudState(): HudState;
  getRenderState(): RenderState;
  getEconomyState(): EconomyState;
  getSelectionState(): SelectionState;
  getCameraState(): HudCameraState | null;
  centerCameraOnWorldPosition(worldX: number, worldY: number): void;
  issueAction(actionType: ActionType): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
  // Slice 11: drain the oldest pending command rejection so the HUD can
  // show a toast. Returns null if no rejection is pending.
  consumeCommandRejection(): string | null;
  // Slice 11: snapshot for the F2 debug overlay. Every frame the HUD
  // requests this when the overlay is in anything other than 'off' mode.
  getDebugSnapshot(): SimulationDebugSnapshot;
  // FU5: serialize the live simulation for the HUD Save button. The
  // HUD writes the returned blob to localStorage and triggers a
  // download.
  saveGame(): SaveBlob;
  // FU5 (widened in Spec 2 v0.1.5 AO-5): swap the running simulation with
  // one rehydrated from `blob`. `createApp` owns the bridge + scene
  // wiring so it implements this callback and rewires the scene, HUD, and
  // browser test API to the new bridge. **Returns a Promise** so async
  // work (e.g., the new RecordingService.start() in Spec 2's
  // rebuildAnnotationStack helper) can be awaited; the saveLoadPanel
  // shows the success toast only after the promise resolves and a
  // failure toast on rejection. Throws / rejects on schema mismatch.
  loadGame(blob: SaveBlob): Promise<void>;
  // Slice 5 (v0.1.12): the unified "Replay…" HUD button. Triggers the
  // ReplayLoadDialog modal that consolidates the three load sources
  // (live session / prior session / file import). Optional so pre-Slice-5
  // callers can omit the wiring (the button stays inert).
  openReplayLoadDialog?(): void;
  // Lets the HUD listen to enter/exit replay events; the unified button
  // is disabled while replay mode is already active. Optional so tests
  // can omit the subscription surface.
  isReplayMode?(): boolean;
  subscribeReplayModeChange?(listener: () => void): () => void;
  // v0.1.95: game-menu wiring. Pause/resume the sim while the menu overlays it;
  // restart the scenario or quit to a fresh start. All optional so tests and the
  // headless HUD can omit them (the menu still opens/closes, just without pause).
  setPaused?(paused: boolean): void;
  isPaused?(): boolean;
  onRestart?(): void;
  onQuit?(): void;
  // Art style: cycle the frame's look and report the current one. Optional so
  // tests and the headless HUD can omit them (the menu row stays inert).
  cycleArtStyle?(): string;
  artStyleLabel?(): string;
}

// Slice 11: debug-overlay mode type remains part of the HUD facade.
export type { DebugOverlayMode } from './debugOverlay';

export interface HudController {
  // Slice 11: the HUD cycles and renders text summaries for debug modes.
  getDebugOverlayMode(): DebugOverlayMode;
  cycleDebugOverlayMode(): DebugOverlayMode;
  // v0.1.95: open/close the in-game menu. createApp binds the Esc key to this
  // through the HotkeyRegistry; the ☰ button is wired inside the controller.
  toggleGameMenu(): void;
  // Spec 2 (annotation-ui v0.1.5) AO-5: expose the toast handle so
  // RecordingService.onPersistenceError can surface IDB failures (quota
  // exceeded, transaction abort) and MarkerListPanel can toast on
  // stale-ref clicks. The toast queue / DOM is private to this
  // controller; only the showToast entry point is exported.
  toastHandle: { showToast(text: string): void };
  // Iter-3 V3-11 / iter-2 M2-6 / iter-1 H-7: tear-down hook so HMR,
  // browser-test teardown, or any future "reset to title" path can
  // cancel the per-frame RAF loop, drop window-level listeners, and
  // dispose the debug-overlay sub-controller. createApp doesn't call
  // this on save-load (the HUD facade closures re-read the bridge so
  // the same controller continues with the new bridge), but the
  // capability now exists for teardown contexts that need it.
  destroy(): void;
}

export function createHudController(root: HTMLElement, bridge: HudBridge): HudController {
  root.innerHTML = HUD_TEMPLATE_HTML;

  // Iter-3 V3-11: collect any teardown work the controller body
  // schedules (window listener removals, sub-controller destroy() calls,
  // RAF cancellation). The returned destroy() walks this in order.
  const teardownCallbacks: Array<() => void> = [];

  const food = root.querySelector<HTMLElement>('[data-hud="food"]');
  const wood = root.querySelector<HTMLElement>('[data-hud="wood"]');
  const gold = root.querySelector<HTMLElement>('[data-hud="gold"]');
  const stone = root.querySelector<HTMLElement>('[data-hud="stone"]');
  const age = root.querySelector<HTMLElement>('[data-hud="age"]');
  const pop = root.querySelector<HTMLElement>('[data-hud="pop"]');
  const time = root.querySelector<HTMLElement>('[data-hud="time"]');
  const matchSummary = root.querySelector<HTMLElement>('[data-hud="match-summary"]');
  const countdownChip = root.querySelector<HTMLElement>('[data-hud="countdown-chip"]');
  const countdownLabel = root.querySelector<HTMLElement>('[data-hud="countdown-label"]');
  const countdownValue = root.querySelector<HTMLElement>('[data-hud="countdown-value"]');
  const minimap = root.querySelector<HTMLCanvasElement>('[data-hud="minimap"]');
  const selectionPanel = root.querySelector<HTMLElement>('[data-hud="selection-panel"]');

  const tooltip = root.querySelector<HTMLElement>('[data-hud="tooltip"]');
  const toastContainer = root.querySelector<HTMLElement>('[data-hud="toast-container"]');
  const debugOverlay = root.querySelector<HTMLElement>('[data-hud="debug-overlay"]');
  // FU5: Save / Load controls live next to the top bar so they stay
  // available even while a large selection panel is open. The load
  // panel is hidden by default and toggled open by the Load button.
  const saveButton = root.querySelector<HTMLButtonElement>('[data-hud="save-button"]');
  const loadButton = root.querySelector<HTMLButtonElement>('[data-hud="load-button"]');
  const loadPanel = root.querySelector<HTMLElement>('[data-hud="load-panel"]');
  const loadSourceLocalStorageInput = root.querySelector<HTMLInputElement>(
    '[data-hud="load-source-localstorage"]',
  );
  const loadSourceLocalStorageLabel = root.querySelector<HTMLElement>(
    '[data-hud="load-source-localstorage-label"]',
  );
  const loadSourcePasteInput = root.querySelector<HTMLInputElement>(
    '[data-hud="load-source-paste"]',
  );
  const loadPasteTextarea = root.querySelector<HTMLTextAreaElement>(
    '[data-hud="load-paste-textarea"]',
  );
  const loadConfirmButton = root.querySelector<HTMLButtonElement>('[data-hud="load-confirm"]');
  const loadCancelButton = root.querySelector<HTMLButtonElement>('[data-hud="load-cancel"]');
  const replayLoadButtonEl = root.querySelector<HTMLButtonElement>(
    '[data-hud="replay-load-button"]',
  );
  // Slice 11: debug-overlay controller owns the F2 cycle, the mode
  // pointer and text summary.
  const debugOverlayController = createDebugOverlayController(debugOverlay);
  teardownCallbacks.push(() => debugOverlayController.destroy());

  let lastMinimapContentSignature = '';
  let lastMinimapCameraSignature = '';
  let latestRenderState: RenderState | null = null;
  let isMinimapDragActive = false;

  // Slice 11: tooltip mechanism — shared tooltip element + pointer/focus
  // event delegation on `root`. Any descendant with a `data-tooltip`
  // attribute surfaces its copy on hover.
  const tooltipController = createTooltipController(root, tooltip);
  teardownCallbacks.push(() => tooltipController.destroy());

  // Slice 11: toast stream for command rejections and FU5 save/load
  // outcomes. `showToast` is passed down into the save/load panel.
  const { showToast } = createToastController(toastContainer);

  // Slice 8: post-game summary card. Hidden while the match is running.
  const postGameSummary = createPostGameSummary(matchSummary);

  // FU5: Save / Load HUD panel. The bridge reference swaps on load, so
  // the panel calls through arrow closures that re-resolve `bridge`
  // each time.
  const saveLoadPanel = createSaveLoadPanel(
    {
      saveButton,
      loadButton,
      loadPanel,
      loadSourceLocalStorageInput,
      loadSourceLocalStorageLabel,
      loadSourcePasteInput,
      loadPasteTextarea,
      loadConfirmButton,
      loadCancelButton,
    },
    {
      saveGame: () => bridge.saveGame(),
      loadGame: (blob: SaveBlob) => bridge.loadGame(blob),
      showToast,
      isReplayMode: () => bridge.isReplayMode?.() ?? false,
    },
  );
  teardownCallbacks.push(() => saveLoadPanel.destroy());

  // Full-review H2: mark Save unavailable while a replay is playing. The panel
  // handler already refuses the save (the source-of-truth guard); aria-disabled
  // keeps the icon focusable so keyboard users can still reach its explanation.
  if (saveButton) {
    const refreshSaveDisabled = (): void => {
      const unavailable = bridge.isReplayMode?.() ?? false;
      saveButton.disabled = false;
      saveButton.setAttribute('aria-disabled', String(unavailable));
    };
    refreshSaveDisabled();
    const unsubscribeSaveDisabled = bridge.subscribeReplayModeChange?.(refreshSaveDisabled);
    teardownCallbacks.push(() => unsubscribeSaveDisabled?.());
  }

  // v0.1.95: the in-game menu (Esc / ☰). Save/Load/Replay live inside its markup
  // but are wired above via saveLoadPanel + the replay button; this only owns
  // open/close, pause-while-open, and Resume/Restart/Quit/Settings.
  const gameMenu = createGameMenu(root, {
    setPaused: bridge.setPaused ? (paused: boolean) => bridge.setPaused!(paused) : undefined,
    isPaused: bridge.isPaused ? () => bridge.isPaused!() : undefined,
    onRestart: bridge.onRestart ? () => bridge.onRestart!() : undefined,
    onQuit: bridge.onQuit ? () => bridge.onQuit!() : undefined,
    cycleDebugOverlay: () => debugOverlayController.cycleMode(),
    subscribeDebugOverlayModeChange: debugOverlayController.subscribeModeChange,
    cycleArtStyle: bridge.cycleArtStyle?.bind(bridge),
    artStyleLabel: bridge.artStyleLabel?.bind(bridge),
  });
  teardownCallbacks.push(() => gameMenu.destroy());

  if (replayLoadButtonEl) {
    // The unified "Replay…" button. Marked unavailable while replay mode is
    // already active (re-entry guard), but kept focusable for its tooltip.
    // Subscribes to replayController mode-change events so the state flips
    // immediately on enter/exit; falls back to click-time refresh if no
    // subscription is wired.
    // v0.1.95: the Replay flow is its own modal, so close the game menu (whose
    // full-screen backdrop would otherwise sit over the replay dialog + timeline).
    const handler = (): void => {
      if (bridge.isReplayMode?.()) {
        return;
      }
      gameMenu.close();
      bridge.openReplayLoadDialog?.();
    };
    const refreshDisabled = (): void => {
      const unavailable = bridge.isReplayMode?.() ?? false;
      replayLoadButtonEl.disabled = false;
      replayLoadButtonEl.setAttribute('aria-disabled', String(unavailable));
    };
    replayLoadButtonEl.addEventListener('click', handler);
    refreshDisabled();
    const unsubscribe = bridge.subscribeReplayModeChange?.(refreshDisabled);
    teardownCallbacks.push(() => {
      replayLoadButtonEl.removeEventListener('click', handler);
      unsubscribe?.();
    });
  }

  // Selection panel: icons + details + queue + command buttons. Skips
  // re-render when the `selectionState` signature is unchanged.
  const selectionPanelHandle = createSelectionPanel(selectionPanel, {
    getEconomyState: () => bridge.getEconomyState(),
    issueAction: (actionType) => bridge.issueAction(actionType),
    queueTrainUnit: (unitType) => bridge.queueTrainUnit(unitType),
    queueResearch: (technologyType) => bridge.queueResearch(technologyType),
    issueMarketAction: (actionType) => bridge.issueMarketAction(actionType),
    beginBuildingPlacement: (buildingType) => bridge.beginBuildingPlacement(buildingType),
  });

  if (minimap) {
    const handleMinimapPointer = (clientX: number, clientY: number): void => {
      const frame = latestRenderState?.frame;
      if (!frame) {
        return;
      }

      const layout = getMinimapLayout(minimap, frame);
      if (!layout) {
        return;
      }

      const bounds = minimap.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return;
      }
      const canvasScaleX = minimap.width / bounds.width;
      const canvasScaleY = minimap.height / bounds.height;
      const localX = (clientX - bounds.left) * canvasScaleX;
      const localY = (clientY - bounds.top) * canvasScaleY;
      // Invert the diamond projection to a cell, then reject clicks that land
      // outside the map diamond (the canvas corners are off-map).
      const { cellX, cellY } = minimapToCell(localX, localY, layout);
      if (cellX < 0 || cellX > frame.mapWidth || cellY < 0 || cellY > frame.mapHeight) {
        return;
      }
      // centerCameraOnWorldPosition takes CELL coordinates (it projects to iso
      // internally).
      bridge.centerCameraOnWorldPosition(cellX, cellY);
    };

    const handleTrackedMinimapMouseMove = (event: MouseEvent): void => {
      if (!isMinimapDragActive) {
        return;
      }

      if ((event.buttons & 1) === 0) {
        isMinimapDragActive = false;
        return;
      }

      handleMinimapPointer(event.clientX, event.clientY);
    };

    const handleTrackedMinimapMouseEnd = (): void => {
      isMinimapDragActive = false;
    };

    // M2: named handler so its removal can be registered — the prior inline
    // arrow could never be removed, leaking a listener on the minimap element
    // on destroy (test isolation / HMR / future return-to-title).
    const handleMinimapMouseDown = (event: MouseEvent): void => {
      if (event.button !== 0) {
        return;
      }

      isMinimapDragActive = true;
      event.preventDefault();
      handleMinimapPointer(event.clientX, event.clientY);
    };
    minimap.addEventListener('mousedown', handleMinimapMouseDown);
    minimap.addEventListener('mousemove', handleTrackedMinimapMouseMove);
    window.addEventListener('mousemove', handleTrackedMinimapMouseMove);
    window.addEventListener('mouseup', handleTrackedMinimapMouseEnd);
    teardownCallbacks.push(() => {
      minimap.removeEventListener('mousedown', handleMinimapMouseDown);
      minimap.removeEventListener('mousemove', handleTrackedMinimapMouseMove);
      window.removeEventListener('mousemove', handleTrackedMinimapMouseMove);
      window.removeEventListener('mouseup', handleTrackedMinimapMouseEnd);
    });
  }

  function update(): void {
    // Iter-3 V3-11 follow-up: re-entrant safety. If destroy() fires
    // mid-tick (test teardown / HMR), the next scheduled RAF has
    // already been cancelled but the in-flight `update()` body would
    // still re-schedule. Skip work + skip re-schedule when destroyed.
    if (isDestroyed) {
      return;
    }
    const hudState = bridge.getHudState();
    const renderState = bridge.getRenderState();
    latestRenderState = renderState;
    const selectionState = bridge.getSelectionState();
    const cameraState = bridge.getCameraState();

    if (food) food.textContent = String(hudState.playerResources.food);
    if (wood) wood.textContent = String(hudState.playerResources.wood);
    if (gold) gold.textContent = String(hudState.playerResources.gold);
    if (stone) stone.textContent = String(hudState.playerResources.stone);
    if (age) age.textContent = formatAgeName(hudState.currentAge);
    if (pop) pop.textContent = `${hudState.population.current}/${hudState.population.cap}`;
    if (time) time.textContent = formatMatchTime(hudState.tick, hudState.fpsTarget);

    postGameSummary.update(hudState);

    if (countdownChip && countdownLabel && countdownValue) {
      // Slice 8: surface the human player's active countdown (Wonder or
      // Relic) in the top bar so the player sees the timer drop live.
      // Wonder takes precedence when both are active (rare; the first
      // countdown to start wins per the deterministic tie-break rule).
      const wonderTicks = hudState.matchState.wonderCountdownTicks;
      const relicTicks = hudState.matchState.relicCountdownTicks;
      const activeKind: 'wonder' | 'relic' | null =
        wonderTicks !== null
          ? 'wonder'
          : relicTicks !== null
            ? 'relic'
            : null;
      if (activeKind === null) {
        // v0.1.95: reserve the slot (keep its box) so the countdown appearing
        // never reflows the bar — toggle content visibility via the attribute,
        // not `hidden` (display:none, which would remove the box).
        countdownChip.dataset.hudCountdownActive = 'false';
      } else {
        countdownChip.dataset.hudCountdownActive = 'true';
        const ticks = activeKind === 'wonder' ? wonderTicks! : relicTicks!;
        countdownLabel.textContent = activeKind === 'wonder' ? 'Wonder' : 'Relic';
        countdownValue.textContent = formatCountdownTicks(ticks, hudState.fpsTarget);
      }
    }
    selectionPanelHandle.update(selectionState, hudState.playerResources);

    // Slice 11: drain any command-rejection reasons the bridge collected
    // since the last frame. `consumeCommandRejection()` pops one at a time
    // so multiple rejections in the same frame still show as individual
    // toasts without losing any of them.
    let rejection = bridge.consumeCommandRejection();
    while (rejection !== null) {
      showToast(rejection);
      rejection = bridge.consumeCommandRejection();
    }

    // M9: key the redraw on the fog OWNER too (via minimapContentSignature),
    // not just the tick. In replay, `ReplayController` can swap the bridge to a
    // different player's fog perspective at the SAME paused tick; without the
    // owner in the signature the minimap kept showing the prior owner's
    // visibility until a tick/camera change forced a redraw.
    const contentSignature = minimapContentSignature(renderState);
    const cameraSignature = minimapCameraSignature(cameraState);
    if (
      minimap
      && (contentSignature !== lastMinimapContentSignature
        || cameraSignature !== lastMinimapCameraSignature)
    ) {
      drawMinimap(minimap, renderState, cameraState);
      lastMinimapContentSignature = contentSignature;
      lastMinimapCameraSignature = cameraSignature;
    }

    debugOverlayController.render(
      hudState,
      selectionState,
      latestRenderState,
      () => bridge.getDebugSnapshot(),
    );

    rafHandle = requestAnimationFrame(update);
  }

  let rafHandle: number | null = null;
  let isDestroyed = false;
  rafHandle = requestAnimationFrame(update);

  return {
    getDebugOverlayMode: debugOverlayController.getMode,
    cycleDebugOverlayMode: debugOverlayController.cycleMode,
    toggleGameMenu: gameMenu.toggle,
    toastHandle: { showToast },
    destroy() {
      if (isDestroyed) {
        return;
      }
      isDestroyed = true;
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      // Walk teardown in reverse so later-registered callbacks see the
      // earlier ones still alive (matches LIFO destructor convention).
      for (let i = teardownCallbacks.length - 1; i >= 0; i -= 1) {
        try {
          teardownCallbacks[i]();
        } catch (error) {
          // Don't let one teardown's error block the others. Tests
          // may capture a stale element ref or similar; surface it
          // as a console warning rather than throw.
          console.warn('[hud] teardown callback failed:', error);
        }
      }
      teardownCallbacks.length = 0;
    },
  };
}
