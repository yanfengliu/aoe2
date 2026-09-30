# Replay Load Sources + Phase 3D/3E — Design Spec

**Status:** Active. Continues the work tracked in `docs/threads/done/replay-scrubber/` after v0.1.7 shipped Phase 3C (TimelinePanel). This thread carries Phase 3D (replay-load sources + replay-mode annotation affordances) and Phase 3E (browser end-to-end + integration tests). Per AGENTS.md and the new `2026-05-06` doc-housekeeping rule, all design content is split into bounded sub-files under `design/` rather than one large document.

**Spec ancestor:** `docs/threads/done/replay-scrubber/design/09-adrs.md` ADR 7 (three load sources, single Replay action) and `07c-api-load-flow-and-annotation.md` §5.7 (Annotation UI behavior in replay mode) define the design boundaries this thread implements.

## Sub-files

- [01-overview-and-goals.md](design/01-overview-and-goals.md) — what ships in this thread, what was inherited from v0.1.7, what is still out of scope.
- [02-annotation-affordances.md](design/02-annotation-affordances.md) — Slice 1 (v0.1.8): Alt+M disabled in replay; MarkerListPanel reads the replay bundle's markers, hides Export/Discard, and scrubs to a marker on row click.
- [03-load-source-current-session.md](design/03-load-source-current-session.md) — Slice 2 (v0.1.9): a HUD entry point that takes the live `RecordingService.bundle()` and calls `replayController.enterReplay(bundle)` while the live recording continues in the background.
- [04-load-source-prior-sessions.md](design/04-load-source-prior-sessions.md) — Slice 3 (v0.1.10): a "Replay" button in MarkerListPanel's Prior Sessions row that calls `IndexedDBMirror.reconstructBundle` and enters replay.
- [05-load-source-file-import.md](design/05-load-source-file-import.md) — Slice 4 (v0.1.11): a file-picker entry point that parses a `SessionBundle` JSON file and enters replay.
- [06-replay-load-dialog-modal.md](design/06-replay-load-dialog-modal.md) — Slice 5 (v0.1.12): unifies the three sources under a single `ReplayLoadDialog` modal accessed from the HUD.
- [07-browser-e2e-and-integration.md](design/07-browser-e2e-and-integration.md) — Slice 6 (v0.1.13): Playwright e2e + vitest+jsdom integration tests.
- [08-versioning.md](design/08-versioning.md) — version-bump policy across the six slices and the closure criterion.

## Open question carried over

DESIGN §5.7 last sentence: "Live recording continues in the background while user scrubs (paused) or stops (replay-mode setPaused)." The current `ReplayController.enterReplay` calls `bridgeToRestore.setPaused(true)` on the LIVE bridge (line 417 of `ReplayController.ts`). That pauses the live world's tick loop, which in turn pauses live `RecordingService` writes (the service observes the live world). So "Live recording continues in the background" is true only in the trivial sense that the recorder isn't disconnected — no new ticks are written until replay exits and the live world resumes. This thread treats that as the intended semantics; if a future requirement needs background live ticking during replay, we will revisit ADR 8.
