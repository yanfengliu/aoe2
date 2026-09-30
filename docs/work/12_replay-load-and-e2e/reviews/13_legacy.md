# Slice 6 — replay-flow integration + e2e — Iter 1

**Diff base:** `9a90c1b` (slice 5 commit).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** ITERATE → 2 MAJOR findings (both reviewers, identical) addressed inline. 3 MINOR findings (Claude) addressed (1) or noted (2). 2 NIT items deferred.

## Codex iter-1

### IMPORTANT — Slice 6 closing the thread without the Playwright half (FIXED)

> "Slice 6 closes the thread while dropping the Playwright half of its own contract. The design (07) explicitly says to assert on test API getters, not screenshots — so the visual-baselines deferral does not justify dropping the spec."

**Fix applied:** shipped `tests/browser/replay-load-dialog.spec.ts` with 3 functional Playwright tests that drive the actual built app:
1. Replay button opens the dialog; Cancel closes without entering replay; mode stays `'live'`.
2. Live tab confirm enters replay (with graceful skip if the live recorder hasn't accumulated commands by test time); Escape exits replay.
3. `__AOE2_TEST__.replay.openReplayLoadDialog()` opens the dialog programmatically.

Spec asserts on `__AOE2_TEST__.replay.getReplayMode()` instead of canvas pixels — no visual baselines required.

### IMPORTANT — Closure state not actually complete (FIXED)

> "Changelog says the thread closes after this slice and should move to `done/`, but the live tree still has it under `current/`. The slice-6 review folder is empty, no `0.1.13` devlog entry."

**Fix applied:** `git mv docs/threads/current/replay-load-and-e2e docs/threads/done/replay-load-and-e2e` performed in this same commit. Slice 6 devlog entry added to `docs/devlog/detailed/2026-05-06_2026-05-06.md` and a `2026-05-07` summary block added to `docs/devlog/summary.md`. This iter-1 REVIEW.md lives at `docs/threads/done/replay-load-and-e2e/2026-05-07/slice-6-iter-1/REVIEW.md`.

## Claude iter-1

### MAJOR M1 + M2 (FIXED — same as Codex)

Same two findings independently flagged. Same fixes.

### MINOR N1 — Runtime-cost claim mismatch in the prompt baseline (NOTED)

The prompt said integration tests run at "similar cost" to `annotation-ui.integration.test.ts` (~6 ms/test). Claude measured ~1.1 s/test for the new replay-flow suite (uses real `createSimulationBridge` + 80-tick AI-rush fixture). The cost is acceptable in absolute terms (~7 s total added to the integration suite), but the prompt's framing was wrong. Cosmetic; no code change.

### MINOR N2 — `replay?` is optional but always present at runtime (FIXED)

Only one install site exists (`createApp.ts`), which always provides the `replay` field. The optional `?` was aspirational. Made `replay: BrowserTestReplayApi` required on both `BrowserTestApi` and `BrowserTestApiInstallOptions`. Updated comments.

### MINOR N3 — Transactional test's worldFactory stub comment understates (FIXED)

> "`fixture.bridge.world` is at tick 80 by the time the stub returns it; controller.world.tick would observe 80, not 0. The narrow assertion is fine but the comment should call out the caveat."

**Fix applied:** rewrote the stub comment to explicitly say "this is only valid for the transactional state-preservation assertion … would mis-report `controller.world.tick` … do not reuse this stub for tests that assert on world state."

### NIT Nt1 (flush-delay inconsistency) + NIT Nt2 (type-coercion pyramids)

Deferred per Claude's "Defer: Nt1, Nt2" disposition.

## Disposition

Both MAJOR findings addressed. Three MINOR findings addressed (N2, N3) or noted (N1). Two NITs deferred. Iter-2 verifies the closure state and the new Playwright spec.

## Files changed by iter-1 fixes

- `tests/browser/replay-load-dialog.spec.ts` (NEW): 3 functional Playwright tests using `__AOE2_TEST__.replay`.
- `src/app/bootstrap/browserTestApi.ts`: `replay: BrowserTestReplayApi` made required (was optional with `?`); options.replay made required.
- `tests/integration/replay-flow.integration.test.ts`: clarified worldFactory stub caveat.
- `docs/devlog/summary.md`: added 2026-05-07 v0.1.13 thread-closure entry.
- `docs/devlog/detailed/2026-05-06_2026-05-06.md`: added Slice 6 detailed entry.
- `docs/changelog.md`: rewrote the deferred-Playwright wording to reflect the now-shipped spec.
- `git mv docs/threads/current/replay-load-and-e2e docs/threads/done/replay-load-and-e2e`: thread closure performed.
