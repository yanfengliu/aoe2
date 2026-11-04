# Review 2: implementation

## Target

Repository aoe2, commit `84164dad056b` on branch `worktree-gate-1104`, reviewed as the diff `ac31349f..84164dad`: the repair of [round 1](1_implementation.md)'s findings F1, F2, F6 and F7 in `scripts/ci-status-worktrees.mjs`, `tests/scripts/ciStatusWorktrees.test.ts`, `tests/scripts/helpers/ciStatusHarness.ts`, `docs/learning/gate-proofs.md` and round 1's record.

## Reviewers and coverage

The same lane as rounds 0 and 1, as a focused re-review: Codex, model `gpt-6-astra` at `model_reasoning_effort=xhigh`, codex-cli 0.163.0, `--sandbox read-only --ephemeral`, run from fleet's ignored `tmp/review-runs/aoe2-138-m2-r2/` with `--cd` on the worktree. The prompt gave round 1's findings with their repairs and the repair diff, asked whether each is resolved, and asked it to compare every git call of the check with the harness's allowlist. The log holds no failed sandbox command (the runbook's check printed `keep`), and the worktree's `git status --porcelain` and `git diff HEAD` were the same before and after the run.

## Reports

### Codex (gpt-6-astra, xhigh)

Kept as written, except that each markdown link to an absolute path in the worktree is now plain `file:line` text.

> **F1, F2, F6 and F7 are resolved.** I found no new blocking or non-blocking issues in `ac31349f..84164dad`.
>
> | Finding | Resolution |
> |---|---|
> | **F1** | **Resolved.** The allowlist rejects the path-bearing options and incorrect positional arguments; the fallback rejects child directories. All seven required Git forms remain accepted. In-memory probes passed 120 option-subset/flag variants and rejected 40 escape variants. `ciStatusHarness.ts:116` |
> | **F2** | **Resolved.** The preceding boundary now applies before the optional `refs/heads/` prefix. All 58 sampled cases passed, covering longer names, both reported bypasses, Markdown, sentence-final dots and revision suffixes. `ci-status-worktrees.mjs:222` |
> | **F6** | **Resolved.** The starting directory is checked before enumeration. A read-only probe using the existing Windows junction performed zero directory reads and retained the junction itself for mtime inspection. `ci-status-worktrees.mjs:116` |
> | **F7** | **Resolved.** The claim now explicitly includes the ignored-folder exception inside wholly untracked folders. The separate bound also discloses the suite’s missing junction coverage. `gate-proofs.md:18` |
>
> Outside the diff, I checked `ci-status.mjs:483`: remote failure still takes precedence with exit 1.
>
> Saved evidence contains a passing 24-case baseline and 37 assertion-failing mutations; all four recorded source hashes match this checkout. I did not rerun file-writing suites. Startup `ci:status` returned UNKNOWN because Git rejected reviewer-account ownership.
>
> No files changed; the worktree remains clean at `84164dad`.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F1 | Harness containment | Resolved, by the reviewer's reading and its probes (120 accepted variants, 40 refused). | None. |
| F2 | Name boundary before `refs/heads/` | Resolved (58 sampled cases). | None. |
| F6 | The walk and a link it starts at | Resolved; a probe on a real junction read no folder through it. | None. Not held by a test with a link, as round 1 recorded. |
| F7 | The ignored-folder claim | Resolved. | None. |

No new finding. F0, F3, F4 and F5 stand as rounds 0 and 1 left them; F3's `AGENTS.md` wording goes to the coordinator.

## Verification

The reviewer read the saved evidence (a 24-case green baseline and 37 red mutations, with source hashes that match `84164dad`) and ran read-only probes; it ran no suite that writes files. The full gate on `84164dad` is recorded in the plan's outcome.

## Round outcome

Accepted: every finding of rounds 0 to 2 is resolved, and no material finding remains open. The review covers `c783b710..84164dad`, the check, its tests and its documents; the plan and devlog records written after it are not reviewed.
