# Review 1: implementation

## Target

Repository aoe2, commit `ac31349f5fc28c08604218b042380c818dd86ef8` on branch `worktree-gate-1104`, reviewed as the diff `bfa78d28..ac31349f`: the repair of [round 0](0_implementation.md)'s findings F0 to F5 in `scripts/ci-status-worktrees.mjs`, `tests/scripts/ciStatusWorktrees.test.ts`, `tests/scripts/helpers/ciStatusHarness.ts`, `tests/scripts/helpers/worktreeSandbox.ts`, `docs/learning/gate-proofs.md`, `docs/policies/rules/worktrees.md` and round 0's record.

## Reviewers and coverage

The same lane as round 0, as a focused re-review: Codex, model `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.163.0, `--sandbox read-only --ephemeral`, run from fleet's ignored `tmp/review-runs/aoe2-138-m2-r1/` with `--cd` on the worktree. The prompt gave round 0's findings with their dispositions and the repair diff, asked whether each finding is resolved, and asked for anything the repair broke. The log holds no failed sandbox command (the runbook's check printed `keep`), and the worktree's `git status --porcelain` and `git diff HEAD` were the same before and after the run.

## Reports

### Codex (gpt-6-astra, xhigh)

Kept as written, except that each markdown link to an absolute path in the worktree is now plain `file:line` text.

> Changes requested: **F1 and F2 remain blocking.** I also found two non-blocking limitations.
>
> 1. **Blocking — the harness still permits reads outside its sandbox.** `ciStatusHarness.ts:114` accepts `rev-parse --resolve-git-dir <outside>/.git` and `ls-files --exclude-from=<outside-file>`. Both reached a recording executor; a separate read-only Git call confirmed resolution of the external repository. Validate path-bearing options, not just subcommand names. Additionally, line 131 lets the non-sandbox fallback answer for `<harness-checkout>/wrong-child`, contradicting its exact-form claim. This leaves the original containment/refusal requirement unmet.
>
> 2. **Blocking — the `refs/heads/` exception bypasses the preceding boundary.** `ci-status-worktrees.mjs:214` treats both `other/refs/heads/retained/x` and `otherrefs/heads/retained/x` as naming `retained/x`. Git accepts both longer branch names. Source-based probes reproduced the false attribution, which still hides unnamed retained branches. Require a boundary before the optional `refs/heads/` prefix.
>
> 3. **Non-blocking — the walker follows its starting directory when that directory is a junction.** `ci-status-worktrees.mjs:119` checks links only among children. Windows Git can list an unignored junction as `dir/`; the walker then enters its target. A read-only probe confirmed this using the existing junction. Check the starting directory before reading it. This contradicts the review record’s “without entering a link” claim, but introduces no observed write; the ordinary ignored `node_modules` remains excluded.
>
> 4. **Non-blocking — the ignored-file claim exceeds the tested behavior.** `gate-proofs.md:18` says creating a file inside an ignored folder does not count as activity. Inside wholly untracked `scratch/`, creating `scratch/tmp/new.log` refreshes `scratch/tmp`, which the new walker reads. An in-memory execution classified that otherwise idle worktree as active. Document the exception already acknowledged in the source header. This is an evidence-description defect; the implementation explicitly chooses this conservative behavior.
>
> | Original finding | Resolution |
> |---|---|
> | **F0** | **Resolved for both deletion cases.** The new walker has the separate junction limitation above. |
> | **F1** | **Not fully resolved.** Original redirect forms are refused, but the remaining bypasses above persist. |
> | **F2** | **Not fully resolved.** Original examples are fixed; the prefix exception creates another false attribution. |
> | **F3** | **Partially resolved, non-blocking.** The worktree rule correctly states precedence. Generated `AGENTS.md:62` remains deferred to the coordinator. |
> | **F4** | **Resolved.** Every listed file is now hashed. |
> | **F5** | **Resolved.** The primary evidence folder exists; copied driver/reports match, and recorded source hashes match this revision. |
>
> Outside the diff, I checked `ci-status.mjs:483`: remote failure correctly retains exit 1.
>
> All seven required Git command forms remain accepted. Backticks, parentheses, lists, table cells, sentence-final dots and `refs/heads/retained/x~1` work. The sampled walk visited 1,099 directories and 11,448 entries in 86 ms; no performance cliff appeared within that bound.
>
> I did not rerun file-writing suites. Saved reports contain 33 assertion-failing mutations, including the separate rerun. Startup `ci:status` was unavailable because Git rejected reviewer-account ownership. No files changed; HEAD remains `ac31349f`.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F1 | Codex 1: path-bearing options of the allowed read-only subcommands (`rev-parse --resolve-git-dir`, `ls-files --exclude-from`) still reach outside the sandbox, and the fallback answers a folder inside the harness checkout | Accepted, blocking. Second failure for one reason, so the approach changed: a deny-list of redirecting options cannot be complete, because any read-only subcommand may take a path. | The harness now allows, per subcommand, only the options the check itself passes (any of them, so a mutant that drops one still runs) and positional arguments of the check's own shapes: none for `ls-files`, `rev-parse` and `status`, a commit id and `refs/heads/main` for `merge-base`, `refs/heads/retained/` for `for-each-ref`, and `list` for `worktree`. The fallback answers its checkout only, not a folder inside it. The harness case gains a pathspec, both path-bearing options, a wrong `merge-base` ref, a wider `for-each-ref` and the child folder. |
| F2 | Codex 2: the `refs/heads/` exception skips the boundary, so `other/refs/heads/retained/x` names `retained/x` | Accepted, blocking. Second failure for one reason: round 0's repair put `refs/heads/` beside the edge instead of after it. | The edge now comes first and `refs/heads/` is an optional part of the name: `(?:^|(?<=EDGE))(?:refs/heads/)?name`. The retained case gains `retained/prefixed-1104`, named only as `other/refs/heads/...` and `otherrefs/heads/...`, which must stay unnamed. |
| F6 | Codex 3: the walk enters its starting folder when that folder is a junction | Accepted, non-blocking: reads only, but it breaks the "without entering a link" claim. | `subfolders` reads the starting folder's own mtime and does not descend when it is a link. Not exercised with a link, because a sandbox never holds one; stated as a bound. |
| F7 | Codex 4: the gate proof says a new file in an ignored folder never counts, but one inside a wholly untracked folder does | Accepted, non-blocking. The behaviour is deliberate and errs toward activity. | The gate-proof entry states the exception. |

F0, F4 and F5 are resolved by Codex's own reading. F3 stays as round 0 left it: `AGENTS.md` is generated, so its wording goes to the coordinator.

## Verification

On the repaired tree: `npx vitest run tests/scripts`, 16 files and 168 tests passed; `npx tsc --noEmit` and `npx eslint tests/scripts` exited 0; the new file passed 24 of 24, and 37 mutations each turned it red, among them round 1's boundary, `refs/heads/` without its edge, the harness allowing any option or any argument, and the fallback answering a folder inside its checkout. Every mutant was restored byte-identical. A prose check of the boundary passed 26 of 26 cases, among them `other/refs/heads/retained/x` and `otherrefs/heads/retained/x` (not named) and `` `refs/heads/retained/x~1` ``, a table cell and a list item (named).

## Round outcome

Changes requested: two blocking findings (F1 and F2, each a second failure) and two non-blocking ones (F6 and F7), all accepted and repaired. A focused re-review of the second repair is round 2.
