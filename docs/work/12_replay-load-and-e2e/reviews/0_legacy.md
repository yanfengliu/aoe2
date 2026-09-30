# Slice 1 — Replay-mode annotation affordances — Iter 1

**Diff base:** `b6266ff` (closed replay-scrubber DESIGN.md split)
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** ITERATE → all findings addressed inline; ready for re-review (iter-2).

## Codex findings

### IMPORTANT — Missing v0.1.8 version/changelog surfaces (FIXED)

Slice was labeled v0.1.8 in `design/02-annotation-affordances.md` but `package.json` and `package-lock.json` were still at `0.1.7` and `docs/changelog.md` had no `0.1.8` entry.

**Fix applied:** bumped `package.json` and `package-lock.json` to `0.1.8`; added `## 0.1.8 - 2026-05-06` entry in `docs/changelog.md` describing the user-visible behavior change.

### IMPORTANT — Replay marker rendering exposes bundle data through innerHTML without full escaping (FIXED)

`MarkerListPanel.renderCurrentSession` interpolated `severity` directly into a class attribute and `m.tick` directly into HTML. Engine `Marker.data` is `JsonValue` and `SessionReplayer.fromBundle` does not validate marker fields, so replay bundles loaded from disk / IDB / file (the upcoming Slice 4 surface) could carry malformed values that break out of attributes.

**Fix applied:**
- `severity`: clamp to known values via `SEVERITY_ICONS[severityRaw] ? severityRaw : 'info'`, then `escapeHtml` the value before interpolating into the class attribute.
- `m.tick`: `Number.isFinite(m.tick) ? Math.trunc(m.tick).toString() : '0'`, then `escapeHtml`.
- `m.id`: already escaped (Claude verified).

### MEDIUM — Stale design/plan docs (FIXED)

`design/02-annotation-affordances.md` said "No new files" but the diff added `replayAnnotationGate.ts`. `PLAN.md` and the test contract pointed at `MarkerListPanel.test.ts`, but the replay-mode tests live in `MarkerListPanel.replay.test.ts` (split to honor the 500-LOC budget).

**Fix applied:** updated `design/02-annotation-affordances.md` Surface section to mention the new gate file + the escape hardening; updated the Test contract section to point at `MarkerListPanel.replay.test.ts`. Updated `PLAN.md` row 1's "files touched" and "new tests" columns.

## Claude findings

Claude's verdict was "ship it" — no real bugs or correctness issues. Claude verified eight specific concerns from the briefing against the live code (gate-captures-controller-not-snapshot; panel-rerenders-on-mode-flip; `__prior` hidden toggle; `escapeHtml` on `data-marker-id`; sort-clones-bundle-array; replay-adapter-undefined / bundle-null safety; controller-wiring single-instance; dispose cleanliness). Claude also confirmed Alt+M is silent in replay (matches the §5.7 contract) and that all docs in the diff align with implementation.

### Nit — Trailing newline regression in `tests/annotation-ui/MarkerListPanel.test.ts` (FIXED)

The slice-1 edit removed the final LF byte from the file. `eol-last` is not a lint rule in this repo, so it didn't fail gates, but it was an unintended diff artifact.

**Fix applied:** restored the trailing newline.

### Note — Numeric escaping observation

Claude noted `m.tick` is "not escaped, which is correct since it doesn't need it." This is wrong for the `JsonValue`-typed bundle case (which Codex caught). The escape + coerce hardening from Codex finding 2 already covers it. No additional work needed.

## Disposition

All findings addressed inline. Pending iter-2 multi-CLI confirmation that the fixes landed correctly and no new defects were introduced.

## Files changed by iter-1 fixes

- `package.json`, `package-lock.json`: version bump.
- `src/ui/annotation/MarkerListPanel.ts`: HTML-escape + coerce numeric/severity rendering.
- `tests/annotation-ui/MarkerListPanel.test.ts`: restored trailing newline.
- `docs/changelog.md`: 0.1.8 entry.
- `docs/threads/current/replay-load-and-e2e/PLAN.md`: row 1 columns.
- `docs/threads/current/replay-load-and-e2e/design/02-annotation-affordances.md`: surface + test-contract sections.
