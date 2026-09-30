# Vitest timeout headroom review

Iteration 1.

## Reviewers

- Codex: completed; exited non-zero from wrapper noise but produced a usable `--output-last-message` review in `tmp/review-runs/vitest-timeout-headroom/2026-05-04/1/codex-last.md`.
- Claude: unreachable; quota limit, reset reported as May 5, 2026 7pm America/Los_Angeles.

## Findings

- High — the utility timeout change hit the wrong test. `createSimulationBridge.utility.test.ts` raised the Spearman test cap to 30s while the failing Watch Tower test still had its 15s cap. Fixed by restoring the Spearman cap and raising the Watch Tower cap.
- Medium — the debugging verification section still stated the earlier 727-test `npm.cmd test` pass as if it were the final 734-test gate for the follow-up change. Fixed by labeling the 727-test pass as earlier runner-fix verification and marking the 734-test verification as pending until the rerun completes.

## Verification Evidence

- `npm.cmd test` failed under the threads-pool full suite with two explicit per-test timeout failures and no assertion mismatch: watch-tower utility at 15.7s against 15s, first blacksmith Forging progression at 47.9s against 45s.
- `npm.cmd test -- tests/simulation/createSimulationBridge.utility.test.ts -t "can build a Watch Tower in Feudal Age"` passes in isolation.
- `npm.cmd test -- tests/simulation/blacksmithProgression.test.ts -t "Forging grants"` passes in isolation.

## Final Disposition

Codex found two real issues. Both are fixed and will receive iteration 2 review.
