# Review iteration 5 - monkTasks accessor migration

## Reviewers

- Codex (`gpt-5.5`, xhigh, read-only): no code-level correctness, security, or performance findings.
- Claude (`claude-opus-4-7[1m]`, max): still unreachable due quota limit: "You've hit your limit - resets May 5, 7pm (America/Los_Angeles)."

## Findings

No blocking findings. Codex verified that task creation/clear, monk behavior cleanup, unit move cleanup, entity destruction, save serialization, schema-1 hydration, and selection activity all route through `monkTasksCodec` / `BridgeStateAccessor`, with guarded dirty marking where prior iterations required it.

## Cleanup Notes

- Codex noted one non-blocking stale source comment in `unitCommandOps.ts` that still described the move helper invariant as raw `monkTasks.delete`. Updated it to describe the guarded `monkTasksCodec` clear.

## Verification

- Review convergence reached: no remaining code-level findings. Claude remained unreachable across iterations and was recorded as a quota blocker.
