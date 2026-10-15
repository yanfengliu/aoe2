# A landing proves its gate ran to the end on the tree it pushes

Status: complete
Owner: Coordinator worker w124-verify-receipt (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-14

## Problem and outcome

The repo reads a gate's result from an exit file, and that file can claim a pass for a run that never finished. On 2026-10-11 work 120's first landing run wrote 0 to its exit file, yet its log stops at browser spec 139 of 238, with no lint and no build. The worker reproduced the cause: a chain ended through WMI's `Win32_Process.Terminate` exits 0 (see `docs/learning/lessons.md`, and `lessons-evidence.md` under 2026-10-11).

Until now, only a worker that happened to read the whole log could tell a finished run from a cut one. The fleet canon names the class: a gate that cannot tell passed from did-not-run reports the second as the first.

Outcome: `npm run verify` writes a receipt as its last step, and a landing checks that receipt against what it pushes.
- The receipt names the tree the run checked: HEAD's tree hash, with no tracked change outstanding.
- A run cut short by any means cannot write one.
- A landing refuses to push without a receipt matching the tree it pushes, unless every commit since the receipt's tree touches only `docs/` and `design/spec-final.md`.

## Scope

Reserved for this work:
- the `verify` line of `package.json`'s scripts;
- a new `scripts/verify-receipt.mjs` and its tests;
- the landing rule in `docs/policies/local-rules.md`, in the gate-lock and merge-lock bullets.

A git hook that enforces the check is optional and needs the coordinator's approval first, because it would bind every session, Codex included.

It must not edit the files of works 116, 120, 121, 122 and 123 while they run. Work 123 owns the per-test headroom gate and the CI workflow.

## Approach

The receipt is written by the chain's last step, so it exists only when every earlier step passed. The checker compares it with `git rev-parse HEAD^{tree}` and the docs-only exception. Read and write it through a small script with tests, proven red by a cut chain, a stale tree and a dirty tree. Retire the lesson in the commit that lands the gate, recording the proof in `docs/learning/gate-proofs.md`. The batch protocol is in `docs/policies/local-rules.md`.

## Acceptance criteria

- Tests show the checker refusing three cases: a missing receipt (a cut chain), a receipt for another tree, and a dirty tree. They show it accepting a receipt for HEAD's tree, and one whose only later commits are docs-only.
- A real cut run writes no receipt. Stop `npm run verify` partway by the WMI method from the lesson, then show that no receipt appears.
- local-rules' landing steps require the receipt check before the push.
- The lesson is retired, with its proof in `gate-proofs.md`.
- `npm run verify` exits 0 and writes a receipt that the check accepts, under the gate lock. The change is merged to main and pushed.

## Implementation steps

- [x] M1: script and tests, the verify line, the cut-run proof, the local-rules landing steps, the lesson retired, land.
  - 2026-10-12: shipped (see Outcome). The coordinator accepted these departures from the plan above. `write` refuses to certify a run whose checkout was not clean at both ends, or whose tree moved, by recording NOT CERTIFIED, and still exits 0, so the exit code keeps saying whether every stage exited 0 and `check` is the landing's answer. Untracked files count as not clean. The docs-only exception compares trees, so a receipt survives a rebase onto docs-only commits. The command runs its library with no "was I run directly?" guard. AGENTS.md's Gates paragraph and the local-rules batch rule (commit the batch, then gate its top) changed with it.
  - Two rounds of independent read-only review found the gap M2 closes, a guard that made the command a silent exit-0 no-op through a junction, untracked files that did not count, a `git diff` that `diff.relative` narrows, `write` exiting 1 against AGENTS.md, and overclaiming docs. All were repaired or stated; the devlog entry records both rounds.
- [x] M2 (queued after work 123 M2, which also touches the reporters in `playwright.config.ts`): a stage ended from outside leaves no receipt. A stage's own process ended through WMI exits 0, so the chain goes on and `write` certifies the run (measured in M1). `start` deletes, and `write` requires, Vitest's and Playwright's own reports from the run, each written at its suite's natural end, with no failures and a nonzero test count. It retires the lesson of 2026-10-12 and closes the register entry of 2026-10-11, now PARTLY FIXED and OPEN. content:validate, typecheck, lint and build stay the receipt's stated bound.
  - 2026-10-14: started on main `45bdc118` after work 123 M2 landed its reporters, in worktree `verify-receipt-m2`. The coordinator added a second item of the same class: census every script under `scripts/` for the "was I run directly?" guard that exits 0 having done nothing when it is reached through a junction, fix each one, and gate it by running each gate script through a junction. Implemented on the branch: `scripts/verify-receipt-evidence.mjs` and the receipt's format 2; `scripts/run-directly.mjs` in `ci-status.mjs`, `ci-job-headroom.mjs`, `test-time-headroom.mjs` and `aiTickAb.mjs`; and `verifyReceiptEvidence.test.ts`, `runDirectly.test.ts` and the sandboxes in `helpers/receiptSandbox.ts`.
  - 2026-10-14, phase 1 done on the branch (the first worker stopped on a usage limit at 13:28; a second resumed from the step log and the tree, after a checkpoint commit). These departures need the coordinator's acceptance. `check` prints the counts the two reports gave. A `.only` fails either suite (`forbidOnly: true` in playwright.config.ts, `allowOnly: false` in vitest.config.ts), which the independent review's S3 asked for and which touches the shared test configs. The real gate was cut in its browser stage, not its unit stage, under the lock from 18:03 to 18:10: cheaper by about eight minutes of lock time, and it measured Playwright's cut, which nothing else had; Vitest's cut was measured on two single-file runs. One review round (`reviews/0_implementation.md`). Rebased onto `83b6ffa3`. Proof in `gate-proofs.md`.
  - 2026-10-14, accepted by the coordinator with those departures. Branch CI run 38667679929 on `abe43202`: all six jobs green. A focused re-review of the fixes (`reviews/1_implementation.md`) found nothing blocking; its should-fix and four nits are done, among them `start` removing `dist/`, so a build ended before it writes can no longer leave the last bundle for the browser suite to test. The landing's run and counts go in Outcome.

## Outcome

**M1 shipped on 2026-10-12**, in the push `1ec80b30..12cf9cda` under the gate lock: the gate as `4ecceae6`, the AGENTS.md Gates paragraph and the batch rule as `b38147f9`, and two docs-only commits. No version change; no player sees it. At the landing rebase the four phase 1 commits, reviewed as `20e5df14`, `abc57377`, `8c47eee8` and `b04d21ad`, were squashed into `4ecceae6`, which carries the same tree.
- **The literal cut:** a real `npm run verify` on `906b57ca` (tree `425afab5`) was cut at its chain's `cmd.exe` through `Invoke-CimMethod -MethodName Terminate`, eight seconds into the unit stage. Its exit file read 0, it left no receipt, and `check` exited 1 ("No receipt").
- **The landing run:** `npm run verify` on the same commit exited 0 in 15 min 51 s. Its log runs through lint and build: 588 unit files and 4,539 tests passed, 236 browser specs passed with 2 skipped, and the build finished. `write` certified tree `425afab5` with nothing dirty at either end. `check` printed OK for `906b57ca`, and for `12cf9cda` across the docs-only commit, after `tests/architecture` passed.
- **Not done, by decision:** the pre-push hook design is the owner's call, which the coordinator raises. The same run-directly guard in `scripts/ci-status.mjs` and `scripts/ci-job-headroom.mjs` is a card of its own.

**M2 shipped on 2026-10-14** as `6e933cf4`, in the push `2a765d31..6e933cf4` under the gate lock (19:30 to 19:52). It squashes the reviewed branch commits `1d583bee..49cc487e`, rebased onto work 129 M1's docs. No version change; no player sees it. The run-directly card that M1 left is done here.
- **The literal cut** (phase 1, under the lock from 18:03 to 18:10): a real `npm run verify` on `a94180d6` with Playwright's runner ended through WMI at spec 6 of 268. Lint and build ran, `write` exited 1 on the missing Playwright report, the exit file read 1, and `check` refused.
- **The landing run:** `npm run verify` on `6e933cf4` (tree `38426f96`) exited 0. Vitest: 614 files passed and 1 skipped, 4,812 tests passed and 3 skipped, in 333 s. Playwright: 267 passed and 2 skipped of 269, in 11.4 min. Lint and the build ran. `write` certified the tree, the first format-2 receipt. `check` printed OK with "vitest 4812 passed and 3 skipped, playwright 267 passed and 2 skipped", the same counts as both summaries in the log.
- **CI:** branch run 38667679929 on `abe43202`, six of six jobs green. On main for `6e933cf4`: CI run 38673255337, six of six jobs green, and playtest-corpus run 38673255525 green.
- **Reviews:** two read-only rounds (`reviews/0_implementation.md`, `reviews/1_implementation.md`); the second found nothing blocking.
