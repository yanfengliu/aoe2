# Recursive Self-Improvement Loop Review - Iteration 1

## Scope

Reviewed the working-tree diff for the recursive self-improvement ledger command: `src/game/playtest/selfImprovementLoop.ts`, `scripts/playtest-self-improve.mjs`, focused tests, package script, and docs.

## Reviewer

In-process adversarial reviewer: Curie. The prompt required live-code verification of symbols, file paths, npm scripts, civ-engine contracts, and docs before approving or flagging issues.

## Findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| C1 | MEDIUM | `scripts/playtest-self-improve.mjs` copied `SessionReplayer.selfCheck().ok` directly. In civ-engine, no-payload and failure-skipped segments can leave engine `ok: true` even when `checkedSegments === 0` or `skippedSegments.length > 0`, which would overclaim replay evidence and could make `autoFix` findings eligible. | FIXED. Added `replaySelfCheckEvidenceFromResult` in `selfImprovementLoop.ts`. Ledger `ok` now means strong evidence: engine ok, at least one checked segment, and zero skipped segments. Partial/vacuous results preserve `engineOk`, record an explanatory error, format as failed, and block `autoFixEligible`. Regression coverage added in `tests/playtest/selfImprovementLoop.test.ts`. |

## Verification After Fix

- `npx.cmd vitest run tests/playtest/selfImprovementLoop.test.ts tests/playtest/playtestSelfImproveScript.test.ts`: 2 files passed, 6 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- Dogfood: `npm.cmd run playtest:self-improve -- --baseline output/playtests-llm/campaign-10 --current output/playtests-llm/campaign-11 --out output/self-improvement/2026-07-08-campaign-11-ledger.json` wrote JSON/Markdown output with 3 standardized findings, replay self-check failure evidence, and baseline/current comparison.
- `npm.cmd test`: 220 files passed, 1 skipped; 1816 tests passed, 2 skipped.
- `npm.cmd run build`: passed.

## Residual Risk

The dogfood bundle is historical (`engineVersion` 1.2.0 vs runtime 1.4.0), so replay self-check currently fails. That is correctly recorded as blocking evidence, but the long-horizon goal should remain active until a fresh loop run produces strong replay/self-check evidence on current artifacts.
