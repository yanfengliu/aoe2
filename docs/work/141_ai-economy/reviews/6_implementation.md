# Review 6: implementation

## Target

aoe2 commit e05735ea on branch `ai-economy-m2-1104` (work 141 M2a-1), reviewed as `git diff 1058ef2f e05735ea`: the repair of [round 5](5_implementation.md)'s findings. The working tree was 702de5b5, the branch squashed and rebased onto main cd1a5fa4, whose code under `src/game/simulation`, `tests/simulation` and `scripts/selfplay-audit.mjs` is e05735ea's byte for byte (`git diff e05735ea 702de5b5` there shows only main's own change to `bridge/selectionStateOps.ts`).

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree, while the full gate ran in the same worktree. It was told not to run the full suites. Its log's two `STATUS_DLL_INIT_FAILED` matches are lines of round 5's record that it read, not results of its commands. It checked its cases on the real bridge for five ticks each, with variants held in memory, and read files outside the diff, among them `aiTradePhase.ts` and `trainingMarketOps.ts`.
- One lane, as in rounds 4 and 5.
- The tree's `git status --porcelain` was empty after the lane.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

1. **Major — Trade Carts bypass the decision budget.** `aiTradePhase.ts:66`, an unchanged file, checks the original stockpile after production runs. Reproduced with 100 food, 400 wood, 200 gold, unpaid Conscription and both players owning Markets: an Archer and Trade Cart leave **105 gold**, below the 150 held. **Fix:** carry the active budget into the trade phase and check/count cart purchases; add this decision case.
2. **Major — A Market buy can charge more than the budget counted.** `aiSystemProductionPhase.ts:64` quotes the current rate, but `trainingMarketOps.ts:326` recalculates it when the command executes. Reproduced with 380 gold: the first Monk costs 100 and the planned food buy costs 130, leaving Conscription exactly 150. One intervening human food buy raises the AI's charge to 134, leaving **146 gold**. **Fix:** enforce the budget's permitted debit at execution, rejecting a buy whose changed price exceeds it; test interleaved trades.
3. **Minor — The surviving fit-check mutant has a reachable counterexample.** `5_implementation.md:31` does not adequately explain the survivor. Change the Market fixture from 400 to **350 gold**: the planner still selects `buy-food`, but only `budget.affords` prevents it consuming the hold. Real-bridge results were **150 gold with the guard, 120 without**. **Fix:** add that case and correct the explanation. The existing Market test at `aiEscrow.test.ts:243` does isolate trade **counting**: disabling the count produced two Monks and 70 gold.
4. **Minor — The new age-up decision test misses R5-1's repaired failure.** `aiEscrow.test.ts:254` uses 850 gold, so settlement buys no early Monk. It still passes when reserve checks are restored to the original stockpile. At **900 gold**, the repaired code queues both Monk and Imperial Age; the defective check loses the age-up. **Fix:** retain the 850-gold settlement case and add the 900-gold cumulative-spending case.
5. **Info — The siege claim contradicts the recorded result.** `spec-final.md:1852` says the computer "cannot take buildings without siege," then records a conquest without siege. **Fix:** describe the measured difficulty or pace instead of impossibility.

It found the reserve arithmetic otherwise sound: `holding` stays active after a purchase with no unpaid hold, and leaving `soldiersAsked` out of the budget's soldier check avoids counting a soldier twice, since the budget already holds it. It found leaving an in-flight request out of the budget correct, with the slot defect stated as deferred, and the recorded deaths (383 and 8 against 365 and 5), the two conquests and the byte-identical lab census and spending files supported by the files kept. Remote CI was not checked, as its sandbox has no GitHub access.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| Codex R6-1 | Trade Carts were bought outside the budget. | Accepted. | The production phase hands its budget to the trade phase on the owner's context (`decisionBudget`, written and read in the same decision, as `blockedBuildCost` is), and a cart is checked and counted against it while it is active. Red at decision level (`ai-escrow-trade-cart-fixture`, Codex's case) with the cart checked on the whole stockpile, and with the budget not handed over. The tribute phase, which also spends after production, was not changed: it sends only from 1,000 of a resource, and a hold is at most 250 gold, so a tribute could breach one only after the same decision spent over 600 gold. That reason was wrong, as Conscription holds 150 food too: [round 7](7_implementation.md) found the case and repaired it. |
| Codex R6-2 | A Market buy is priced when the AI decides and charged when the handler runs, so a trade executed before it in the same tick can make it dearer than the budget counted. | Accepted as a bound, not repaired. The handler would need the AI's budget to enforce the hold at execution, a change to the command layer outside this work, and the same race already holds for the age-up's Market trade on main. The shortfall is the price's move (4 gold in Codex's case) and lasts one decision: the escrow holds the price again at the next one. Round 7 found both bounds false (twenty trades executed first leave the hold 78 short, and spent gold does not come back), and the records now say so. | Stated in spec §13.2's escrow paragraph; a card in work 106's queue. |
| Codex R6-3 | The trade's fit-check mutant survived, and the record's reason was wrong. | Accepted. | `ai-escrow-market-guard-fixture` (350 gold) is red with the check off: the Market's own choice does not keep what the hold needs. Round 5's record says so. |
| Codex R6-4 | The age-up case did not hold R5-1's repair. | Accepted. | `ai-escrow-monk-age-up-spend-fixture` (900 gold): the escrow buys the Monk, and the Archer must wait for the age. Red with the reserves checked on the whole stockpile. |
| Codex R6-5 | The spec said the computer cannot take buildings without siege, beside a conquest with none. | Accepted. | Spec §13.2 now says it takes them slowly without siege. |

## Verification

- Seventeen mutants, one at a time against `tests/simulation/aiEscrow.test.ts` (28 tests), with the number of tests each fails: R4-1 (1), R4-2 (4), R4-3 (5), R4-4 (2), R4-5 (2), R4-5b (1), R4-5c (1), R4-6 (1), R4-9 (1), R5-1 (3), R5-1b (3), R5-1c (3), R5-2 (1), R5-2b (1), R6-1 the cart on the whole stockpile (1), R6-1c the budget not handed over (1). R6-1b, the cart not counted, fails none: nothing after the trade phase reads the budget, so the count only keeps it true for a later reader.
- Typecheck, lint on the changed files and the 28 escrow tests pass.
- Re-measured on the repaired code: the coverage lab's census (`labCensus.mts`), its spending probe (`labSpend.mts`) and the castle configuration's seven matches (`scripts/selfplay-audit.mjs --ledger`) are byte for byte round 5's, so no measured match bought a Trade Cart out of a hold.

## Round outcome

Two major, two minor and one Info finding: R6-1, R6-3, R6-4 and R6-5 accepted and repaired, R6-2 accepted as a stated bound with a card. The repair touches the trade phase and the tests, and no measurement moved, so a focused round 7 reviews it.
