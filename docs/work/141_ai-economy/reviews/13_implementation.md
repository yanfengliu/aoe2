# Review 13: implementation

## Target

aoe2 commit 2d43f55e on branch `ai-economy-m2a2-1105` (work 141 M2a-2a), reviewed as `git diff 6aa60e51 2d43f55e`: the repair of [round 12](12_implementation.md)'s R12-1 (the purchase point's internals in ES private members, its budget opened once and only from the escrow phase) and its two record findings, a focused check.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/`, with the worktree as `--cd`. Its log holds no `STATUS_DLL_INIT_FAILED` result. It cited files outside the diff (`aiSystem.ts:204` and `:218`, `aiEscrowPhase.ts:113`) and its citations hold.
- One lane. The tree's `git status --porcelain` and `git diff HEAD` were empty before and after the run; the lane changed nothing. A full gate on 2d43f55e ran meanwhile and was stopped once the findings came in, after its unit suite had passed (669 files passed, 1 skipped).

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

Reviewed **2d43f55e** against **6aa60e51**. **Two findings remain in boundary enforcement; no behavior regression found in the unchanged execution paths.**

1. **R13-1 — high — A phase can still obtain and disable the decision's budget through writable `openBudget`.**
   `src/game/simulation/bridge/systems/aiPurchases.ts:191`, `tests/architecture/aiPurchaseChokePoint.test.ts:162`.

   An earlier phase can install this **fully typed, cast-free** wrapper:
   ```ts
   const open = ctx.purchases.openBudget.bind(ctx.purchases);
   ctx.purchases.openBudget = budget => {
     budget.affords = () => true;
     open(budget);
   };
   ```
   I inserted it into `runBuildingPhase` **in memory**. It passes typechecking and all eight architecture tests. The real Trade Cart fixture then reaches **0 gold despite Conscription's 150-gold hold**.

   The outside-diff ordering makes this possible: `src/game/simulation/bridge/systems/aiSystem.ts:218` runs building before production, and `src/game/simulation/bridge/systems/aiEscrowPhase.ts:113` subsequently supplies the actual budget to that replaceable method.

   The once-guard prevents reopening, but does not protect the budget from interception. The lexical check also accepts `purchases['openBudget'](...)` outside escrow. Give ordinary phases an immutable `buy` facade and keep budget initialization outside that surface.

2. **R13-2 — medium — The prototype-surface test misses public symbol methods.**
   `tests/architecture/aiPurchaseChokePoint.test.ts:179`.

   `Object.getOwnPropertyNames` excludes symbols; `Reflect.ownKeys(instance)` does not inspect its prototype. In memory, I replaced `#ask` with `[Symbol.iterator]` and updated its internal calls. **All 19 original focused tests still passed**, and TypeScript accepted:
   ```ts
   purchases[Symbol.iterator](monk);
   ```
   A runtime check confirmed this dispatched the Monk that `buy` refused. This demonstrates a regression-detection gap, not an existing symbol method at HEAD. Use `Reflect.ownKeys(AiPurchases.prototype)` for the claimed complete surface check.

Other checks completed:

- Direct bracket access to all eight internals, with both ordinary and `#`-prefixed string keys, produces TypeScript errors. Casts do not expose ES private members.
- The current call graph creates a fresh instance at `src/game/simulation/bridge/systems/aiSystem.ts:204` and opens it at most once. No legitimate duplicate opening found.
- Receiver binding, dispatch switches and the pricing default branch preserve existing behavior. All **17 escrow fixtures' complete saved-state JSON hashes match** the parent after 61 ticks.
- **R12-2 and R12-3 are corrected:** the plan distinguishes supplied prices from handler charges, and round 11 explicitly corrects its mutation count.

Verification: **49 focused Vitest tests passed**, baseline typechecking and diff checks passed. Full verification was not rerun; remote CI was inaccessible. All experimental changes were in memory; no files were modified.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| R13-1 | A phase can put its own `openBudget` on the point and tamper with the budget it is handed; `purchases['openBudget']` passes the lexical check | Accepted as a cheap repair. This is the third hole found in one boundary (R11-1, R12-1), so the approach was reassessed: each later one needs code written to defeat the point, which is not how the budget leaked (paths that did not know of it). The bound is now stated, and repairs stop at what is cheap: | The instance is frozen in its constructor and its prototype at load, so assigning `openBudget` or `buy` throws a TypeError, and `ctx.purchases` is `Readonly<AiPurchases>`, so the wrapper above fails the typecheck (TS2540). The lexical check refuses the name `openBudget` anywhere outside the escrow phase and the point, `purchases['openBudget']` and `.bind` included. Red on their own mutations: the instance unfrozen, the prototype unfrozen, the tribute phase opening by string. Not repaired, and stated as the bound in the test, the point and the plan: a patched `DecisionBudget.prototype`, or any other code written to defeat the point. |
| R13-2 | The surface check misses a method under a symbol | Accepted. | The prototype's surface is `Reflect.ownKeys`, symbols included; a method under `Symbol.iterator` turns the check red. |

## Verification

On the repaired tree: typecheck clean; the purchase, gate and escrow files pass (49 tests); twenty-two mutations, each applied alone with the file's bytes restored after, turn their own test red (the budget check removed turns seven of the unit file's tests red, every other mutation one): R1 to R14 against the architecture test, B1 to B8 against the unit test. Codex's wrapper in `aiSystemBuildingPhase.ts` fails the typecheck: "Cannot assign to 'openBudget' because it is a read-only property."

## Round outcome

Play is unchanged; both findings are repaired at what is cheap, and the boundary's bound is stated rather than chased. Round 14 checks the repair against that bound.
