# Slice 1 — Replay-mode annotation affordances (v0.1.8)

## Goal

Honor the `07c-api-load-flow-and-annotation.md` §5.7 contract: while `replayController.mode === 'replay'`, Alt+M is a no-op, and `MarkerListPanel` becomes a read-only viewer over the REPLAY bundle's markers (not the live recorder's). Clicking a marker row scrubs to its tick instead of selecting an entity. Export/Discard buttons hide in replay because they belong to the live recorder, not the replay bundle.

## User-visible changes

- Alt+M while replay mode is active: no annotation form opens. (No toast, no error — same as pressing a key the panel doesn't bind. Silent is the correct affordance because the live recorder is paused under the bridge swap.)
- Alt+L stays bound. The panel surface becomes:
  - In live mode: unchanged from v0.1.7 — current-session markers, Prior Sessions section, Export/Discard.
  - In replay mode: shows the REPLAY bundle's markers (read from `replayController.bundle.markers`), hides the Prior Sessions section entirely, and on row click calls `replayController.jumpToMarker(marker.id)` instead of pause+pan+select.
- The panel re-renders when `replayController.onModeChange` fires so the surface flips on enter/exit.

## Surface changes

- `MarkerListPanelConfig` gains `replay: { mode(): ReplayMode; bundle(): ReplayBundle | null; jumpToMarker(id: string): void; onModeChange(listener: (mode: ReplayMode) => void): () => void }`. The whole sub-object is optional so MarkerListPanel tests that pre-date this slice keep working with `replay: undefined` (defaults to live behavior).
- `createApp.ts` Alt+M registration is wrapped through a new helper `gateAnnotationHotkeyOnReplayMode(replayController, () => stack.annotationController.onHotkey())`. The helper lives in `src/app/bootstrap/replayAnnotationGate.ts` (NEW).
- `createApp.ts` MarkerListPanel constructor receives the `replay` adapter that wires through to the existing `replayController`.
- The marker-row HTML now defensively HTML-escapes `m.id`, `severity`, and `m.tick` (coerced through `Number.isFinite` + `Math.trunc`); only severities present in `SEVERITY_ICONS` are written into the class attribute, others fall back to `info`. This is preventative hardening because future slices will load arbitrary `SessionBundle` JSON from disk / IDB whose marker `data` is `JsonValue` per civ-engine and not validated by `SessionReplayer.fromBundle`.
- No schema or save-format changes; no new dependencies.

## Test contract (TDD-first)

The replay-mode coverage lives in a new sibling file `tests/annotation-ui/MarkerListPanel.replay.test.ts` (the live-mode file would otherwise have crossed the 500-LOC budget). The original `tests/annotation-ui/MarkerListPanel.test.ts` retains the live-mode coverage unchanged.

`tests/annotation-ui/MarkerListPanel.replay.test.ts`:

1. When `replay.mode()` returns `'replay'` and `replay.bundle()` returns a bundle with two markers at ticks 50 and 200, the panel renders exactly those two markers in tick-desc order, regardless of `recording.markers()` content.
2. In replay mode the Prior Sessions toggle is hidden (`querySelector('[data-testid="marker-list-prior-toggle"]')` returns null OR the element has `hidden` set).
3. In replay mode, clicking a marker row calls `replay.jumpToMarker(markerId)` and does NOT call `pauseControl.pause`, `bridge.panCameraTo`, or `bridge.select`.
4. Switching from live to replay (the registered `onModeChange` listener fires with `'replay'`) re-renders the panel with the replay bundle's markers without an explicit `refresh()` call.
5. Switching back to live restores the live-mode behavior (current-session markers, Prior Sessions toggle re-appears, row click goes through pause+pan+select).

`tests/app/replayAnnotationGating.test.ts` (NEW):

1. With a stubbed `replayController` whose `mode === 'replay'`, simulating an Alt+M keypress through the registered hotkey does NOT call `annotationController.onHotkey`.
2. With `mode === 'live'`, the same Alt+M call DOES invoke `annotationController.onHotkey`.

## Risks and mitigations

- **Stale closure on mode flip:** Listeners must capture `replayController` (which is mutable-mode) by reference, not by snapshotting `mode` at registration time. Verified by test (4) — switching mode after panel mount re-renders without explicit refresh.
- **Replay bundle has no markers:** Render the existing `marker-list-current-empty` element. No new copy; "No markers yet." applies because the replay bundle could legitimately have zero markers.
- **Marker row click while bundle is null:** Should never happen because the row is only rendered when bundle is non-null. Defensive guard: noop if `replay.bundle()` returns null at click time.

## Out of scope for this slice

- Annotation creation in replay (deferred — see parent DESIGN open question).
- A "back to live mode" affordance inside the panel — Escape exits replay (already bound by ReplayHotkeys).
- Visual styling differences between live-mode and replay-mode rows. Functionally identical rows are fine for v0.1.8; styling tweaks fall to a future polish slice.
