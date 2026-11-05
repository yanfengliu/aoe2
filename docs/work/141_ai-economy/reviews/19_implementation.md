# Review 19: implementation

## Target

aoe2 commit b55678c5 on branch `ai-economy-m2a2b-1105` (work 141 M2a-2b), reviewed as `git diff 78362a38 b55678c5`: the repairs of review round 18's two low findings (one fixture entry, one test, one spec sentence).

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder under fleet's ignored `tmp/review-runs/`, with the worktree as `--cd`. Its log holds no `STATUS_DLL_INIT_FAILED` result. It was told not to run tests or builds, because the full gate was running on the machine; it reasoned from the code. It cited files outside the diff: `createSimulationBridge.ts:321` (spot-checked: `drainPendingCommands(...)` runs before `world.step()`) and `aiSystemGating.ts:180`.
- One lane. The tree's `git status --porcelain` was empty before and after the run; the lane changed nothing.

## Reports

### Codex (gpt-6-astra)

Local absolute paths in its links were shortened to repository paths; nothing else was changed.

No new findings in `78362a38..b55678c5`. Both round 18 low findings are resolved by static inspection.

- **R18-1 — low, resolved.** The new test, `tests/simulation/aiSiege.test.ts:274`, exercises the real command and AI production paths. The fixture, `src/game/simulation/fixtures/aiEscrow.ts:206`, supplies eight soldiers against one Militia and one Castle: the adjusted lead is `8 − 1 − 1 = 6`. Counting the queued ram as standing siege would remove the Castle deduction, produce superiority 1, and request a second ram—failing the final assertion.
- **The timing and affordability checks support that conclusion.** Commands drain before stepping at `createSimulationBridge.ts:321`; the engine processes handlers before AI systems. The first ram leaves 100 gold and 840 wood, enough for another costing 75 gold and 160 wood. The ram purchase precedes research and army spending. A workshop containing one entry remains eligible: `aiSystemGating.ts:180` rejects only queues of two or more. These files are outside the diff.
- **R18-2 — low, resolved.** Spec §13.3, line 1917, now matches `aiSiege.ts:130`: defence subtraction requires population strictly below max-civ-pop, alongside the army-size, standing-siege and researched-technology conditions. The documented 186/194 thresholds match the implementation.

No tests, builds or mutations were run; the predicted regression failure is reasoned from code, not experimentally demonstrated. No files changed.

## Findings and disposition

No findings. The regression Codex predicted for R18-1 was demonstrated by the worker before this round: with the phase passing the queued ram as standing (`tmp/m2a2b/mutations/r18.json`), the case queues a second ram and fails, alone (round 18's Verification).

## Verification

No repair in this round. The revision reviewed, b55678c5, is the code of the phase-1 gate on c3b87011 (vitest 5,340 passed and 3 skipped, Playwright 310 passed and 2 skipped, receipt OK on tree 0da237eee76c), whose later commits are records. Codex ran no test, by instruction; the regression it reasoned about was run before the round (round 18's Verification).

## Round outcome

Clean. Rounds 17 to 19 close M2a-2b's review with no finding open.
