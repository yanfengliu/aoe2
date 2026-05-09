# Phase-6.E auto-apply propose-fix + counterfactual fix-validation — impl-2 review synthesis

Date: 2026-05-09. Iteration 2. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers found the same 2 HIGH iter-2-introduced bugs** in the new `cleanupBranch` helper from iter-1's H3 fix. Codex also raised 2 MEDIUM (provider fallback symmetry, stale envelope reads). All addressed inline; iter-3 review next.

## HIGH

### H1 (Codex H2 + Claude H1, overlap) — `cleanupBranch` couldn't unwind a staged-but-uncommitted patch

**Issue:** When `git add -A` succeeded but `git commit` failed, the index held the patch. `cleanupBranch`'s `git checkout -- .` only restores the worktree FROM the index — leaving the staged patch alive. `git clean -fd` only removes untracked files. The subsequent `git checkout main` could either fail with "your local changes would be overwritten" OR carry the staged patch onto main. Either way: the spec's claim "operator's working tree returns to the pre-invocation state" was violated.

**Fix applied:** changed both `cleanupBranch` (orchestrator) AND `applyAndGate`'s gate-failed revert path to use `git reset --hard HEAD && git clean -fd`. The hard reset covers BOTH staged and unstaged modifications uniformly. Existing tests updated to match (`reset --hard` instead of `checkout -- .`); ` reverted=true requires both reset AND clean to succeed`.

### H2 (Codex H1 + Claude H2, overlap) — `cleanupBranch` deleted pre-existing branches the operator owned

**Issue:** When `git checkout -b <branchName>` failed (e.g., branch already exists for the operator-supplied `--branch <name>`), `applyAndGate` returned `precondition-failed`. Orchestrator unconditionally called `cleanupBranch`, which unconditionally ran `git branch -D <branchName>` — destroying a branch the operator pre-existed and we never owned.

**Fix applied:** `cleanupBranch` now reads `git rev-parse --abbrev-ref HEAD` first. If HEAD is NOT on the auto-fix branch, we never created it; cleanup skips the `branch -D` step (still resets/cleans the worktree as a safety) and returns. If HEAD IS on the branch, we own it and the full cleanup sequence (reset + clean + checkout base + branch -D) runs. This handles both the "branch creation failed" case AND the "we did create it but commit failed" case correctly.

## MEDIUM (Codex)

### M1 — Provider fallback not symmetric with `playtest-llm.mjs`

**Issue:** `selectProvider()` checks `resolveClaudeBinary('claude') !== null`, but on POSIX the function always returns the raw path even if `claude` is absent. `playtest-llm.mjs` does a `--version` smoke test via `canSpawnClaude()` to verify spawnability. Auto-fix could pick claude-code on a POSIX system without claude installed; the API fallback would never trigger.

**Disposition:** Deferred to iter-3 + tracked. The same `canSpawnClaude` helper should be shared. For v1, the asymmetry is acceptable because the orchestrator's first `claude -p` invocation will fail loud with a clear "claude not found" error rather than silently bill the API. Adding a shared helper is cleanup-worth a follow-up commit; not blocking.

### M2 — Stale envelopes drive false validation results

**Issue:** `runPlaytestLlm` logs non-zero exit codes but still returns; `readEnvelope` then reads from a fixed path. If the playtest crashes before writing a fresh envelope, an envelope from a previous invocation is loaded — leading to false-positive "regression" or false-negative "clean" verdicts.

**Disposition:** Deferred to iter-3. Fix is one-liner — `rmSync` the envelope file before each `runPlaytestLlm` invocation. Tracked.

## Test coverage gaps (Claude)

- No test for `cleanupBranch` directly — both H1 and H2 were caught by reasoning, not tests. Adding a unit harness for `cleanupBranch` (extract as a pure function over `runFn`) would prevent regression.
- No test for `git add -A` failure (only `git commit` failure).
- No test for "commitMessage supplied but branchName not supplied" (commit silently skipped — unusual semantics).

**Disposition:** Deferred to iter-3 follow-up. Iter-2's main responsibility was fixing the 2 HIGH bugs; tests for cleanupBranch are a regression-prevention investment that doesn't gate the fix from landing.

## Disposition

2 HIGH addressed inline. 2 MED + 3 test-coverage gaps deferred to iter-3 polish. Re-review next iteration.
