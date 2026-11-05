# Review 3: implementation

## Target

aoe2, branch `ci-unit-suite-1105` at `4db8bcf1` against `b97742da`, the revision round 2 reviewed: the repair commit `b02f89dd` (the PowerShell `--` rule reading each run block whole) and the records commit `4db8bcf1` (the register's sample wording, the gate proofs, plan 143's third hosted run, review round 2). A focused re-review of round 2's repairs.

## Reviewers and coverage

Codex `gpt-6-astra` at `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, codex-cli 0.163.0, run from fleet's ignored `tmp/review-runs/aoe2-w143-r3/` with the worktree as `--cd`. The lane check found no failed sandboxed command (`keep`, 0 lines), and the worktree's status was the same before and after. Lens: any PowerShell form that still hands npm a bare `--` past the whole-block rule, whether the rule's price is stated where an author meets it, and the docs' consistency. No Claude lane ran.

## Reports

### Codex (gpt-6-astra)

Its report, unchanged except that local absolute paths in its links were shortened to repository paths:

> Reviewed `4db8bcf1` against `b97742da`. **No blocker or major finding; F1 remains open, plus one documentation nit.**
>
> 1. **Minor — PowerShell token boundaries still bypass the guard.** [ciJobHeadroom.test.ts:217](tests/scripts/ciJobHeadroom.test.ts:217) requires whitespace around `--`. Both replacements for the Lint command pass all six workflow checks:
>
>    ```powershell
>    npm run lint --('--max-warnings=0')
>    npm run lint $(Write-Output --silent)-- --max-warnings=0
>    ```
>
>    PowerShell 5.1 parses both successfully and removes the bare separator before the shim receives `$args`; quoted controls preserve it. Parentheses can separate arguments without whitespace, consistent with [PowerShell’s parsing rules](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing?view=powershell-7.5#argument-mode). Handle token boundaries and retain these negative controls. The exhaustive claim in [round 2:53](docs/work/143_ci-unit-suite-time/reviews/2_implementation.md:53)—“no further syntactic form”—is consequently incorrect.
>
> 2. **Nit — the repaired sample range includes another failing run.** [defect-register.md:11](docs/learning/defect-register.md:11) assigns **50–66%** to the eight other unsharded runs, but those eight include `42004237120`, which reports **67%** and fails. Evidence outside the diff: [127166850049.log:1260](tmp/w143/logs/127166850049.log:1260). Use “the seven passing unsharded runs,” or expand the range. [Round 2:45](docs/work/143_ci-unit-suite-time/reviews/2_implementation.md:45) repeats this error.
>
> Other checks held:
>
> - The real workflow passes all six workflow checks. All **19 documented mutations fail**, and all **four controls pass**, in read-only, in-memory execution.
> - The accepted false positives are explicitly documented beside the helper at [ciJobHeadroom.test.ts:211](tests/scripts/ciJobHeadroom.test.ts:211) and in the gate proofs. Comments, strings and another command’s separator reproduce that behavior.
> - Mutation counts and earlier-round records otherwise agree. The six saved shard logs confirm the added hosted run’s timings and **223/223/221 files per OS**.
>
> No files changed; the tree remains clean. No full Vitest/verify run was performed. `ci:status` returned `UNKNOWN`; hosted checks used saved logs.
## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F1 | Minor, a fifth time: the rule wanted whitespace around a bare `--`, and a bracket also ends a PowerShell token, so `npm run lint --('--max-warnings=0')` and `npm run lint $(Write-Output --silent)-- --max-warnings=0` passed it. Round 2's record said no further form remained; that was wrong. | Accepted, and this is the fifth and last repair this finding gets under the canon's cap: a further form goes to the coordinator as a report. | A bare `--` is now two hyphens that no word character, hyphen or quote touches, whatever surrounds them. Both forms are red, with the earlier 19; `$i--` beside an npm command stays green, with the earlier four controls. |
| F4 | Nit, again: the register gave 50-66% for the eight other unsharded runs, but they include `42004237120`, which failed at 67%; round 2's record repeats it. | Accepted. Round 2's record is closed history and stays as written; this round corrects it. | The entry now gives the seven runs that passed (50-66%) and names the failing one at 40.1 minutes (67%). |

## Verification

On the reviewed revision: `npm run verify` on a clean checkout of `4db8bcf1` exited 0 and certified its receipt (tree `e9af5cd193cf`), and hosted run 42023734189 on `4db8bcf1` passed all ten jobs (Windows shards 17.4, 15.8 and 11.6 minutes, Ubuntu 13.7, 7.1 and 5.6). After the repairs: all 21 mutations of ci.yml failed the intended case and the five controls passed; the CI-workflow and architecture test files passed 187 of 187, and lint and typecheck passed; the repairs went through `npm run verify` before their commit. No round 4 ran: F1's budget is spent, and the coordinator decides whether the repaired rule needs another read.

## Round outcome

No blocker or major finding. F1 and F4 accepted and repaired in the next commit. F1's repair budget of five is spent: the rule now matches the characters of a bare `--` in any PowerShell block that names npm or npx, and what it cannot see is stated in its comment and in `docs/learning/gate-proofs.md` (an npm the block never names). Round 2's "no further syntactic form" is corrected here.
