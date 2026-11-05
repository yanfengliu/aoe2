# Review 5: implementation

## Target

aoe2 commit 1058ef2f on branch `ai-economy-m2-1104` (work 141 M2a-1), reviewed as `git diff ab7f8f15 1058ef2f`: the repair of [round 4](4_implementation.md)'s findings.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree. Its log's three `STATUS_DLL_INIT_FAILED` matches are lines of round 4's record that the lane read in the diff, not results of its commands. It ran both git commands, and its reproductions and the 19 tests through an in-memory TypeScript harness, not Vitest. It read files outside the diff, among them `aiTownCenterPhase.ts`, `trainingMarketOps.ts` and `queueResearchValidator.ts`.
- One lane, as in round 4.
- The tree's `git status --porcelain` was empty after the lane.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

1. **Major — Separate reserve checks still allow spending the age-up's money.** `aiSystemProductionPhase.ts:297`, and the Castle's at 333. The age-up and villager reserve and `unheld(cost)` each check the original stockpile, and neither counts purchases the escrow already asked for. With 1,050 food and 900 gold, an available Imperial Age and two relics, the escrow buys a Monk for 100 gold; the Archer's 45 gold passes both checks separately, and the Imperial Age then fails. With 200 food, Conscription and a Barracks, Conscription and a Spearman leave 15 food and the villager is not queued. **Fix:** combine pending spending and the reserves in one check, keeping the per-resource hold. `aiTownCenterPhase.ts:66` confirms the later age-up check reads the original stockpile.
2. **Major — Market spending bypasses the budget and can consume a hold.** `aiSystemProductionPhase.ts:371`. The trade is neither checked against the budget nor counted, so a later Monk reuses its gold: with 100 food, 400 gold, no wood, an unpaid Conscription, an enemy Monastery and a Market, the early Monk, a 130-gold food purchase and the later Monk leave 70 gold of Conscription's 150. **Fix:** validate trades against the remaining budget and count them. The gold is taken at `trainingMarketOps.ts:326`.
3. **Minor — Ordinary research still asks for in-flight Conscription and budgets the refused request.** `aiSystemProductionPhase.ts:211`. With Conscription queued, the research loop asks again, the request is refused (`queueResearchValidator.ts:77`), and the Castle's slot is counted taken, so its unique unit waits. **Fix:** skip in-flight technologies before budgeting or counting the slot.
4. **Minor — The tests prove the helpers but not their wiring.** All 19 still passed with the in-flight set ignored, production's `spend` disabled, the age-up reserve dropped at the settlement call, or the latch check removed. **Fix:** decision-level cases for retained resources, competing producers, the age-up and the latch; qualify the records' blanket red-proof claim and the "holds stay whole" claims.

It found the per-resource check right for zero and absent costs, the later Monk loop on the budget, every Monastery and every enemy counted, the housing and attack conditions and the sampling limits stated, and no change in the production checks while nothing is held.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| Codex R5-1 | The reserves and the hold were checked apart, so a purchase the escrow made was not counted against the age-up or the villager. | Accepted. | `DecisionBudget` holds what the decision has spent (the escrow's purchases and every later ask) apart from the unpaid holds. Its one check runs the purchase's reserves on what is not spent, every resource of the reserve as the AI has always checked it, and the holds resource by resource. While the escrow holds or bought anything, research, soldiers, the Castle's unit, the later Monks and the Market use it; otherwise every check is as before. Red three ways, two of them decision cases (`ai-escrow-villager-fixture`, `ai-escrow-monk-age-up-fixture`). |
| Codex R5-2 | The Market's trade spent outside the budget. | Accepted. | While the budget is active, a trade must fit it (a buy's price in gold, a sell's batch of its commodity) and is counted. The count is red at decision level (`ai-escrow-market-fixture`, Codex's case: with the count off, a second Monk leaves Conscription 70 of its 150 gold). The fit check's mutant survived this round's cases, and the reason given here, that the Market's own choice keeps what its target needs, was wrong: with 350 gold the Market picks a trade only the check refuses, the case [round 6](6_implementation.md) added (`ai-escrow-market-guard-fixture`). |
| Codex R5-3 | The research loop asked for in-flight research, the Castle's above all. | Accepted in part. The class fix, skipping the owner's in-flight technologies in the research loop and the plan's scan, was measured and moved the coverage lab a long way: owner 1 built no Monastery or Siege Workshop, losing both buildings, its Monk and its Siege Workshop research; with only that skip taken out, the census is round 4's exactly. The re-request predates work 141 on main, so that fix needs its own measurement. | The budget no longer counts a request for a technology in flight. The class defect is a card in work 106's queue, with this measurement. Not tested at decision level. |
| Codex R5-4 | The tests did not hold the wiring. | Accepted. | Six decision cases added: two soldiers against an unpaid hold (`ai-escrow-spend-fixture`), the villager's food after Conscription (`ai-escrow-villager-fixture`), the age-up before the Monk (`ai-escrow-monk-age-up-fixture`), the latch (`ai-escrow-monk-latch-fixture`), the Market's trade and a later Monk (`ai-escrow-market-fixture`), and Conscription at the first decision. Fourteen mutants, Codex's four wiring defects among them; thirteen are red (Verification). Round 4's record now says its proofs were helper-level. |

## Verification

- Fourteen mutants, one at a time against `tests/simulation/aiEscrow.test.ts` (25 tests) on the final code, with the number of tests each fails: R4-1 in flight (1), R4-2 the budget not counting (3, two of them decision cases), R4-3 the hold on every resource (4), R4-4 the later Monk unchecked (2), R4-5 the settlement without the age-up (2), R4-5b the reserve dropped at the call (1), R4-5c the latch check removed (1), R4-6 the bare price (1), R4-9 housing (1), R5-1 reserves on the whole stockpile (2), R5-1b soldiers without their reserve (2), R5-1c production not counting (2), R5-2 the trade not counted (1). R5-2b, the trade not checked against the budget, fails none of these 25; round 6 added the case that fails it.
- Typecheck, lint on the changed files, the file-size budget and the 25 escrow tests pass. The budget test found the scenario registry over its 500-line cap since this work's first commit (503 lines, then 506), so the escrow's seeds moved to their fixture file (`AI_ESCROW_SCENARIOS`), as other works' seed lists have.
- Re-measured on the repaired code (plan 141's Outcome). The coverage lab's census and its spending probe are byte for byte round 4's, so its producers are unchanged. The castle configuration's seven matches moved: 2 of 7 end within their horizon (gold-rush at 53,598 as before, and corpus-seed-b at 43,627, owner 2 conquering owner 1 without siege) against 1 on main 496ee0e9 and in round 4; villager deaths 383 (8 under enemy defences) against 365 (5) on main; every Castle at the tick it stood before. default-seed's owner 1, which qualified for the Castle Age at the 45,000 horizon on main, qualifies at 45,250 (run to 52,000 on both trees).

## Round outcome

Two major and two minor findings: three accepted and repaired, R5-3 in part with a card in work 106's queue. The repairs moved the castle configuration's seven matches, not the coverage lab, so a focused round 6 reviews them.
