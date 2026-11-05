# Review 7: implementation

## Target

aoe2 commit 8d44264a on branch `ai-economy-m2-1104` (work 141 M2a-1, one squashed commit on main 45a76681), reviewed as `git diff 702de5b5 8d44264a`: the repair of [round 6](6_implementation.md)'s findings.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree, while the full gate ran in the same worktree. It was told not to run the full suites. Its log's one `STATUS_DLL_INIT_FAILED` match is a line of round 6's record that it read, not a result of its commands. It checked its cases on the real bridge for five ticks each, with variants held in memory, and read files outside the diff, among them `aiSystem.ts`, `aiTributePhase.ts` and `trainingMarketOps.ts`.
- One lane, as in rounds 4 to 6.
- The tree's `git status --porcelain` was empty after the lane.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

1. **Major — Tribute can spend Conscription's hold.** `aiTributePhase.ts:46` checks the original stockpile and ignores `decisionBudget`. The justification in `6_implementation.md:31` overlooks Conscription's **food** hold. I reproduced an allied Imperial decision starting with 1,050 food, 3,000 wood and 100 gold: production and the Market leave **265 food**; tribute charges 130 and leaves **135**, below the 150 held. Disabling only tribute leaves 265. No large gold expenditure is required. **Fix:** check and count tribute, including its fee, against the active budget; add this decision case and correct the disposition.
2. **Major — R6-2's stated size and duration bounds are false.** `spec-final.md:1850`, `106_de-parity-orchestration/plan.md:158`, `141_ai-economy/plan.md:155` and `6_implementation.md:32` describe "a few gold" or recovery after one decision. Re-reserving cannot restore spent gold. In the 380-gold case, one intervening human buy leaves **146 gold through tick 70**, after further decisions at ticks 30 and 60. Twenty intervening buys leave **72 gold**. The unchanged `trainingMarketOps.ts:326` charges the current price without enforcing the planned debit. **Fix:** enforce a permitted debit at execution, or explicitly defer a potentially substantial deficit that persists until income replenishes it. Command-layer scope can justify deferral; the claimed recovery cannot.
3. **Minor — The devlog retains the rejected fit-check explanation.** The detailed devlog's line 141 still says the mutant survives because the Market's choice preserves its target. The 350-gold case disproves that, and round 5's review record now acknowledges it. **Fix:** identify that explanation as subsequently disproved, or replace it with the missing-case explanation.

It found the rest of what it was asked to check right: `aiSystem.ts:172` builds a fresh context per owner and decision with the budget null (line 201), the ferry still reaches production and trade, and no early return exposes another owner's or an earlier decision's budget; each new test fails with its defect back (120 gold without the Market guard, 105 without the cart's guard or the handover, the Imperial Age lost with the old reserve check); the retained mutation log supports 16 of 17, with the cart's count correctly explained; the census, spending and seven-match files are byte-identical across the repair, and the recorded deaths and conquests match them; the summary compaction keeps the removed row verbatim; and the siege wording is consistent. Remote CI was not checked, as its sandbox has no GitHub access.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| Codex R7-1 | Tribute could spend Conscription's food hold. | Accepted; round 6's reason looked at gold alone. Building the case showed a second gap behind it: the Town Center's villager was not counted, so a tribute after it saw 50 food that was gone. | The tribute and its fee (`tributeCost` at the owner's rate) go through the budget while it is active and are counted. The Town Center's purchases, the next age, its Market trade and the villager, are counted in the budget too, and never stopped by a hold (DE buys age-ups first; its villagers may spend escrow); `marketTradeCost` moved to `aiEscrowPhase.ts` for both phases. `ai-escrow-tribute-fixture` (1,000 food; a Barracks, a Stable, a Market and a starving ally): red with the tribute unchecked and with the villager uncounted, each leaving the hold 135. |
| Codex R7-2 | The price bound recorded for R6-2 was false in size and duration. | Accepted; the fix stays deferred, as Codex allows for the command layer's scope. | Spec §13.2, plan 106's card, plan 141 and round 6's record now say the shortfall grows with each trade executed first (78 gold after twenty) and lasts until income makes it up. |
| Codex R7-3 | The devlog kept round 5's rejected reason. | Accepted. | The devlog's round 5 line says the mutant survived for want of a case, which round 6 found. |

## Verification

- Twenty-two mutants, one at a time against `tests/simulation/aiEscrow.test.ts` (29 tests), with the number of tests each fails: R4-1 (1), R4-2 (5), R4-3 (5), R4-4 (2), R4-5 (2), R4-5b (1), R4-5c (1), R4-6 (1), R4-9 (1), R5-1 (3), R5-1b (3), R5-1c (4), R5-2 (1), R5-2b (1), R6-1 (1), R6-1c the budget not handed on (2: the cart and the tribute), R7-1 the tribute unchecked (1), R7-1b the villager uncounted (1). Four fail none. The tribute's count (R7-1e): nothing after the tribute phase reads the budget. The cart's count (R6-1b), the age-up's (R7-1c) and the age-up trade's (R7-1d): no case reads them after they are made. [Round 8](8_implementation.md) corrected this record's first reason, that only a tribute would: the research and the later Monks after the Town Center phase read the age-up's and its trade's counts too.
- Typecheck, lint on the changed files, the 29 escrow tests and `aiTribute.test.ts` pass.
- Re-measured on the repaired code: the coverage lab's census and its spending probe, and the castle configuration's 60,000-tick matches (gold-rush, coastal, arena, fortress), are byte for byte round 6's. In the 45,000-tick file one number moved: default-seed's owner 2 holds 11 soldiers at 45,000 against 9, so its peak army is 11 (12 on main 496ee0e9); its deaths, Castle and Imperial Age are unchanged, as is every other seat.

## Round outcome

Two major and one minor finding, all accepted: R7-1 and R7-3 repaired, R7-2 corrected in the records with the fix deferred to its card. The repair counts the Town Center's purchases and the tribute, so a focused round 8 reviews it.
