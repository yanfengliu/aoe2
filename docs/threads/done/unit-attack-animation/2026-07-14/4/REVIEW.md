# Review iteration 4

## Scope

OpenAI Codex externally reviewed the full committed range `0818c65..03bf46e` plus the live v0.2.3 documentation, version, and browser-test closeout diff. It was directed to verify every claim against live code and to re-check the prior feed, Monk, replay, fog, clock, picking, and documentation findings. Anthropic Claude was not retried: the authorized earlier invocation was blocked by tenant policy before execution and transmitted no AoE source.

## Findings and disposition

- **HIGH — the attacker's owner was always added as a witness, exposing a retained ranged target's exact fog-hidden coordinates. Confirmed and fixed.** Ownership no longer bypasses the visibility snapshot. Every witness must see at least one cell of the attacker's footprint and at least one cell of the target's footprint. A red recorder test proved the old feed published `{targetX: 8, targetY: 4, witnessedBy: [1]}` when owner 1 saw only its arbalest; the fixed test publishes no record, while a second player who sees both footprints remains the sole witness.
- **MEDIUM — the browser handoff guard accepted all four approachers carrying fabricated attack weight. Fixed.** The deterministic boar fixture now pins the progressed moving weights to `[0, 0, 1, 1]`, in addition to requiring all four modes to remain `moving` and every weight to stay finite and bounded.
- **MEDIUM — done-thread and iteration-4 links did not yet exist. Expected closeout state.** This review supplies iteration 4; the objective remains under `current/` until the fixes pass re-review and the final gates, then moves atomically to `done/`.

## Result

The external reviewer reported no other substantive finding and did not modify files or run tests. The two new fog contracts failed before the source fix and passed 13/13 afterward. The strengthened headless boar browser test passed 1/1. Because iteration 4 found a HIGH issue, iteration 5 must independently verify the repair before this thread closes.
