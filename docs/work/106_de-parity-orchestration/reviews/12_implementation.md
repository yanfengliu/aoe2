# Review 12: the engine guard accepts a worktree's link to its primary checkout's install (round 1)

## Target

aoe2 commit 36871822 on branch `guard-junction-1111`, reviewed as `git diff eb59353d 36871822`: review 11's target with its repairs, in `scripts/check-engine.mjs`, `tests/scripts/engineInstall.test.ts` and one assertion of `tests/civEngineInternalHelpers.test.ts`.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, read-only sandbox (codex-cli 0.163.0), the runbook's command from a run folder in the primary checkout's ignored `tmp/review-runs/guard-junction-r1/`, with the worktree as `--cd`. The worktree's `git status --porcelain` and `git diff HEAD` were the same before and after, and the runbook's check of the log found no failed sandbox command.
- One lane. The prompt listed review 11's six findings with the repair each claimed, and asked whether each is closed, whether the repairs open a new bypass class or refuse a correct install, whether npm's hidden lockfile supports the claim made of it, whether the tests are falsifiable and portable to a Linux runner, and whether the internal-helpers assertion is as strong as before in a physical checkout.
- The reviewer read outside the diff: `README.md`, `scripts/controlWorktree.mjs` and `tests/scripts/runDirectly.test.ts`. It measured one git call at 77-114 ms, checked spaces, locked, detached and prunable entries against the parser, and ran the guard on the primary with git absent.

## Reports

### Codex (`gpt-6-astra`)

Verdict: approve with minor findings. No blocker or major finding. Review 11's findings 1 to 5 are closed, finding 4 "within the npm-managed-install contract", and finding 6 partly. Four new points, redacted only of absolute paths:

1. Minor: `detach` treated any `lstat` failure as the link being gone, so an unlink that failed followed by an `lstat` that failed for another reason left the fixture listed for recursive deletion. Only "no such file" should show absence.
2. Minor: a git failure was discarded, so a correct worktree with git missing or refused by `safe.directory` got the same message as a link that is not allowed. Refusing is right; the diagnostic should survive.
3. Note: npm's hidden lockfile shows what npm recorded, not the bytes now on disk. An engine replaced by hand under an old record passes, and a stale record refuses correct files. That is inside the existing contract, in which npm checks bytes and the guard checks location and version (`README.md`), and should not be described as a check of installed bytes.
4. Note: the same-version case changed the address and the integrity together, so removing either comparison alone left it green.

## Findings and disposition

1. FINDING-1 (minor), repaired in 97251114: `detach` counts a link as gone only on `ENOENT`. Not tested by a case of its own: the reviewer reproduced the flaw with filesystem doubles, and the repair is one comparison.
2. FINDING-2 (minor), repaired in 97251114: the refusal carries the first line of what git said. A new case runs the guard with no git on the path and reads it.
3. FINDING-3 (note), answered in 97251114: the comment beside the comparison says it is a record, not a second check of the installed bytes, which `npm ci` makes when it installs. The refusal already says "by npm's record of what it installed".
4. FINDING-4 (note), repaired in 97251114: the case is two, another archive by its address alone and by its integrity alone, and two mutants remove one comparison each.

## Verification

- `npx vitest run tests/scripts/engineInstall.test.ts tests/scripts/runDirectly.test.ts tests/civEngineInternalHelpers.test.ts`: 48 passed on 97251114.
- Thirteen mutants of the guard, each red at its own case and restored byte for byte: the target not compared; a checkout git does not list; a bare primary; `GIT_DIR` left in the environment; the shared engine's physical check skipped; npm's record skipped; the record compared without the address, and without the integrity; git's diagnostic dropped; the old advice kept wherever there is a link; the worktree advice given with no primary; every link refused; and `node_modules` checked before the three files are read.
- `npm run verify` on 97251114 exited 0, with the receipt accepted on its tree: vitest 5,533 passed and 3 skipped, Playwright 345 passed and 2 skipped.
- These repairs were not reviewed again: all four points were minor or notes.

## Round outcome

Approve with minor findings, all four addressed. No further round.
