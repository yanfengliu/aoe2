# Review iteration 3 - monkTasks accessor migration

## Reviewers

- Codex (`gpt-5.5`, xhigh, read-only): returned one MEDIUM finding.
- Claude (`claude-opus-4-7[1m]`, max): still unreachable due quota limit: "You've hit your limit - resets May 5, 7pm (America/Los_Angeles)."

## Findings

### MEDIUM C5 - idle Monk context-move fallback still dirtied monkTasks

Codex verified that `monkTaskOps.clearMonkTask` still used `accessor.mutate(monkTasksCodec, (m) => m.delete(monkId))`, so an idle Monk context-clicking empty terrain through the move fallback published an empty `aoe2.monkTasks` diff even when no task changed.

Disposition: fixed. Added a red/green regression for idle Monk context-move fallback and changed `clearMonkTask` to mark `monkTasksCodec` dirty only when `delete(monkId)` returns true. Also applied the same guarded-delete pattern to entity-destroy cleanup for `monkTasks`.

## Verification

- `npm.cmd test -- tests/simulation/createSimulationBridge.unitMovement.test.ts -t "idle Monk context-move"` failed before the guarded shared clear helper with `aoe2.monkTasks: []` in the tick diff, then passed after the fix.
