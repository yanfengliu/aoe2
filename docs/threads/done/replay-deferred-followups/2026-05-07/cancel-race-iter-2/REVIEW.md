# Cancel-during-load race fix — Iter 2

**Diff base:** `5f43a4a` (escapeHtml-consolidation commit).
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `opus-4-7[1m]` max. Both reachable.
**Disposition:** Did NOT converge — both reviewers raised the SAME two IMPORTANT findings about the iter-2 changes; iter-3 follows.

## Both reviewers — IMPORTANT — `handleTabClick` stale-cache test does not exercise the regression

Independent traces from Codex and Claude reached the same conclusion: the iter-2 test ordered as `open → click prior tab → close → resolveStaleList → reopen → click prior tab` does NOT distinguish iter-1 from iter-2 code, because `open()` unconditionally resets `priorSessionsCache = null` after the stale resolution has already drained — erasing the bug's only visible side effect before the assertion runs. The test passes on iter-1 even without the new guard.

**Fix:** swap the order so reopen happens BEFORE the stale resolution. After the swap:

- Pre-fix: stale resolve writes `cache=[stale]`; second prior-tab click sees `cache !== null` → skips fetch → renders [stale] → assertion fails.
- Iter-2: stale resolve sees stale `myGen`, bails; second prior-tab click sees `cache=null` → fetches fresh → renders [fresh] → assertion passes.

Iter-3 reorders the test as recommended.

## Both reviewers — IMPORTANT — Missing iter-1 / iter-2 REVIEW.md on disk

AGENTS.md mandates: *"Save reviewer synthesis under `docs/threads/current/<objective>/<date>/<iteration_number>/`"* and *"Each iteration directory contains only `REVIEW.md`."* The iter-1 directory existed but was empty (synthesis was written directly into the devlog instead). Re-reviewers consult prior iterations' `REVIEW.md` per AGENTS.md.

**Fix:** iter-3 writes both `cancel-race-iter-1/REVIEW.md` and `cancel-race-iter-2/REVIEW.md` (this file).

## Codex iter-2 NIT — Changelog overstates the file-import generation check

`docs/changelog.md` said *"checks generation after the file read and after the parse before calling `enterReplay`"*. The implementation only checks ONCE, after the read but BEFORE parse + enterReplay (parse + enterReplay are synchronous after that). Behavior is fine; wording was wrong.

**Fix:** changelog now reads *"checks generation immediately after the file read and bails before parse + `enterReplay` (both of which are synchronous after the await)."*

## Claude iter-2 NIT — "Three races" vs four bullets in changelog

Changelog opened with *"Closes three async lifecycle races"* but enumerates four bullets (prior-row, file-import, tab-switch, dispose).

**Fix:** changelog now says four.

## Claude iter-2 NIT — Test commentary "detached DOM" framing inaccurate

`dialog.close()` does NOT detach DOM; it only sets `open=false`. The old commentary was misleading.

**Fix:** the test rewrite drops the inaccurate framing entirely; new comment says *"the resumed handler from step 2 unconditionally writes priorSessionsCache=[stale]; the next prior-tab click sees cache !== null → skips refetch → renders [stale]."*

## Anti-regression / verification (positive findings agreed by both reviewers)

- **dispose-bump ordering** — `generation += 1` runs BEFORE listener removal. Correct: handlers already past listener invocation see the bump; new clicks won't fire after listener removal.
- **`handleTabClick` guard symmetry** — both success and error paths bail before any state write or render.
- **`open()` in-flight `listPriorSessions` guard** — both branches bail before cache write / toast / `showModal`.
- **`dispose-during-prior-row` test is genuine** — Claude's trace confirmed the test would fail on iter-1 (where dispose did not bump generation).
- **Helper-level signal is a clean cancellation seam** — optional parameter; `createApp.ts:168`'s 2-arg call unaffected.
- **Anti-regression intact**: `priorSessionsCache` reentrancy, `opening` flag, slice-4 transactional `enterReplay` all unchanged.
- **Doc accuracy**: `package.json:3 = "0.1.14"`, `docs/devlog/summary.md` top entry mentions v0.1.14, devlog detailed entry covers all four races + iter narrative.

## Iter-3 actions

1. Reorder the `handleTabClick` stale-cache test (swap reopen before resolveStaleList) — closes both reviewers' IMPORTANT #1.
2. Write `cancel-race-iter-1/REVIEW.md` (this file's sibling) and `cancel-race-iter-2/REVIEW.md` (this file) — closes both reviewers' IMPORTANT #2.
3. Fix changelog "three" → "four" — Claude NIT.
4. Fix changelog file-import wording — Codex NIT.
5. The "detached DOM" framing fix is already in the iter-2 test rewrite (no separate fix needed).
