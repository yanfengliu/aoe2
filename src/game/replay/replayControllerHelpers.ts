// Pure helpers for ReplayController, extracted verbatim 2026-06-12 when
// the replay-fog-owner API would have pushed the controller past the
// 500-line budget. No behavior change.
//
// Note (observed during the move, deliberately NOT consolidated here):
// `replayUpperBoundFor` and TimelinePanel's `replayTimelineUpperBound`
// compute near-identical bounds with a Math.min vs Math.max(startTick,...)
// difference — unifying them is a behavior-sensitive cleanup for a
// dedicated pass, not a mechanical extraction.

import { BundleIntegrityError, type RecordedCommand } from 'civ-engine';

import type { GameCommands, GameWorld } from '../simulation/bridge/pureHelpers';
import type { SimulationBridge } from '../simulation/createSimulationBridge';
import type { ReplayBridge } from '../simulation/replay/makeReplayBridge';
import type {
  ReplayBundle,
  ReplayFrameScheduler,
  ReplayReplayer,
} from './ReplayController';

export interface ReplayContext {
  bundle: ReplayBundle;
  replayer: ReplayReplayer;
  world: GameWorld;
  bridge: SimulationBridge;
  commandsByTick: Map<number, RecordedCommand<GameCommands>[]>;
  // replay-fog-owner iter-1 (Claude LOW perf): owners never join or
  // leave a recorded session, so candidates are computed ONCE per
  // enterReplay — the panel re-renders every playback tick and must not
  // trigger a full economy projection per render.
  fogOwnerCandidates: number[];
}

// Stale-adapter teardown (iter-1, all three reviewers): outgoing replay
// bridges keep a connected RenderAdapter on the world; dispose after a
// successful swap. Optional-chained so test stub bridges need no method.
export function disposeOutgoingReplayBridge(bridge: SimulationBridge): void {
  (bridge as Partial<ReplayBridge>).disposeReplayRenderAdapter?.();
}

export function createDefaultScheduler(): ReplayFrameScheduler {
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

export function indexCommands(
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

export function replayUpperBoundFor(bundle: ReplayBundle): number {
  const upperBound = upperBoundFor(bundle);
  const firstFailedTick = bundle.metadata.failedTicks
    ?.filter((tick) => tick <= upperBound)
    .sort((left, right) => left - right)[0];
  return firstFailedTick === undefined
    ? upperBound
    : Math.min(upperBound, firstFailedTick - 1);
}

export function clampTick(bundle: ReplayBundle, tick: number): number {
  return Math.max(bundle.metadata.startTick, Math.min(replayUpperBoundFor(bundle), tick));
}

export function assertReplayPayloadsAvailable(bundle: ReplayBundle, targetTick: number): void {
  if (targetTick <= bundle.metadata.startTick || bundle.commands.length > 0) {
    return;
  }
  throw new BundleIntegrityError(
    'bundle has no command payloads; replay forward is impossible',
    { code: 'no_replay_payloads', requested: targetTick },
  );
}
