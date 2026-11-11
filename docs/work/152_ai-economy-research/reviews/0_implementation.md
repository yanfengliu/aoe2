# Review 0: implementation (M1d, the builder's walk)

## Target

aoe2, work 152 M1d: commit `088dd769` on branch `ai-builder-walk-1111`, the diff against `origin/main` `72ed0729` with `docs/work/152_ai-economy-research/plan.md` left out of the pasted diff (the reviewer could read it in the tree). The change: the computer sends to a building it places, and to a site it crews or takes up again, the available villager with the shortest walk to the site, ties by entity order, and passes over a resource's last gatherer while another can be sent (`siteBuilderWalk.ts`, `aiSystemGating.ts`, `aiSystemBuildingPhase.ts`, `aiBuildCrewPhase.ts` and their wiring); the read-only accessor `bridge.isCellPassableForUnit`; the fixtures and tests; the judge `tests/simulation/builderWalkProbe.ts` in two self-play gates; the hit census's moved window; the lab census re-recorded; spec §13.2's paragraph.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder outside the reviewed tree. The prompt stated the rule in five parts and asked for real defects with a file and line, in particular: the flood's frontier argument, the closed-own-cell rule and the kept flood's staleness; determinism and replay safety; whether "who is available" is unchanged and the pass-over is what the rule says, with its two stops; every placement path and the crew loop; whether any test can pass with the defect put back, and whether the judge is read-only and shares no code with the game's choice; the moved window and the re-recorded census; the spec against the code; cost. It was told what is out of scope (where a site is put, what the computer builds, the path search, the rebalance). The run used 159,605 tokens. The tree's `git status --porcelain` and `git diff HEAD` were saved before and compared after: unchanged. The log has no failed sandbox command (the runbook's check prints `keep`). No Claude lane was run: the brief asked for Codex.

## Reports

### Codex (`gpt-6-astra`)

The report whole.

> No actionable findings in `088dd769` against `72ed0729`. Static review only; tests were not run.
>
> Outside the diff hunks: `src/game/simulation/bridge/movementPlanOps.ts:288` — checked the open-start-cell rule; `src/game/simulation/bridge/occupancyRebuild.ts:26` — checked load/replay invalidation of cached floods.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| — | None reported. | Accepted as a report of no finding, not as proof of none: the review was static. | None. |

## Verification

Both citations outside the diff were checked against the tree. `movementPlanOps.ts:288` lies in the comment and code that count a unit's own cell as open (work 145), the rule the flood's closed-own-cell step copies. `occupancyRebuild.ts:26` is `worldOccupancy.reset()`, which a load or a replay's rebuild calls; `worldOccupancy.ts:268` adds one to the structural revision there and never sets it back, so a flood kept for an earlier revision is not reused after a rebuild. The log shows the reviewer also reading the gate-completion bump (`notePassabilityChange` for a finished gate). What the review did not do: run a test, or measure. Those are the worker's (plan 152, M1d: the mutants, the self-play gates, the measurement).

## Round outcome

No finding; nothing to repair. The revision reviewed is `088dd769`. What followed it on the branch before landing changes no code the review read: comments in the headers of `aiEconomySelfPlay.test.ts` and `selfPlayContentCoverage.test.ts` (the rule as it stands, and main's counts by today's judge), the records (this file, the plan, the spec's measured bullet, the changelog and the devlog) and the merge of `origin/main` at `eb4f54fb` (work 148 M3a moved the placement validator's sentences into one module, its codes and decisions unchanged; work 150 M2b added scripts). A later change to code would need a round of its own.
