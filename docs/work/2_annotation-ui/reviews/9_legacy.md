# Annotation UI — FR-1 Final Code Review (2026-04-29)

**Disposition:** ACCEPT (with all findings resolved inline before commit). Convergent across both reviewers. Codex ITERATE on 1 BLOCKER + 2 MAJORS + 1 MINOR; Claude ACCEPT with 0 BLOCKERS + 0 MAJORS + 2 MINORs. All findings addressed; the PHASE 2 commit lands clean.

Reviewers: Codex (`gpt-5.5` xhigh), Claude (`claude-opus-4-7[1m]` max). Gemini removed from the toolchain mid-thread (commit `b93cf2b`).

Scope: Full PHASE 2 diff for AO-1..AO-12 + AO-14 docs against accepted DESIGN v5 / PLAN v2 / impl-1 fixes.

## Codex BLOCKER

### B1 — Missing CSS for AnnotationForm + MarkerListPanel; #hud-root blocks pointer events

`AnnotationForm.ts:71` and `MarkerListPanel.ts:78` reference `annotation-form--hidden` / `marker-list-panel--hidden` classes, but no stylesheet defined them. `#hud-root` has `pointer-events: none` (so the Phaser canvas can receive input), and individual HUD elements opt-in to `pointer-events: auto`. Without explicit CSS, the new components are unstyled, unpositioned, and unclickable.

**Fix applied:** added ~250 lines of CSS to `src/styles.css` covering `.annotation-form`, `.annotation-form--hidden` (display: none), `.annotation-form__form` / `__title` / `__label` / `__text` / `__severity` / `__category` / `__screenshot` / `__error` / `__buttons`, `.marker-list-panel`, `.marker-list-panel--hidden`, `.marker-list-panel__title` / `__row` / `__sev--info|warning|bug|blocker` / `__text` / `__author` / `__prior-toggle` / `__prior-list` / `__prior-row` / `__warn`. Both root containers set `pointer-events: auto` explicitly. Position: form is a centered modal; panel is bottom-right.

## Codex MAJORS

### M1 — Refs captured at submit, not at Alt+M (contradicts DESIGN §6 + changelog)

`AnnotationController.handleSubmit` called `buildRefsFromSelection(world.tick)` — running selection capture at SAVE time, not HOTKEY time. The contract documented in `docs/changelog.md:9` says "selection at the moment of Alt+M becomes the marker's `MarkerRefs.entities`." Capturing at submit means a user who clicks around in the form (or has AI auto-select something else mid-typing) would get a marker pointing at the wrong entities.

