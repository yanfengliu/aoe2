# Review 0: implementation

## Target

aoe2, branch `ci-unit-suite-1105`, commit `807692a4` ("Work 143: the unit suite runs in three shards per runner") against its parent `b5e7eb1f`: `.github/workflows/ci.yml`, `scripts/ci-job-headroom.mjs`, `scripts/test-time-headroom.mjs`, `tests/scripts/ciJobHeadroom.test.ts`, `tests/scripts/testTimeHeadroom.test.ts` and `vitest.config.ts`. Code only; plan 143 and the register entry were not yet written.

## Reviewers and coverage

Codex `gpt-6-astra` at `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, codex-cli 0.163.0, run from fleet's ignored `tmp/review-runs/aoe2-w143-r0/` with the worktree as `--cd`. The lane check found no failed sandboxed command (`keep`, 0 lines). The worktree's `git status --porcelain` and `git diff HEAD` were the same before and after the run. Lens: the whole diff, with eight asks (the partition, the argument reaching vitest on both runners, both headroom gates per shard, vacuous tests, cross-file test dependencies, consumers of job names and counts, anything else). The reviewer had no network, so it did not read the hosted runs. No Claude lane ran this round.

## Reports

### Codex (gpt-6-astra)

Its report, unchanged except that local absolute paths in its links were shortened to repository paths:

> Reviewed `807692a4` against `b5e7eb1f`. **No blocker or major defect found in the current workflow. Two minor regression-test gaps:**
>
> 1. **Minor — coverage assertions do not enforce execution on both runners and every shard.** [ciJobHeadroom.test.ts:178](tests/scripts/ciJobHeadroom.test.ts:178) checks the matrix declarations but never binds `runs-on` to `matrix.os` or checks whether the suite is conditionally skipped. In-memory mutations changing `runs-on` to `ubuntu-latest`, or adding `if: ${{ matrix.shard != 2 }}` to the suite, both left all 13 exercised cases passing. These respectively remove Windows coverage and omit a complete slice; the latter also skips its per-test headroom check. **Fix:** assert the runner binding and unconditional suite participation, with negative controls for both mutations.
>
> 2. **Minor — the PowerShell guard misses ordinary command forms.** [ciJobHeadroom.test.ts:215](tests/scripts/ciJobHeadroom.test.ts:215) examines physical lines beginning with `npm` or `npx`. Both `& npm run typecheck -- --pretty=false` and a backtick continuation placing `--` on the following line escape detection. I reproduced both false negatives; a same-line bare separator correctly failed. **Fix:** handle logical command continuations and invocation operators, or explicitly reject unsupported command forms, and add regression controls.
>
> The implementation checks otherwise held:
>
> - **Complete partition:** the actual Vitest `BaseSequencer` assigned the current 667 files as **223/223/221**, with zero omissions or duplicates and identical assignments under Linux- and Windows-style roots. Outside the diff, [coverage.DfSpMS-b.js:3456](node_modules/vitest/dist/chunks/coverage.DfSpMS-b.js:3456) implements the partition; line 3401 applies it before sorting.
> - **Arguments:** quoted `'--'` survives Bash and the available PowerShell 5.1 shim reproduction. The reasoning also matches [PowerShell 7’s documented parsing](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_parsing?view=powershell-7.5#the-end-of-parameters-token) and [npm 10.8.2’s shim](https://github.com/npm/cli/blob/v10.8.2/bin/npm.ps1). PowerShell 7 was unavailable locally.
> - **Headroom:** limits and thresholds are unchanged. Each shard starts its clock first, judges its own report, and checks job headroom last. [test-time-headroom.mjs:112](scripts/test-time-headroom.mjs:112) rejects zero measured tests.
> - **Dependencies and consumers:** no cross-file producer/consumer dependency was found in the filesystem and import audit. Report tests use separate temporary fixtures. CI status processes jobs dynamically, without matching old names or requiring a fixed count; see [ci-status-attempts.mjs:78](scripts/ci-status-attempts.mjs:78).
>
> Verification was read-only: 13 existing cases exercised through an in-memory harness, partition checks, shell argument probes, and source inspection. No full Vitest run; hosted CI could not be queried because network access was denied. No files changed.
## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Minor: the split checks never bind `runs-on` to `matrix.os`, and a condition on the suite step (`if: ${{ matrix.shard != 2 }}`) passes them while skipping a slice and its per-test check. | Accepted: both drop a runner or a slice while the matrix still reads whole. | `ciJobHeadroom.test.ts` now holds `runs-on: ${{ matrix.os }}` and refuses an `if` or `continue-on-error` on the job or the suite step; four mutations (runs-on, job condition, step condition, continue-on-error) each red. |
| F1 | Minor: the PowerShell `--` rule read only physical lines starting with `npm` or `npx`, so `& npm run typecheck -- --pretty=false` and a backtick continuation escaped it. | Accepted: the rule claimed every npm or npx command. | The rule now joins backtick continuations and reads a command that starts a line or follows `;`, `|`, `&&`, `(`, `$(`, `{` or `&`; three mutations (call operator, continuation, subexpression) each red, a quoted `'--'` after `&` green; its doc comment names what it still does not read (a command built in a string for Invoke-Expression). |

## Verification

After the repairs: the five CI-workflow test files passed 39 of 39; the 15 mutations of ci.yml each failed the intended case and the two controls passed (`docs/learning/gate-proofs.md`); lint and typecheck passed. Hosted runs 42008973265 (clean) and 42009011415 (red proof), read after this round, are in plan 143. The repairs are commit `5a56aed9`, reviewed again in round 1.

## Round outcome

No blocker or major finding. Both minor findings were accepted and repaired; the repaired revision goes to round 1.
