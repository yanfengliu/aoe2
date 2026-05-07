# Slice 1 — Replay-mode annotation affordances — Iter 2

**Diff base:** `b6266ff`
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** ITERATE → both substantive findings addressed inline; ready for iter-3 nit-only re-review (or commit if iter-3 is skipped given the small scope).

## Codex iter-2 findings

### IMPORTANT — Severity prototype-pollution bypass (FIXED)

`SEVERITY_ICONS[severityRaw] ? severityRaw : 'info'` (the iter-1 clamp) used a truthy lookup against a normal `Record<string, string>` object. Inherited names like `constructor`, `__proto__`, `toString` resolve to `Object.prototype.X` (truthy), so a malicious bundle marker with `data.severity = 'constructor'` would bypass the clamp, get `escapeHtml`-wrapped (no special chars in those identifier strings), and end up as a class name like `marker-list-panel__sev--constructor`. The downstream `icon = SEVERITY_ICONS[severity] ?? 'i'` would then resolve to the inherited Object constructor, interpolating its source code into the row's innerHTML.

**Fix applied:** introduced `ALLOWED_SEVERITIES = new Set(Object.keys(SEVERITY_ICONS))` and replaced the truthy lookup with `ALLOWED_SEVERITIES.has(severityRaw)`. `Set.has` does not consult the prototype chain, so identifier names like `__proto__`/`constructor`/`toString` no longer pass. The `icon` lookup is now safe because `severity` is guaranteed to be an own key. Added a regression test `prototype-pollution severities (constructor/__proto__/toString) clamp to "info"` to `MarkerListPanel.replay.test.ts`.

### IMPORTANT — Test-count footer mismatch (FIXED before iter-2 launched)

The 0.1.8 changelog footer claimed `110 files / 802 passed` but the slice-1 commit alone produces `109 files / 796 passed` (the additional file/tests in the workspace come from untracked slice-2 files `loadCurrentSession.ts/.test.ts`). Already corrected in the staged changelog.

## Claude iter-2 findings

Claude's iter-2 verdict: all four iter-1 fixes verified clean; one new finding (the changelog footer mismatch — same as Codex's #2, already addressed); no other issues. Claude verified five additional structural concerns from the prompt:

- `createApp.ts` Alt+M registration passes the controller by reference (gate re-evaluates mode on every call).
- The replay adapter literal (`mode/bundle/jumpToMarker/onModeChange`) thunks correctly without losing receiver.
- `MarkerListPanelReplayAdapter.bundle()` structurally accepts `SessionBundle` (its `markers` field matches `readonly Marker[]`).
- The bundle markers spread-clone before sort prevents mutation of the controller-owned array.
- The mode-change listener is registered in mount and unsubscribed in dispose with no leak.

Claude also noted the slice-1 commit's `MarkerListPanel.test.ts` change (live-mode file) is byte-identical to `b6266ff` after the trailing-newline fix — true; the file was modified during slice-1 implementation and reverted to its original byte content during iter-1 fixes. Not an issue, just an audit-trail note.

### B — Forward-looking design docs in slice-1 commit (NO ISSUE per Claude)

Claude explicitly endorsed folding the slices 2-6 design sub-files into the slice-1 commit because the thread is being created for slice 1 and per-slice setup commits would just add ceremony.

## Disposition

Both substantive iter-2 findings addressed inline. The added regression test means iter-3 should converge to nits or no findings; given the small scope of iter-2 fixes (one helper Set + one swap + one test), iter-3 is optional unless future review iterations on similar code reveal another path through the clamp.

## Files changed by iter-2 fixes

- `src/ui/annotation/MarkerListPanel.ts`: `ALLOWED_SEVERITIES` Set + `Set.has` clamp.
- `tests/annotation-ui/MarkerListPanel.replay.test.ts`: prototype-pollution regression test.
- `docs/changelog.md`: validation-footer count corrected from `110/802` to `109/796` (already addressed before iter-2 launch).
