# Review Iteration 2

## Reviewers

- Codex `gpt-5.5` xhigh: completed live-codebase diff review.
- Claude `claude-opus-4-7[1m]`: unreachable due the same quota limit.

## Findings

- [HIGH] Schema-1 `sideMaps.pendingCommands` did not appear in immediate post-load `world.serialize()` snapshots because bootstrap flush only wrote bridge meta, match state, and visibility. Disposition: fixed by adding pending-command flushing to `bootstrapFlush` and adding a schema-1 conflicting-pending regression.

## Outcome

The HIGH finding was addressed before the thread advanced to iteration 3.
