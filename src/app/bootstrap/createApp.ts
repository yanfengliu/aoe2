import Phaser from 'phaser';

import {
  createSimulationBridge,
  type SimulationBridge,
} from '../../game/simulation/createSimulationBridge';
import type { SaveBlob } from '../../game/simulation/saveSchema';
import { GameScene } from '../../phaser/scenes/GameScene';
import { createHudController, type HudController } from '../../ui/hud/createHudController';
import { installBrowserTestApi } from './browserTestApi';
import { parseDisableAiParam } from './disableAiParam';
import { parseCivParam } from './civParam';
import { parseRendererMode } from './rendererMode';
import { createPauseControl } from '../../game/control/PauseControl';
import { createHotkeyRegistry } from '../../game/control/HotkeyRegistry';
import { createRecordingService, type RecordingService } from '../../game/recording/RecordingService';
import {
  createAnnotationController,
  type AnnotationController,
} from '../../game/recording/AnnotationController';
import {
  createAnnotationForm,
  type AnnotationFormView,
} from '../../ui/annotation/AnnotationForm';
import {
  createMarkerListPanel,
  type MarkerListPanel,
} from '../../ui/annotation/MarkerListPanel';
import {
  createReplayController,
} from '../../game/replay/ReplayController';
import { createTimelinePanel } from '../../game/replay/TimelinePanel';
import { registerReplayHotkeys } from '../../game/replay/ReplayHotkeys';
import { replaceLiveBridgeAfterReplayExit } from './replaceBridgeForLoad';
import { gateAnnotationHotkeyOnReplayMode } from './replayAnnotationGate';
import { loadPriorSessionAsReplay } from '../../game/replay/loadPriorSession';
import { createReplayLoadDialog } from '../../ui/replay/replayLoadDialog';

interface AnnotationStack {
  recording: RecordingService;
  annotationController: AnnotationController;
  markerListPanel: MarkerListPanel;
  form: AnnotationFormView;
  unsubscribePersistenceError: () => void;
  dispose(): Promise<void>;
}

