# Review 3: implementation (work 147 M2, the repairs of round 2)

## Target

aoe2 commit f35a5ce2 on branch `ai-spending-m2-1106`, reviewed as `git diff 32e64065 f35a5ce2` with the tree readable: round 2's repairs to `docs/work/147_ai-spending/plan.md` and `tests/simulation/aiFlushBuffers.test.ts`.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), from fleet's ignored `tmp/review-runs/aoe2-147-m2-r3/`, the worktree as `--cd`. It ran 16 focused tests and cited `aiFlushBufferPhase.ts:30`, outside the diff; no sandbox failure in its log; the tree's `git status --porcelain` was the same after the run as before.

## Reports

Codex (authored):

- R2-1: the reporting is repaired (the plan unchecks retention and states both readings and the individual losses); acceptance remains open, since keeping P1 needs the coordinator's decision.
- R2-2: repaired; the new case covers all eight tiers of the three buffered lines, the Imperial ones included, and seven excluded units, and comparing base names only would fail it.
- R2-3: repaired; the plan says nine changed conquest results and seven idle-match breaches in each arm, both matching the records.
- **R3-1, low, `plan.md:212`:** the repair changed the reference of the recycled-entity-id finding (M1's spend probe, `reviews/0_plan.md:70`) from R0-1 to R2-1; restore R0-1.

## Findings and disposition

- R3-1: repaired after the gate (a docs-only change, `plan.md:212` back to R0-1). Minor, so no further round.

## Verification

The repairs of round 2 checked by the reviewer against the records and 16 focused tests; R3-1's repair is the one-word restoration it names, checked by reading the line and by the architecture suite (`npx vitest run tests/architecture`).

## Round outcome

Round 2's three findings repaired, R2-1's acceptance left to the coordinator; one new low finding, R3-1, repaired. No further round.
