# Review 2: implementation (work 147 M2, DE's flush buffers)

## Target

aoe2 commit 32e64065 on branch `ai-spending-m2-1106` (work 147 M2), reviewed as `git diff e4ca37c1 32e64065` over `src`, `scripts` and `tests` (the census JSON left out of the diff, its moves named in the prompt's plan), with the repository readable: the rule (`aiFlushBuffers.ts`), its reader (`bridge/systems/aiFlushBufferPhase.ts`), the production phase's wiring, the two refactors (`ramGoalInputs`, `seatFarmWork`), the fixtures and tests, the `selfplay-ab` farm columns, and the plan, spec and changelog records.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from fleet's ignored `tmp/review-runs/aoe2-147-m2-r0/`, the worktree as `--cd`. It ran 60 focused tests and cited files outside the diff (`ai.ts:211`, `aiSiege.ts:125`, `bridge/scenarioSeedOps.ts:182`); no sandbox failure in its log; the tree's `git status --porcelain` and `git diff HEAD` were the same after the run as before.
- One lane, Codex preferred by the brief. Its IDs R0-1 to R0-3 are recorded here as R2-1 to R2-3, since rounds 0 and 1 of this plan used R0 and R1.

## Reports

Codex (authored; transport chatter left out):

- **R2-1, high, `plan.md` (the M2 outcome's closing paragraph):** the retention decision weakens the agreed drop condition. The plan requires no loss of a building, Age or seat's economy, but the outcome substitutes "no systematic loss". coastal#4 owner 1's collapse is attributed to the buffered army waiting before a raid; corpus-seed-b owner 1 lost its Imperial Age, its Monastery and its Siege Workshop, which the retained records confirm. Aggregate gains do not satisfy the stated criterion; acceptance needs an explicit coordinator exception or the prescribed drop.
- **R2-2, medium, `tests/simulation/aiFlushBufferTraining.test.ts:73`:** the claimed coverage of whole lines exercises only base units. Both Castle fixtures start with nothing researched, so their positive controls expect `spearman` and `archer`; the tests would pass if `flushLineOf` knew only base names. Cover the upgraded tiers, the Imperial ones too.
- **R2-3, low, `plan.md`:** two outcome summaries contradict the measurements: "seven" conquest outcomes changed where nine are listed (the records confirm nine), and the idle match was said to have no farm-floor breaches where it has 7 in each arm.
- No other defect found in the buffer predicate, the bridge inputs, the shared census, the refactors, the purchase routing or the measurement; the census moves are named correctly; every tier mapping and the unequal-length series extension passed its direct checks.

## Findings and disposition

- R2-1: accepted as a records defect, not repaired by dropping. The plan and the handoff now state both readings: seat by seat, the drop rule is met (coastal#4 owner 1, corpus-seed-b owner 1); by the counts over 105 seat-seeds, nothing was lost. The worker did not drop the rule and puts the reading to the coordinator, with the evidence that a chaotic match flips both ways under any change.
- R2-2: repaired. `aiFlushBuffers.test.ts` checks `flushLineOf` at every tier of the three lines (Spearman to Halberdier, Archer to Arbalest, Skirmisher and Elite Skirmisher) and that seven other lines map to none; proved red by making `flushLineOf` compare names without `unitLineOf`.
- R2-3: repaired in the plan.

## Verification

The repairs are checked in round 3 (`3_implementation.md`).

## Round outcome

Three findings: R2-1 (high) repaired in the records, its question put to the coordinator; R2-2 (medium) and R2-3 (low) repaired. Round 3 checks the repairs.
