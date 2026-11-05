# Review 9: implementation

## Target

aoe2 commit 70c76077 on branch `ai-economy-m2-1104` (work 141 M2a-1, one squashed commit on main c574e666): the final revision handed to the coordinator, with round 8's repair as `git diff 25e495be 70c76077`. Round 8 was the fifth repair round, the cap on automatic repair (AGENTS.md, R11), so this round's findings go to the coordinator rather than into a sixth.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from the worktree, while the full gate ran in the same worktree. It was told not to run the full suites. Its log's four `STATUS_DLL_INIT_FAILED` matches are lines of earlier rounds' records that it read, not results of its commands. It checked its case on the real bridge for two ticks with a variant held in memory, and read files outside the diff, among them `villagerEconomySystem.ts`, `createSimulationBridge.ts` and `trainingMarketOps.ts`.
- One lane, as in rounds 4 to 8.
- The tree's `git status --porcelain` was empty after the lane.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

1. **Major — An "unchargeable" trade can bypass escrow and execute after ordinary income arrives.** `aiSystemProductionPhase.ts:392` permits `tradeCost === null`, submitting the trade without checking or debiting the budget. That result describes affordability when the AI decides, not when commands are submitted. **Reproduction:** a two-tick, in-memory bridge run using the existing Trade Cart fixture: Imperial AI, completed Market, busy Castle, Conscription unresearched, 0 food/wood and 350 gold. A food rate of 271 quotes 353 gold. The AI submits `buy-food` uncounted. A villager delivers 10 gold later that tick; the next tick's validator accepts the trade, which leaves **7 gold against Conscription's 150-gold hold**. Without the delivery, the trade is rejected and 350 remains. The price never changes. This uses the ordinary delivery and command sequence; I did not measure its frequency in full matches. Outside the diff, `villagerEconomySystem.ts:305` processes deliveries, and `createSimulationBridge.ts:315` defers AI command submission until the next tick. **Fix:** with an active budget, require a non-null trade cost and `budget.affords(cost)` before submitting the Imperial trade. Preserve the existing inactive-budget path. Add the delivery-boundary regression case and correct the records' assertion that an uncounted request necessarily remains uncharged.
2. **Minor — The devlog still overstates mutation coverage.** The detailed devlog's line 169 claims every review repair is proven red except four counts. Round 8 correctly records **seven survivors: those four counts plus its three untested repairs**. **Fix:** state "18 of 25 mutants red," naming both groups of exceptions, consistently with the plan and round 8.

It found no change in behaviour while no escrow budget is active; round 8's in-flight age-up exclusion, owner-priced villager, corrected survivor reason and work 97 status present; `chargedTradeCost` matching the Market handler's completed-Market and price checks (it leaves out the handler's option check, which only excludes the Dark Age, where no escrow runs); and the pre-escrow building boundary stated accurately. It checked the 29 tests and sixteen fixtures by reading, and `git diff --check` passed.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| Codex R9-1 | While the budget is active, a Market trade the AI cannot pay for when it decides is still asked for, uncounted, and income arriving before its handler runs (the next tick) lets it through, leaving a hold short. | Accepted, open: round 8's repair introduced it (before it, a trade was asked for while the budget was active only when the budget afforded its price), and the cap stops a sixth repair round. | For the coordinator: Codex's fix, one condition in `aiSystemProductionPhase.ts` (ask for the trade while the budget is active only when `chargedTradeCost` is not null and the budget affords it), with a case at the delivery boundary. Spec §13.2 and round 8's record no longer say an uncounted trade is always refused. Repaired on the coordinator's authorization (2026-11-05: a new defect round 8 introduced, so its first repair) in d3d9ee67, which [round 10](10_implementation.md) checked. |
| Codex R9-2 | The devlog said every repair was red but four counts. | Accepted. | The devlog says 18 of 25, naming the four counts and round 8's three repairs. |

## Verification

- No code changed after this round; the records were corrected (docs only). The gate on 70c76077 is plan 141's.

## Round outcome

One major and one minor finding. R9-2 corrected in the records; R9-1 open with the coordinator, with its one-condition fix named, then repaired in d3d9ee67 on the coordinator's authorization and checked as round 10.
