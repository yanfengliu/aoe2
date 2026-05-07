import type { SessionBundle } from 'civ-engine';

import type { ReplayBundle, ReplayController } from './ReplayController';

export type LoadCurrentSessionStatus =
  | 'no-bundle'
  | 'no-payloads'
  | 'ok'
  | 'error';

export interface LoadCurrentSessionResult {
  readonly status: LoadCurrentSessionStatus;
  readonly error?: Error;
}

export interface LoadCurrentSessionDeps {
  readonly replayController: Pick<ReplayController, 'enterReplay' | 'mode'>;
  readonly recording: { bundle(): SessionBundle | null };
}

export function loadCurrentSessionAsReplay(
  deps: LoadCurrentSessionDeps,
): LoadCurrentSessionResult {
  const bundle = deps.recording.bundle();
  if (!bundle) {
    return { status: 'no-bundle' };
  }
  // Per civ-engine SessionReplayer.openAt: a target tick > startTick with
  // empty `commands` throws `no_replay_payloads`. Match that contract here
  // so the helper only succeeds when forward replay is actually possible —
  // an elapsed bundle with zero recorded commands cannot be replayed even
  // though `endTick > startTick`.
  if (bundle.commands.length === 0) {
    return { status: 'no-payloads' };
  }
  try {
    // RecordingService writes `SessionBundle<Record<string, never>>` because
    // it stays generic over GameCommands; the live world that produced the
    // bundle uses the typed GameCommands surface, so the runtime shape is
    // identical. Cast through `unknown` to bridge the two generic
    // instantiations without losing type safety at the call site.
    deps.replayController.enterReplay(bundle as unknown as ReplayBundle);
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err : new Error(String(err)) };
  }
  return { status: 'ok' };
}
