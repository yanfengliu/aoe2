# AI monk intention split review

Iteration 2.

## Reviewers

- Codex: completed; exited non-zero from wrapper noise but produced a usable `--output-last-message` review in `tmp/review-runs/ai-monk-intention-split/2026-05-04/2/codex-last.md`.
- Claude: unreachable; quota limit, reset reported as May 5, 2026 7pm America/Los_Angeles.

## Findings

- Medium — `saveGame()` serialized `pendingCommands` with only a shallow array copy, and hydration reused the same blob command objects. A caller could save during the one-tick AI command window, mutate `blob.sideMaps.pendingCommands[0].data`, and alter the still-live bridge queue before the dispatcher drained it. Fixed by adding `clonePendingCommand`, using it in save and hydrate, and adding a regression that mutating the returned save blob cannot change the live queued AI Monk relic pickup.

## Verification Evidence

- Iteration 1 Codex HIGH and MEDIUM were addressed before this re-review.
- Red-green regression: `npm.cmd test -- tests/simulation/aiPlayer.test.ts -t "keeps saved pending AI Monk intentions isolated from the live queue"` failed before the clone fix and passed after it.
- `npm.cmd test -- tests/simulation/aiPlayer.test.ts -t "FU4 AI Monks"` passes: 8 passed, 16 skipped.
- `npm.cmd test -- tests/architecture/fileSizeBudget.test.ts` passes.
- `npm.cmd test -- tests/commands/monkContextAtEntity.test.ts` passes.
- `npm.cmd test -- tests/simulation/aiPlayer.test.ts -t "FU4 AI Monks"` passes.
- `npm.cmd test -- tests/commands/dispatcher.test.ts tests/commands/unitMove.test.ts` passes.
- `npm.cmd test -- tests/architecture/fileSizeBudget.test.ts` passes.
- `npm.cmd run typecheck` passes.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd test` passes: 99 files, 732 tests passed, 1 skipped.

## Final Disposition

Codex found one real snapshot-isolation issue. The fix is implemented and will receive iteration 3 review.
