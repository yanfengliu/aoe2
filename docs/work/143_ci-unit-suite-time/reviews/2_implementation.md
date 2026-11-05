# Review 2: implementation

## Target

aoe2, branch `ci-unit-suite-1105` at `b97742da` against `e185cbef`, the revision round 1 reviewed: the repair commit `ae40c57f` (the PowerShell `--` rule reading whole lines, the ci.yml ranges) and the records commit `b97742da` (plan 143's regenerated model and run table, the register entry, the gate proofs, review round 1). A focused re-review of round 1's repairs.

## Reviewers and coverage

Codex `gpt-6-astra` at `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, codex-cli 0.163.0, run from fleet's ignored `tmp/review-runs/aoe2-w143-r2/` with the worktree as `--cd`. The lane check found no failed sandboxed command (`keep`, 0 lines), and the worktree's status was the same before and after. Lens: whether the new rule catches every bare `--` it can be handed and still passes the real ci.yml, whether the regenerated numbers hold against the 18 saved job logs of the nine unsharded runs, the docs' consistency, and regressions of what rounds 0 and 1 confirmed. No Claude lane ran.

## Reports

### Codex (gpt-6-astra)

Its report, unchanged except that local absolute paths in its links were shortened to repository paths:

> Reviewed `b97742da1b30` against `e185cbef`. **No blocker or major finding. F2 is repaired; F3’s ranges are correct; F1 remains partially open.**
>
> 1. **Minor — multiline PowerShell expressions still bypass the guard.** [ciJobHeadroom.test.ts:216](tests/scripts/ciJobHeadroom.test.ts:216) joins backtick continuations but splits other valid multiline expressions. Replacing the Lint step with this passes all six workflow checks:
>
>    ```powershell
>    npm run lint $(
>      Write-Output --silent
>    ) -- --max-warnings=0
>    ```
>
>    PowerShell accepts this syntax and drops the bare separator; quoting it preserves it. A multiline `& (Get-Command npm)` invocation also escapes. This contradicts the “every npm or npx command” claim at line 227. Handle complete statements or explicitly reject unsupported multiline invocation forms, and retain these regression cases.
>
> 2. **Nit — the register still describes the original sample as consecutive runs.** [defect-register.md:11](docs/learning/defect-register.md:11) says “The three runs before it passed at 65–66%.” The third preceding run, `41963003150`, actually used **61%**, recorded outside the diff in [127033510311.log:1258](tmp/w143/logs/127033510311.log:1258). Say “three earlier sampled runs,” or identify the sample explicitly.
>
> Other checks:
>
> - **Guard:** the real workflow passes. All **17 documented mutations fail**, and all **three controls pass**, using in-memory execution. Quoted executable names, call operators, single-line subexpressions and backtick continuations are caught. Workflow/job shell defaults and step overrides behave as intended: explicit PowerShell is checked; explicit Bash is exempt.
> - **False positives:** comments, string contents such as `Write-Output "npm uses -- as separator"`, and another command’s separator on the same line all fail at [ciJobHeadroom.test.ts:217](tests/scripts/ciJobHeadroom.test.ts:217). They do not affect today’s workflow, but create future false alarms; blindly quoting text or another command’s separator can change its meaning.
> - **Numbers:** reparsing all **18 logs from the nine runs** confirms Windows jobs **30.1–40.2 minutes**, unit steps **27.5–36.6**; Ubuntu jobs **18.3–30.0**, unit steps **16.5–28.1**. The corrected model reproduces **2,135 seconds**, **223/223/221 files**, and every regenerated table value. The rounded **1.46×, 2.5× and 1.7×** bounds are consistent.
> - **Prior confirmations:** executable workflow YAML is unchanged. Earlier mutation protections remain intact. Vitest’s actual partition and saved clean hosted logs still cover all **667 files exactly once per OS**; outside the diff, [BaseSequencer:3456](node_modules/vitest/dist/chunks/coverage.DfSpMS-b.js:3456) implements that split. Saved red-proof logs still fail the intended shards.
>
> No files changed; the tree remains clean. No full Vitest/verify run was performed. Session-start CI status returned `UNKNOWN`; hosted verification used saved logs.
## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F1 | Minor, again: a command that spans lines in other ways than a backtick, an open `$(` or a call operator on its own line, escaped the line rule. | Accepted, and the approach reassessed: three rounds each found a form a pattern did not follow, so the rule no longer follows forms. | The whole run block is the unit: a PowerShell step of a Windows job that names npm or npx anywhere and holds a bare `--` anywhere fails. The round's two mutations are red, with the earlier 17, and a quoted `'--'` after a `$(` spanning lines stays green. |
| F1 (false positives) | Codex noted that comments, string contents and another command's `--` on the same line fail too. | Accepted as the stated price, wider now that the unit is the block: no step in ci.yml has one, and the test's comment says to quote the `--` or give that command a step of its own. | None. |
| F4 | Nit: the register called its sample "the three runs before it", but they were not consecutive (`41963003150` used 61%). | Accepted. | The entry now gives the eight other unsharded runs of the day (50-66%), naming the three at 65-66%. |

## Verification

On the reviewed revision: `npm run verify` on a clean checkout of `b97742da` exited 0 and certified its receipt (tree `fa71b4720102`), and hosted run 42019409523 on `b97742da` passed all ten jobs (Windows shards 16.9, 16.1 and 10.2 minutes, Ubuntu 12.6, 6.3 and 8.2; 223, 223 and 221 files on each runner). After the repairs: all 19 mutations of ci.yml failed the intended case and the four controls passed; the CI-workflow and architecture test files, lint and typecheck passed; the repairs went through `npm run verify` before their commit.

## Round outcome

No blocker or major finding. F2 and F3 confirmed repaired; F1 and F4 accepted and repaired in the next commit. With the rule reading whole blocks, no further syntactic form of the same class remains to find; what stays outside it is an npm the block never names.
