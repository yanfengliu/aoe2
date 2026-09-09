# Recursive Self-Improvement Loop Review - Iteration 2

## Scope

Reviewed the deterministic oracle bootstrap diff: oracle ingestion in `src/game/playtest/selfImprovementLoop.ts`, `--oracles` CLI glue in `scripts/playtest-self-improve.mjs`, focused tests, and docs that standardize oracle findings through the ledger.

## Reviewer

In-process adversarial self-review by the driver. Subagent review was not used for this iteration because the available subagent tool requires explicit user delegation in this environment; the review still verified claims against the live code and fresh command output.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| S1 | LOW | The first implementation put oracle conversion helpers directly in `selfImprovementLoop.ts`, pushing the file to 522 LOC and failing the repo's hard 500 LOC budget. | FIXED. Split oracle conversion into `src/game/playtest/oracleImprovementFindings.ts`; the focused file-size budget test now passes. |

Checked risks with no further substantive findings:

- Missing trace handling: `scripts/playtest-self-improve.mjs` still requires `.llm-trace.jsonl` unless `--oracles` is explicit, so typoed LLM prefixes do not silently turn into zero-command deterministic ledgers.
- Deterministic metrics: `selfImprovementLoop.ts` uses zero decision/command/stall metrics for no-trace deterministic runs and keeps `ticksRun`, `stopReason`, and `findingsCount`, avoiding NaN comparison output.
- Oracle standardization: `oracleImprovementFindings.ts` maps `OracleViolation`s to shared `ImprovementFinding`s with `verificationStatus: "verified"`, `disposition: "candidate"`, bundle/tick/metric evidence, and fix/observe routing.
- Legacy path: `scripts/run-oracles.mjs` remains the pass/fail report path; docs point recursive-loop evidence at `playtest:self-improve --oracles`.

## Verification

- TDD red was observed before implementation: focused tests failed for missing `oracle-violations` source, NaN deterministic metrics, and unknown `--oracles`.
- `npx.cmd vitest run tests/playtest/selfImprovementLoop.test.ts tests/playtest/playtestSelfImproveScript.test.ts`: 2 files passed, 9 tests passed.
- `npx.cmd vitest run tests/architecture/fileSizeBudget.test.ts tests/playtest/selfImprovementLoop.test.ts tests/playtest/playtestSelfImproveScript.test.ts`: 3 files passed, 11 tests passed after the helper split.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- Fresh dogfood:
  - `npm.cmd run playtest -- --seed self-improve-smoke --max-ticks 500 --out output/self-improvement/fresh-smoke-baseline --all-ai`
  - `npm.cmd run playtest -- --seed self-improve-smoke --max-ticks 700 --out output/self-improvement/fresh-smoke-current --all-ai`
  - `npm.cmd run playtest:self-improve -- --baseline output/self-improvement/fresh-smoke-baseline --current output/self-improvement/fresh-smoke-current --out output/self-improvement/2026-07-08-fresh-smoke-current-ledger.json --oracles`
- Dogfood result: current ledger reported replay self-check `ok` with 1 checked / 0 skipped, 22 standardized oracle findings, fix/observe classifications, and a baseline/current comparison.
- First full `npm.cmd test` attempt failed only on the file-size budget; the failure is fixed by the helper split and the focused budget test is green.
- Full gates after the split: `npm.cmd test` (220 files passed, 1 skipped; 1819 tests passed, 2 skipped), `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.

## Residual Risk

The oracle suite currently reports known short-run failures such as `match-completes` at maxTicks and pinned/oscillating units. The ledger correctly preserves those as candidate findings; it does not decide which fix to implement next. The broader goal remains active until a later patch closes or classifies those findings through a rerun.
