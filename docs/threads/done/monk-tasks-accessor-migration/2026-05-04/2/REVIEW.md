# Review iteration 2 - monkTasks accessor migration

## Reviewers

- Codex (`gpt-5.5`, xhigh, read-only): returned two MEDIUM findings.
- Claude (`claude-opus-4-7[1m]`, max): still unreachable due quota limit: "You've hit your limit - resets May 5, 7pm (America/Los_Angeles)."

## Findings

### MEDIUM C3 - ordinary moves dirtied monkTasks even when no task existed

Codex verified that `setUnitMoveCommandDirect` called `accessor.mutate(monkTasksCodec, (m) => m.delete(unitId))`. `BridgeStateAccessor.mutate` always marks dirty, and civ-engine's `setState` marks the slot dirty in tick diffs. Ordinary non-Monk moves therefore published empty `aoe2.monkTasks` diffs.

Disposition: fixed. Added a red/green unit movement regression proving ordinary moves with no prior Monk task do not publish `aoe2.monkTasks` in the tick diff. `setUnitMoveCommandDirect` now reads the accessor-backed map and calls `accessor.markDirty(monkTasksCodec)` only when `delete(unitId)` returns true.

### MEDIUM C4 - active replay-scrubber docs still described raw monkTasks.delete

Codex verified that current replay-scrubber design/plan docs still documented `monkTasks.delete` as a ground-truth helper invariant even though `BridgeState.monkTasks` no longer exists.

Disposition: fixed. Updated the active replay-scrubber `DESIGN.md` and `PLAN.md` to describe clearing the accessor-backed `monkTasksCodec` entry when present. A grep for `monkTasks.delete` in those current files now returns no hits.

## Verification

- `npm.cmd test -- tests/simulation/createSimulationBridge.unitMovement.test.ts -t "monkTasks diffs"` failed before the guarded dirty-mark fix with `aoe2.monkTasks: []` in the tick diff, then passed after the fix.
