# Phase-6.E auto-apply propose-fix + counterfactual fix-validation — impl-1 review synthesis

Date: 2026-05-09. Iteration 1. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers found substantive issues.** Codex 3 HIGH + 2 MED; Claude 3 HIGH (one overlapping, two new) + 3 MED + 4 LOW. All HIGH and MED addressed inline.

## HIGH

### H1 — Patch never committed; branch not push-ready (Codex H1)

**Issue:** `applyAndGate` returned `git rev-parse HEAD` after gates passed but never committed the applied patch. The branch was technically "checked out with dirty worktree" — counterfactual re-runs ran against uncommitted changes; `git push origin <branch>` would push an empty branch.

**Fix applied:** `applyAndGate` gains optional `commitMessage?: string` input. When supplied (with `branchName`), runs `git add -A && git commit -m <message>` after all gates pass. Orchestrator passes a regression-summary commit message. Fully push-ready branch on success.

### H2 — `git checkout -- .` doesn't remove patch-introduced files (Claude H2)

**Issue:** Hard-revert restored tracked files but left untracked artifacts (new files the patch added) on disk. Next auto-fix invocation's clean-tree precondition would trip on stale junk from the prior failed attempt.

**Fix applied:** revert sequence is now `git checkout -- .` AND `git clean -fd`. `reverted: true` requires both to succeed. New test `reverted=true requires both checkout AND clean to succeed` pins the contract.

### H3 — Apply-failed leaves dangling branch + counterfactual cleanup is broken (Codex H2 + Claude H1, overlap)

**Issue (Codex H2):** counterfactual rejection cleanup did `git checkout -` + `git branch -D` on an UNCOMMITTED worktree; the patch could bleed onto the previous branch and the deletion would fail because the branch was still checked out.

**Issue (Claude H1):** `apply-failed` and `precondition-failed` paths only logged + exited, leaving a created auto-fix branch dangling. Operator had to manually `git checkout main && git branch -D auto-fix/...` before retrying.

**Fix applied:** new `cleanupBranch(branchName, baseBranch)` helper does the full sequence (`checkout -- .` → `clean -fd` → `checkout <baseBranch>` → `branch -D <branchName>`). Called from EVERY error path: apply-failed, gate-failed, precondition-failed (post-branch-creation), counterfactual-failed. The HIGH 1 commit fix means by the time counterfactual runs the worktree is clean + branch has a commit, so `cleanupBranch` works on a known-good shape.

### H4 — ClaudeCodeProvider can't return raw diff text (Codex H3)

**Issue:** `proposeFix` used `tools: []` and concatenated text blocks to get the diff. ClaudeCodeProvider schema-constrains output to `{thought, toolCalls[]}` — diff text would be jammed into the `thought` field (which the schema documents as "1-3 sentences of reasoning"). Subscription-only users got broken auto-fix.

**Fix applied:** replaced the free-text approach with a `submit_fix_diff` tool. Both providers (Anthropic SDK + ClaudeCodeProvider) emit the diff via tool_use, parsed identically. Empty-string diff is the model's signal for "no fix could be identified" — handled by the existing `proposal.diff.length < 10` early-bail.

### H5 — Provider auto-detect order asymmetric vs `playtest-llm.mjs` (Claude H3)

**Issue:** `selectProvider()` checked `ANTHROPIC_API_KEY` first, then `claude` CLI. `playtest-llm.mjs` does the opposite (claude-code first). Subscription users with both configured would have `playtest:llm` go through their subscription but `playtest:llm-auto-fix` bill their API quota — surprising and costly given auto-fix runs the LLM 4× per invocation.

**Fix applied:** flipped order to match playtest-llm.mjs (claude-code first, API second). Comment documents the cost-symmetry rationale.

## MEDIUM

### M1 — No on-main enforcement before branching (Codex M1)

**Fix applied:** orchestrator's pre-flight now runs `git rev-parse --abbrev-ref HEAD` and refuses with a clear error if not on `main`. The captured `baseBranch` is also passed to `cleanupBranch` so cleanup returns to the right place (defensive — currently always `main`, but supports future branch-aware operators).

### M2 — Missing-envelope crash in buildRegressionContext (Codex M2)

**Fix applied:** explicit null-guard at the top of `buildRegressionContext`. Returns a "no envelope" message instead of throwing on `envelope.seed`.

### M3 — Spec wording conflates two distinct opt-ins (Claude M1)

**Fix applied:** spec §15.7 now reads "Off by default — enabled via `npm run playtest:llm-auto-fix`. Pass `--skip-counterfactual` for the propose-only sub-flow that skips step 4."

### M4 — Spec said `<HHMMSS>` branch name; impl uses `<YYYYMMDDHHMMSS>` (Claude M2)

**Fix applied:** spec corrected to `<YYYYMMDDHHMMSS>` to match the implementation.

### M5 — Stale "Phase-6 deferred" note in spec determinism caveat (Claude M3)

**Fix applied:** changed "(Phase-6 deferred)" to "(Phase-6.E, shipped)" since the very bullet above describes the same N=3 mechanism as a shipped feature.

## LOW (all Claude, deferred)

- L1 — Dead `known` Set + unused `rmSync`/`join` imports. Defer; no lint/test impact.
- L2 — `--out` extra-flag collision footgun (orchestrator hardcodes; user value silently ignored). Defer; document in spec.
- L3 — Counterfactual breaks on first regression — could collect all N reasons. Defer; first signal is sufficient for v1.
- L4 — `proposeFix` regex for fence-stripping no longer applies (using tool now). Moot post-H4 fix.

## Tests

The applyAndGate suite gains 4 new tests covering the H1 and H2 fixes:
- "reverted=true requires both checkout AND clean to succeed"
- "commits the patch when commitMessage is supplied + gates pass"
- "skips commit when commitMessage is not supplied"
- "returns precondition-failed when commit fails after gates pass"

196 unit tests pass total + 1 skipped integration.

## Disposition

5 HIGH + 5 MED addressed inline. 4 LOW deferred. Re-review next iteration.
