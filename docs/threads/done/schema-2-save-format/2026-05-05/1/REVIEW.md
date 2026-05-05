# Review Iteration 1

## Reviewers

- Codex `gpt-5.5` xhigh: completed live-codebase diff review.
- Claude `claude-opus-4-7[1m]`: unreachable due quota limit (`resets May 5, 7pm America/Los_Angeles`).

## Findings

- [MEDIUM] Schema-1 hydration overlaid legacy `sideMaps.*` payloads onto migrated `worldSnapshot.state` maps without clearing first, so stale schema-2 state could win when both existed. Disposition: fixed by clearing migrated Tier-1 map slots before applying schema-1 side maps and adding a `productionQueues` authority regression.
- [MEDIUM] `aoe2.pendingCommands` was only save-time flushed, so recorder-visible snapshots after command drain could retain stale pending commands. Disposition: fixed by syncing a cloned pending-command snapshot in the output tail and adding a post-load+step `world.serialize()` regression.

## Outcome

Substantive findings required code and test changes, so the thread advanced to iteration 2.
