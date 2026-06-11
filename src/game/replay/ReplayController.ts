import {
  BundleIntegrityError,
  ReplayHandlerMissingError,
  SessionReplayer,
  type Marker,
  type RecordedCommand,
  type SessionBundle,
  type SessionMetadata,
} from 'civ-engine';

import type { SimulationBridge } from '../simulation/createSimulationBridge';
import type {
  GameCommands,
  GameEvents,
  GameWorld,
} from '../simulation/bridge/pureHelpers';
import { fromEngineWorld, toEngineWorld } from '../simulation/bridge/pureHelpers';
import { createReplayWorldOnly } from '../simulation/replay/createReplayWorldOnly';
import { getReplayWorldContext } from '../simulation/replay/replayWorldContext';
import {
  makeReplayBridge as defaultMakeReplayBridge,
  type ReplayBridgeOptions,
} from '../simulation/replay/makeReplayBridge';
import { TPS } from '../simulation/prototypeScenario';

export type ReplayMode = 'live' | 'replay';
export type ReplayBundle = SessionBundle<GameEvents, GameCommands>;
export type ReplayReplayer = SessionReplayer<GameEvents, GameCommands>;
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

interface ReplayContext {
  bundle: ReplayBundle;
  replayer: ReplayReplayer;
  world: GameWorld;
  bridge: SimulationBridge;
  commandsByTick: Map<number, RecordedCommand<GameCommands>[]>;
}

const REPLAY_TICK_MS = 1000 / TPS;

function createDefaultScheduler(): ReplayFrameScheduler {
  return {
    request(callback) {
      if (typeof globalThis.requestAnimationFrame === 'function') {
        return globalThis.requestAnimationFrame(callback);
      }
      return globalThis.setTimeout(
        () => callback(globalThis.performance?.now() ?? Date.now()),
        0,
      ) as unknown as number;
    },
    cancel(handle) {
      if (typeof globalThis.cancelAnimationFrame === 'function') {
        globalThis.cancelAnimationFrame(handle);
        return;
      }
      globalThis.clearTimeout(handle);
    },
  };
}

function indexCommands(
  commands: readonly RecordedCommand<GameCommands>[],
): Map<number, RecordedCommand<GameCommands>[]> {
  const byTick = new Map<number, RecordedCommand<GameCommands>[]>();
  for (const command of commands) {
    const existing = byTick.get(command.submissionTick);
    if (existing) {
      existing.push(command);
    } else {
      byTick.set(command.submissionTick, [command]);
    }
  }
  for (const bucket of byTick.values()) {
    bucket.sort((left, right) => left.sequence - right.sequence);
  }
  return byTick;
}

function upperBoundFor(bundle: ReplayBundle): number {
  return bundle.metadata.incomplete
    ? bundle.metadata.persistedEndTick
    : bundle.metadata.endTick;
}

function replayUpperBoundFor(bundle: ReplayBundle): number {
  const upperBound = upperBoundFor(bundle);
  const firstFailedTick = bundle.metadata.failedTicks
    ?.filter((tick) => tick <= upperBound)
    .sort((left, right) => left - right)[0];
  return firstFailedTick === undefined
    ? upperBound
    : Math.min(upperBound, firstFailedTick - 1);
}

function clampTick(bundle: ReplayBundle, tick: number): number {
  return Math.max(bundle.metadata.startTick, Math.min(replayUpperBoundFor(bundle), tick));
}

function assertReplayPayloadsAvailable(bundle: ReplayBundle, targetTick: number): void {
  if (targetTick <= bundle.metadata.startTick || bundle.commands.length > 0) {
    return;
  }
  throw new BundleIntegrityError(
    'bundle has no command payloads; replay forward is impossible',
    { code: 'no_replay_payloads', requested: targetTick },
  );
}

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

  function buildReplayBridge(world: GameWorld): SimulationBridge {
    return makeReplayBridge(world, {
      getRenderInterpolationAlpha: () => renderInterpolationAlpha,
    });
  }

  function openReplayAt(tick: number): void {
    const current = requireReplayContext();
    const targetTick = clampTick(current.bundle, tick);
    const world = fromEngineWorld(current.replayer.openAt(targetTick));
    const selectedRefs = current.bridge
      .getSelectedEntityRefs()
      .filter((ref) => world.isCurrent(ref));
    const bridge = buildReplayBridge(world);
    if (selectedRefs.length > 0) {
      bridge.select(selectedRefs);
    }
    const nextContext = { ...current, world, bridge };
    config.bridgeCell.replace(bridge);
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
    if (bridgeToRestore) {
      config.bridgeCell.replace(bridgeToRestore);
      bridgeToRestore.setPaused(liveWasPausedBeforeReplay);
      displayedTick = bridgeToRestore.world.tick;
    } else {
      displayedTick = config.bridgeCell.current().world.tick;
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
    enterReplay(bundle: ReplayBundle, atTick = bundle.metadata.startTick) {
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
          worldFactory: (snapshot) => toEngineWorld(worldFactory(snapshot)),
          skipRegistrationCheck: true,
        },
      ) as ReplayReplayer;
      const targetTick = clampTick(bundle, atTick);
      const world = fromEngineWorld(replayer.openAt(targetTick));
      const bridge = buildReplayBridge(world);
      const nextContext: ReplayContext = {
        bundle,
        replayer,
        world,
        bridge,
        commandsByTick: indexCommands(bundle.commands),
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
