# Phase 3A/A.5 Replay World Review - Iteration 33

## Reviewers

- Codex `gpt-5.5` xhigh: completed live-codebase diff review.
- Claude `claude-opus-4-7[1m]`: unreachable due quota limit (`You've hit your limit - resets 7pm (America/Los_Angeles)`).

## Findings

- [HIGH] Codex: the replay-only drain fixed stale hydrated queues, but replay worlds still dropped live `aoe2.pendingCommands` when `openAt(t)` targeted an AI-decision boundary tick. Recorded commands at `t` are not replayed until advancing to `t + 1`, so the replay target tick must reproduce the serialized pending queue itself. Disposition: fixed by running replay-safe `prototypeAi` and `prototypeAutoAggression` with real intention emitters into the replay pending queue, while keeping recorded commands as the only execution source.
- [MEDIUM] Codex: validator replay docs overstated closest-snapshot byte-for-byte coverage even though civ-engine snapshots do not carry `nextCommandResultSequence`. Disposition: docs now state exact validator/result parity applies to the initial-snapshot command stream; closest-snapshot paths are covered by structural replay equality.
- [MEDIUM] Codex: replay docs still described `drainPendingCommands` as an after-step/createApp hook. Disposition: plan/design/architecture docs now describe the actual pre-step `createSimulationBridge` boundary.

## Outcome

All findings were fixed in code, tests, and docs before the next review pass. Claude remained quota-blocked and is recorded as unreachable.
