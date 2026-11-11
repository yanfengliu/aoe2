# Review 11: the engine guard accepts a worktree's link to its primary checkout's install (round 0)

## Target

aoe2 commit 8f987c7b on branch `guard-junction-1111`, reviewed as `git diff eb59353d 8f987c7b`, with eb59353d main at the time: `scripts/check-engine.mjs` and `tests/scripts/engineInstall.test.ts`. The change is the owner's decision of 2026-11-11 ("Accept the shared link"): the guard accepts a linked git worktree's `node_modules` that resolves to its primary checkout's `node_modules`, and checks the primary's install against the worktree's own pin, manifest and lock. The card is this plan's "The shared install must follow each engine pin".

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command (`../fleet/docs/skills/multi-cli-review.md`) from a run folder in the primary checkout's ignored `tmp/review-runs/guard-junction-r0/`, with the worktree as `--cd`. The worktree's `git status --porcelain` and `git diff HEAD` were the same before and after, and the runbook's check of the log found no failed sandbox command.
- One lane. The prompt named six criteria: what the guard still refuses and any bypass class; git's worktree records on Windows and POSIX; that the worktree's own pin is what is compared; whether the tests are real, falsifiable and safe to clean up; the recovery advice; and anything else in the tree the change contradicts.
- The reviewer read outside the diff: `tests/scripts/runDirectly.test.ts`, `scripts/controlWorktree.mjs`, `docs/policies/rules/worktrees.md`, the hooks, the workflows and the README.

## Reports

### Codex (`gpt-6-astra`)

Verdict: request changes. Six findings, redacted only of absolute paths:

1. Blocker: `check-engine.mjs` looked at `node_modules` before reading the pin, manifest and lock, so `tests/scripts/runDirectly.test.ts`'s `check-engine.mjs` probe, whose fixture holds neither, got an `lstat` error where it asserts a missing-JSON one. Fails on Windows and Linux.
2. Major, a bypass class: the primary was read from the worktree's `.git` file, `commondir` and the back-pointer, with nothing checking that the administrative directory lies in the primary's `worktrees/`, that the back-pointer names exactly `.git`, or that the primary is not bare. A hand-made administrative directory inside the checkout was accepted though the primary never registered it, and a bare repository at `P/.git` made `P` a primary checkout. `scripts/controlWorktree.mjs` uses git's listing and refuses a bare repository.
3. Major: the advice depended on finding a primary, not on finding a link, so a linked `node_modules` whose primary could not be established was still told to run `npm ci` in place.
4. Major, a bypass class: the shared package was checked by location and version only, so a worktree that consistently pins another archive of the same version accepted the primary's archive. The new pin test changed only the version.
5. Note: ordinary absolute and relative pointers, a worktree made from a worktree, and submodule layouts behaved correctly, but "fails closed on anything unexpected" was disproved by finding 2.
6. Note: the tests are substantive and portable, but the cleanup swallowed every unlink failure, so a fixture could be deleted recursively with its link still in place.

## Findings and disposition

1. FINDING-1 (blocker), repaired in 36871822: the three files are read first again. The first full gate on 8f987c7b had failed on the same case, and on `tests/civEngineInternalHelpers.test.ts`, which compared the guard's package root with the checkout's own `node_modules/civ-engine`; it now compares with that path's realpath.
2. FINDING-2 (major), repaired in 36871822: `primaryCheckoutOf` asks `git worktree list --porcelain` in the checkout, with `GIT_DIR`, `GIT_WORK_TREE`, `GIT_COMMON_DIR` and `GIT_INDEX_FILE` taken out of the environment. The first entry must not be bare, and the checkout must be one of the later entries. New cases: a directory with a copied `.git` pointer, a hand-made record beside a real worktree, a worktree of a bare repository, and a `GIT_DIR` that names another repository.
3. FINDING-3 (major), repaired in 36871822: wherever `node_modules` is a link the advice is never to run `npm ci` there, with the primary named when it is known. Every refusal case asserts that the old advice is absent.
4. FINDING-4 (major), repaired in 36871822: in a shared install, npm's own record of what it installed (`node_modules/.package-lock.json`) must match the worktree's pin in address, integrity and version. New cases: another version, another archive of the same version, and an install with no record.
5. FINDING-5 (note), answered by finding 2's repair: git's own listing decides.
6. FINDING-6 (note), repaired in 36871822: `detach` takes the fixture off the list of directories to delete recursively and fails the test when a link will not come away.

## Verification

- `npx vitest run tests/scripts/engineInstall.test.ts tests/scripts/runDirectly.test.ts tests/civEngineInternalHelpers.test.ts`: 46 passed on 36871822.
- Ten mutants of the guard, each red at its own case and restored byte for byte.
- `npm run verify` on 36871822 exited 0, with the receipt accepted on its tree: vitest 5,531 passed and 3 skipped, Playwright 345 passed and 2 skipped. It was the first full gate to run in a `controlWorktree` worktree since the pin.
- The repairs went to a second round (review 12).

## Round outcome

Request changes: one blocker and three major findings, all repaired, with two notes answered. A second round followed on the repairs.
