# Review 0: implementation

## Target

Repository aoe2, commit `bfa78d28e943c15499f2f25618736fac516ca01e` on branch `worktree-gate-1104`, reviewed as the diff `c783b710..bfa78d28` (main was `c783b710`). Work 138 M2b, the leftover-worktree check in `npm run ci:status`: `scripts/ci-status-worktrees.mjs` (new), `scripts/ci-status.mjs`, `tests/scripts/ciStatusWorktrees.test.ts` (new), `tests/scripts/helpers/worktreeSandbox.ts` (new), `tests/scripts/helpers/ciStatusHarness.ts`, `docs/learning/gate-proofs.md`, `docs/learning/lessons.md`, `docs/learning/lessons-evidence.md`, `docs/learning/defect-register.md` and `docs/policies/rules/worktrees.md`.

## Reviewers and coverage

One lane: Codex, model `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.163.0, `--sandbox read-only --ephemeral`, run from fleet's ignored `tmp/review-runs/aoe2-138-m2-r0/` with `--cd` on the worktree. The prompt held the coordinator's contract, six lenses (correctness, writes, Windows paths, the harness's refusal property, test isolation and flakiness, documentation accuracy) and the diff, and told the reviewer not to delegate. The lane's log holds no failed sandbox command (the runbook's check printed `keep`), and the worktree's `git status --porcelain` and `git diff HEAD` were the same before and after the run. Inside its sandbox, `npm run ci:status` could not reach GitHub, and git refused the peer's worktree as dubious ownership, which the check reported as UNKNOWN. No Claude lane ran: the brief prefers Codex, and a `claude -p` lane can write.

## Reports

### Codex (gpt-6-astra, xhigh)

Kept as written, except that each markdown link to an absolute path in the worktree is now plain `file:line` text.

> Changes requested: **three blocking findings** and three non-blocking documentation issues.
>
> 1. **Blocking — recent activity can produce a false leftover.** `ci-status-worktrees.mjs:107` derives folders solely from files still returned by `ls-files`. Delete the last untracked file inside an existing nested folder: that folder’s fresh mtime is never inspected. An otherwise idle checkout is then reported as `LEFTOVER`, despite recent non-ignored activity. An in-memory reproduction confirmed this. Include empty, non-ignored folders in activity detection and add this deletion case.
>
> 2. **Blocking — the harness permits Git to escape its sandbox.** `ciStatusHarness.ts:112` checks only the first `-C` directory, then forwards arbitrary remaining arguments. Both `-C <inside> -C <outside> …` and `-C <inside> --git-dir=<outside> …` pass. Containment is also lexical, so junction targets are unchecked. A recording stub confirmed dispatch without executing these commands. The non-sandbox fallback additionally accepts invalid arguments at lines 118–121. Validate complete permitted command forms and resolved repository paths. The unchanged refusal tests at `ciStatus.test.ts:228`, outside the diff, do not cover these bypasses.
>
> 3. **Blocking — retained branches can be falsely attributed to an open plan.** `ci-status-worktrees.mjs:182` lacks a preceding boundary and recognizes too few branch-name characters at the trailing boundary. A plan mentioning only `other/retained/foo` or `retained/foo+next` incorrectly claims `retained/foo`. Both are valid Git branch names; both cases reproduced. This defeats the required reporting of branches with no named plan.
>
> 4. **Non-blocking — exit-code documentation is incomplete.** `worktrees.md:18` promises exit 2 without qualifying that remote failure takes precedence. `AGENTS.md:62`, unchanged and outside the diff, still explains only remote failures. Document 1 versus 2 explicitly. The implementation’s precedence is correct, so this is an instruction defect.
>
> 5. **Non-blocking — byte-preservation evidence is overstated.** `gate-proofs.md:18` claims unchanged file and reflog bytes. `worktreeSandbox.ts:168` compares sizes and mtimes, hashing only the index. Hash the other files or narrow the claim. This is an evidence limitation, not an observed production write.
>
> 6. **Non-blocking — the mutation evidence pointer is wrong.** `gate-proofs.md:22` points to the primary checkout’s `tmp/worktree-retirement-20261104/m2b/`, which is absent. The evidence exists in this worktree’s `tmp/m2b/`. Correct its location and preserve it before retiring this worktree.
>
> Verification: read-only probes confirmed the findings and all six green/red × active/leftover/unknown exit combinations. Saved mutation reports show 21/21 failures with detection removed; their recorded script/test hashes match this revision. I did not rerun file-writing suites. Live GitHub verification was blocked by network restrictions. No files were changed.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F0 | Codex 1: a deletion that leaves an empty folder is unseen, so a worktree in use can read as a leftover | Accepted, blocking. Reproduced: `git ls-files --others --directory` lists an empty folder inside a tracked one, but collapses a wholly untracked folder to its top, so an empty folder inside one is not listed either. | `lastActivity` adds the folders `--directory` lists and walks each wholly untracked one on disk without entering a link; an ignored folder inside one is read too, which errs toward activity. New cases: a deletion that empties a folder, and one inside a wholly untracked folder. |
| F1 | Codex 2: the harness's sandbox containment checks only the first `-C`, lexically, and the fallback answers loose forms | Accepted, blocking. The check never issues those forms, but the harness exists to refuse what is not scripted, and a mutant could have run git outside the sandbox. | In a sandbox the harness allows only `worktree list` and the read-only subcommands `ls-files`, `rev-parse`, `status`, `merge-base` and `for-each-ref`, refuses `-C`, `-c`, `--git-dir`, `--work-tree` and the other redirecting options after the first `-C`, and compares paths by real path. Without a sandbox it answers only the check's two exact forms. New case: the harness refuses seven escaping or writing forms in a sandbox, and four forms without one. Containment by real path is not exercised with a link, because a sandbox never holds one. |
| F2 | Codex 3: a plan naming `other/retained/foo` or `retained/foo+next` is read as naming `retained/foo` | Accepted, blocking: it hides a branch that no open plan names. | A name now counts only as a whole word: before it a start, whitespace, markdown or sentence punctuation, or `refs/heads/`; after it an end, the same, or a dot that ends a sentence. The retained case gains `retained/plus-1104`, `retained/nested-1104` (both unnamed) and `retained/ref-1104` (named as `refs/heads/retained/ref-1104`). |
| F3 | Codex 4: the docs do not say that a red remote gate's exit 1 comes before exit 2 | Accepted. | `docs/policies/rules/worktrees.md` now says so. `AGENTS.md` is generated by the fleet's sync script, so its session-start wording goes to the coordinator as a proposal. |
| F4 | Codex 5: the read-only case claims unchanged bytes but hashes only the index | Accepted. | The sandbox's `stamps` hashes every file it lists; the gate-proof entry states what is compared. |
| F5 | Codex 6: the mutation evidence pointer names a folder that did not exist yet | Accepted. | The driver and its reports are copied to the primary's `tmp/worktree-retirement-20261104/m2b/` before this worktree is removed, after the final mutation run. |

## Verification

The repairs were checked on the repaired tree: `npx vitest run tests/scripts`, 16 files and 168 tests passed; `npx tsc --noEmit` and `npx eslint tests/scripts` exited 0; the new file passed 24 of 24, and 33 mutations each turned it red in the cases that hold that part, among them the empty folders not read, a wholly untracked folder not walked, six faults in the name boundary including this revision's boundary, and two faults in the harness. Every mutant was restored byte-identical. Codex's own probes are its report's.

## Round outcome

Changes requested: three blocking findings and three non-blocking ones, all accepted and repaired. A focused re-review of the repair is round 1.
