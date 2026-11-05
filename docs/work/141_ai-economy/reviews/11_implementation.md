# Review 11: implementation

## Target

aoe2 commit 4cde9712 on branch `ai-economy-m2a2-1105` (work 141 M2a-2a), on main c103f8f3, reviewed as `git diff c103f8f3 4cde9712`: the AI's one purchase point (`src/game/simulation/bridge/systems/aiPurchases.ts`), the phases moved onto it, its architecture test (`tests/architecture/aiPurchaseChokePoint.test.ts`) and unit test (`tests/simulation/aiPurchases.test.ts`), and the records. The criterion is plan 141's "M2a-2, FIRST": one function every AI purchase passes through, an architecture test that fails when any AI phase buys outside it, and no change in play.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/`, with the worktree as `--cd`. Asked to verify neutrality path by path, whether any AI phase could still issue a purchase command outside the point, and the tests' soundness. Its log holds no `STATUS_DLL_INIT_FAILED` result. It cited files outside the diff (`civBonusTable.ts:293`, `trainingMarketOps.ts:228`, `aiIntentionPushers.ts:114`) and its citations hold.
- One lane. The tree's `git status --porcelain` and `git diff HEAD` were empty before and after the run; the lane changed nothing. A full gate the author had started on 4cde9712 was stopped once the findings came in, before it ended, since the repairs change the code.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

Reviewed `4cde9712` against `c103f8f3`. **No behavior-neutrality regression found, but the required bypass enforcement is incomplete.**

1. **R11-1 — high — Typed purchase bypasses pass every architecture check.**
   `src/game/simulation/bridge/systems/aiSystemTypes.ts:36` exposes the full world, and `tests/architecture/aiPurchaseChokePoint.test.ts:50` misses direct submissions such as:
   ```ts
   deps.world.submitWithResult('queue.train', {
     buildingId: marketId, unitType: 'trade-cart',
   });
   ```
   Replacing the cart's `buy` call this way **in memory** passed all six architecture checks; the real fixture trained the cart and left **105 gold against Conscription's 150-gold hold**.

   A second bypass also passed: enqueue an ordinary movement intention, then change the last pending command's `type` and `data`. `ReadonlyArray` leaves its elements mutable, and the unchanged `src/game/simulation/bridge/aiIntentionPushers.ts:114` exposes the actual queue by reference. Both bypass shapes typecheck without casts. Thus the documented runtime/type boundary and architecture-test guarantee are stronger than the implementation.

2. **R11-2 — medium — The tests still do not pin the discounted-villager repair from round 8.**
   `tests/simulation/aiPurchases.test.ts:101` supplies a literal 50-food price, so it cannot detect the Town Center supplying the wrong price. I restored `trainingCost('villager')` in place of `ownerTrainingCost(...)` **in memory**: all **39 purchase and escrow test callbacks still passed**. This recreates the previously reviewed defect; the unchanged `src/game/simulation/civBonusTable.ts:293` supplies the Indian villager discount. A phase-level case needs to observe a downstream purchase that fits only when the discounted debit is counted.

3. **R11-3 — low — "What the handler will charge" overstates the accounting contract.**
   `src/game/simulation/bridge/systems/aiPurchases.ts:180` describes exact handler charges, but its default branch returns the supplied price. Soldiers supply base `trainingCost`, whereas the unchanged handler charges `ownerTrainingCost` at `src/game/simulation/bridge/trainingMarketOps.ts:228`. This deliberately preserved overcounting should be stated explicitly. **Correct the description; changing those prices would violate neutrality.**

I traced every requested purchase site, push order, reserve, in-flight exclusion, budget-opening condition, and moved accessor read. The budget implies the retained stockpile checks, including `spent ≥ soldiersAsked`; I found no consequential cache-read difference. Ferry/building purchases retain their pre-budget behavior.

Verification: retained census, spending probe, and seven-match audit outputs are byte-identical; the census also matches its checked-in expectation. Independently, all 17 escrow fixtures produced identical saved states against the parent after 61 ticks. Typechecking and diff checks passed. All 45 specified test callbacks passed using an in-memory assertion runner, **not Vitest**. Full gates were not rerun; remote CI was inaccessible. No files were modified.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| R11-1 | Typed bypasses pass the gate: a direct `world.submitWithResult`, and a queued command rewritten in place through the queue the phases held | Accepted. The gate claimed a boundary it did not have. | The phases' deps lose the pending queue, which only `aiSystem.ts` reads (`splitPurchaseCommands` takes it out with the five commands). The gate also refuses, in AI files but the pusher factory, `.submit(` and `.submitWithResult(`, and a purchase command's type string anywhere but after `===` or `!==`. Codex's submission, a queued move rewritten into a tribute, and phase deps that keep the queue each turn their own test red. The bound now says what is not seen: a type built at run time, and direct state writes, which are no command. |
| R11-2 | Round 8's repair, the villager counted at its owner's price, has no case | Accepted. | `aiPurchases.test.ts` runs the Town Center phase on fakes with an Indian Imperial seat: the villager is counted at 39 food, so a 61-food purchase fits after it; with the base price put back (`trainingCost('villager')`) that test alone goes red. |
| R11-3 | The point's comments say it counts exactly what the handler charges; a soldier counts its base price | Accepted. Changing the price would change play. | The header and `charged` now say a unit, a building and a tribute count the price their path supplies, which for a soldier is the base price and may exceed the owner's charge, as in M2a-1. |

## Verification

On the repaired tree: typecheck clean; the two test files pass (16 tests); fourteen mutations, each applied alone with the file's bytes restored after, turn their own test red and no other (`tmp/m2a2/mutate.mjs` in the worktree): R11-1's two bypasses and the split keeping the queue, R11-2's base villager price, and the ten of the first revision. The neutrality outputs are re-measured on the final revision (plan 141's Outcome).

Correction (round 12, R12-3): not every mutation turns one test alone red. The budget check removed turns six of the unit file's tests red; the other thirteen turn one each.

## Round outcome

Codex found no change in play and three defects in the gate and its records, all accepted and repaired. The repairs are checked by round 12.
