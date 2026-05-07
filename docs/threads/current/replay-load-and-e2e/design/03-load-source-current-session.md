# Slice 2 — Load current live session as replay (v0.1.9)

## Goal

Surface the simplest replay-load path: take the in-progress `RecordingService.bundle()` and hand it to `replayController.enterReplay(bundle)`. The live recorder keeps observing the (paused) live world per ADR 8, so on `exitReplay` the live recording resumes from the same tick.

## User-visible changes

- A new HUD button labeled "Replay" appears in the same region as Save/Load. Disabled when `recording.bundle()` returns null (no recording started yet) or returns a bundle with empty `commands`. The empty-commands rule mirrors the civ-engine `SessionReplayer.openAt` contract: a target tick `> startTick` with no recorded commands throws `no_replay_payloads`. An elapsed bundle without commands could only replay tick 0 (the initial snapshot), which is not useful, so the button stays disabled.
- Click: `replayController.enterReplay(recording.bundle()!)`. On error (e.g., `BundleIntegrityError` for empty payloads), toast the error message and stay in live mode.
- The TimelinePanel becomes visible automatically because it gates on `replayController.mode === 'replay'` (already implemented in v0.1.7).

## Surface changes

- A new helper `loadCurrentSessionAsReplay({ replayController, recording })` in `src/game/replay/loadCurrentSession.ts` (NEW) that:
  - Reads `recording.bundle()`.
  - Returns `{ status: 'no-bundle' | 'no-payloads' | 'ok' | 'error'; error?: Error }`.
  - On `ok`, calls `replayController.enterReplay(bundle)`.
  - On error from `enterReplay`, returns `{ status: 'error', error }`.
- HUD wiring: `createHudController` adds three optional `HudBridge` fields (`replayCurrentSession`, `isReplayCurrentSessionAvailable`, `isReplayMode`) plus a `subscribeReplayModeChange` thunk. The button's `disabled` state refreshes on three signals: an immediate `replayController.onModeChange` listener (no poll lag on enter/exit replay), a 500ms poll (catches recording-bundle changes that have no event channel), and a re-check inside the click handler before invoking `onClick` (closes the staleness window between polls).
- The new helper module `src/ui/hud/replayCurrentSessionButton.ts` (NEW) owns the button's enabled-state lifecycle and exposes a `destroy()` that unsubscribes both the listener and the poll. The HUD HTML template moves into `src/ui/hud/hudTemplate.ts` (NEW) so `createHudController.ts` stays under the 500-LOC budget after the new fields landed.
- `src/app/bootstrap/createApp.ts` declares `let stack: AnnotationStack | undefined` near the top so the bridge thunks can guard with truthiness instead of hitting the temporal-dead-zone — the HUD button's initial `refresh()` fires before the first `await chainRebuild(undefined)` resolves.

## Test contract (TDD-first)

`tests/replay/loadCurrentSession.test.ts` (NEW):

1. `loadCurrentSessionAsReplay` with no bundle returns `{ status: 'no-bundle' }` and does NOT call `enterReplay`.
2. With a bundle whose `commands.length === 0` (no payloads — even if `endTick > startTick`), returns `{ status: 'no-payloads' }` and does NOT call `enterReplay`.
3. With a valid bundle (`commands.length > 0`), calls `enterReplay(bundle)` and returns `{ status: 'ok' }`.
4. When `enterReplay` throws, returns `{ status: 'error', error: ... }` and does not propagate.

`tests/ui/hud-replay-button.test.ts` (NEW, `@vitest-environment jsdom`):

1. Button is disabled when `recording.bundle()` returns null.
2. Button is enabled when bundle has payloads.
3. Clicking the button invokes the controller's enterReplay.
4. While `replayController.mode === 'replay'`, the button is disabled to prevent re-entry races.

## Risks and mitigations

- **Bundle reference is mutable while recording:** `RecordingService.bundle()` returns the `recorder.toBundle()` snapshot, which is a fresh object on each call. There is no aliasing risk on enterReplay.
- **Live recorder stays attached to the live world while replay holds the bridge:** verified — `RecordingService` binds to `config.world` directly (`world: bridgeRef().world` snapshot at construction time), and `enterReplay` only swaps the bridge cell. The recorder keeps observing the same world reference.
- **Recorder writes during replay paused live:** the live world is paused via `bridgeToRestore.setPaused(true)` so `world.step` stops. No new tick entries are written until exit. Exit restores priorPaused; if user was unpaused, ticks resume immediately and the recorder catches them.
- **Bundle without commands (start tick only):** rejected with `no-payloads` status before calling enterReplay, matching `ReplayController.assertReplayPayloadsAvailable`.

## Out of scope for this slice

- Background live recording during replay scrub (live world is paused; that is the intended ADR 8 behavior).
- Choosing a target tick for enterReplay — this slice always starts at `bundle.metadata.startTick` (the controller default). Slice 5 dialog can offer a tick picker.
- Visual integration into the dialog modal — slice 5 unifies; slice 2 ships a standalone button.
