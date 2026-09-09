# Annotation UI — Implementation Iteration 1 Review (2026-04-29)

**Disposition:** Iterate (paragraph-level fixes applied inline before AO-9). Codex flagged 3 MAJORs + 2 MINORs; Claude graded the same diff 0 BLOCKERS / 0 MAJORs / 5 MINORs (with the substantive items overlapping Codex's MAJORs but at lower severity). Gemini was attempted but failed at dispatch and is no longer in the toolchain (see AGENTS.md update commit `b93cf2b`).

Reviewers: Codex (`gpt-5.5` xhigh), Claude (`claude-opus-4-7[1m]` max). Gemini unreachable at this iteration; convergence reached on Codex + Claude.

Scope: PHASE 2 AO-1..AO-8 implementation (Vite shims, bridge additive surfaces, PauseControl + HotkeyRegistry, GameScene.panCameraTo, HUD changes, annotation primitives, IndexedDBMirror split, RecordingService) + tests. UI + wireup layer (AO-9..AO-14) lands in `impl-2`.

## Convergent findings (all resolved inline before AO-9)

### IDB-open permanent failure left mirror dangling — _pending grew unbounded (Codex MAJOR / Claude M2)

`RecordingService.start()` deliberately swallows `mirror.open()` failure and continues with MemorySink only (Safari private mode etc.). But the mirror reference was retained, so subsequent `record*` calls kept pushing into `_pending` and each scheduled `_flushNow` retried `_ensureOpen` → fails → `_pending` preserved → unbounded growth. Each retry also fired `onPersistenceError` → toast spam.

**Fix applied:** added `IndexedDBMirror._disabled` flag; on permanent open failure (onerror / onblocked) the mirror sets `_disabled = true`, drops `_pending`, and emits ONE error to listeners. All subsequent `record*` methods early-return as no-ops; `listSessions` returns `[]`; `reconstructBundle` / `discard` / etc. throw. Exposed `isDisabled()` so RecordingService can branch (e.g., skip `markClosed` when disabled).

### IDB metadata not finalized; listSessions endTick was wrong (Codex MAJORs)

The mirror wrote `recordMeta(sessionId, metadata, snapshot)` once at session start with `endTick: 0` (the metadata at start). Subsequent ticks updated MemorySink's metadata in place but the IDB row stayed frozen at the start values. `listSessions` then computed `endTick` from a row count of `session_ticks` rather than reading the persisted metadata — wrong for sessions with non-zero `startTick` or any tick gaps.

**Fix applied:** added `IndexedDBMirror.updateMeta(sessionId, metadata)` that overwrites the metadata field of an existing session_meta row. `RecordingService.stop()` now captures `recorder.toBundle().metadata` after `disconnect()` (the terminal snapshot is already written by then) and calls `mirror.updateMeta(currentSessionId, finalMetadata)` BEFORE `markClosed`. `listSessions` now reads `metadata.endTick` directly instead of computing from row count.

### `bridge.select(refs)` shape inconsistency (Codex MINOR)

DESIGN §7 / ADR 10 specify `select(refs): void` but the implementation wired through `selectByRefs` returning boolean to the public surface. Mismatch between contract and impl.

**Fix applied:** `SimulationBridge.select` typed as `(refs): void`; the inner `selectByRefs(refs)` boolean return is consumed but discarded.

### `getSelectedEntityRefs()` did not prune stale refs; comment misleading (Claude M3)

The implementation comment claimed "the recorder will validate / filter stale refs" — but `recorder.addMarker` actually THROWS `MarkerValidationError(code: '6.1.entity_liveness')` on stale refs (it does not filter). If a unit dies between selection and the next Alt+M (before any other prune-on-read getter has been called), marker creation would crash.

**Fix applied:** `getSelectedEntityRefs()` now applies the same `getCurrentEntityId` filter as `getSelectedEntityIds`, prunes `selection.refs` in place, and returns the surviving refs. The misleading comment is replaced with the real "the recorder validates and throws on stale" explanation.

### `HotkeyRegistry` `contenteditable="false"` on focused element ignored (Claude M5)

Per HTML spec, an explicit `contenteditable="false"` element is non-editable regardless of ancestors. The original implementation only returned true on `'true'/'plaintext-only'` then fell through to the ancestor walk — so a `<button contenteditable="false">` nested inside `<div contenteditable="true">` would incorrectly suppress the hotkey.

**Fix applied:** added `if (ce === 'false') return false;` BEFORE the ancestor walk.

## Items considered, deferred to later iterations

- **TeeSink first-snapshot detection is implicit (Claude M4):** the heuristic "first writeSnapshot is the initial snapshot" is contractually correct for civ-engine v0.8.11 (the recorder writes the initial snapshot synchronously after `open()` before any other writes). Hardening with an explicit `entry.tick === metadata.startTick` guard is a defensive add but doesn't change current behavior. Folded into the AO-12.5 integration tests TODO list.

- **`_pending` cleared before tx commits (Claude M1):** if `tx.onerror` or `tx.onabort` fires, the snapshot in `pending` is dropped. MemorySink remains the source of truth so live `exportBundle` is unaffected; only IDB mirror loses the failed-tx tail. Documented in code comment as "acceptable degradation"; no functional fix needed.

- **Quota-error test rigor (Codex MINOR / Claude N6):** the existing IndexedDBMirror "listener invoked on flush failure" test asserts `errors.length > 0` weakly. Force-killing fake-indexeddb to provoke a real tx abort is unreliable. Folded into AO-12.5 integration tests where a quota-exceeded scenario can be simulated more robustly.

- **`atob` vs `Buffer` fallback in browser builds (Claude N4):** `captureScreenshot.ts` and `RecordingService.ts` use `typeof atob === 'function'` then a `require('node:buffer')` fallback. In browser bundles the fallback is dead code and Vite tree-shakes the typeof check, but the `require` literal can sneak into the bundle if Vite doesn't constant-fold. AO-13 visual gates will catch this if the bundle breaks.

## Convergence trajectory

- iter-1 (impl): 3 MAJORs (Codex) / 0 MAJORs (Claude); 5 paragraph-level fixes applied inline.

## Disposition

**Continue to AO-9..AO-14.** All convergent + MAJOR fixes applied. Remaining MINORs deferred to AO-12.5 integration tests where they can be exercised more robustly. impl-2 review will run on the AO-9..AO-14 chunk.
