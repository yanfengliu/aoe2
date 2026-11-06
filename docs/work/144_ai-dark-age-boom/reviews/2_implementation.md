# Review 2: implementation

## Target

aoe2 commit dc45e608 on branch `ai-dark-age-1105` (work 144 M1), reviewed as `git diff 1f11ad9b dc45e608 -- scripts tests`: the repairs of review round 1's four findings. A focused re-review.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from fleet's ignored `tmp/review-runs/aoe2-144-m1-r3`, with the worktree as `--cd`. The runbook's Codex check printed `keep`; the lane cited `src/game/simulation/createSimulationBridge.ts:310`, outside the diff, which says what it says (`match-over` refuses before any tick runs).
- One lane. The worktree's status was the same before and after; the lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

No implementation defect found in the four repairs on `dc45e608`. One regression-coverage finding remains:

- **Medium — Partial reversions of the repairs still pass the focused assertions.** In-memory mutation probes confirmed three gaps:
  - [selfplayAb.test.ts:324](tests/scripts/selfplayAb.test.ts:324) changes only the game fingerprint; removing the worker’s measurement-drift check survives.
  - [selfplayAb.test.ts:148](tests/scripts/selfplayAb.test.ts:148) prevents refused steps from advancing; removing both `match-over` advancement guards survives.
  - [selfplayAb.test.ts:337](tests/scripts/selfplayAb.test.ts:337) checks only the map table; restoring the twelve-sample cap in the pooled table survives.

These gaps could let misattributed measurements, invalid tick accounting or hidden late-army differences return unnoticed. Add assertions for those three cases.

Outside the diff, [createSimulationBridge.ts:310](src/game/simulation/createSimulationBridge.ts:310) confirms `match-over` refuses before advancement. Read-only probes passed the repaired tick boundaries and extended map/pooled reporting. Full tests were not run because they write files; CI status returned `UNKNOWN`. No files changed.

## Findings and disposition

- No implementation defect in the four repairs.
- **R2-1 (medium), accepted and repaired: three partial reversions passed the tests.** The worker's case now also changes only the measurement's fingerprint between its two readings, and is refused; the step's cases add a `match-over` refusal that moved the world and one that says it ran a tick, both refused; the long-horizon case also reads the pooled table's `army 65k` row.

## Verification

Test-only repairs on the commit after dc45e608. `tests/scripts/selfplayAb.test.ts` has 18 tests, all passing; the three reversions the reviewer probed are red with the new assertions (`tmp/m1/mutate.mjs`, 41 mutants in all: the measurement's drift unchecked, the `match-over` guards dropped, the pooled table capped at twelve samples).

## Round outcome

One medium finding on the tests, accepted and repaired with assertions only. No further round: the repair adds assertions and changes no code under review, and each is red with its reversion.
