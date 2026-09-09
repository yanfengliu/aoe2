# Slice 5 — ReplayLoadDialog modal — Iter 1

**Diff base:** `4705c4b` (slice 4 commit).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** ITERATE → 4 substantive findings addressed (2 from Codex, 4 from Claude with overlap); 1 LOW left as-is. Iter-2 verifies.

## Codex iter-1

### MEDIUM — `priorSessionsCache` never invalidates (FIXED)

`priorSessionsCache` was set once on first open / first prior-tab click and never re-fetched. After save/load (which rebuilds `stack` and changes the live `RecordingService` identity), or after the user persisted a new session between two opens, the dialog kept showing the stale list.

**Fix applied:** clear `priorSessionsCache = null` at the top of every `open()` call so each open re-fetches the prior-session list. Cache stays per-open-cycle so multiple tab clicks within one open don't re-fetch.

Added a regression test `reopen re-fetches prior sessions (cache invalidated each open)` that opens, sets a new prior list, reopens, and asserts a second `listPriorSessions` call + the new row.

### MEDIUM — `open()` not idempotent during async listPriorSessions (FIXED)

Two rapid clicks while `listPriorSessions()` is in flight could call `showModal()` twice and throw `InvalidStateError`.

**Fix applied:** introduced an `opening` reentrancy flag plus an early `if (dialogEl.open) return;` after the await. Tests added a `rapid concurrent open() calls do not throw on showModal` regression.

## Claude iter-1

### MAJOR — Same `priorSessionsCache` finding (FIXED via Codex's fix)

### MEDIUM — No CSS for `.replay-load-dialog__*` classes (FIXED)

Dialog rendered with browser-default styling because `src/styles.css` had no `.replay-load-dialog` rules.

**Fix applied:** added ~110 lines of CSS to `src/styles.css` covering the dialog root + backdrop, inner template (title, tabs with active-state underline, panels, hint, primary button, prior-list rows with hover, empty state, footer, cancel button). Matches the existing HUD palette (dark-teal background, blue-accent active state).

### MEDIUM — Asymmetric error handling on `listPriorSessions` rejection (FIXED)

`open()`'s catch was silent; `handleTabClick` toasted. Inconsistent UX.

**Fix applied:** `open()`'s catch now also calls `toast.showToast('Could not list prior sessions: …')` matching `handleTabClick`.

### MEDIUM — Live tab can desynchronize after first paint (FIXED)

Switching to the live tab via `handleTabClick` did not re-read `recording.bundle()`. If the recorder gained/lost payloads while the dialog was open, the disabled state/hint stayed stale.

**Fix applied:** `handleTabClick` now calls `refreshLiveAvailability()` whenever `source === 'live'`.

### LOW — `escapeHtml` duplicated from MarkerListPanel (deferred)

Acceptable duplication at slice scope; flagged for a future cleanup that consolidates into `src/ui/utils/escapeHtml.ts`.

### LOW — `handleTabClick` `e.target.dataset.source` brittle to child elements (FIXED)

Replaced direct `e.target.dataset.source` with `e.target.closest<HTMLElement>('[data-source]')` so future tab-button children (icons, label spans) don't break the lookup. Mirrors `handlePriorRowClick`.

### LOW — Race on rapid prior-tab clicks (deferred)

Two quick clicks during the await could overwrite a successful cache with `[]` from the second's catch arm. Edge case; not reachable under normal interaction. Deferred.

### LOW — `showModal()` on already-open dialog (FIXED via Codex's fix)

Same as Codex's MEDIUM #2.

## Disposition

All MAJOR/MEDIUM findings addressed. Two LOW items deferred (escapeHtml duplication, rapid-prior-tab-click race). Iter-2 verifies.

## Files changed by iter-1 fixes

- `src/ui/replay/replayLoadDialog.ts`: `opening` reentrancy flag + cache invalidation on each open + toast on `open()` catch + `refreshLiveAvailability` on live tab click + `closest('[data-source]')` for tab dispatch.
- `src/styles.css`: ~110 lines of dialog CSS.
- `tests/ui/replayLoadDialog.test.ts`: 2 new regression tests (cache-invalidation-on-reopen + rapid-concurrent-open).
- `docs/changelog.md`: footer count 849 → 851.
