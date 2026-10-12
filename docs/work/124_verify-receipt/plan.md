# A landing proves its gate ran to the end on the tree it pushes

Status: active
Owner: Coordinator worker w124-verify-receipt (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-12

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
- [ ] M2 (queued after work 123 M2, which also touches the reporters in `playwright.config.ts`): a stage ended from outside leaves no receipt. A stage's own process ended through WMI exits 0, so the chain goes on and `write` certifies the run (measured in M1). `start` deletes, and `write` requires, Vitest's and Playwright's own reports from the run, each written at its suite's natural end, with no failures and a nonzero test count. It retires the lesson of 2026-10-12 and closes the register entry of 2026-10-11, now PARTLY FIXED and OPEN. content:validate, typecheck, lint and build stay the receipt's stated bound.

## Outcome

**M1 shipped on 2026-10-12**, in the push `1ec80b30..12cf9cda` under the gate lock: the gate as `4ecceae6`, the AGENTS.md Gates paragraph and the batch rule as `b38147f9`, and two docs-only commits. No version change; no player sees it. At the landing rebase the four phase 1 commits, reviewed as `20e5df14`, `abc57377`, `8c47eee8` and `b04d21ad`, were squashed into `4ecceae6`, which carries the same tree.
- **The literal cut:** a real `npm run verify` on `906b57ca` (tree `425afab5`) was cut at its chain's `cmd.exe` through `Invoke-CimMethod -MethodName Terminate`, eight seconds into the unit stage. Its exit file read 0, it left no receipt, and `check` exited 1 ("No receipt").
- **The landing run:** `npm run verify` on the same commit exited 0 in 15 min 51 s. Its log runs through lint and build: 588 unit files and 4,539 tests passed, 236 browser specs passed with 2 skipped, and the build finished. `write` certified tree `425afab5` with nothing dirty at either end. `check` printed OK for `906b57ca`, and for `12cf9cda` across the docs-only commit, after `tests/architecture` passed.
- **Not done, by decision:** the pre-push hook design is the owner's call, which the coordinator raises. The same run-directly guard in `scripts/ci-status.mjs` and `scripts/ci-job-headroom.mjs` is a card of its own.
