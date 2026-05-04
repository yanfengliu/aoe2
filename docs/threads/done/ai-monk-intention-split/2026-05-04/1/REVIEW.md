# AI monk intention split review

Iteration 1.

## Reviewers

- Codex (`gpt-5.5`, xhigh, read-only): two substantive findings.
- Claude (`claude-opus-4-7[1m]`, max): unreachable. CLI returned quota limit: "resets May 5, 7pm (America/Los_Angeles)".

## Findings

- **Codex HIGH:** queued AI monk commands discarded the AI's selected task kind and original owner, so a stale command could be reinterpreted as the wrong task or apply after owner change. Disposition: fixed by carrying optional `expectedOwner` and `intendedTaskKind` through `monk.contextAtEntity`, rejecting owner changes in the validator/handler route, and suppressing move/task fallback when the intended task no longer matches.
- **Codex MEDIUM:** saving after the AI decision tick but before the handler tick could drop the queued monk assignment because the bridge drained pending intentions into the engine command queue, which is not serialized. Disposition: fixed by draining bridge-owned `pendingCommands` before the next tick, persisting `pendingCommands` in `SaveBlob.sideMaps`, hydrating them on load, and adding save/load coverage for the AI monk one-tick window.

## Verification Evidence

- RED: `npm.cmd test -- tests/simulation/aiPlayer.test.ts -t "defers AI Monk task assignment"` failed before the implementation because the AI monk carried the relic after the first decision step.
- GREEN: `npm.cmd test -- tests/simulation/aiPlayer.test.ts -t "defers AI Monk task assignment"` passes.
- `npm.cmd test -- tests/simulation/aiPlayer.test.ts -t "FU4 AI Monks"` passes.
- `npm.cmd test -- tests/commands/monkContextAtEntity.test.ts tests/simulation/monkConversion.test.ts tests/simulation/computeUnitActivityMonkCarry.test.ts` passes.
- `npm.cmd test -- tests/commands/monkContextAtEntity.test.ts` passes.
- `npm.cmd test -- tests/commands/dispatcher.test.ts tests/commands/unitMove.test.ts` passes.
- `npm.cmd test -- tests/architecture/fileSizeBudget.test.ts` passes.
- `npm.cmd run typecheck` passes.
- `npm.cmd run lint` passes.
- `npm.cmd run build` passes.
- `npm.cmd test` passes: 99 files, 732 tests passed, 1 skipped.

## Final Disposition

Changes required; addressed in iteration 2.
