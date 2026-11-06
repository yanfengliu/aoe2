# Review 15: implementation

## Target

aoe2 commit e908fdd3 on branch `ai-economy-m2a2-1105` (work 141 M2a-2a), on main 606ad92c, reviewed as `git diff 07c18ade e908fdd3`: the repair of [round 14](14_implementation.md)'s R14-1 (a check that only the human's own input submits a purchase command to the world by its type) and records, a focused check.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/`, with the worktree as `--cd`. Its log holds no `STATUS_DLL_INIT_FAILED` result. It cited files outside the diff (`aiTradePhase.ts:72`, `dispatcher.ts:77`) and its citations hold.
- One lane. The tree's `git status --porcelain` and `git diff HEAD` were empty before and after the run; the lane changed nothing. A full gate on e908fdd3 ran meanwhile and was stopped when the finding came in, after its unit suite had passed (671 files passed, 1 skipped).

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

Reviewed **e908fdd3**. **One enforcement gap remains, plus one minor record issue.**

**R15-1 — medium — Command-object helpers still bypass the architecture check.**
`tests/architecture/aiPurchaseChokePoint.test.ts:169`

The regex requires the purchase type immediately after the submission's opening parenthesis. An ordinary shared helper escapes it:

```ts
export function requestTraining(
  world: GameWorld, buildingId: number, unitType: TrainableUnitType,
): void {
  const command = {
    type: 'queue.train' as const,
    data: { buildingId, unitType },
  };
  world.submitWithResult(command.type, command.data);
}
```

I added this to `gatherCommandOps.ts` **in memory**, replacing the purchase at unchanged `src/game/simulation/bridge/systems/aiTradePhase.ts:72` with its call:

- **Zero TypeScript errors; all nine architecture tests passed.**
- After five ticks, the Trade Cart fixture queued a cart and retained **105 gold against Conscription's 150-gold hold**. The existing escrow test correctly failed.
- The new check misses this shape for **all five purchase types**, through both submission methods.

This needs no knowledge of the purchase point, method aliasing, computed strings or tampering. The unchanged `src/game/simulation/dispatcher.ts:77` already uses this command-object submission idiom. It is a regression-detection gap, **not an existing purchase leak at HEAD**.

Cover this ordinary helper shape too. Consequently, `docs/work/141_ai-economy/plan.md:199`'s claim that a shared helper "cannot either" remains too broad; the decision and review/devlog closure claims need the same qualification.

**R15-2 — low — The devlog's Result retains older test counts.**
`docs/devlog/detailed/2026-11-04_2026-11-06.md:225`

It reports **6 architecture tests and 9 purchase tests**; HEAD has **9 and 11**, respectively. Update them or explicitly label them as pre-review counts.

Other checks completed:

- R14-1's direct-literal helper is refused: **30 variants** covering five types, both methods and three quote styles.
- The three-file allowlist matches the current human purchase entry points and their ownership/selection guards.
- The non-vacuous guard fails when the scan is empty or the human submissions disappear.
- All four recorded rebase patch pairs match byte-for-byte; the five retained outputs match both control baselines.
- Baseline **50 focused Vitest tests**, typechecking and diff checks pass. No product source changed in this repair.

Full verification was not rerun; remote CI was inaccessible. All experiments were in memory, and the worktree remains unchanged.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| R15-1 | A shared helper that builds a command object escapes the submission check | Accepted: an ordinary helper, inside the bound, and round 14's hole in a second shape. Matching shapes had now failed twice for one reason, so the fifth repair changes method. It is the last the five-attempt cap allows on this boundary. | Round 14's check is replaced by an exact list: outside the AI files (held by their own check), only seventeen files may name a purchase command type at all, those that define, handle or validate the commands, submit the human's own purchases, or describe them to the LLM playtest agent. A helper names the type it submits however it builds the command, so both of Codex's helpers turn the test red, and so does a listed file that stops naming its command (the list is exact both ways). Stated as the bound: a type built at run time, or read from a recorded command, gets past it. |
| R15-2 | The devlog's Result gives the first revision's test counts | Accepted. | The counts read 9 and 11, after review. |

## Verification

On the repaired tree: the architecture test passes (9 tests); three mutations, each applied alone with the bytes restored after, turn the new test alone red: round 14's literal helper, round 15's command-object helper, and the tribute's command spelled `'tribute' + '.send'` in `tributeOps.ts`.

## Round outcome

The repair of round 14 held for its shape and missed another; the fifth repair replaces shape matching with an exact list of the files that may name a purchase command. The cap is reached: a further hole in this boundary goes to the coordinator. Round 16 checks this repair.

Correction (round 16, R16-1): the exact list exempts a listed file whole, so the disposition above overstates the check. A helper extracted inside one of the seventeen files, or exported beside the pushers in `aiIntentionPushers.ts`, and called from an AI phase, still passes it.
