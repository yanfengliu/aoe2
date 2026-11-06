# Review 1: implementation

## Target

aoe2 commit e4791912 on branch `shared-gathering-1105` (work 145 M1), reviewed as `git diff a2c6789b..e4791912`: round 0's repair (the move-order search counts the unit's own cell as open, and the walk-order message counts a unit on such a cell as inside the flood when a cell beside it is), the rejection of R0-1 with its regression test, and the move-order case.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree's ignored `tmp/review-runs/145-r1`. The lane is valid: its log's two `STATUS_DLL_INIT_FAILED` matches are lines of round 0's record that it read, not command results; it cited civ-engine's `path-service.ts:202` outside the diff, ran 16 existing tests and 41,472 small-grid cases of its own, and changed no file (HEAD stayed e4791912).
- One lane, Codex preferred by the brief.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

- **Medium — [sharedGathering.test.ts:203](tests/simulation/sharedGathering.test.ts:203): the Farm regression accepts the opposite rule.** Sorting the final targets loses farmer identity, and `mostOnF1` only proves exclusivity. An in-memory mutation reserving Farms during delivery kept the original farmer on F1 and sent the newcomer to F2, and the test still passed. Assert that the newcomer actually gathers F1 while the original farmer delivers, then that the returning farmer gathers F2, alongside the exclusivity check.

It found R0-1's rejection consistent with the amended spec, and noted that the cited Steam report (2019) describes farm stealing during delivery but does not alone establish current DE parity. No movement defect: all three `flood` callers are safe (two flood from unit positions, the third from `seedNear`, which returns a passable cell); opening only the start keeps every barrier, since the engine checks each later cell (`path-service.ts:202`); the path cache checks the current position and next step, and new orders clear it; no persistent state or randomness was added. Verdict: changes needed.

## Findings and disposition

- **R1-1 (medium), accepted and repaired.** The case now asserts by name: the villager sent to the Farm while its farmer delivers farms it, and the farmer coming back takes the free Farm, besides never two at once. Red with the reviewer's rule put in (a Farm counted as taken while its farmer is in `to-dropoff`): "the villager sent to the Farm while its farmer delivered never farmed it".
- **The parity bound** is recorded in spec §6.4 and the plan: the farm-stealing source is a 2019 player report, and current DE was not launched to check it (the brief forbids launching DE). Listed for the owner.
- **Found by the gate, not the review:** `npm run verify` on e4791912 failed one unit test, `monkCarriedRelic.test.ts` › "picks up a relic it stands on in a save made before work 128, and walks off with it", whose premise read a refused move order as proof that the Monk stood on blocked ground: the trap this work removes. Its premise is now the shared cell itself (the relic under the Monk), and spec §6.9's sentence that such a unit "stays on blocked ground until a Monk picks the relic up" now says it walks off. The case's own claims (the Monk picks the relic up and walks off with it) are unchanged.

## Verification

The strengthened case and the rest of `sharedGathering.test.ts` passed (11), red with the reviewer's mutation; `monkCarriedRelic.test.ts` passed (11); `tsc --noEmit` passed. The full gate on the repair commit is in the plan.

## Round outcome

One medium finding, accepted and repaired; one gate failure from the trap's own premise, repaired. A focused round 2 reviews the repair commit.
