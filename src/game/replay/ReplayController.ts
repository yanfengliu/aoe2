import {
  ReplayHandlerMissingError,
  SessionReplayer,
  type Marker,
  type SessionBundle,
  type SessionMetadata,
} from 'civ-engine';

import {
  assertReplayPayloadsAvailable,
  clampTick,
  createDefaultScheduler,
  disposeOutgoingReplayBridge,
  indexCommands,
  replayUpperBoundFor,
  type ReplayContext,
} from './replayControllerHelpers';

import type { SimulationBridge } from '../simulation/createSimulationBridge';
import type { GameCommands, GameComponents, GameEvents, GameWorld } from '../simulation/bridge/pureHelpers';
import { createReplayWorldOnly } from '../simulation/replay/createReplayWorldOnly';
import { getReplayWorldContext } from '../simulation/replay/replayWorldContext';
import {
  makeReplayBridge as defaultMakeReplayBridge,
  type ReplayBridgeOptions,
} from '../simulation/replay/makeReplayBridge';
import { HUMAN_PLAYER_ID, TPS } from '../simulation/prototypeScenario';

export type ReplayMode = 'live' | 'replay';
export type ReplayBundle = SessionBundle<GameEvents, GameCommands>;
// Pin TComponents = GameComponents so a replayed world is registry-typed (engine 1.2.0).
// TDebug (engine-internal JsonValue) is not exported, so `infer` it from the bundle type.
type ReplayBundleDebug = ReplayBundle extends SessionBundle<GameEvents, GameCommands, infer TDebug> ? TDebug : never;
export type ReplayReplayer = SessionReplayer<GameEvents, GameCommands, ReplayBundleDebug, GameComponents>;
export type ReplayWorldFactory = (snapshot: ReplayBundle['initialSnapshot']) => GameWorld;
export type ReplayBridgeFactory = (
  world: GameWorld,
  options?: ReplayBridgeOptions,
) => SimulationBridge;
export type ReplayModeListener = (mode: ReplayMode) => void;
export type ReplayTickListener = (tick: number) => void;

export interface ReplayFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface ReplayBridgeCell {
  current(): SimulationBridge;
  replace(bridge: SimulationBridge): void;
}

export interface ReplayController {
  readonly mode: ReplayMode;
  readonly currentTick: number;
  readonly bundleMetadata: SessionMetadata | null;
  readonly bundle: ReplayBundle | null;
  readonly world: GameWorld | null;
  // replay-fog-owner: rendered fog perspective (default P1, resets each enterReplay).
  readonly fogOwner: number;
  fogOwnerCandidates(): number[];
  setFogOwner(owner: number): void;
  cycleFogOwner(): void;
  enterReplay(bundle: ReplayBundle, atTick?: number): void;
  exitReplay(): void;
  scrubTo(tick: number, options?: { coalesce?: boolean }): void;
  commitPendingScrub(): void;
  stepForward(): void;
  stepBackward(): void;
  jumpToMarker(markerId: string): void;
  play(): void;
  pause(): void;
  isPlaying(): boolean;
  onModeChange(listener: ReplayModeListener): () => void;
  onTickChange(listener: ReplayTickListener): () => void;
}

export function exitReplayBeforeLiveBridgeReplacement(
  controller: Pick<ReplayController, 'mode' | 'exitReplay'>,
): void {
  if (controller.mode === 'replay') {
    controller.exitReplay();
  }
}

export interface ReplayControllerConfig {
  bridgeCell: ReplayBridgeCell;
  isLivePaused: () => boolean;
  worldFactory?: ReplayWorldFactory;
  makeReplayBridge?: ReplayBridgeFactory;
  scheduler?: ReplayFrameScheduler;
}

const REPLAY_TICK_MS = 1000 / TPS;

