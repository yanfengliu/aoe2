# Recursive Self-Improvement Loop Review - Iteration 3

## Scope

Reviewed the ledger-driven fix proposal intake diff: `src/game/playtest/fixProposalInput.ts`, `scripts/propose-fix.mjs`, focused tests, and docs that make `propose-fix --ledger` the recursive-loop proposal entrypoint while preserving legacy `REPORT.md` fallback.

## Reviewers

- In-process adversarial self-review by the driver, grounded against the live code and focused test/typecheck output.
- Codex CLI external review was attempted after upgrading `codex.cmd` from 0.142.5 to 0.143.0, but the first run was blocked by sandboxed network/socket permissions and the required escalation was rejected because it would export private repo diff/context to an external service without explicit user authorization.
- Claude CLI review was unavailable because `claude.cmd` is not on PATH.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| S1 | LOW | Shared `ImprovementFinding.severity` can include `info`, but the proposal prompt path converts findings into `OracleViolation`, whose severity only permits `low`, `medium`, or `high`. Passing through `info` would fail typecheck or produce an invalid violation shape. | FIXED. Added `normalizedSeverity`, maps non-oracle informational findings to `low`, and added a regression test. |
| S2 | LOW | Reworking `propose-fix.mjs` around ledger input could regress the legacy `REPORT.md` fallback, which older oracle artifacts still use. | FIXED. Added a dry-run script test for the legacy report path and kept ledger selection behind `--ledger` only. |

Checked risks with no further substantive findings:

- Ledger target selection only considers `classification.kind: "fix"` findings and filters optional `--finding-id` / `--oracle` after conversion, so observe/proposal findings are not sent to the fix prompt.
- Dry run writes `TARGET.json` and `PROMPT.md` before reviewer discovery and exits without checking Codex/Claude availability.
- Non-dry proposal generation still checks reviewer availability before shelling out and writes the selected target alongside any `WHY.md` / `proposal.diff` artifacts.
- Docs describe `--ledger`, `--finding-id`, and `--dry-run` as proposal-intake behavior and still identify `REPORT.md` parsing as fallback-only.

## Verification

- TDD red: `npx.cmd vitest run tests/playtest/fixProposalInput.test.ts tests/playtest/proposeFixScript.test.ts` failed because `fixProposalInput.ts` did not exist and `propose-fix` rejected `--ledger`.
- Green focused tests: `npx.cmd vitest run tests/playtest/fixProposalInput.test.ts tests/playtest/proposeFixScript.test.ts`: 2 files passed, 6 tests passed.
- `npm.cmd run typecheck`: passed after the severity normalization fix.
- Dogfood: `npm.cmd run propose-fix -- --ledger output/self-improvement/2026-07-08-fresh-smoke-current-ledger.json --dry-run --proposal-root output/self-improvement/fix-proposals` selected `aoe2-oracle-match-completes-run-0` and wrote target/prompt artifacts for `match-completes`.
- Full gates: `npm.cmd test` (222 files passed, 1 skipped; 1825 tests passed, 2 skipped), `npm.cmd run typecheck`, `npm.cmd run lint`, and `npm.cmd run build`.

## Residual Risk

This slice stops at proposal-intake dry run. It does not invoke a reviewer model, apply a patch, or prove a finding fixed by rerun. The broader goal remains active until candidate findings are addressed or explicitly carried forward by proposal/fix policy and before/after rerun evidence.
