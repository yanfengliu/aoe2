# Slice 6 — Phase 3E browser e2e + integration (v0.1.13)

## Goal

End-to-end test coverage for the replay-load workflow: from clicking the HUD button to entering replay mode and scrubbing through the timeline. Closes Phase 3E from the closed replay-scrubber thread.

## What ships

### Playwright e2e (`tests/browser/replay-load-dialog.spec.ts`)

1. **Live session flow:** start the app, run for a few ticks (Pause toggle exposed via test API), click "Replay…", select "Live session" tab, click "Start replay", verify the TimelinePanel mounts and replay mode is active.
2. **File import flow:** start the app, click "Replay…", select "From file" tab, upload a fixture bundle JSON (committed under `tests/browser/fixtures/replay-bundle.json`), verify replay mode is active.
3. **Prior session flow:** seed an IndexedDB session (via the test API), click "Replay…", select "Prior session" tab, click the Replay button on the seeded row, verify replay mode is active.
4. **Scrub workflow:** in any of the above flows, drag the timeline thumb halfway, release, verify `currentTick` advanced and the canvas reflects the new tick.
5. **Escape exits replay:** Escape collapses the dialog AND (separately) Escape during replay exits replay mode.

### Vitest+jsdom integration (`tests/integration/replay-flow.integration.test.ts`)

1. Construct a real `RecordingService` + a real `ReplayController` against a deterministic bundle, drive `loadCurrentSessionAsReplay` end-to-end, scrub to a non-start tick, and assert the replay world's tick matches.
2. Construct an in-memory `IndexedDBMirror` (via fake-indexeddb), seed a session, call `loadPriorSessionBundle`, drive enterReplay, exit replay, assert the live bridge is restored.
3. With a freshly imported bundle from disk (test fixture JSON), parse + enterReplay + assert the timeline panel renders the expected marker pins.

## Surface changes

- New test fixture `tests/browser/fixtures/replay-bundle.json` (committed; small — hand-crafted minimal bundle with a few ticks + commands + 2 markers).
- New test API methods on `window.__AOE2_TEST__`:
  - `seedPriorSession(meta, ticks, commands, snapshots, markers): Promise<string>` — writes a session to IDB and returns the session ID. Used by the prior-session e2e flow.
  - `getReplayMode(): 'live' | 'replay'` — exposes `replayController.mode` for assertions.
  - `getReplayCurrentTick(): number` — exposes `replayController.currentTick`.

## Risks and mitigations

- **Playwright deterministic rendering:** the canvas snapshot diff baselines required to verify "the canvas reflects the new tick" need user-side `npm run test:browser -- --update-snapshots`. To avoid the v0.1.5 baseline-blocked situation, this slice asserts on the test API getters (`getReplayCurrentTick()`) NOT on canvas pixels. Visual baselines are a separate (out-of-scope) concern.
- **Test isolation across e2e tests:** each spec opens a fresh page, so IDB state is per-page-context. Use `await context.clearCookies(); await page.evaluate(() => indexedDB.deleteDatabase('aoe2-recording-v1'))` in beforeEach.
- **Long e2e runtime:** these are 5-10 specs; budget < 60s total. If runtime balloons, consider extracting the heaviest scrub-from-snapshot test into a separate spec file.

## Closure criterion for the thread

After slice 6 lands and converges:

1. `git mv docs/threads/current/replay-load-and-e2e docs/threads/done/replay-load-and-e2e`.
2. Final summary entry in `docs/devlog/summary.md` consolidates v0.1.8-0.1.13.
3. `docs/architecture/ARCHITECTURE.md` reflects the new `src/ui/replay/` surface and `replay-load` entry points; `docs/architecture/drift-log.md` carries a row.
