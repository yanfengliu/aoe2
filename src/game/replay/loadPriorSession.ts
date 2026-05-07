import type { SessionBundle } from 'civ-engine';

import type { ReplayBundle, ReplayController } from './ReplayController';

export type LoadPriorSessionStatus = 'no-payloads' | 'ok' | 'error';

export interface LoadPriorSessionResult {
  readonly status: LoadPriorSessionStatus;
  readonly error?: Error;
}

export interface LoadPriorSessionDeps {
  readonly replayController: Pick<ReplayController, 'enterReplay'>;
  readonly recording: { loadPriorSessionBundle(sessionId: string): Promise<SessionBundle> };
}

/**
 * Slice 3 (replay-load-and-e2e v0.1.10): the helper the MarkerListPanel
 * Replay button delegates to via createApp's `onReplayPriorSession`
 * callback. Mirrors `loadCurrentSessionAsReplay`'s contract for the
 * prior-session source: reconstruct the bundle from IDB, reject the
 * "no recorded commands" case (matches civ-engine `SessionReplayer.openAt`'s
 * `no_replay_payloads` rejection), and call `enterReplay` on success.
 *
 * Errors from `recording.loadPriorSessionBundle` (SessionNotFoundError,
 * SchemaMismatchError, generic) propagate up to the panel's catch so it
 * can surface the right toast wording.
 */
export async function loadPriorSessionAsReplay(
  deps: LoadPriorSessionDeps,
  sessionId: string,
): Promise<LoadPriorSessionResult> {
  const bundle = await deps.recording.loadPriorSessionBundle(sessionId);
  if (bundle.commands.length === 0) {
    return { status: 'no-payloads' };
  }
  try {
    // RecordingService writes `SessionBundle<Record<string, never>>` because
    // it stays generic over GameCommands; the live world that produced the
    // bundle uses the typed GameCommands surface, so the runtime shape is
    // identical. Cast through `unknown` to bridge the two generic
    // instantiations — same rationale as `loadCurrentSession.ts`.
    deps.replayController.enterReplay(bundle as unknown as ReplayBundle);
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err : new Error(String(err)) };
  }
  return { status: 'ok' };
}
