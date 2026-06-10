# Phase-6.C.2 post-hoc observation oracle — impl-2 review synthesis

Date: 2026-05-09. Iteration 2. Reviewers: Codex (gpt-5.5 xhigh), Claude (Opus 4.7 1M, max effort).

## Verdict

**Both reviewers effectively approve.** Codex flagged 1 MEDIUM (over-broad screenshot catch) + 1 LOW (test gap). Claude APPROVE with 3 "Minor" notes; Claude explicitly said: "If reviewers nitpick at the level of Minor 1-3 in iter-3, that's the convergence signal called out in AGENTS.md." The Codex MED + Codex LOW (overlapping with Claude Minor 1-2) are addressed inline; Claude Minor 3 is a one-word doc nit not worth a third iteration.

## MEDIUM (Codex only)

### M1 — Post-loop screenshot catch was over-broad

**Issue:** The catch block at `llmRunner.ts:165` was unconditional. On clean exits (maxTicks/stopWhen), a post-loop screenshot failure indicates a real harness regression but was silently swallowed, leaving the oracle with the stale pre-advance screenshot.

**Fix applied:** narrowed the catch — only suppress when `stopReason === 'engineHalt'` (the run already failed; the in-loop fallback is the best available). On clean exits, a screenshot failure escalates to `stopReason='engineHalt'` + `errorMessage='final-screenshot capture failed: ...'`.

## LOW (Codex)

### L1 — Test coverage gap on the post-loop screenshot path + cost rollup

**Fix applied:** 3 new tests in `tests/playtest/llmRunner.test.ts`:
- "returns the post-loop screenshot, not the pre-advance one from the last decision" — counter-returning stub asserts `result.finalScreenshotPng` reflects the LAST call.
- "finalScreenshotPng is undefined when screenshotEnabled=false" — confirms the post-loop call is gated by the same flag.
- "escalates a post-loop screenshot failure on clean exit to engineHalt" — confirms the M1 fix surfaces failures rather than swallowing them.

The cost rollup (`totalCostUsd += verdict.costUsd`) is in the script glue layer — not unit-testable without integration scaffolding. Inspection confirms no NaN/undefined risk (`verdict.costUsd: number` always populated by the provider).

## Claude "Minor" notes

### Minor 1 — Test coverage on M1 behavior change (covered above by Codex L1 fix).

### Minor 2 — Empty `catch {}` at llmRunner.ts:165 swallows post-loop errors silently

The Codex M1 fix already addresses this for clean-exit paths (failures escalate to engineHalt). On the engineHalt-already path, the swallow is intentional (the in-loop fallback is the best we can do). No further change needed.

### Minor 3 — Spec wording vs script implementation

Spec §15.7 says "skipped when stopReason='stopWhen' + errorMessage='cost-budget-exceeded'"; script checks only the `errorMessage` field. Functionally equivalent (the only place that sets that errorMessage value also sets stopReason='stopWhen'). Doc-vs-impl wording, not a defect. Keeping as-is — Claude flagged as NIT, not a finding.

## No-issue verifications (all from Claude)

- M2 null-toolInput guard placement (immediately before cast, correct short-circuit order). ✓
- M3 cost rollup including the `costUsd === 0` case (trivially `+= 0` no-op). ✓
- M4 §15.7 spec scoping (correctly tagged as internal tooling, sits naturally with §15.4-15.6 operator-side subsections, doesn't leak gameplay framing). ✓
- L1 header comment fix (correct field name `errorMessage`, correct caller-side attribution). ✓
- L3 wrong-toolName test exercises the genuine fallback branch. ✓
- NIT type-import location consistency. ✓

## Disposition

Codex MED + LOW addressed inline. Claude effectively APPROVE. Phase-6.C.2 converged. Landing.
