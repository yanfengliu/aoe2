# Phase-6.D winner oracle — impl-1 review synthesis

Date: 2026-05-09. Iteration 1. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers converged on the same 2 issues.** All addressed inline; iter-2 review next.

## Codex findings (2 MEDIUM)

### M1 — winner-contract violation in two paths

**Issue (a):** count probe throw left clean-exit envelope without winner field, but `stopReason` stayed clean. Contract says "winner present unless engineHalt"; probe failure on clean exit silently broke that.

**Issue (b):** export-bundle throw AFTER winner scoring flipped `stopReason` to engineHalt — but the already-computed winner was still spread into the envelope. Contract says "winner omitted on engineHalt"; this leaked.

**Fixes applied:**
- (a) Probe failure on clean exit now escalates to `stopReason='engineHalt'` + `errorMessage='winner-oracle count probe failed: ...'` (mirrors the post-loop screenshot escalation pattern).
- (b) Added `finalWinner` re-check at envelope-build time: if `stopReason === 'engineHalt'` (which can happen if exportBundle threw post-score), winner is dropped before the conditional spread.
- 2 new runner tests: "drops winner field when exportBundle throws after a successful score" + "escalates a count-probe failure on clean exit to engineHalt".

### M2 — spec persistence

**Fix applied:** `design/spec-final.md` §15.7 now has a winner-oracle bullet documenting `kind` values, the engineHalt-omit semantics, and the cost-budget-exit asymmetry vs the observation oracle (winner runs on cost-budget exit because read is free; observation skips because LLM call costs money).

## Claude findings (2 IMPORTANT, overlapping with Codex)

### IMPORTANT 1 — winner field can leak past engineHalt when export-bundle throws on a clean run

Same as Codex M1b. Already fixed.

### IMPORTANT 2 — spec persistence

Same as Codex M2. Already fixed.

## Claude design-discussion items (informational, not findings)

### Cost-budget exit invokes winner oracle (asymmetric with observation)

Both reviewers note this asymmetry. Claude explicitly recommends keeping current behavior because:
- Winner extraction has zero marginal cost (engine read, no LLM call).
- `kind: 'in-progress'` honestly captures the truncated-play semantics.
- `errorMessage` already gives consumers the qualifying context.

Spec §15.7 winner bullet now calls out this asymmetry explicitly.

### Buildings-under-construction count as "alive"

Claude noted that 1%-progress buildings count toward owner-alive. This is the right semantic (under-construction buildings consume cells, are visible, refund material on cancel). Spec §15.7 winner bullet documents "under-construction buildings count" explicitly to prevent future re-derivation.

## Verified clean (Claude confirmation)

- `extractWinner` numeric sort (no lexicographic trap). ✓
- Resources / sheep / wildlife correctly excluded (`economy.resources` is read separately by callers; not aggregated here). ✓
- Dying-state semantics (engine doesn't keep zombie entities; destroyEntity removes from query). ✓
- Garrison handling (garrisoned units lose position → not in `economy.units`; building destruction cascades → owner correctly dead). ✓
- engineHalt skip path (gating + conditional spread; existing test correctly asserts both). ✓
- Determinism (numeric sort independent of JS engine; `Number(id)` coercion correct). ✓
- File-size budget (winnerOracle.ts 36 LOC, llmRunner.ts 268 LOC — both under 500). ✓

## Disposition

2 MEDIUM (Codex) + 2 IMPORTANT (Claude, overlap) addressed inline. Re-review next iteration.
