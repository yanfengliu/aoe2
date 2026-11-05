# Review 1: implementation

## Target

aoe2, branch `ci-unit-suite-1105` at `e185cbef` against main `b5e7eb1f`: the three commits `807692a4` (the change), `5a56aed9` (the repairs after round 0) and `e185cbef` (plan 143, review round 0, the register entry and its rollover, the gate proofs).

## Reviewers and coverage

Codex `gpt-6-astra` at `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, codex-cli 0.163.0, run from fleet's ignored `tmp/review-runs/aoe2-w143-r1/` with the worktree as `--cd`. The lane check found no failed sandboxed command (`keep`, 0 lines), and the worktree's status was the same before and after. Lens: whether round 0's F0 and F1 are repaired, then the whole change again with the docs, their numbers checked against the saved hosted job logs (`tmp/w143/logs/` in the worktree), since the sandbox had no network. No Claude lane ran.

## Reports

### Codex (gpt-6-astra)

Its report, unchanged except that local absolute paths in its links were shortened to repository paths:

> Reviewed `e185cbef` against `b5e7eb1f`. **No blocker or major finding. F0 is repaired; F1’s original examples are repaired, but one related gap remains.**
>
> 1. **Minor — the PowerShell guard still misses ordinary invocation forms.** [ciJobHeadroom.test.ts:215](tests/scripts/ciJobHeadroom.test.ts:215) misses `& 'npm' run lint -- --max-warnings=0`. It also truncates `npm run lint $(Write-Output --silent) -- --max-warnings=0` at `)`, overlooking the separator afterward. Both mutations passed all exercised checks; PowerShell still removes their bare separator when invoking a script. This contradicts the claim covering every npm/npx command. **Fix:** recognize quoted executable names and balanced arguments, or explicitly reject unsupported forms; retain negative controls. The current suite command is unaffected.
>
> 2. **Nit — the timing model uses the wrong file partition.** [plan.md:46](docs/work/143_ci-unit-suite-time/plan.md:46) describes modeling Vitest’s current split, but the log parser requires a duration and omits the wholly skipped integration file. Consequently, the model partitions **666 files as 222/222/222**, whereas Vitest partitions **667 as 223/223/221**. Including the skipped file changes the modeled three-shard maximum from approximately 13.7 to 13.8 minutes. This does not invalidate the hosted result, but makes the forecast inaccurate. **Fix:** partition the complete file inventory, including skipped files, then attach measured durations and regenerate the model numbers.
>
> 3. **Nit — the workflow’s historical timing range contradicts the evidence.** [ci.yml:61](.github/workflows/ci.yml:61) says every November 5 unsharded Windows run took 38.9–40.2 minutes, including 35.2–36.3 minutes of tests. Run `42000220735` instead took **38.1 / 34.2 minutes**; Ubuntu took **18.3 minutes**, below the comment’s 22.7-minute minimum. The plan records these correctly. **Fix:** identify the narrower sample or update the ranges.
>
> Verification otherwise supported the change:
>
> - Actual Vitest partitioning and the clean hosted logs both cover all **667 files exactly once per OS**, with identical assignments. Outside the diff, [BaseSequencer.shard:3456](node_modules/vitest/dist/chunks/coverage.DfSpMS-b.js:3456) implements this partition.
> - All 15 documented mutations were detected in read-only, in-memory execution; both controls passed.
> - Hosted logs confirm argument delivery on both runners. The npm.ps1 explanation agrees with [PowerShell’s documented separator behavior](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing?view=powershell-7.5#the-end-of-parameters-token).
> - Both thresholds remain unchanged, and hosted red proofs fail the intended shards. [test-time-headroom.mjs:112](scripts/test-time-headroom.mjs:112) rejects zero measured tests.
> - No cross-file state dependency or incompatible job-name/count consumer surfaced. The register rollover is verbatim.
>
> No files changed. No full Vitest/verify run was performed; the session-start CI check returned UNKNOWN. Hosted conclusions above use the saved logs.
## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Round 0's runner binding and unconditional-slice finding. | Confirmed repaired. | None. |
| F1 | Minor, continued: the `--` rule still missed `& 'npm' run lint -- …` and a subexpression before the `--` (`npm run lint $(Write-Output --silent) -- …`), so it did not cover every npm or npx command as it claimed. | Accepted. Parsing PowerShell commands one by one kept leaving forms out. | The rule now reads each logical line (backtick continuations joined) that names `npm` or `npx` anywhere, quoted or in a variable, and fails a bare `--` anywhere on it. A bare `--` on such a line that belongs to another command fails too and is quoted the same way: the cost of the broader net. Both of the round's mutations are red now, with the earlier 15, and the quoted controls stay green. |
| F2 | Nit: the timing model partitioned 666 files (222/222/222), because the log parser dropped the wholly skipped file, where vitest splits 667 (223/223/221). | Accepted. | The parser keeps a skipped file at 0 ms. On 667 files the model gives 223/223/221, as the hosted run did, and its three-shard slowest shard is 13.8 minutes, not 13.7; plan 143's table is regenerated. The bound is unchanged at 2.5x and 1.7x. |
| F3 | Nit: ci.yml said every unsharded Windows run of 2026-11-05 took 38.9-40.2 minutes (35.2-36.3 of tests) and Ubuntu 22.7-30.0, but run 42000220735 took 38.1/34.2 and Ubuntu 18.3. | Accepted; the range was of the first four runs read. | All nine unsharded runs of 2026-11-05 are now read from their logs: Windows 30.1-40.2 minutes (unit step 27.5-36.6), Ubuntu 18.3-30.0; two runs went red (41990047794 at 40.2, 42004237120 at 40.1). ci.yml, plan 143 and the register entry say so. |

## Verification

On the reviewed revision, before the repairs: `npm run verify` on a clean checkout of `e185cbef` exited 0 and certified its receipt (tree `7fe13b751167`). After the repairs: all 17 mutations of ci.yml failed the intended case and the three controls passed (`tmp/w143/split-red-proof.mjs` in the worktree); the CI-workflow and architecture test files passed 187 of 187; lint and typecheck passed. The regenerated model gives the hosted run's split, 223, 223 and 221 files. The repairs are reviewed in round 2.

## Round outcome

No blocker or major finding. F0 confirmed; F1, F2 and F3 accepted and repaired in the next commit, which round 2 reviews.
