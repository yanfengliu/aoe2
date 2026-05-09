# Phase-6.E auto-apply propose-fix + counterfactual fix-validation — impl-3 review synthesis

Date: 2026-05-09. Iteration 3. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers approve iter-3 fixes for the H1+H2 cleanupBranch bugs.** Codex iter-3 escalated the previously-deferred M2 (stale envelopes) to HIGH; this was addressed inline with the same iter-3 commit. Phase-6.E converged.

- Codex: "No additional cleanupBranch runtime bugs found in iter-3."
- Claude: "Iter-3 closes both iter-2 HIGHs cleanly. Recommend approval."

## Verifications (both reviewers)

- **HEAD-ref ownership detection** — verified by walking the "branch already exists" trace: `currentBranch !== branchName` → `branch -D` is NOT called, pre-existing operator branch preserved.
- **Post-commit-fail cleanup** — verified by walking the "gates passed, commit failed" trace: full reset → clean → checkout main → branch -D auto-fix. End state clean on main.
- **Gate-failed revert path** — `git reset --hard HEAD` is consistent with the cleanupBranch pattern even though the gate-failed case doesn't see staged content; defensive consistency worth the small uniformity cost.
- **Test integrity** — 13 applyAndGate tests pass; the new `reset --hard`-based assertions correctly establish the AND semantics for `reverted: true`.

## NEW HIGH (Codex iter-3) — addressed inline same iteration

### H3 — stale envelopes can drive false validation

**Issue:** `runPlaytestLlm` didn't delete pre-existing envelope files before invoking `playtest:llm`. If the child process crashed before writing a fresh envelope, `readEnvelope` would silently load a stale envelope from a prior invocation. Concrete worst case in the counterfactual loop: all 3 samples' playtest binaries crash silently before envelope-write but stale-clean envelopes from a prior `npm run playtest:llm-auto-fix` invocation are still on disk → orchestrator prints "all green; ready for manual push" while the patched build is actually broken.

Both reviewers explicitly recommended landing this fix in iter-4 if iter-3 didn't close it; both noted it was a one-liner (the unused `rmSync` import was already in the file).

**Fix applied:** `runPlaytestLlm` now `rmSync`'s any existing envelope file at `${outBase}.envelope.json` before invoking `playtest:llm`. Logged warn on rmSync failure (best-effort). Spec §15.7 documents the contract: "Each `playtest:llm` invocation deletes any pre-existing envelope at its `--out` path before running so a child crash before envelope-write cannot drive false validation against stale data."

## NEW MEDIUM (Codex iter-3) — addressed inline

### M3 — Spec §15.7 documented stale revert semantics

**Issue:** spec text still said "hard-reverts the worktree via `git checkout -- .`"; live code uses `git reset --hard HEAD`.

**Fix applied:** spec wording reconciled to "hard-reverts via `git reset --hard HEAD` + `git clean -fd` (the reset covers both staged and unstaged changes; the clean sweeps any untracked files the patch added)." Plus expanded the "any error path" sentence to enumerate all four (apply-failed, gate-failed, counterfactual-failed, commit-failed) and to clarify the no-branch-created case.

## Deferred to follow-up (both reviewers, both endorsed)

- **Codex iter-2 M1 (provider fallback symmetry)**: `selectProvider` uses `resolveClaudeBinary` whose POSIX path always returns rawPath. Should mirror playtest-llm.mjs's `canSpawnClaude` smoke test. Failure mode is loud (first `claude -p` errors out) so not silent; defer.
- **Test coverage for `cleanupBranch`**: orchestrator-level helper has zero unit tests. Both H1 and H2 (and H3) were caught by reasoning, not tests. Worth adding a thin test harness; not blocking.
- **`applyAndGate.ts:133-138` comment-accuracy nit (Claude L1)**: comment cites the staged-patch concern as the reason for the gate-failed revert change, but the gate-failed path never sees a staged patch. The change is consistency-driven. Comment polish, not a bug.

## Architecture / size

- `applyAndGate.ts`: 153 LOC.
- `playtest-llm-auto-fix.mjs`: ~360 LOC (.mjs, not subject to file-size budget test).
- `applyAndGate.test.ts`: 280 LOC; 13 tests.
- All under or outside the 500-line ceiling for `.ts` files in `src/`/`tests/`.

## Disposition

Iter-3 (with the inline M2/H3 + spec fixes) lands. Phase-6.E converged. The deferred items are nit-level / follow-up polish and do not gate the merge.
