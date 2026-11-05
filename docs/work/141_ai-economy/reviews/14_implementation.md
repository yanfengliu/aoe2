# Review 14: implementation

## Target

aoe2 commit 07c18ade on branch `ai-economy-m2a2-1105` (work 141 M2a-2a), after the branch was rebased onto main 606ad92c (work 142 M2b-2a, which touched no AI file). Reviewed: round 13's repair, `git diff 132314a2 07c18ade`, against the boundary's stated bound, and the rebase's record merges. The rebased commits c5350159, ee7303c3, 132314a2 and 07c18ade carry the same `src/` and `tests/` patches as the reviewed 4cde9712, 6aa60e51, 2d43f55e and 1cdcdb34 (compared byte for byte by the author, and again by the reviewer).

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/`, with the worktree as `--cd`. Its log holds no `STATUS_DLL_INIT_FAILED` result. It cited files outside the diff (`aiTradePhase.ts:72`, `aiSystem.ts:204`, `aiEscrowPhase.ts:113`) and its citations hold.
- One lane. The tree's `git status --porcelain` and `git diff HEAD` were empty before and after the run; the lane changed nothing. A full gate on 07c18ade ran meanwhile and was stopped when the finding came in.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

Reviewed **07c18ade**. **One finding remains in the architecture gate; round 13's repairs themselves hold.**

**R14-1 — medium — Ordinary shared purchase helpers escape the gate.**
`tests/architecture/aiPurchaseChokePoint.test.ts:119` identifies AI files by an `ai` filename prefix; line 153 restricts submission checks to those files.

I tested an **in-memory** shared `bridge/trainingRequests.ts` helper containing:

```ts
export function requestTraining(
  world: GameWorld, buildingId: number, unitType: TrainableUnitType,
): void {
  world.submitWithResult('queue.train', { buildingId, unitType });
}
```

Calling it from the unchanged purchase location at `src/game/simulation/bridge/systems/aiTradePhase.ts:72` produced **zero TypeScript errors and passed all eight original architecture tests**. After five ticks, the Trade Cart fixture queued a cart and held **105 gold against Conscription's 150-gold hold**.

I classify this as an ordinary helper extraction or reuse that could be written **without knowing about the point**: no reflection, computed command strings, aliases or tampering are required. Excluding deliberate attacks is reasonable, but the stated bound remains too broad because filename classification does not cover an AI phase's callees. Extend enforcement to those purchase helpers or restrict the submission capability exposed to phases. This is a regression-detection gap, **not an existing purchase leak at HEAD**.

Other checks completed:

- **R13-1 repaired:** replacing either method produces TS2540; instance and prototype replacements fail at runtime. Dot, bracket, template-string, destructured and bound references to `openBudget` are refused.
- **R13-2 repaired:** the surface check detects a public `Symbol.iterator` method.
- **Freeze behavior preserved:** private budget writes succeed; spending and the once-only guard work. The fresh-instance/opening sequence remains intact at `src/game/simulation/bridge/systems/aiSystem.ts:204` and `src/game/simulation/bridge/systems/aiEscrowPhase.ts:113`, both outside the repair diff.
- **Record merges:** no loss or garbling found against `606ad92c` and pre-rebase `1cdcdb34`. Both works' entries survive; the summary has 49 rows and its removed row is preserved verbatim in the detailed devlog. All four rebased `src/` and `tests/` patches match their originals byte for byte.

Baseline typechecking, **49 focused Vitest tests**, and diff checks pass. Full verification was not rerun; sandbox networking prevented remote CI verification. All experiments were in memory; no files were modified.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| R14-1 | A shared helper in a file not named `ai*`, which an AI phase calls, can submit a purchase command to the world | Accepted: an ordinary extraction, inside the stated bound. | A new check over every file under `src/`: a purchase command is submitted to the world by its type only from the human's own input (`humanInputOps.ts`, `placementOps.ts`, `tributeOps.ts`); the dispatcher and the replay submit by the recorded type. The check also requires those three files to be found, so it cannot read nothing. Codex's helper, added to `gatherCommandOps.ts`, turns that test alone red. |

## Verification

On the repaired tree: the architecture test passes (9 tests), and the new check is red with the helper put in. The other twenty-two mutations are unchanged by this repair, which touches only the test file.

## Round outcome

Round 13's repairs and the rebase's record merges hold. The one finding is repaired; it is the fourth repair of this boundary (rounds 11 to 14), one short of the five-attempt cap.
