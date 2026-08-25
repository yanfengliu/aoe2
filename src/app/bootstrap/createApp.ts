import {
  createSimulationBridge,
  type SimulationBridge,
} from '../../game/simulation/createSimulationBridge';
import type { SaveBlob } from '../../game/simulation/saveSchema';
import { AoeVoxelGameView } from '../AoeVoxelGameView';
import { createHudController, type HudController } from '../../ui/hud/createHudController';
import { installBrowserTestApi } from './browserTestApi';
import { parseDisableAiParam } from './disableAiParam';
import { parseCivParam } from './civParam';
import { parsePlayersParam } from './playersParam';
import { parseTeamsParam } from './teamsParam';
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
// before mounting the game view; on rejection, main.ts catches and renders a
// fatal error message in document.body.
export async function createApp(): Promise<AoeVoxelGameView> {
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

  // Player count: ?players=3 opens a three-player skirmish. §2.2 puts "AI
  // opponents" in scope, so a 1v1 is the default rather than the only shape.
  const playerCount = parsePlayersParam(window.location.href);

  // Teams: ?teams=1,1,2 puts owners 1 and 2 on a side against owner 3. §2.2
  // puts "optional AI allies" in scope; without this every match is a
  // free-for-all, which is also what an unusable value falls back to.
  const teamsByOwner = parseTeamsParam(window.location.href, playerCount ?? 2);

  // FU5: bridge reference is mutable so HUD Load can swap in a
  // rehydrated simulation. AO-12 adds bridgeRef indirection so consumers
  // (PauseControl, AnnotationController, MarkerListPanel) continue to
  // resolve the live bridge after a swap.
  let bridge: SimulationBridge = createSimulationBridge(seed, {
    disableAiForOwners: disableAiForOwners.size > 0 ? disableAiForOwners : undefined,
    civilizationsByOwner: civilizationsByOwner.size > 0 ? civilizationsByOwner : undefined,
    playerCount,
    teamsByOwner: teamsByOwner.size > 0 ? teamsByOwner : undefined,
  });
  const bridgeRef = (): SimulationBridge => bridge;

  // hudController is needed by the annotation stack (toastHandle), so
  // create it BEFORE the first stack rebuild. It receives `handleLoadGame`
  // (defined further down) via the loadGame field.
  // Forward declarations: `view` and `hudController` are assigned once
  // before the first `chainRebuild` call but the assignment must happen
  // AFTER `rebuildAnnotationStack` is defined (the helper closes over them).
  let view: AoeVoxelGameView;
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
        view.setBridge(nextBridge);
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
    let form: AnnotationFormView | null = null;
    let annotationController: AnnotationController | null = null;
    let markerListPanel: MarkerListPanel | null = null;
    try {
      await recording.start();
      form = createAnnotationForm();
      form.mount(hudRoot!);
      annotationController = createAnnotationController({
        recording,
        pauseControl,
        form,
        worldRef: () => bridgeRef().world,
        selection: { getSelectedEntityRefs: () => bridgeRef().getSelectedEntityRefs() },
        captureDataUrlRef: () => view.getWorldCapture().dataUrl,
        toast: hudController.toastHandle,
      });
      markerListPanel = createMarkerListPanel({
        recording,
        pauseControl,
        toast: hudController.toastHandle,
        bridge: {
          panCameraTo: (target) => view.panCameraTo(target),
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
    } catch (error) {
      unsubscribePersistenceError();
      annotationController?.dispose();
      markerListPanel?.dispose();
      form?.dispose();
      try { await recording.stop(); } catch { /* preserve the startup failure */ }
      throw error;
    }
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
        view.setBridge(nextBridge);
      },
    });
    // Chain off any in-flight rebuild OR the live stack — whichever is
    // most recent. handleLoadGame only runs after the initial stack lands,
    // so `stack` is always defined here in practice; the explicit check
    // satisfies TS narrowing now that `stack` is `AnnotationStack | undefined`.
    const priorPromise = _pendingRebuild ?? (stack ? Promise.resolve(stack) : undefined);
    stack = await chainRebuild(priorPromise);
  }

  try {
    view = new AoeVoxelGameView({ host: gameRoot, bridge });
  } catch (error) {
    hotkeyRegistry.dispose();
    throw error;
  }
  const cleanupCallbacks: Array<() => void | Promise<void>> = [
    () => hotkeyRegistry.dispose(),
  ];
  let cleanupPromise: Promise<void> | null = null;
  const cleanupStartupResources = (): Promise<void> => {
    cleanupPromise ??= (async () => {
      for (const cleanup of [...cleanupCallbacks].reverse()) {
        try {
          await cleanup();
        } catch (error) {
          console.error('[aoe2] startup resource cleanup failed', error);
        }
      }
      cleanupCallbacks.length = 0;
    })();
    return cleanupPromise;
  };
  view.onDestroy(() => {
    void cleanupStartupResources();
  });

  try {

  hudController = createHudController(hudRoot, {
    getHudState: () => bridge.getHudState(),
    getRenderState: () => bridge.getRenderState(),
    getEconomyState: () => bridge.getEconomyState(),
    getSelectionState: () => bridge.getSelectionState(),
    getCameraState: () => view.getCameraState(),
    centerCameraOnWorldPosition: (worldX: number, worldY: number) => {
      view.centerCameraOnWorldPosition(worldX, worldY);
    },
    issueAction: (actionType) => bridge.issueAction(actionType),
    setSelectionStance: (stance) => bridge.setSelectionStance(stance),
    setSelectionFormation: (formation: import('../../game/simulation/unitFormation').UnitFormation) =>
      bridge.setSelectionFormation(formation),
    queueTrainUnit: (unitType) => bridge.queueTrainUnit(unitType),
    queueResearch: (technologyType) => bridge.queueResearch(technologyType),
    issueMarketAction: (actionType) => bridge.issueMarketAction(actionType),
    sendTribute: (toPlayerId, resource, amount) => bridge.sendTribute(toPlayerId, resource, amount),
    listTributeTargets: () => bridge.listTributeTargets(),
    humanTributeFeeRate: () => bridge.humanTributeFeeRate(),
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
    // Art style is a display preference, not world state: it never enters a
    // save, and switching it re-resolves the frame rather than the world.
    cycleArtStyle: () => view.cycleArtStyle(),
    artStyleLabel: () => view.artStyleLabel(),
  });
  cleanupCallbacks.push(() => hudController.destroy());
  const timelinePanel = createTimelinePanel({ controller: replayController });
  timelinePanel.mount(hudRoot);
  cleanupCallbacks.push(() => timelinePanel.dispose());
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
  cleanupCallbacks.push(() => replayLoadDialog.dispose());

  // Initial annotation stack. handleLoadGame replaces this cell on bridge swap.
  stack = await chainRebuild(undefined);
  cleanupCallbacks.push(async () => {
    if (stack) await stack.dispose();
  });

  // Hotkey closures resolve `stack` at call time, so handleLoadGame's
  // reassignment is observed automatically (Alt+M after load fires the
  // new stack's controller).
  hotkeyRegistry.register(
    { key: 'm', alt: true },
    gateAnnotationHotkeyOnReplayMode(replayController, () => stack?.annotationController.onHotkey()),
  );
  hotkeyRegistry.register({ key: 'l', alt: true }, () => stack?.markerListPanel.toggleVisibility());
  // M6 control: A arms attack-move; the next left click is its destination
  // (AoE2's own interaction). Right-click or Esc cancels.
  hotkeyRegistry.register({ key: 'a' }, () => {
    view.armAttackMove();
  });
  // M6 control: P arms patrol. Same interaction as attack-move — the next left
  // click is the far end — but the route stands, so the unit paces it until
  // ordered elsewhere.
  hotkeyRegistry.register({ key: 'p' }, () => {
    view.armPatrol();
  });
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
  cleanupCallbacks.push(() => replayHotkeys.dispose());

  const disposeBrowserTestApi = installBrowserTestApi(window, () => bridge, view, {
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
  cleanupCallbacks.push(disposeBrowserTestApi);
  // Install the automation seam before the first simulation frame. This lets
  // deterministic browser harnesses pause immediately without accumulating
  // hidden startup time while recording and HUD services initialize.
  view.start();

  return view;
  } catch (error) {
    view.destroy();
    await cleanupStartupResources();
    throw error;
  }
}
