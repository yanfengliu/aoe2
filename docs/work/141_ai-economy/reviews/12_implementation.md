# Review 12: implementation

## Target

aoe2 commit 6aa60e51 on branch `ai-economy-m2a2-1105` (work 141 M2a-2a), reviewed as `git diff 4cde9712 6aa60e51`: the repairs of [round 11](11_implementation.md)'s R11-1 to R11-3, a focused check.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/`, with the worktree as `--cd`. Its log holds no `STATUS_DLL_INIT_FAILED` result. It cited files outside the diff (`aiTradePhase.ts:72`, `trainingMarketOps.ts:228`, `civBonusTable.ts:296`, `civBonusEffects.ts:299`) and its citations hold.
- One lane. The tree's `git status --porcelain` and `git diff HEAD` were empty before and after the run; the lane changed nothing. A full gate on 6aa60e51 ran meanwhile and was stopped once the findings came in, at its typecheck stage: its unit suite had passed (669 files passed, 1 skipped).

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

**R11's two original bypass shapes are blocked, but the typed purchase boundary remains incomplete. No behavior regression found in the repair.**

1. **R12-1 — high — A phase can still bypass `buy` through typed access to private members.**
   `tests/architecture/aiPurchaseChokePoint.test.ts:172` checks the stripped dependencies, but the phase context exposes the full `AiPurchases` instance.

   I changed the unchanged `src/game/simulation/bridge/systems/aiTradePhase.ts:72` **in memory** to:
   ```ts
   purchases['ask']({
     kind: 'train', buildingId: marketId,
     unit: 'trade-cart', price: cost,
   });
   ```
   This produced **zero TypeScript errors and passed all six architecture tests**. A runtime test confirmed that `ask` dispatches a purchase rejected by `buy`, without updating the budget. `purchases['commands'][AI_PURCHASE_COMMANDS[0]](...)` also typechecks, exposing the original command directly.

   These routes require neither casts nor the documented computed-type/aliased-world-submission exceptions. Narrow the phase-facing purchase interface or use runtime-private internals, and add a negative control.

2. **R12-2 — low — The plan retains R11-3's inaccurate accounting description.**
   `docs/work/141_ai-economy/plan.md:194` still says the point "counts what the handler will charge." The repaired source comments correctly distinguish supplied prices from actual charges. For example, Trade Carts supply the base price, while unchanged `src/game/simulation/bridge/trainingMarketOps.ts:228` charges `ownerTrainingCost`. Update the record to match that distinction.

3. **R12-3 — low — The mutation summary incorrectly claims one failing test per mutation.**
   `docs/work/141_ai-economy/reviews/11_implementation.md:51` says all fourteen mutations turn "their own test red and no other." The retained `mut-B1-no-budget-check.json` reports **six** failing tests, correctly acknowledged at `plan.md:200`. Correct the summary; this does not invalidate the red proofs.

Other checks:

- **R11-1's concrete repairs work:** direct `.submit(...)`/`.submitWithResult(...)` calls are refused lexically; `pendingCommands` is absent from phase dependencies at both type and runtime levels. The architecture suite accepts the existing AI code.
- **R11-2's regression is covered:** unchanged `src/game/simulation/civBonusTable.ts:296` supplies `0.77`, and `src/game/simulation/civBonusEffects.ts:299` rounds: `round(50 × 0.77) = 39`; `200 − 100 − 39 = 61`. Restoring `trainingCost('villager')` in memory made exactly the new case fail.
- **R11-3's source comments are corrected.**
- **Neutrality:** the split returns the original queue reference; `aiSystem` still reads that same array. All five retained before/after-repair artifacts compare byte-identically: census, spending probe, and three seven-match audit outputs.

Verification: **16 focused Vitest tests passed**, typecheck and diff checks passed. Full verification was not rerun; remote CI was inaccessible. No files were modified.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| R12-1 | TypeScript lets a phase read the point's `private` members by bracket, so `purchases['ask']` and `purchases['commands']` ask past the budget with no cast | Accepted. The second hole of the same kind (R11-1), so the approach was reassessed: the point's internals must be private at run time, not by the type checker's leave. | `AiPurchases` keeps its commands, deps, owner, stockpile and budget in ES private members (`#`), and `#ask` and `#charged` are ES private methods, so no name reaches them. `purchases['ask']` is now a type error (TS2551) and undefined at run time. The budget opens once a decision and only from the escrow phase, so no call can unbind it. New checks, each red on its own mutation: the point's prototype shows only `buy` and `openBudget` and an instance has no own property (a public `ask`; the commands assigned as an own property), only `aiEscrowPhase.ts` calls `openBudget` (the tribute phase opening it), and a second opening throws (the guard disabled). |
| R12-2 | The plan still says the point counts what the handler charges | Accepted. | The plan says a unit, a building and a tribute count the price their path supplies, a soldier's and a Trade Cart's being the base price. |
| R12-3 | Round 11's record says each mutation turned one test red | Accepted. | A labelled correction in round 11's record: the budget check removed turns six tests red, the others one each. |

## Verification

On the repaired tree: typecheck clean; the two test files pass (19 tests); eighteen mutations, each applied alone with the file's bytes restored after, turn their own test red (the budget check removed turns seven of the unit file's tests red, every other mutation one): R1 to R10 against the architecture test, B1 to B8 against the unit test. Codex's bracket bypass in `aiTradePhase.ts` fails the typecheck: "Property 'ask' does not exist on type 'AiPurchases'. Did you mean '#ask'?".

## Round outcome

The repairs of round 11 hold, play is unchanged, and the one high finding, the second hole in the same boundary, is repaired by making the point's internals private at run time. Round 13 checks that repair.
