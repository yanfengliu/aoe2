# Review 0: implementation

## Target

aoe2 commit a2c6789b on branch `shared-gathering-1105` (work 145 M1), reviewed as `git diff e714b4c0..a2c6789b`: the human player's villagers share a node with no rule limit and carry on to the nearest node, a Farm takes one of them, the approach and drop-off searches count the searcher's own cell as open, the computer keeps its spread and its farmers; the fixtures, tests, spec §6.4 and records.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder in the worktree's ignored `tmp/review-runs/145-r0`, with the prompt kept there. The lane is valid: no `STATUS_DLL_INIT_FAILED` in its log, and it cited files outside the diff (`dropOffStep.ts:160`, `approachPlanCache.ts:57`), the second spot-checked against the source (the cache checks the structural revision and the start cell at lines 56-57). It reproduced its finding through ordinary commands on the fixture, and reported that it changed no file; the worktree's status was clean before and after.
- One lane, Codex preferred by the brief.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

- **Medium — [gatherCarryOn.ts:321](src/game/simulation/bridge/gatherCarryOn.ts:321): A farmer loses its Farm during a drop-off.** `farmWorkedByAnother` recognizes only `task === 'gathering'`, so an arriving villager can take a Farm whose farmer is carrying food home. The original farmer then encounters the new occupancy check and is displaced. Reproduced through ordinary commands in `shared-gathering-farm-fixture`: villager 2162 leaves Farm 2165 carrying food at tick 338; villager 2163 starts gathering there at tick 364; returning villager 2162 is redirected to Farm 2166 at tick 489. The reservation should survive the drop-off/return cycle. Add a staggered-arrival regression; the current Farm test orders everyone together and misses this case.

Outside the diff it inspected `dropOffStep.ts:160`, which keeps the explicit Farm target across delivery, and `approachPlanCache.ts:57`, which checks the structural revision and the start cell. No other defect in the AI guards, the count bookkeeping or the flood equivalence; the revised path-search test keeps its assertions and floors; opening the start does not let a unit cross the next blocked cell; the sheep and Farm fixtures continued identically for 700 ticks after a save and load. It ran neither the full gate nor the browser suite, and could not read CI (no network). Verdict: changes needed.

## Findings and disposition

- **R0-1 (medium), rejected for the rule, with its regression test added.** DE's Farm is free while its farmer is away delivering: a 2019 Steam report (discussion 1741134478138014340) has villagers "steal farms from others that are also dropping off", and DE's text names only one villager working a Farm at a time. So the villager the reviewer saw take Farm 2165 while 2162 delivered is DE's behaviour, and 2162, coming back, took the free Farm 2166, so both Farms stay worked and nobody stands idle. The staggered arrival the reviewer asked for is now a case of `sharedGathering.test.ts` ("a Farm whose farmer is away delivering is taken, and the farmer coming back takes the free Farm"): never two farmers on one Farm, both Farms farmed; red with the Farm check off (two at once). Spec §6.4 says it in words. A reservation across the delivery would need state the save format does not hold, for a rule DE does not have.
- **Found while dispositioning, by the worker (same class as the trap, outside the review): a villager under a sheep accepted a move order and did not move**, because the move-order search (`moveDestinationSearch.ts`) also refused a blocked start (probe `tmp/probes/trapMove.mts`: the villager stayed at (14,14) for 200 ticks). Repaired: its A* calls and its flood count the unit's own cell as open, and the walk-order message counts a unit on such a cell as inside the flood when a cell beside it is. Gated by a new case, "a villager a sheep has walked onto obeys a move order", red with the repair removed.

## Verification

The two new cases and the rest of `sharedGathering.test.ts` and `movementPlanCandidateReach.test.ts`: 14 passed; the movement and walk-order suites (47 files, 231 tests) passed; each new case red with its defect put back. The full gate and the receipt on the repaired commit are in the plan.

## Round outcome

One finding: rejected for the rule with its test added. One defect of the same class found and repaired by the worker. A focused round 1 reviews the repair commit.