export function createReplayController(config: ReplayControllerConfig): ReplayController {
  const worldFactory = config.worldFactory ?? createReplayWorldOnly;
  const makeReplayBridge = config.makeReplayBridge ?? defaultMakeReplayBridge;
  const scheduler = config.scheduler ?? createDefaultScheduler();
  const modeListeners = new Set<ReplayModeListener>();
  const tickListeners = new Set<ReplayTickListener>();

  let mode: ReplayMode = 'live';
  let liveBridge: SimulationBridge | null = null;
  let liveWasPausedBeforeReplay = false;
  let replayContext: ReplayContext | null = null;
  let displayedTick = config.bridgeCell.current().world.tick;
  let pendingScrubTick: number | null = null;
  let playing = false;
  let frameHandle: number | null = null;
  let playbackAccumulatorMs = 0;
  let lastFrameTimeMs: number | null = null;
  let renderInterpolationAlpha = 0;
  let fogOwner = HUMAN_PLAYER_ID;

  function emitMode(): void {
    for (const listener of modeListeners) listener(mode);
  }

  function emitTick(): void {
    for (const listener of tickListeners) listener(displayedTick);
  }

  function requireReplayContext(): ReplayContext {
    if (!replayContext) {
      throw new Error('ReplayController is not in replay mode.');
    }
    return replayContext;
  }

  function buildReplayBridge(world: GameWorld, owner: number = fogOwner): SimulationBridge {
    return makeReplayBridge(world, {
      getRenderInterpolationAlpha: () => renderInterpolationAlpha,
      fogOwner: owner,
    });
  }

  function fogOwnerCandidates(): number[] {
    return replayContext ? [...replayContext.fogOwnerCandidates] : [];
  }

  function setFogOwner(owner: number): void {
    const context = requireReplayContext();
    if (!context.fogOwnerCandidates.includes(owner)) {
      throw new Error(
        `Fog owner ${owner} is not a player in this replay (players: ${context.fogOwnerCandidates.join(', ')}).`,
      );
    }
    if (owner === fogOwner) return;
    // Transactional rebuild over the SAME world (iter-1/iter-2): assign +
    // dispose-old only after the swap succeeds; a throwing swap disposes
    // the incoming bridge instead (it already connected to this world).
    const selectedRefs = context.bridge
      .getSelectedEntityRefs()
      .filter((ref) => context.world.isCurrent(ref));
    const bridge = buildReplayBridge(context.world, owner);
    try {
      if (selectedRefs.length > 0) {
        bridge.select(selectedRefs);
      }
      config.bridgeCell.replace(bridge);
    } catch (err) {
      disposeOutgoingReplayBridge(bridge);
      throw err;
    }
    disposeOutgoingReplayBridge(context.bridge);
    fogOwner = owner;
    replayContext = { ...context, bridge };
    emitTick();
  }

  function cycleFogOwner(): void {
    const candidates = fogOwnerCandidates();
    if (candidates.length < 2) return;
    setFogOwner(candidates[(candidates.indexOf(fogOwner) + 1) % candidates.length]!);
  }

  function openReplayAt(tick: number): void {
    const current = requireReplayContext();
    const targetTick = clampTick(current.bundle, tick);
    const world = current.replayer.openAt(targetTick);
    const selectedRefs = current.bridge
      .getSelectedEntityRefs()
      .filter((ref) => world.isCurrent(ref));
    const bridge = buildReplayBridge(world);
    if (selectedRefs.length > 0) {
      bridge.select(selectedRefs);
    }
    const nextContext = { ...current, world, bridge };
    config.bridgeCell.replace(bridge);
    disposeOutgoingReplayBridge(current.bridge);
    replayContext = nextContext;
    pendingScrubTick = null;
    displayedTick = targetTick;
    renderInterpolationAlpha = 0;
    emitTick();
  }

  function cancelFrame(): void {
    if (frameHandle !== null) {
      scheduler.cancel(frameHandle);
      frameHandle = null;
    }
  }

  function resetPlaybackClock(): void {
    playbackAccumulatorMs = 0;
    lastFrameTimeMs = null;
    renderInterpolationAlpha = 0;
  }

  function updateInterpolationAlpha(): void {
    renderInterpolationAlpha = Math.max(
      0,
      Math.min(1, playbackAccumulatorMs / REPLAY_TICK_MS),
    );
  }

  function scheduleNextFrame(): void {
    cancelFrame();
    frameHandle = scheduler.request((timestamp) => {
      frameHandle = null;
      if (!playing) return;
      try {
        runPlaybackFrame(timestamp);
      } catch (err) {
        playing = false;
        cancelFrame();
        throw err;
      }
    });
  }

  function commitPendingScrub(): void {
    if (pendingScrubTick === null) return;
    try {
      openReplayAt(pendingScrubTick);
    } catch (err) {
      const context = replayContext;
      if (context) {
        pendingScrubTick = null;
        displayedTick = context.world.tick;
        emitTick();
      }
      throw err;
    }
  }

  function submitRecordedCommands(context: ReplayContext, tick: number): void {
    const commands = context.commandsByTick.get(tick) ?? [];
    for (const command of commands) {
      if (!context.world.hasCommandHandler(command.type)) {
        throw new ReplayHandlerMissingError(
          `replay needs handler for command type "${String(command.type)}", not registered in replay world`,
          { code: 'handler_missing', commandType: String(command.type), tick },
        );
      }
      context.world.submitWithResult(
        command.type,
        command.data as GameCommands[keyof GameCommands],
      );
    }
  }

  function advanceOneTick(): boolean {
    commitPendingScrub();
    const context = requireReplayContext();
    const upperBound = replayUpperBoundFor(context.bundle);
    if (context.world.tick >= upperBound) {
      playing = false;
      cancelFrame();
      return false;
    }

    assertReplayPayloadsAvailable(context.bundle, context.world.tick + 1);
    submitRecordedCommands(context, context.world.tick);
    context.world.step();
    getReplayWorldContext(context.world)?.accessor.reset();
    displayedTick = context.world.tick;

    if (context.world.tick >= upperBound) {
      playing = false;
      cancelFrame();
      emitTick();
      return false;
    }
    emitTick();
    return true;
  }

  function runPlaybackFrame(timestamp: number): void {
    if (lastFrameTimeMs === null) {
      lastFrameTimeMs = timestamp - REPLAY_TICK_MS;
    }
    const deltaMs = Math.max(0, timestamp - lastFrameTimeMs);
    lastFrameTimeMs = timestamp;
    playbackAccumulatorMs += deltaMs;

    while (playing && playbackAccumulatorMs >= REPLAY_TICK_MS) {
      playbackAccumulatorMs -= REPLAY_TICK_MS;
      if (!advanceOneTick()) {
        resetPlaybackClock();
        return;
      }
    }

    updateInterpolationAlpha();
    if (playing) {
      scheduleNextFrame();
    }
  }

  function findMarker(context: ReplayContext, markerId: string): Marker {
    const marker = context.bundle.markers.find((candidate) => candidate.id === markerId);
    if (!marker) {
      throw new Error(`Replay marker "${markerId}" was not found.`);
    }
    return marker;
  }

  function exitReplay(): void {
    if (mode === 'live') return;
    playing = false;
    cancelFrame();
    resetPlaybackClock();
    const bridgeToRestore = liveBridge;
    const outgoingReplayBridge = replayContext?.bridge ?? null;
    if (bridgeToRestore) {
      config.bridgeCell.replace(bridgeToRestore);
      bridgeToRestore.setPaused(liveWasPausedBeforeReplay);
      displayedTick = bridgeToRestore.world.tick;
    } else {
      displayedTick = config.bridgeCell.current().world.tick;
    }
    // Past the restore throw-point — the replay session is gone for good.
    if (outgoingReplayBridge) {
      disposeOutgoingReplayBridge(outgoingReplayBridge);
    }
    replayContext = null;
    pendingScrubTick = null;
    mode = 'live';
    liveBridge = null;
    liveWasPausedBeforeReplay = false;
    emitMode();
    emitTick();
  }

  function scrubTo(tick: number, options: { coalesce?: boolean } = {}): void {
    const context = requireReplayContext();
    playing = false;
    cancelFrame();
    resetPlaybackClock();
    const targetTick = clampTick(context.bundle, tick);
    if (options.coalesce) {
      pendingScrubTick = targetTick;
      displayedTick = targetTick;
      emitTick();
      return;
    }
    openReplayAt(targetTick);
  }

  return {
    get mode() {
      return mode;
    },
    get currentTick() {
      return mode === 'replay' ? displayedTick : config.bridgeCell.current().world.tick;
    },
    get bundleMetadata() {
      return replayContext?.bundle.metadata ?? null;
    },
    get bundle() {
      return replayContext?.bundle ?? null;
    },
    get world() {
      return replayContext?.world ?? null;
    },
    get fogOwner() {
      return fogOwner;
    },
    fogOwnerCandidates,
    setFogOwner,
    cycleFogOwner,
    enterReplay(bundle: ReplayBundle, atTick = bundle.metadata.startTick) {
      // replay-fog-owner: new sessions default to the human perspective;
      // the closure var is only assigned after the swap succeeds below.
      const fogOwnerForNewSession = HUMAN_PLAYER_ID;
      // Build the new replay context BEFORE mutating any state. If the
      // SessionReplayer constructor or replayer.openAt throws, the
      // controller stays in its pre-call state — no exitReplay(), no
      // setPaused, no bridge swap. Closes the partial-apply bug class
      // for bundles that fail engine-level validation (schemaVersion
      // mismatch, missing metadata.engineVersion, range violations,
      // etc.) when the user is already in replay mode. Slice-4 review.
      const replayer = SessionReplayer.fromBundle(
        bundle,
        // skipRegistrationCheck (civ-engine v0.8.18 absorb): aoe2's
        // replay factory is DELIBERATELY instrumented — replay mode
        // swaps in replay-safe AI-decision systems and registers
        // aoe2ReplayPendingCommandDrain (see registerAllSystems), so
        // its registration manifest intentionally differs from the
        // live recording world. The engine's escape hatch exists for
        // exactly this case; selfCheck remains the divergence backstop.
        {
          worldFactory,
          skipRegistrationCheck: true,
        },
      );
      const targetTick = clampTick(bundle, atTick);
      const world = replayer.openAt(targetTick);
      const bridge = buildReplayBridge(world, fogOwnerForNewSession);
      const nextContext: ReplayContext = {
        bundle,
        replayer,
        world,
        bridge,
        commandsByTick: indexCommands(bundle.commands),
        fogOwnerCandidates: Object.keys(bridge.getEconomyState().playerResources)
          .map(Number)
          .filter((owner) => Number.isInteger(owner))
          .sort((left, right) => left - right),
      };

      // Construction succeeded — safe to mutate state from here.
      if (mode === 'replay') {
        exitReplay();
      }
      resetPlaybackClock();
      const bridgeToRestore = config.bridgeCell.current();
      const priorPaused = config.isLivePaused();
      bridgeToRestore.setPaused(true);
      try {
        config.bridgeCell.replace(bridge);
      } catch (err) {
        bridgeToRestore.setPaused(priorPaused);
        throw err;
      }
      liveBridge = bridgeToRestore;
      liveWasPausedBeforeReplay = priorPaused;
      // iter-1 Codex HIGH: a throwing exitReplay/replace above leaves the
      // prior session's fogOwner intact and consistent with its bridge.
      fogOwner = fogOwnerForNewSession;
      replayContext = nextContext;
      mode = 'replay';
      pendingScrubTick = null;
      displayedTick = targetTick;
      emitMode();
      emitTick();
    },
    exitReplay,
    scrubTo,
    commitPendingScrub,
    stepForward() {
      const context = requireReplayContext();
      scrubTo(clampTick(context.bundle, displayedTick + 1));
    },
    stepBackward() {
      const context = requireReplayContext();
      scrubTo(clampTick(context.bundle, displayedTick - 1));
    },
    jumpToMarker(markerId: string) {
      const marker = findMarker(requireReplayContext(), markerId);
      scrubTo(marker.tick);
    },
    play() {
      requireReplayContext();
      if (playing) return;
      commitPendingScrub();
      const context = requireReplayContext();
      if (context.world.tick >= replayUpperBoundFor(context.bundle)) return;
      assertReplayPayloadsAvailable(context.bundle, context.world.tick + 1);
      resetPlaybackClock();
      playing = true;
      scheduleNextFrame();
    },
    pause() {
      playing = false;
      cancelFrame();
      resetPlaybackClock();
    },
    isPlaying() {
      return playing;
    },
    onModeChange(listener: ReplayModeListener) {
      modeListeners.add(listener);
      return () => {
        modeListeners.delete(listener);
      };
    },
    onTickChange(listener: ReplayTickListener) {
      tickListeners.add(listener);
      return () => {
        tickListeners.delete(listener);
      };
    },
  };
}
