# A landing proves its gate ran to the end on the tree it pushes

Status: planned
Owner: Coordinator worker w124-verify-receipt (coordinator: AOE2 repo coordinator setup)
Created: 2026-10-11
Updated: 2026-10-11

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

- [ ] Script and tests, the verify line, the cut-run proof, the local-rules landing steps, the lesson retired, land.

## Outcome

Pending.
