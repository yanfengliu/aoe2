# Review 8: implementation

## Target

aoe2 commit 25e495be on branch `ai-economy-m2-1104` (work 141 M2a-1, one squashed commit on main 45a76681), reviewed as `git diff 8d44264a 25e495be`: the repair of [round 7](7_implementation.md)'s findings.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree, while the full gate ran in the same worktree. It was told not to run the full suites. Its log's two `STATUS_DLL_INIT_FAILED` matches are lines of earlier rounds' records that it read, not results of its commands. It checked its cases on the real bridge with variants held in memory, and read files outside the diff, among them `trainingMarketOps.ts`, `civBonusTable.ts` and work 97's plan.
- One lane, as in rounds 4 to 7.
- The tree's `git status --porcelain` was empty after the lane.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

1. **Major — An already-paid age-up is counted again.** `aiTownCenterPhase.ts:99` does not exclude research already in flight. The unchanged executor rejects that duplicate without charging it (`trainingMarketOps.ts:274`). With Imperial already queued, a busy Monastery and 1,050 food/850 gold, the phantom debit blocked Crossbowman and Man-at-Arms research; removing only that debit allowed both. **Fix:** exclude in-flight age-ups from budget accounting, as ordinary research already does, and add a queued-age regression case.
2. **Minor — Impossible age-up trades are counted as spending.** `aiTownCenterPhase.ts:121` counts the request without checking that a completed Market exists or that the quoted trade is affordable. The executor rejects these requests (`trainingMarketOps.ts:314`). I reproduced a missing-Market case with a 1,300-gold quote against 1,000 gold: the fictitious debit blocked later research and a Monk. **Fix:** count only executable trade requests, while preserving the intended permission to spend escrow toward an age.
3. **Minor — Discounted villagers are overcounted.** `aiTownCenterPhase.ts:153` records the base 50-food price. The executor uses `ownerTrainingCost`; Indians pay **41 in Castle Age and 39 in Imperial**, under `civBonusTable.ts:293`. This understates what later purchases can afford. **Fix:** use the owner's price for the counted debit; the existing inactive-budget decision checks can remain unchanged.
4. **Minor — The survivor explanation excludes real consumers.** `plan.md:182` says only tribute would read the age-up and age-up-trade counts. Castle-Age research and later Monks also read them (`aiSystemProductionPhase.ts:396`). The retained log does support **18/22**, but these survivors demonstrate missing observable coverage, not unnecessary counts. **Fix:** correct that explanation and test downstream purchases, including rejected requests above. Tribute's own count genuinely has no subsequent consumer.
5. **Info — Earlier purchases remain outside the budget.** `aiSystem.ts:212` runs ferry/building purchases before escrow, but these only enqueue commands; they have not reduced the stockpile used by settlement. Ordinary wood/stone construction does not directly consume these holds, but a Wonder spends gold. With a busy Castle, 40 villagers and 1,000 gold, I reproduced a Wonder leaving **zero gold** despite the planned Conscription hold. **Fix:** explicitly document this pre-escrow boundary, or account for earlier commitments if protection is intended across the whole decision. This predates the repair.
6. **Minor — The lumber-routing wrapper remains stale.** The new thread status (`lumber-camp-routing/2026-09-01/REVIEW.md:388`) describes the rejected retry, while work 97's latest status (`97_lumber-camp-routing/plan.md:45`) still says nothing was retried. **Fix:** append the matching current disposition to the wrapper.

It found the rest right: a real age-up is counted at the executor's price, and the new counts touch no check before the Town Center phase and nothing while no budget is active; the tribute is counted at the executor's fee, and `ai-tribute-fixture` saves the same state before and after the repair through 900 ticks; the tribute case isolates both repairs (265 food and wood sent now, 135 food with either repair taken out); and the measurement records match the files kept.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| Codex R8-1 | A re-requested age-up already in flight was counted. | Accepted. | The Town Center phase counts the age-up only when it is not in flight (`inFlightTechByOwnerCodec`), as the research loop does. No decision case: an in-flight age-up with an active budget needs a busy Monastery at the second decision, which no fixture sets up. |
| Codex R8-2 | A Market trade the handler refuses was counted. | Accepted. | `chargedTradeCost` (`aiEscrowPhase.ts`) counts a trade only when the owner has a completed Market and the stockpile covers the price, the handler's two checks; both the age-up trade and the Imperial Market's trade use it. A trade it will not charge is still asked for, as before, and refused there. No decision case. [Round 9](9_implementation.md) found that wrong: income arriving before the handler runs let such a trade through uncounted; repaired in d3d9ee67 ([round 10](10_implementation.md)). |
| Codex R8-3 | The villager was counted at the base price. | Accepted. | Counted at `ownerTrainingCost`, the handler's price. No decision case. |
| Codex R8-4 | The record said only a tribute reads the age-up's and the age-up trade's counts. | Accepted: research and later Monks after the Town Center read them too. | Plan 141 and round 7's record say the survivors are counts no case reads, not counts nothing reads. |
| Codex R8-5 | Purchases before the escrow, in the building phase, are outside the budget; a Wonder can spend held gold. | Accepted as a stated boundary, not repaired; it predates the escrow's budget. | Spec §13.2's escrow paragraph states it. |
| Codex R8-6 | Work 97's plan, which wraps the lumber-camp thread, still said nothing was retried. | Accepted. | A dated status line there, matching the thread's. |

## Verification

- Twenty-five mutants, one at a time against `tests/simulation/aiEscrow.test.ts` (29 tests): the eighteen of round 7 that failed still fail, each the same number of tests. Seven fail none: the four counts of round 7 (R6-1b, R7-1c, R7-1d, R7-1e) and round 8's three repairs (R8-1 an in-flight age-up counted, R8-2 a trade counted with no Market, R8-3 the villager at the base price), for which no case was built.
- Typecheck, lint on the changed files, the 29 escrow tests and `aiTribute.test.ts` pass.
- Re-measured on the repaired code: the coverage lab's census and spending probe and the castle configuration's seven matches are byte for byte round 7's.

## Round outcome

This is the fifth repair round of M2a-1 (rounds 4 to 8), the cap on automatic repair (AGENTS.md, R11). One major and four minor findings, and an Info: R8-1 to R8-4 and R8-6 accepted and repaired, R8-5 accepted as a stated boundary. No measurement moved. A round 9 reviews the final revision; whatever it finds goes to the coordinator, not into a sixth repair round ([round 9](9_implementation.md)).
