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
import { HUD_CHIP_TOOLTIPS, createTooltipController } from './tooltips';
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
import { MINIMAP_CELL_SIZE, drawMinimap, getMinimapLayout } from './minimap';
import { createSelectionPanel } from './selectionPanel';

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
  // FU5: swap the running simulation with one rehydrated from `blob`.
  // `createApp` owns the bridge + scene wiring so it implements this
  // callback and rewires the scene, HUD, and browser test API to the
  // new bridge. Throws on schema mismatch so the HUD can toast the
  // failure.
  loadGame(blob: SaveBlob): void;
}

// Slice 11: debug-overlay mode type is re-exported so GameScene +
// browser test API continue to import from `createHudController`.
export type { DebugOverlayMode } from './debugOverlay';

export interface HudController {
  // Slice 11: GameScene reads the active overlay mode so it can draw
  // world-space debug shapes (selection bounds, pathing lines). The HUD
  // itself renders the text overlay for ai-state / perf.
  getDebugOverlayMode(): DebugOverlayMode;
  cycleDebugOverlayMode(): DebugOverlayMode;
}

export function createHudController(root: HTMLElement, bridge: HudBridge): HudController {
  root.innerHTML = `
    <div class="hud-top">
      <div class="hud-bar">
        <div class="hud-chip" data-hud-chip="food" data-tooltip="${HUD_CHIP_TOOLTIPS.food}">
          <div class="hud-label">Food</div>
          <div class="hud-value" data-hud="food">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="wood" data-tooltip="${HUD_CHIP_TOOLTIPS.wood}">
          <div class="hud-label">Wood</div>
          <div class="hud-value" data-hud="wood">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="gold" data-tooltip="${HUD_CHIP_TOOLTIPS.gold}">
          <div class="hud-label">Gold</div>
          <div class="hud-value" data-hud="gold">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="stone" data-tooltip="${HUD_CHIP_TOOLTIPS.stone}">
          <div class="hud-label">Stone</div>
          <div class="hud-value" data-hud="stone">0</div>
        </div>
        <div class="hud-chip" data-hud-chip="age" data-tooltip="${HUD_CHIP_TOOLTIPS.age}">
          <div class="hud-label">Age</div>
          <div class="hud-value" data-hud="age">Dark Age</div>
        </div>
        <div class="hud-chip" data-hud-chip="pop" data-tooltip="${HUD_CHIP_TOOLTIPS.pop}">
          <div class="hud-label">Pop</div>
          <div class="hud-value" data-hud="pop">0/0</div>
        </div>
        <div class="hud-chip" data-hud-chip="time" data-tooltip="${HUD_CHIP_TOOLTIPS.time}">
          <div class="hud-label">Time</div>
          <div class="hud-value" data-hud="time">00:00</div>
        </div>
        <div class="hud-chip" data-hud-chip="countdown" data-hud="countdown-chip" data-tooltip="${HUD_CHIP_TOOLTIPS.countdown}" hidden>
          <div class="hud-label" data-hud="countdown-label">Countdown</div>
          <div class="hud-value" data-hud="countdown-value">00:00</div>
        </div>
        <div class="hud-save-load">
          <button
            type="button"
            class="hud-save-load__button"
            data-hud="save-button"
            data-tooltip="Save the current match to browser storage and download a .json copy."
          >Save</button>
          <button
            type="button"
            class="hud-save-load__button"
            data-hud="load-button"
            data-tooltip="Load a saved match from browser storage or paste in a save blob."
          >Load</button>
        </div>
      </div>
      <div class="hud-load-panel" data-hud="load-panel" hidden>
        <div class="hud-load-panel__title">Load saved match</div>
        <label class="hud-load-panel__option">
          <input
            type="radio"
            name="hud-load-source"
            value="localstorage"
            data-hud="load-source-localstorage"
            checked
          />
          <span data-hud="load-source-localstorage-label">From browser storage</span>
        </label>
        <label class="hud-load-panel__option">
          <input
            type="radio"
            name="hud-load-source"
            value="paste"
            data-hud="load-source-paste"
          />
          <span>From pasted JSON</span>
        </label>
        <textarea
          class="hud-load-panel__textarea"
          data-hud="load-paste-textarea"
          placeholder="Paste save-blob JSON here"
          rows="4"
          hidden
        ></textarea>
        <div class="hud-load-panel__actions">
          <button type="button" class="hud-save-load__button" data-hud="load-confirm">Restore</button>
          <button type="button" class="hud-save-load__button hud-save-load__button--ghost" data-hud="load-cancel">Cancel</button>
        </div>
      </div>
    </div>
    <div class="hud-bottom">
      <div
        class="hud-panel hud-panel--selection"
        data-hud="selection-panel"
      ></div>
      <div class="hud-panel hud-panel--map">
        <div class="hud-label">Minimap</div>
        <canvas
          class="hud-minimap"
          width="220"
          height="160"
          data-hud="minimap"
        ></canvas>
      </div>
      <div class="hud-footer" data-hud="match-summary" hidden></div>
    </div>
    <div class="hud-tooltip" data-hud="tooltip" data-hud-tooltip-active="false" role="tooltip" aria-hidden="true"></div>
    <div class="hud-toasts" data-hud="toast-container" aria-live="polite"></div>
    <div
      class="hud-debug-overlay"
      data-hud="debug-overlay"
      data-hud-debug-mode="off"
    ></div>
  `;

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
  // Slice 11: debug-overlay controller owns the F2 cycle, the mode
  // pointer, and the text summary. GameScene reads the mode through
  // the `HudController` facade returned below.
  const debugOverlayController = createDebugOverlayController(debugOverlay);

  let lastRenderedTick = -1;
  let lastMinimapCameraSignature = '';
  let latestRenderState: RenderState | null = null;
  let isMinimapDragActive = false;

  // Slice 11: tooltip mechanism — shared tooltip element + pointer/focus
  // event delegation on `root`. Any descendant with a `data-tooltip`
  // attribute surfaces its copy on hover.
  createTooltipController(root, tooltip);

  // Slice 11: toast stream for command rejections and FU5 save/load
  // outcomes. `showToast` is passed down into the save/load panel.
  const { showToast } = createToastController(toastContainer);

  // Slice 8: post-game summary card. Hidden while the match is running.
  const postGameSummary = createPostGameSummary(matchSummary);

  // FU5: Save / Load HUD panel. The bridge reference swaps on load, so
  // the panel calls through arrow closures that re-resolve `bridge`
  // each time.
  createSaveLoadPanel(
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
    },
  );

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
      if (
        localX < layout.offsetX
        || localX > layout.offsetX + layout.drawWidth
        || localY < layout.offsetY
        || localY > layout.offsetY + layout.drawHeight
      ) {
        return;
      }

      const normalizedX = (localX - layout.offsetX) / layout.drawWidth;
      const normalizedY = (localY - layout.offsetY) / layout.drawHeight;
      bridge.centerCameraOnWorldPosition(
        normalizedX * frame.mapWidth * MINIMAP_CELL_SIZE,
        normalizedY * frame.mapHeight * MINIMAP_CELL_SIZE,
      );
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

    minimap.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }

      isMinimapDragActive = true;
      event.preventDefault();
      handleMinimapPointer(event.clientX, event.clientY);
    });
    minimap.addEventListener('mousemove', handleTrackedMinimapMouseMove);
    window.addEventListener('mousemove', handleTrackedMinimapMouseMove);
    window.addEventListener('mouseup', handleTrackedMinimapMouseEnd);
  }

  function update(): void {
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
        countdownChip.hidden = true;
      } else {
        countdownChip.hidden = false;
        const ticks = activeKind === 'wonder' ? wonderTicks! : relicTicks!;
        countdownLabel.textContent = activeKind === 'wonder' ? 'Wonder' : 'Relic';
        countdownValue.textContent = formatCountdownTicks(ticks, hudState.fpsTarget);
      }
    }
    selectionPanelHandle.update(selectionState);

    // Slice 11: drain any command-rejection reasons the bridge collected
    // since the last frame. `consumeCommandRejection()` pops one at a time
    // so multiple rejections in the same frame still show as individual
    // toasts without losing any of them.
    let rejection = bridge.consumeCommandRejection();
    while (rejection !== null) {
      showToast(rejection);
      rejection = bridge.consumeCommandRejection();
    }

    const minimapCameraSignature = cameraState
      ? `${cameraState.scrollX.toFixed(2)},${cameraState.scrollY.toFixed(2)},${cameraState.zoom.toFixed(3)}`
      : 'none';
    if (
      minimap
      && (renderState.tick !== lastRenderedTick || minimapCameraSignature !== lastMinimapCameraSignature)
    ) {
      drawMinimap(minimap, renderState, cameraState);
      lastRenderedTick = renderState.tick;
      lastMinimapCameraSignature = minimapCameraSignature;
    }

    debugOverlayController.render(
      hudState,
      selectionState,
      latestRenderState,
      () => bridge.getDebugSnapshot(),
    );

    requestAnimationFrame(update);
  }

  update();

  return {
    getDebugOverlayMode: debugOverlayController.getMode,
    cycleDebugOverlayMode: debugOverlayController.cycleMode,
  };
}
