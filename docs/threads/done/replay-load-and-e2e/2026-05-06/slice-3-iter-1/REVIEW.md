# Slice 3 — Prior Sessions Replay button — Iter 1

**Diff base:** `b8a1a5b` (slice 2 commit).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** ITERATE → both findings addressed; ready for iter-2 (or commit if iter-2 nitpicks).

## Codex iter-1

### MEDIUM — Disabled-gate mismatch with design doc (FIXED)

`design/04-load-source-prior-sessions.md` said Replay should be disabled when `closedNormally === false && endTick === startTick`, but the implementation gated on schema version only. Either align implementation or update design.

**Fix applied:** Aligned implementation to design. `MarkerListPanel.renderPriorSessions` now computes `replayEmptyAbnormal = !s.closedNormally && s.endTick === s.startTick` and gates the Replay button on `exportDisabled || replayEmptyAbnormal`. Tooltip text reflects the active reason (schema mismatch / abnormal-empty). Added two regression tests:
- `Replay button is disabled when session ended abnormally with zero elapsed ticks` — closedNormally:false + endTick === startTick → disabled, tooltip mentions "session ended abnormally with zero elapsed ticks".
- `Replay button is enabled when session ended abnormally but has elapsed ticks` — closedNormally:false + endTick > startTick → enabled (controller can replay up to the last good tick).

Also tightened `design/04-load-source-prior-sessions.md` to cite the implementation site for traceability.

### LOW — Stale JSDoc on `RecordingService.loadPriorSessionBundle` (FIXED)

JSDoc said "throws ... or a generic Error if the IDB connection is unavailable (inMemoryOnly: true)" but the implementation throws `SessionNotFoundError` for that case (matching the new test).

**Fix applied:** Replaced the stale wording with "Throws SessionNotFoundError when the IDB mirror is unavailable (inMemoryOnly: true) OR the row is missing, and propagates SchemaMismatchError from the underlying mirror."

## Claude iter-1

### MINOR — Stale JSDoc on `loadPriorSessionBundle` (FIXED)

Same finding as Codex's LOW. Same fix.

Claude said "everything else in the prompt's 'what to look for' list checks out" — explicitly verified:
- The `escapeHtml(...)` template-literal-inside-call pattern produces no double-escape.
- Replay disabled gate on schema-mismatch is correct (defense in depth: even if user bypassed UI, `mirror.reconstructBundle` rejects).
- No race on `priorSessionsCache` — Replay branch never mutates it.
- `try/finally` correctly handles sync-throw-from-async-wrapper.
- `loadPriorSessionBundle` skipping `reembedBundle` is correct (in-process consumer).
- Unresolved-promise test is meaningful (assertion fires while promise is pending).
- `RecordingService.test.ts` round-trip test parallels `exportPriorSession round-trips`.
- Changelog test count math is consistent.
- No `ARCHITECTURE.md` / `drift-log.md` updates needed.

### Nit — `Parameters<typeof replayController.enterReplay>[0]` cast reads heavier than `as unknown as ReplayBundle`

Both forms are fine; the comment explains the cast. Left as-is.

## Disposition

Both substantive findings addressed inline. Iter-2 should converge.

## Files changed by iter-1 fixes

- `src/ui/annotation/MarkerListPanel.ts`: combined `replayDisabled` gate (`exportDisabled || replayEmptyAbnormal`) and per-reason tooltip text.
- `src/game/recording/RecordingService.ts`: corrected JSDoc on `loadPriorSessionBundle`.
- `tests/annotation-ui/MarkerListPanel.priorReplay.test.ts`: 2 new regression tests for the abnormal-empty + abnormal-with-ticks cases.
- `docs/threads/current/replay-load-and-e2e/design/04-load-source-prior-sessions.md`: surface text matched to the implementation gate.
- `docs/changelog.md`: 0.1.10 entry's disabled rationale + footer count (821 → 823 reflecting the 2 new tests).
