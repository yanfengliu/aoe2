# Review 0: implementation

## Target

Repository aoe2, work 124 M2 on branch `verify-receipt-m2`: `45bdc118..a94180d6`, three commits (the checkpoint `e11c7cfc`, then `058648d1` and `a94180d6`). That is the suites' evidence in `scripts/verify-receipt-evidence.mjs` and the receipt's format 2, `scripts/run-directly.mjs` and its four callers, their tests, and the drafted docs. M1's two review rounds are recorded in its devlog entry (`docs/devlog/detailed/2026-09-29_2026-10-12.md`), not in this folder; this is the folder's first review file.

## Reviewers and coverage

- **One independent read-only reviewer**, a Claude subagent dispatched by the implementer, with the worktree and git. It ran nothing: no Vitest, Playwright, tsc, eslint, mutation or cut.
- **The worktree moved under it.** The implementer rebased onto `83b6ffa3` while it read, so it checked blob hashes against `a94180d6` and reports on that revision.
- **Not covered:** whether the tests pass, lint and typecheck, or how long they take on CI's windows-latest runner; `defectRegisterRollover.test.ts`; a full Playwright report's argv on disk; the register's measured claims; and the devlog, architecture and changelog, none of which the diff touched yet.

## Reports

### Claude subagent (read-only)

Its verdict, condensed: do not land `a94180d6` as it stands. The code does what M2 claims, and no false red was found in the current setup. But the docs cite proof that is not in the tree, two false greens fall outside the stated bounds, and several rules could be mutated away with every test still green.

- **Blocker B1:** `gate-proofs.md` had no M2 entry, while the M1 entry, the retired lesson, the register heading ("FIXED and gated", "Mutations of every rule went red"), and two test headers pointed at one.
- **Should-fix:** S1, wrong counts in the register (7 evidence cases, 5 run-directly cases, "four gate scripts"). S2, five evidence rules removable with every case green: a report with no valid `writtenAt`, the status rule tested only with "interrupted", "failed" missing from the failed states, the argv length check, the window's upper bound. S3, a committed `.only` narrows Playwright's whole run (no `forbidOnly`) and still reports "passed" with the full suite's arguments. S4, a `vite build` ended before it writes leaves the last bundle, which the browser suite then tests and its report vouches for. S5, the register rollover was stale against main, which had already moved the same entry. S6, only a hand-made fixture held the contract between the reporters and `write`, and nothing tied the evidence's command lines to package.json.
- **Nits:** N1, a Playwright `test.fail()` failing as expected would refuse the run. N2, the bound on another run's report is exactly what a cut can leave behind (an orphaned suite). N3, `run-directly.mjs` fell back to the path as typed if the native realpath throws. N4, a refused start record did not name the field, and "let every stage finish" was the wrong advice for some reasons.
- **Checked and fine:** real full Vitest reports carry argv `["run"]`; Vitest 3.2.6 says "passed" without counting unhandled errors, so that check is needed; skipped, todo and flaky tests are handled; nothing in the chain starts a filtered run in the root; one clock gives both ends of the window; the sandboxes cannot reach the checkout; format-1 receipts and M1 start records are refused; run-directly works through junctions, symlinks, a different letter case and tsx; the junction cleanup never deletes through the link; the new tests run in both CI unit jobs.

## Findings and disposition

| ID | Finding | Disposition | Evidence |
| --- | --- | --- | --- |
| B1 | The proof was cited but absent. | Accepted. | The M2 entry in `gate-proofs.md`, the devlog entry and the plan land with the gate. |
| S1 | Wrong counts in the register. | Accepted. | The entry now gives 14, 13 and 7 cases and five junction runs. |
| S2 | Five evidence rules removable with every case green. | Accepted. | Five cases added; mutants E15 to E19 each go red. |
| S3 | A `.only` narrows a suite and still passes. | Accepted, fixed rather than bounded. | `forbidOnly: true` and `allowOnly: false`, held by a case (P3, P4). Measured: two spec files with one `test.only` ran 1 test and exited 0 with the flag off, and both runners exit 1 with it on. |
| S4 | A cut build leaves the last bundle for the browser suite. | Accepted as a stated bound. | The bounds in `verify-receipt.mjs`, `verify-receipt-evidence.mjs`, the register and `gate-proofs.md`. |
| S5 | The rollover was stale against main. | Already redone at the rebase, before the report arrived. | Main's register taken whole; the gate named the 2026-10-11 six-civilization-bonuses entry, moved verbatim with its note and one positional pointer fixed. |
| S6 | Only a hand-made fixture held the reporter contract. | Accepted. | A case feeds both real reporters' output to the rules (mutants R1, R2), and one holds package.json to the evidence's command lines (P1, P2). |
| N1 | `test.fail()` would refuse the run. | Stated as a bound; there is none today. | `verify-receipt-evidence.mjs`'s header. |
| N2 | An orphaned whole run's report counts. | Stated in the bound. | The same header. |
| N3 | The realpath fallback. | Accepted. | Node's own realpath is tried before the path as typed. |
| N4 | Error messages. | Accepted. | A refused start record names each wrong field (mutant E20); the advice fits every reason. |

## Verification

On the rebased branch the three files hold 34 cases, and the affected tests (25 files at the rebase, then the four script files) pass. The mutation set was rerun on the final code (`gate-proofs.md` lists every mutant). The `.only` behaviour was measured with real Vitest and Playwright runs. No re-review of the fixes ran.

## Round outcome

All findings were repaired or stated. The fixes have not been re-reviewed; the handoff says so.
