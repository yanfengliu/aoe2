# Review 1: implementation

## Target

Repository aoe2, work 124 M2: the fixes made after review 0, on branch `verify-receipt-m2` at `abe43202`, rebased onto main `83b6ffa3`. In order: `179a3cba` (`check` prints the suites' counts, and package.json is held to the evidence's command lines), `d207fce7` (review 0's findings on the evidence), and `abe43202` (the gate proof, the register, the devlog, review 0 and the plan). The rebase took main's register and redid the rollover, inside the first commit.

## Reviewers and coverage

- **One focused, independent read-only reviewer,** dispatched by the coordinator as `r124m2-review`, read the worktree while the implementer kept the branch unchanged.
- **Coverage:** every review-0 repair, against the code, the cases and the docs that state them, and branch CI run 38667679929 on `abe43202`.
- **Relayed:** the report reached the implementer through the coordinator, condensed; no raw output is kept here.

## Reports

### Coordinator-dispatched reviewer (read-only)

Its verdict, as relayed: no blocking findings. Every round-0 repair is correct or honestly bounded, and branch CI 38667679929 is confirmed green.

- **Should-fix 1 (docs):** the 2026-10-11 register heading said "FIXED and gated by work 124, M1 and M2", while its own root cause defines the class as a pass recorded for a run that did not finish. content:validate, typecheck, lint and build ended from outside still pass, and a cut build could leave a stale bundle the browser report vouches for. The heading should name the bound, with the body consistent.
- **Nit 1:** the Playwright half of the `.only` case was a text regex that a commented-out or nested `forbidOnly: true` would satisfy. Assert the loaded config's top-level value, proved red by mutation.
- **Nit 2:** the census matched only `from './run-directly.mjs'` in single quotes, and the junction sandbox copied only top-level `.mjs` files. Widen it to any import of the helper, in either quote and by any relative path, across `scripts/` at any depth, or state it as the bound.
- **Nit 3 (optional):** if `start` removing `dist/` takes a few lines and a red case, do it, to close the stale-bundle window; otherwise leave the bound. Leave the idea of reporters copying `startedAt` as a stated bound.
- **Nit 4:** cite run 38667679929 (ubuntu) in `gate-proofs.md` as the evidence for the symlink claim.
- **For the landing:** its run will give the first certified format-2 receipt. Check that `check`'s Playwright passed and skipped counts equal the log's summary, and record both in the plan's Outcome.

## Findings and disposition

| ID | Finding | Disposition | Evidence |
| --- | --- | --- | --- |
| S1 | The register heading claimed more than the fix covers. | Accepted. | The heading now reads "FIXED and gated by work 124 M1 and M2 for a cut chain and both test suites, with a cut content:validate, typecheck, lint or build a stated bound", and the root cause says the same. |
| N1 | The Playwright `.only` check read text. | Accepted. | The case imports `playwright.config.ts` and asserts `forbidOnly` is `true`. Mutant N1 moved the flag into the `use` block: green against the old regex, red against the new case (`expected undefined to be true`). |
| N2 | The census saw one spelling of the import. | Accepted, widened. | `USES_HELPER` matches a static or dynamic import in either quote by any relative path, across `scripts/` at any depth, and the sandbox copies the whole scripts tree. Mutant N2, a new script importing the helper in double quotes, was green before and red after (the users list grows to five). |
| N3 | The stale-bundle window. | Accepted, closed. | `start` removes `dist/`. Its case was red first (`the last bundle: expected true to be false`), and mutant N3 (`start` keeps the bundle) is red. A recursive `rmSync` on a junction was checked to remove only the link. That a missing `dist/` fails the browser suite rests on Vite 6.4.3's own check, read in its source and not run. |
| N4 | The symlink claim lacked its evidence. | Accepted. | `gate-proofs.md` cites run 38667679929's ubuntu-latest unit job. |
| L1 | The landing's counts. | To be done at the landing. | The plan's Outcome records `check`'s counts beside the log's two summaries. |

## Verification

The three files hold 34 cases and pass. Mutants N1, N2 and N3 are red, as are E9, M1, P3, P4 and G1 to G6, which round 1 touched; every file was restored byte-identical. The architecture suite passes on the docs. The landing reruns the full gate under the lock.

## Round outcome

The round found nothing blocking. Its should-fix and four nits are done, and the landing item goes to the plan's Outcome. The changes from this round were not reviewed again.