// Spec 2 (annotation-ui v0.1.5) AO-12: createApp is async because
// RecordingService.start() awaits IDB connection. main.ts awaits this
// before mounting Phaser; on rejection, main.ts catches and renders a
// fatal error message in document.body.
export async function createApp(): Promise<Phaser.Game> {
  const gameRoot = document.getElementById('game-root');
  const hudRoot = document.getElementById('hud-root');

  if (!gameRoot || !hudRoot) {
    throw new Error('Expected #game-root and #hud-root to exist.');
  }

  // Iter-3 V3-22: distinguish "param absent" (use DEFAULT_SEED) from
  // "param explicitly empty / whitespace" (warn + still fall through).
  const rawSeed = new URL(window.location.href).searchParams.get('seed');
  const trimmedSeed = rawSeed?.trim() ?? '';
  if (rawSeed !== null && trimmedSeed === '') {
    console.warn('[aoe2] ?seed= URL parameter was empty; falling back to DEFAULT_SEED.');
  }
  const seed = trimmedSeed === '' ? undefined : trimmedSeed;

  // LLM-agent harness: ?disableAi=2,3 disables the in-game AI for those
  // owners so an external agent can drive them via dispatchAgentCommand.
  // Owner 1 is the human slot — rejected (passing it would leave nobody
  // to attack). Comma-separated; unparseable tokens warn and skip.
  const disableAiForOwners = parseDisableAiParam(window.location.href);

  // Civ selection: ?civ=<name> sets the human player's civilization so its
  // bonuses (Britons sheep, Franks knights, Goths infantry, Aztecs speed, …)
  // are felt in a real game. Unknown/absent → the default (Britons).
  const civilizationsByOwner = parseCivParam(window.location.href);
  const rendererMode = parseRendererMode(window.location.href);

  // FU5: bridge reference is mutable so HUD Load can swap in a
  // rehydrated simulation. AO-12 adds bridgeRef indirection so consumers
  // (PauseControl, AnnotationController, MarkerListPanel) continue to
  // resolve the live bridge after a swap.
  let bridge: SimulationBridge = createSimulationBridge(seed, {
    disableAiForOwners: disableAiForOwners.size > 0 ? disableAiForOwners : undefined,
    civilizationsByOwner: civilizationsByOwner.size > 0 ? civilizationsByOwner : undefined,
  });
  const bridgeRef = (): SimulationBridge => bridge;

  // hudController is needed by the annotation stack (toastHandle), so
  // create it BEFORE the first stack rebuild. It receives `handleLoadGame`
  // (defined further down) via the loadGame field.
  // Forward declarations: `scene` and `hudController` are assigned once
  // before the first `chainRebuild` call but the assignment must happen
  // AFTER `rebuildAnnotationStack` is defined (the helper closes over them).
  // eslint-disable-next-line prefer-const
  let scene: GameScene;
  // eslint-disable-next-line prefer-const
  let hudController: HudController;
  // Slice 5 (v0.1.12): the ReplayLoadDialog's `recording` config closes
  // over `stack` lazily (its `bundle()`, `listPriorSessions()`, and
  // `loadPriorSessionBundle()` thunks all read `stack?.recording.X`).
  // The dialog is constructed BEFORE the first `await chainRebuild(undefined)`
  // resolves, so the closures must observe `stack === undefined` until the
  // initial annotation stack lands. Declaring the binding here with an
  // `undefined` initial value gives the closures a defined slot to read
  // (no TDZ) and lets `handleLoadGame` reassign `stack` on save/load.
  let stack: AnnotationStack | undefined;

  // Spec 2 AO-3: PauseControl + HotkeyRegistry shared across rebuilds.
  // Both work against the live bridge via bridgeRef indirection.
  const pauseControl = createPauseControl(bridgeRef);
  const hotkeyRegistry = createHotkeyRegistry();
  const replayController = createReplayController({
    bridgeCell: {
      current: () => bridge,
      replace: (nextBridge) => {
        bridge = nextBridge;
        scene.setBridge(nextBridge);
      },
    },
    isLivePaused: () => pauseControl.isPaused(),
  });

  // Spec 2 AO-12 single-flight cell — closure-scoped per design-5 review.
  let _pendingRebuild: Promise<AnnotationStack> | null = null;

  async function rebuildAnnotationStack(
    prior?: AnnotationStack,
  ): Promise<AnnotationStack> {
    if (prior) {
      try {
        await prior.dispose();
      } catch (err) {
        // Best-effort: log + toast and continue with construction so the
        // user keeps an annotation surface (impl-1 review fix). The
        // disabled-mirror flag prevents toast spam from the underlying
        // mirror failure.
        console.error('[aoe2] prior annotation-stack dispose failed', err);
        try {
          hudController?.toastHandle.showToast(
            `recording cleanup failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        } catch { /* HUD may not be ready yet */ }
      }
    }
    const recording = createRecordingService({ world: bridgeRef().world });
    // FR-1 fix (Codex MAJOR): register the persistence-error listener
    // BEFORE start() so any error fired during start (e.g., synchronous
    // indexedDB.open failure in Safari private mode) is captured.
    const unsubscribePersistenceError = recording.onPersistenceError((err) => {
      hudController.toastHandle.showToast(`recording: ${err.message}`);
    });
    await recording.start();
    const form = createAnnotationForm();
    form.mount(hudRoot!);
    const annotationController = createAnnotationController({
      recording,
      pauseControl,
      form,
      worldRef: () => bridgeRef().world,
      selection: { getSelectedEntityRefs: () => bridgeRef().getSelectedEntityRefs() },
      canvasRef: () => scene.getCaptureCanvas(),
      toast: hudController.toastHandle,
    });
    const markerListPanel = createMarkerListPanel({
      recording,
      pauseControl,
      toast: hudController.toastHandle,
      bridge: {
        panCameraTo: (target) => scene.panCameraTo(target),
        select: (refs) => bridgeRef().select(refs),
      },
      worldRef: () => bridgeRef().world,
      replay: {
        mode: () => replayController.mode,
        bundle: () => replayController.bundle,
        jumpToMarker: (markerId) => replayController.jumpToMarker(markerId),
        onModeChange: (listener) => replayController.onModeChange(listener),
      },
      onReplayPriorSession: async (sessionId: string) => {
        const result = await loadPriorSessionAsReplay({ replayController, recording }, sessionId);
        if (result.status === 'no-payloads') {
          throw new Error('session has no recorded commands; nothing to replay forward');
        }
        if (result.status === 'error') {
          throw result.error ?? new Error('unknown replay error');
        }
      },
    });
    markerListPanel.mount(hudRoot!);
    return {
      recording,
      annotationController,
      markerListPanel,
      form,
      unsubscribePersistenceError,
      async dispose() {
        // Claude FR-1 MINOR M1: reset PauseControl so the new stack
        // starts unpaused. PauseControl tracks `paused` locally; if
        // dispose happens while the form is open, the local cache is
        // stale and the next pause() short-circuits, leaving the new
        // bridge ticking with a phantom-paused indicator.
        try { pauseControl.resume(); } catch { /* best-effort */ }
        unsubscribePersistenceError();
        annotationController.dispose();
        markerListPanel.dispose();
        form.dispose();
        await recording.stop();
      },
    };
  }

  // Single-flight rebuild: every concurrent rebuild observes the prior
  // fully-disposed stack and serializes via the _pendingRebuild chain.
  function chainRebuild(prior: Promise<AnnotationStack> | undefined): Promise<AnnotationStack> {
    const next = (async () => {
      const resolved = prior === undefined ? undefined : await prior.catch(() => undefined);
      return rebuildAnnotationStack(resolved);
    })();
    _pendingRebuild = next;
    return next;
  }

  async function handleLoadGame(blob: SaveBlob): Promise<void> {
    replaceLiveBridgeAfterReplayExit({
      replayController,
      createBridge: () => createSimulationBridge(seed, { savedGame: blob }),
      replaceBridge: (nextBridge) => {
        bridge = nextBridge;
        scene.setBridge(nextBridge);
      },
    });
    // Chain off any in-flight rebuild OR the live stack — whichever is
    // most recent. handleLoadGame only runs after the initial stack lands,
    // so `stack` is always defined here in practice; the explicit check
    // satisfies TS narrowing now that `stack` is `AnnotationStack | undefined`.
    const priorPromise = _pendingRebuild ?? (stack ? Promise.resolve(stack) : undefined);
    stack = await chainRebuild(priorPromise);
  }

  scene = new GameScene(bridge, {
    getDebugOverlayMode: () => hudController.getDebugOverlayMode(),
    rendererMode,
  });

  hudController = createHudController(hudRoot, {
    getHudState: () => bridge.getHudState(),
    getRenderState: () => bridge.getRenderState(),
    getEconomyState: () => bridge.getEconomyState(),
    getSelectionState: () => bridge.getSelectionState(),
    getCameraState: () => scene.getCameraState(),
    centerCameraOnWorldPosition: (worldX: number, worldY: number) => {
      scene.centerCameraOnWorldPosition(worldX, worldY);
    },
    issueAction: (actionType) => bridge.issueAction(actionType),
    queueTrainUnit: (unitType) => bridge.queueTrainUnit(unitType),
    queueResearch: (technologyType) => bridge.queueResearch(technologyType),
    issueMarketAction: (actionType) => bridge.issueMarketAction(actionType),
    beginBuildingPlacement: (buildingType) => bridge.beginBuildingPlacement(buildingType),
    consumeCommandRejection: () => bridge.consumeCommandRejection(),
    getDebugSnapshot: () => bridge.getDebugSnapshot(),
    saveGame: () => bridge.saveGame(),
    loadGame: handleLoadGame,
    isReplayMode: () => replayController.mode === 'replay',
    subscribeReplayModeChange: (listener) => replayController.onModeChange(() => listener()),
    // Slice 5 (v0.1.12): unified replay-load entry point. The dialog is
    // initialized AFTER createHudController returns; this closure is
    // only invoked from a user click on the "Replay…" button, so the
    // `replayLoadDialog` binding is always defined by the time we read
    // it. (Same TDZ-safe pattern documented for slice 4's file-import
    // closure — moved here.)
    openReplayLoadDialog: () => { void replayLoadDialog.open(); },
    // v0.1.95: game-menu wiring. Pause the sim while the menu overlays it; Restart
    // reloads the same scenario, Quit drops the URL params back to a fresh start
    // (there is no separate title screen yet, so both are page reloads).
    setPaused: (paused: boolean) => { if (paused) { pauseControl.pause(); } else { pauseControl.resume(); } },
    isPaused: () => pauseControl.isPaused(),
    onRestart: () => { window.location.reload(); },
    onQuit: () => { window.location.href = window.location.origin + window.location.pathname; },
  });
  const timelinePanel = createTimelinePanel({ controller: replayController });
  timelinePanel.mount(hudRoot);
  const replayLoadDialog = createReplayLoadDialog({
    host: hudRoot,
    replayController,
    recording: {
      // Lazily resolve through the live `stack` so the dialog always
      // reads the current annotation stack's recording surface
      // (handleLoadGame replaces stack on save/load).
      bundle: () => stack?.recording.bundle() ?? null,
      listPriorSessions: () => stack ? stack.recording.listPriorSessions() : Promise.resolve([]),
      loadPriorSessionBundle: (sessionId: string) => {
        if (!stack) return Promise.reject(new Error('recording not ready'));
        return stack.recording.loadPriorSessionBundle(sessionId);
      },
    },
    toast: hudController.toastHandle,
  });

  // Initial annotation stack. handleLoadGame replaces this cell on bridge swap.
  stack = await chainRebuild(undefined);

  // Hotkey closures resolve `stack` at call time, so handleLoadGame's
  // reassignment is observed automatically (Alt+M after load fires the
  // new stack's controller).
  hotkeyRegistry.register(
    { key: 'm', alt: true },
    gateAnnotationHotkeyOnReplayMode(replayController, () => stack?.annotationController.onHotkey()),
  );
  hotkeyRegistry.register({ key: 'l', alt: true }, () => stack?.markerListPanel.toggleVisibility());
  // v0.1.95: Esc toggles the in-game menu (the ☰ button toggles it too). The
  // HotkeyRegistry already suppresses keys while a text input is focused. Esc
  // has prior claimants: in replay mode it EXITS replay, and while a modal
  // <dialog> (e.g. the replay-load dialog) is open it belongs to that dialog —
  // yield in both cases so we don't hijack them (the registry is first-match, so
  // this single registration must arbitrate rather than stack a second handler).
  hotkeyRegistry.register({ key: 'Escape' }, () => {
    if (replayController.mode === 'replay') {
      replayController.exitReplay();
      return;
    }
    if (document.querySelector('dialog[open]')) {
      return;
    }
    hudController.toggleGameMenu();
  });
  const replayHotkeys = registerReplayHotkeys({
    hotkeys: hotkeyRegistry,
    controller: replayController,
    panel: timelinePanel,
  });

  const game = new Phaser.Game({
    // Canvas mode keeps the transparent overlay directly compositable without
    // preserving a second WebGL drawing buffer. The standalone fallback keeps
    // Phaser's normal AUTO renderer choice.
    type: rendererMode === 'voxel' ? Phaser.CANVAS : Phaser.AUTO,
    parent: gameRoot,
    width: gameRoot.clientWidth,
    height: gameRoot.clientHeight,
    backgroundColor: rendererMode === 'voxel' ? 'rgba(0,0,0,0)' : '#132224',
    transparent: rendererMode === 'voxel',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
      antialias: false,
    },
    scene: [scene],
  });

  installBrowserTestApi(window, game, () => bridge, scene, {
    replay: {
      getReplayMode: () => replayController.mode,
      getReplayCurrentTick: () => replayController.currentTick,
      openReplayLoadDialog: () => { void replayLoadDialog.open(); },
      // Deferred follow-up (v0.1.15): rolls a save+load round-trip so
      // the live recorder closes its current session (becoming a prior
      // session in IDB) and starts a fresh one. After this resolves,
      // the dialog's Prior tab will list at least one row sourced from
      // the just-closed session — provided the caller drove enough
      // ticks beforehand for the recorder to have captured commands.
      seedPriorSession: async () => {
        const blob = bridge.saveGame();
        await handleLoadGame(blob);
      },
    },
    // LLM-agent harness (Phase 1.B): test API resolves the live recording
    // service for getRecorderBundle.
    getRecording: () => stack?.recording ?? (() => { throw new Error('recording not initialized'); })(),
  });

  game.events.on('destroy', () => {
    if (stack) void stack.dispose();
    replayHotkeys.dispose();
    timelinePanel.dispose();
    replayLoadDialog.dispose();
    hotkeyRegistry.dispose();
    // M2: hudController owns the render-loop RAF + window mouse listeners (its
    // teardown walk); without this call they leaked on scene destroy (test
    // isolation / HMR / future return-to-title). Its destroy() is idempotent.
    hudController.destroy();
  });

  return game;
}
