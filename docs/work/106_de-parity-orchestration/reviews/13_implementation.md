# Review 13: the hit census's eaten-farm rule allows one swing for each farmer (round 0)

## Target

aoe2 commit 5e746f2a on branch `coordinator-batch-1111`, reviewed as `git diff 2d8824a6 5e746f2a`: one file, `tests/simulation/playerHitCensus.test.ts`. The census exempted a farm gone unstruck that held at most one swing's food; the change exempts one that held at most one swing's food for each villager gathering it, states the bound in the header, and adds ten cases.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder in the primary checkout's ignored `tmp/review-runs/census-farm-rule-r0/`, with the worktree as `--cd`. The worktree's `git status --short` and `git diff` were empty before and after, and the runbook's check of the log found no failed sandbox command.
- One lane. The prompt gave the failure on work 152's branch, the coordinator's decision, the seven mutants run and what each turned red, and asked six things: whether the rule fits what the simulation does, whether the gate is weakened beyond the bound the header states, whether the new cases are proofs and which mutant survives them, whether the header is accurate, whether a tighter rule is practical, and anything else wrong in the diff.
- The reviewer read the gather code outside the diff (`src/game/simulation/bridge/systems/gatheringStep.ts` among it) and ran the ten new cases in memory, unchanged and under a mutant of its own. It did not run the whole file under Vitest, the gate, typecheck, lint or the seven mutants.

## Reports

### Codex (`gpt-6-astra`)

Verdict: approve with minor findings. No blocker or major finding. Redacted only of absolute paths:

1. Minor: the stated bound was tighter than the implementation. The count is of villagers whose gather target is the farm before the tick, including those walking, delivering a load or waiting on their swing, so it does not establish what they could take on that tick. An unrecorded kill of a two-food farm with two villagers both away delivering failed before and passes now.
2. Minor: the cases did not hold the count at its edge. All ten passed with `readOwned` giving every farm one farmer too many: the table never goes through `readOwned`, and the deletion case left room between the farm's food and its farmers. Asked for: a deletion in the census at exactly one swing more than a count established apart from the census, and an unfarmed deletion to carry the no-farmer guard through the census.
3. Note: the depletion case depends on the fixture's villagers swinging together. A change of movement or cadence could leave one food before the last tick and fail the case with the rule still right.

The reviewer confirmed from the code that one villager takes at most `gatherAmountFor('farm')` from a farm on a tick (bonuses change the pace, technologies the capacity, difficulty and gather credit the payment); that every swing at a farm reads it through `targetResourceId`; that a reseed refills the same entity and so never enters the exemption; that farms cannot be converted; and that a player's delete removes the entity with no blow. It advised against exact swing accounting: a villager can deposit on the tick it swings, Khmer farmers are paid into the stockpile directly and difficulty scales deposits, so loads gained do not add up to food taken.

## Findings and disposition

1. FINDING-1 (minor), repaired in f39ffaa5: the header says the bound as the census applies it. It counts the villagers whose gather target is the farm before the tick, whatever they are doing; any unstruck removal inside that count goes unchecked, a blow and a delete alike; and the count is generous. The first sentence also says the farm leaves the world only when its owner cannot pay to reseed it.
2. FINDING-2 (minor), repaired there: three census cases replace the deletion case. The farm's owner deletes it on a tick the census entered with every villager of the fixture on it and the food set, a tick ahead, to exactly one swing each and one more (a death with no blow, named by its tick), to exactly one swing each (read as eaten: the bound itself, shown), and to nothing with no villager on it (a death with no blow). The count is the fixture's own number of villagers, not only the census's. The reviewer's mutant is red on two of them, and so is a count that doubles every gatherer.
3. FINDING-3 (note), answered there: the case is named for several villagers, not three, and a comment says what it depends on and what to do when a change staggers them.
4. Not done, as the reviewer advised: exact swing accounting.

## Verification

- The twelve farm cases pass on f39ffaa5, and the whole file passed on 5e746f2a: 23 cases, the all-AI match in 68.7 s.
- Nine mutants, each red and restored byte for byte: main's rule of one swing (five cases red); one farmer too many in the rule (four); one too few (four); no farmer needed (two); `readOwned` giving every farm 99 farmers (two), none (two) and one too many (two, the reviewer's); every gatherer counted twice (two); an eaten farm still counted a death (two).
- On work 152's branch head 4654ed10, in a scratch worktree since removed: the old rule reproduced "tick 20631: owner 1's farm #2184 died and no blow was recorded"; with 5e746f2a's file no death was unrecorded, and the all-AI case failed on its floor instead, with no Town Centre arrows in its window (blows by attacker: light-cavalry 52, knight 26, crossbowman 5). That re-read of the window is that branch's own work.
- A bound the cases leave: a count that took every gatherer in the world, whatever its target, would pass them, because the fixture's three villagers all gather the one farm.
- The repairs were not reviewed again: both findings were minor.

## Round outcome

Approve with minor findings, all three addressed. No further round.
