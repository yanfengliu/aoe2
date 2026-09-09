# Slice 3 — Prior Sessions Replay button — Iter 2

**Diff base:** `b8a1a5b` (slice 2 commit).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** ITERATE → Codex MEDIUM addressed inline; Claude said "ship slice 3" so iter-3 will verify the new extraction converges.

## Codex iter-2

### MEDIUM — Prior-session Replay can still open non-advanceable bundles (FIXED)

> "If a prior session has elapsed ticks but zero recorded commands, the new button stays enabled, `createApp.ts` calls `replayController.enterReplay(bundle)` without validating command payloads, and the user can be moved into replay mode with disabled forward controls. That contradicts the existing current-session behavior and the changelog rationale that forward replay needs payloads."

The UI gate (`!closedNormally && endTick === startTick`) only catches the obvious empty-then-crashed case. A prior session that ran for ticks without ever submitting a command would slip through.

**Fix applied:** Extracted the replay-prior-session logic into `src/game/replay/loadPriorSessionAsReplay` mirroring `loadCurrentSessionAsReplay`'s contract. The helper:
1. Reconstructs the bundle via `recording.loadPriorSessionBundle(sessionId)`.
2. Returns `{ status: 'no-payloads' }` when `bundle.commands.length === 0`, before calling `enterReplay`.
3. Wraps `enterReplay` in a try/catch returning `{ status: 'error', error }`.

`createApp.ts` now delegates to the helper; the panel's catch surfaces "session has no recorded commands; nothing to replay forward" as a "replay failed: ..." toast for the no-payloads branch.

Added `tests/replay/loadPriorSession.test.ts` (5 tests): ok, no-payloads, error-on-throw, propagates rejection from loadPriorSessionBundle, wraps non-Error throws.

## Claude iter-2

> "No substantive findings; ship slice 3."

Claude verified all six iter-2 verification targets clean:
- `MarkerListPanel.ts` `replayDisabled` gate matches design.
- Tooltip per-reason priority order is correct.
- Two new regression tests are valid.
- `RecordingService.ts` JSDoc cleaned.
- Design doc cites the implementation site.
- Iter-1 REVIEW.md is accurate.

Claude also flagged three non-issue nits (post-resolve re-enable assertion gap, `dispose()` not nulling `priorSessionsListEl`, `renderPriorSessions()` in success-path finally being a wasted DOM write); none worth fixing.

## Disposition

Codex's MEDIUM is real and addressed via the helper extraction. Iter-3 should converge — both reviewers will inspect a small new module + a wiring delegation in createApp.

## Files changed by iter-2 fixes

- `src/game/replay/loadPriorSession.ts` (NEW): `loadPriorSessionAsReplay` helper mirroring `loadCurrentSession`'s contract, with explicit `no-payloads` status for empty-commands bundles.
- `src/app/bootstrap/createApp.ts`: `onReplayPriorSession` thunks through the helper; status-handling logic moved into the helper.
- `tests/replay/loadPriorSession.test.ts` (NEW, 5 tests): unit coverage for the helper.
- `docs/changelog.md`: footer count `823 → 828` reflecting +5 helper tests + +1 file.
