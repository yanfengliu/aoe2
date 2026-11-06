# Review 16: implementation

## Target

aoe2 commit 99726d7f on branch `ai-economy-m2a2-1105` (work 141 M2a-2a), on main 606ad92c, reviewed as `git diff e908fdd3 99726d7f`: the fifth and last repair the five-attempt cap allows on the purchase point's boundary (an exact list of the files outside the AI that may name a purchase command type), and records, a focused check.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/`, with the worktree as `--cd`. Its log holds no `STATUS_DLL_INIT_FAILED` result. It cited files outside the diff (`humanInputOps.ts:293`, `aiTradePhase.ts:72`) and its citations hold.
- One lane. The tree's `git status --porcelain` and `git diff HEAD` were empty before and after the run; the lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

Reviewed **99726d7f**. **One enforcement gap remains within the stated bound.** I found no existing purchase leak at HEAD.

**R16-1 — medium — Whole-file exemptions still admit ordinary shared purchase helpers.**

Location: `tests/architecture/aiPurchaseChokePoint.test.ts:207`.

The check accepts every purchase-type reference inside a listed file, without restricting its purpose or callers. An ordinary extraction of the existing submission at unchanged `src/game/simulation/bridge/humanInputOps.ts:293` escapes it:

```ts
export function requestTraining(
  world: GameWorld, buildingId: number, unitType: TrainableUnitType,
) {
  return world.submitWithResult('queue.train', { buildingId, unitType });
}
```

In memory, I extracted that helper within `humanInputOps.ts`, used it from the existing human caller, and replaced the purchase at unchanged `src/game/simulation/bridge/systems/aiTradePhase.ts:72` with:

```ts
requestTraining(world, marketId, 'trade-cart');
```

Evidence:

- **Zero TypeScript errors; all nine architecture test callbacks passed.**
- The existing Trade Cart escrow case failed: after five ticks, a cart was queued and **105 gold remained against Conscription's 150-gold hold**.
- Human ownership checks remain at their original caller. This needs no knowledge of `AiPurchases`, computed type, recorded command, aliasing or tampering.

The AI/non-AI predicates partition the scanned files consistently, but the factory exception has the same weakness: line 157 skips `aiIntentionPushers.ts`, while the runtime check examines only returned pushers. Adding the helper as a separate export there also passed all nine callbacks.

This is a regression-detection gap. At the repair cap, it belongs with the coordinator.

Other checks completed:

- Both rounds' original helpers are refused: **60 variants**, covering five types, two submission methods, three quote styles and both helper shapes.
- The real tree passes. An independent scan confirmed **exactly seventeen non-AI files**, with no missing or unexpected entry.
- Removing the purchase-type references from each listed file independently failed the exact-list check: **17/17**.

The records correctly update the counts to **9 architecture and 11 purchase tests**, and correctly identify the fifth repair and cap. However, the general prevention claims in `docs/work/141_ai-economy/plan.md:199`, `docs/architecture/decisions.md:976` and the devlog (`docs/devlog/detailed/2026-11-04_2026-11-06.md:227`) remain too broad. Review 15's (`docs/work/141_ai-economy/reviews/15_implementation.md:66`) concrete helper proofs hold, but its boundary description needs the allowed-file exception exposed above.

Verification: baseline typechecking and diff checks passed. **50 existing test callbacks passed using an in-memory runner with Vitest matchers, not the Vitest runner.** Full verification was not rerun; sandbox networking prevented remote CI verification. No files were modified.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| R16-1 | A listed file is exempt whole, so a helper extracted inside one, or exported beside the pushers in `aiIntentionPushers.ts`, and called from an AI phase, buys past the point and passes every check | Accepted as a real gap inside the bound. Not repaired: the boundary has had five repairs (rounds 11 to 15), the cap. Lexical checks have now failed three times for one reason (the shape of a submission, then its file), so the class fix needs another method. | OPEN, with the coordinator. Proposed class fix: a run-time guard in `aiSystem.ts` that refuses any purchase command submitted to the world while the AI decides, since every AI purchase is queued through the point, never submitted; the lexical gate stays as the narrowing it is. The plan, decisions.md, the devlog, review 15 (a labelled correction) and the comments in the test and the point now say the class is not closed. |

## Verification

No code changed in response but comments: the test's bound and the point's header now say the gate is aimed at the class and does not close it. The full gate runs on the revision that carries this record.

## Round outcome

The fifth repair holds for every shape outside the listed files. One gap remains inside them, past the repair cap; it is with the coordinator with a proposed run-time guard.
