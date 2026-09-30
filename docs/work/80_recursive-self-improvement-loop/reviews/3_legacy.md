# Recursive Self-Improvement Loop Review - Iteration 4

## Scope

Reviewed the rerun finding-delta diff: `src/game/playtest/selfImprovementFindingComparison.ts`, `src/game/playtest/selfImprovementLoop.ts`, focused tests, thread docs, spec, architecture notes, and the fresh dogfood ledger at `output/self-improvement/2026-07-08-fresh-smoke-current-ledger.json`.

## Reviewers

- In-process adversarial self-review by the driver, grounded against the live code, focused Vitest output, typecheck output, and the dogfood ledger.
- External Codex/Claude review was not rerun for this low-risk internal harness slice. The previous Codex CLI escalation was rejected because it would export private repo diff/context to an external service without explicit user authorization, and Claude CLI remains unavailable on PATH.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| S1 | MEDIUM | Raw `ImprovementFinding.id` comparison was too weak for deterministic oracle findings. `oracleImprovementFindings.ts` generates ids with an order-dependent suffix, so a stable oracle/tick/message could be reported as resolved plus introduced when ordering changed between reruns. | FIXED. `selfImprovementFindingComparison.ts` now compares oracle findings by stable oracle/tick/message identity and falls back to id identity for generic findings. Added `tests/playtest/selfImprovementFindingComparison.test.ts` to lock this behavior. |

Checked risks with no further substantive findings:

- The ledger still stores actual finding ids in the resolved/persisted/introduced buckets so the JSON remains navigable to standardized finding records.
- `SelfImprovementComparison.metrics` continues to use `civ-engine.compareMetricsResults`; the new finding delta does not fork the metrics comparator.
- Markdown summary output stays concise and reports bucket counts only, avoiding a noisy full finding list in the human summary.
- Docs now describe stable finding identity rather than raw id comparison.

## Verification

- TDD red: `npx.cmd vitest run tests/playtest/selfImprovementLoop.test.ts` failed because `ledger.comparison.findings` was undefined and Markdown lacked a finding-delta line.
- Review red: `npx.cmd vitest run tests/playtest/selfImprovementFindingComparison.test.ts` failed because shifted oracle ids misclassified the same oracle/tick/message as resolved plus introduced.
- Green focused tests: `npx.cmd vitest run tests/playtest/selfImprovementFindingComparison.test.ts` passed (1 file, 1 test) and `npx.cmd vitest run tests/playtest/selfImprovementLoop.test.ts` passed (1 file, 8 tests).
- Typecheck: `npm.cmd run typecheck` passed before the final full-gate pass.
- Dogfood: `npm.cmd run playtest:self-improve -- --baseline output/self-improvement/fresh-smoke-baseline --current output/self-improvement/fresh-smoke-current --out output/self-improvement/2026-07-08-fresh-smoke-current-ledger.json --oracles` wrote a ledger with strong replay self-check evidence, 22 standardized oracle findings, and stable finding deltas: 14 introduced, 8 persisted, 8 resolved.
- Full gates: `npm.cmd test` (223 files passed, 1 skipped; 1827 tests passed, 2 skipped), `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.

## Residual Risk

The rerun comparison proves finding movement across two fresh deterministic runs. It does not itself apply or validate a gameplay fix. The broader goal remains active until the loop uses these ledgers to classify and close or carry forward candidate fixes with before/after rerun evidence.
