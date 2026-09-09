# Slice 4 — Replay file import — Iter 1

**Diff base:** `bc154f1` (slice 3 commit).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** ITERATE → both substantive findings addressed; ready for iter-2.

## Codex iter-1

### IMPORTANT — Parser accepts structurally incomplete bundles that can partially enter replay (FIXED)

The original parser only required `metadata`/`commands`/`initialSnapshot`. But the live `SessionBundle` requires nine top-level fields, and `TimelinePanel`'s mode-change listener iterates `bundle.markers`/`failures` immediately after `enterReplay` swaps the bridge. A bundle missing those would crash AFTER the bridge swap, violating the "invalid bundles never partially apply" contract.

**Fix applied:** widened `REQUIRED_TOP_LEVEL` to all nine `SessionBundle` fields (`metadata`, `initialSnapshot`, `ticks`, `commands`, `executions`, `failures`, `snapshots`, `markers`, `attachments`) and `ARRAY_FIELDS` to all seven required arrays. The "missing field" loop fires for any absent top-level; the "is not an array" loop type-checks each required array. Added regression tests for missing `markers`, `failures`, `snapshots` (the three Codex called out + the snapshot iterator path).

### LOW — `replayFileImport` not disposed on app teardown (FIXED)

`game.events.on('destroy', ...)` was missing the `replayFileImport.dispose()` call.

**Fix applied:** Added `replayFileImport.dispose()` next to `timelinePanel.dispose()`.

## Claude iter-1

### MINOR — Same dispose finding (FIXED via Codex's fix)

Independently flagged the same issue. Same fix.

### NIT — TDZ-adjacent ordering in createApp (DOCUMENTED inline)

`replayFromFile: () => replayFileImport.promptForFile()` closes over a binding declared lower in the file. Safe today (closure is only invoked on user click, after the const is initialized) but fragile — any future synchronous probe of `bridge.replayFromFile?.()` would hit TDZ.

**Fix applied:** Added a comment near the closure noting the ordering constraint and pointing future maintainers at slice 2's `let stack` forward-declaration pattern as the precedent for fixing it if needed.

### NIT — Comment says "FileReader" but code uses `file.text()` (FIXED)

Updated the comment to say "via the Blob `file.text()` Promise API."

### NIT — Add test for `file.text()` rejection branch (FIXED)

Added a regression test using a stub `File` whose `text()` returns `Promise.reject(new Error('disk error'))`. Asserts the toast is `'Could not read file: disk error'`.

### NIT — Pre-existing CSS overflow risk on `.hud-save-load` at narrow widths

Pre-existing, not introduced by slice 4. Skipped per Claude's "fix when adding button #5, not now" recommendation.

## Disposition

Both substantive findings addressed inline. All four NIT items (3 from Claude, 1 pre-existing) addressed except the CSS overflow which is pre-existing.

## Files changed by iter-1 fixes

- `src/game/replay/parseSessionBundleFile.ts`: widened required-top-level + required-arrays to match the full `SessionBundle` surface.
- `src/ui/replay/replayFileImport.ts`: comment update.
- `src/app/bootstrap/createApp.ts`: dispose call + TDZ-ordering comment.
- `tests/replay/parseSessionBundleFile.test.ts`: 3 new regression tests for missing markers/failures/snapshots.
- `tests/ui/replayFileImport.test.ts`: 1 new regression test for file.text() rejection.
- `docs/changelog.md`: footer count 848 → 852 reflecting +4 tests; description widened to mention the full required-array surface.
