# Scrub-workflow Playwright e2e — Iter 1

**Diff base:** `dbb400a` (v0.1.15 dialog interactivity fix).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** CONVERGED on iter 1 — both reviewers raised the same 3 findings (1 IMPORTANT functional, 1 IMPORTANT doc, 1 NIT duplication). All addressed inline.

## Both reviewers — IMPORTANT — `getReplayCurrentTick()` only verifies the coalesced-scrub path

Codex (more specific): "TimelinePanel sets a pending coalesced scrub on `input` (TimelinePanel.ts:142-143), and `ReplayController.scrubTo(..., { coalesce: true })` immediately updates `displayedTick`. The test API reads `replayController.currentTick`, whose getter returns `displayedTick` in replay mode. So the assertion can pass after the `input` event even if the `change` listener / `commitPendingScrub()` path is broken."

Claude raised the related concern that `waitForTimeout(50)` is the wrong tool — the chain is fully synchronous, so the wait is unnecessary today and flake-prone if a future microtask is inserted. Recommended `expect.poll`.

**Fix applied (covers both points):**
- All `await page.waitForTimeout(50)` calls removed; replaced with `await expect.poll(() => getReplayCurrentTick()).toBe(N)` which both removes the misleading "may need a microtask" comment and makes the test robust to forward-microtask insertion.
- Added a comment block at the top of the file flagging the coverage caveat: the test verifies the input/coalesced-scrub path; the `change`/commit path's side effects live outside the public test surface. A future task will expose `getReplayCommittedTick()` so the commit phase has a dedicated observable.

## Both reviewers — NIT — Duplicate range value-set + event-dispatch block

Same 5 lines appeared twice. Extracted into `commitRangeValue(range, value)` helper at the top of the file. Codex pointed out the helper's intent ("input + change") is now explicit.

## Both reviewers — IMPORTANT/NIT — Changelog/devlog "visual-baseline gaps" mischaracterized

Both reviewers grepped the named failing specs. Codex: "live `test-results` error contexts show normal behavior/assertion failures: market resources expected 800 got 700, garrison villager count expected 2 got 3, rendering boolean expected true got false". Claude: same grep, no `toMatchSnapshot` / `toHaveScreenshot` / `baseline` references in those specs.

**Fix applied:** changelog and devlog detailed both now say *"pre-existing rendering/behavior assertion mismatches (e.g., market resources expected 800 got 700; garrison villager count expected 2 got 3; building visual flags off)"* and explicitly call out *"the 8 replay-related Playwright tests (5 dialog + 3 scrub) all pass"* so the load-bearing claim is unambiguous.

## Anti-regression / verification (positive findings agreed by both reviewers)

- `TimelinePanel.ts:171` is a native `<input type="range">` (no drag synthesis needed).
- All testids exist (`timeline-panel`, `timeline-range`, `timeline-step-back`, `timeline-step-forward`, `timeline-exit`).
- `__AOE2_TEST__.replay.{getReplayMode,getReplayCurrentTick,seedPriorSession,advanceTicks}` all wired correctly.
- v0.1.14 cancel-race plumbing (generation counter, dispose-bump): intact.
- v0.1.15 CSS fixes (`.replay-load-dialog__panel[hidden]`, `.replay-load-dialog__root { pointer-events: auto }`): intact.
- Slice-4 transactional `enterReplay`: intact.
- `expect.poll` usage in beforeEach: correct Playwright syntax.
- Step-back guard `expect(maxValue).toBeGreaterThan(2)`: sound for the seeded prior-session path (endTick = 125).
- No production source changes — only docs, lockfile, version, new spec.

## Iter-1 fix-up summary

1. `commitRangeValue(range, value)` helper extracts the duplicate dispatch boilerplate.
2. All four `waitForTimeout(50)` calls replaced with `expect.poll(...).toBe(...)` patterns.
3. Top-of-file comment now flags the coverage caveat (test exercises coalesced-scrub path; commit-path side effects deferred to a future test API).
4. Changelog + devlog detailed now characterize the 5 unrelated Playwright failures accurately ("rendering/behavior assertion mismatches" with concrete examples) and explicitly call out the 8 replay-related tests passing.

## Disposition

Both reviewers said "ship as is" + "fold IMPORTANT #1 fix into this commit if small" — fold is small, all 3 findings addressed inline. No iter-2 needed.