**Fix applied:** added `let pendingRefs` closure cell. `onHotkey()` now captures refs FIRST (`pendingRefs = buildRefsFromSelection(worldRef().tick)`), then pauses + opens the form. `handleSubmit` consumes the snapshot and clears it; `handleCancel` clears it. Defensive guard: if `handleSubmit` runs without `pendingRefs` set (shouldn't happen given the gates), surface a toast and abort.

### M2 — IndexedDBMirror sync `indexedDB.open` failure path doesn't disable / drop pending; createApp subscribes after start()

Two coupled issues:

(a) `IndexedDBMirror.open()` wraps `indexedDB.open()` in try/catch for synchronous throws, but in that catch path the code did NOT set `_disabled = true` or drop `_pending`. So a synchronous open failure (rare but possible — e.g., the constructor throws on a corrupted database name in some browsers) would leave the mirror partially-broken and growing unbounded. Async `req.onerror` / `req.onblocked` paths already had the disable+drop logic (impl-1 fix); the sync catch was missed.

(b) `createApp.rebuildAnnotationStack` registered `recording.onPersistenceError(handler)` AFTER `await recording.start()`. If `start()` itself emits via `mirror.open()` failure, the listener wasn't installed yet, so the error vanished into the void.

**Fix applied:**
- `IndexedDBMirror.open()` sync-catch now sets `_disabled = true; this._pending = emptyPending();` before emitting + rejecting (mirror parity with the async error handlers).
- `createApp.rebuildAnnotationStack` registers `unsubscribePersistenceError = recording.onPersistenceError(...)` BEFORE `await recording.start()`, so any error during start() reaches the toast handler.

## Codex MINOR

### N1 — package.json / package-lock.json version mismatch

`package.json` was bumped to 0.1.5 manually but `package-lock.json` still showed 0.1.4 (the lockfile records its own version field too). Cosmetic — npm would regenerate on next install, but the diff was incoherent.

**Fix applied:** `npm install` regenerated the lockfile; both files now show 0.1.5.

## Claude MINORs

### M1 — PauseControl local state desyncs from new bridge after save/load

`PauseControl` tracks `paused` locally and short-circuits idempotent `pause()` / `resume()` calls. After `handleLoadGame`, the new bridge starts with `pauseState.pausedManually = false`, but `pauseControl.paused` retains its pre-swap value. If a user opens the Alt+M form (paused=true on the OLD bridge), then triggers Load before submit/cancel, `prior.dispose()` discarded the form WITHOUT calling `pauseControl.resume()`. The shared `pauseControl` (created once at `createApp` boot) was now stale — the first subsequent Alt+M would short-circuit in `pause()` and the new bridge would keep ticking with a phantom-paused indicator.

**Fix applied:** `AnnotationStack.dispose()` now calls `pauseControl.resume()` first (best-effort; wrapped in try/catch). Guarantees the local cache and bridge state both reset on rebuild.

### M2 — Test name lies about what it asserts

`tests/simulation/bridge-additive-surfaces.test.ts:115-125` test "setPaused(false) does NOT clear a real engineHalted state" only asserts `hud.engineHalted === null` after a pause/resume cycle on a fresh bridge that was never halted — trivially true regardless of `setPaused` implementation behavior. Test comment acknowledged the limitation but the test name claimed to verify the invariant.

**Disposition:** acknowledged but NOT fixed — Claude marked this as a NON-blocking coverage gap; the implementation invariant IS correct (separate carriers verified at `createSimulationBridge.ts:236-245`). Renaming the test to "setPaused does not write to engineHalted" would be more honest but requires injecting a fake halt state which isn't trivial in the existing test setup. Folded into v0.1.6 follow-up TODOs.

## Anti-regression checklist (verified by Claude across 13 items)

All hold per Claude's verification:
- `pauseState.pausedManually` separate from `haltState.halted`
- `getHudState().engineHalted` reads `haltState.halted` only
- `bridge.world` returns same `World` instance for bridge lifetime
- `bridge.select(refs)` returns void
- `panCameraTo` resolution direction correct
- `MemorySink({ allowSidecar: true })` explicit
- `IndexedDBMirror._disabled` set on open failures (sync + async after FR-1 fix)
- `RecordingService.stop()` calls `mirror.updateMeta` before `markClosed`
- `getSelectedEntityRefs()` prunes stale refs
- HotkeyRegistry handles `contenteditable="false"` correctly
- `_pendingRebuild` closure-scoped
- `HudBridge.loadGame: Promise<void>`; `saveLoadPanel` awaits + button-disable guard
- `AnnotationController` rejection path keeps form open + showError, no resume

Plus Claude's deeper scrutiny areas (createApp wireup ordering, TeeSink first-snapshot, stop() ordering, single-flight rebuild semantics, vite shims unreachability, MarkerListPanel poll cleanup, canvas-not-yet-mounted race, type erasure in TeeSink.toBundle) — all verified.

## Disposition

**ACCEPT — commit and ship.** Convergent ACCEPT direction:

- iter-1 (impl-1): 3 MAJORs (Codex) + 5 MINORs (Claude); convergent on mirror-disable, metadata-finalization, listSessions-endTick, getSelectedEntityRefs-prune-on-read, contenteditable=false short-circuit. All resolved inline.
- FR-1 (this review): 1 BLOCKER + 2 MAJORs + 1 MINOR (Codex) + 2 MINORs (Claude). All resolved inline before commit.

The PHASE 2 commit (aoe2 v0.1.5) lands clean. Final test count: 113 new tests + existing suite green; typecheck/lint/build clean. Coordinated drop with civ-engine v0.8.11 (commit `4338347`).
