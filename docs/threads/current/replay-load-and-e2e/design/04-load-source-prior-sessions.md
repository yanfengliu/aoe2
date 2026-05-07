# Slice 3 — Prior Sessions "Replay" button (v0.1.10)

## Goal

Add a "Replay" button alongside the existing Export / Discard buttons in `MarkerListPanel`'s Prior Sessions row. Clicking it reconstructs the bundle via `IndexedDBMirror.reconstructBundle(sessionId)` and calls `replayController.enterReplay(bundle)`.

## User-visible changes

- `Replay` button per Prior Session row, alongside Export and Discard.
- Button is disabled when the row's `schemaVersion !== current` (same gate Export uses).
- Button is disabled when `closedNormally === false` AND the metadata's endTick equals startTick (no payloads to replay). When the session ended abnormally but ran for several ticks, replay is still allowed because partial bundles can be replayed up to the last good tick.
- Click flow:
  1. Disable the row's buttons during the async load.
  2. Call `recording.loadPriorSessionBundle(sessionId)` (NEW — see surface changes).
  3. On success, call `replayController.enterReplay(bundle)`. The MarkerListPanel automatically flips into replay-mode rendering (Slice 1's adapter is already wired).
  4. On error (SchemaMismatchError, SessionNotFoundError, generic), show a toast and re-enable buttons.

## Surface changes

- `RecordingService` adds `loadPriorSessionBundle(sessionId: string): Promise<SessionBundle>`. Implementation: reuse `IndexedDBMirror.reconstructBundle(sessionId)` — same call as `exportPriorSession` makes internally, but returning the bundle directly instead of a Blob. No new IDB code; just a new public surface.
- `MarkerListPanelConfig` adds `onReplayPriorSession?: (sessionId: string) => Promise<void>`. The panel calls this when the user clicks Replay; createApp wires it through to `loadCurrentSessionAsReplay`-style helper.
- The Prior Sessions row HTML gains a `<button data-testid="marker-list-prior-replay" ...>Replay</button>` between Export and Discard.

## Test contract

`tests/recording/RecordingService.test.ts` (extend):
1. `loadPriorSessionBundle('s1')` calls `mirror.reconstructBundle('s1')` and returns the bundle.
2. With `inMemoryOnly: true` (no mirror), throws `SessionNotFoundError`.
3. With a SchemaMismatchError from the mirror, propagates the error type.

`tests/annotation-ui/MarkerListPanel.test.ts` (extend):
1. Replay button appears alongside Export/Discard in each Prior Sessions row.
2. Click invokes `onReplayPriorSession(sessionId)` and disables the row's buttons during the call.
3. Schema-mismatched session has the Replay button disabled (same as Export).

## Risks and mitigations

- **In-flight load races with another action:** disable all three buttons in the row while the async load is in flight; re-enable on completion or error.
- **Schema mismatch:** the same SchemaMismatchError that Export raises will surface via Replay. Toast text mirrors the Export wording for consistency.
- **closedNormally:false rows:** allow Replay if the bundle has any commands (let `enterReplay` make the call); rely on the existing assertReplayPayloadsAvailable inside the controller for the deepest validation.
