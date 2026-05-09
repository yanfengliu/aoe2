# Playtest Loop — Phase 2 Implementation Review

Date: 2026-05-08

Reviewers: Codex (`gpt-5.5` xhigh, read-only sandbox). Claude (`opus-4-7[1m]` max) was unreachable for this iteration — the background process never produced output. Per AGENTS.md, proceeding with the remaining reviewer; will retry Claude on the next iteration.

## Disposition

**Iter-2 fixes applied inline.** Codex found 2 real HIGH bugs in the oracle layer + 1 MEDIUM doc-drift issue. All three fixed.

## Findings

### HIGH

**H1. `no-pinned-or-oscillating-units` misses "moved once, then got stuck"** (Codex H1).

The single-event branch (events.length === 1) caught units that never moved; the multi-event sliding window stops when `start + window > lastEvent.tick`. A unit that moves at tick 10 and then stays put through endTick=200 has events.length === 2 but no later position diffs — the sliding window never reaches its tail and the oracle returns 0 violations. This is the most common failure mode the spec wanted to catch (the §12.7 "redirect oscillation broke and the unit moved once then deadlocked" case).

**Fix.** Added a tail-pinned branch after the sliding loop: if no sliding-window violation fired AND `endTick - lastEvent.tick >= window`, fire a violation tagged with the last event's position. Preserves the existing "no-events" branch for never-moved units. New regression test "fires when a unit moved early then stayed put (tail-pinned)" pins the case.

**H2. Removal handling drops historical evidence** (Codex H2).

`reconstructPositions` deleted the entity timeline on `position.removed`; `noPinnedOrOscillating` deleted from the unit set on `unit.removed`. A unit pinned for 50 ticks and then garrisoned (which removes the position component) or destroyed loses its history before the oracle evaluates it. False negative for the core contract.

**Fix.** `reconstructPositions` no longer calls `byEntity.delete(id)` on `removed`. The historical events stay in the timeline; the oracle naturally ignores entities past their last event because the sliding window terminates at the last event's tick. The H1 fix's tail-pinned branch only fires when the unit was a unit at any point in the bundle, so a removed unit's pre-removal pinning is correctly evaluated.

### MEDIUM

**H3. ARCHITECTURE.md was stale after Phase 2** (Codex MEDIUM).

The Phase-1 commit's update said "only Phase 1 is currently shipped"; Phase 2 commit didn't update that statement, so devlog and ARCHITECTURE.md disagreed.

**Fix.** ARCHITECTURE.md `playtest/` paragraph rewritten to enumerate every shipped module: `oracles.ts`, `positionReplay.ts`, `fixBotPrompt.ts`, `corpusSchema.ts`, `scripts/run-oracles.mjs`, `scripts/propose-fix.mjs`, `scripts/playtest-corpus.mjs`, the CI workflow. Lists Phase-6 follow-ups (auto-apply patches, real economy-progression oracle, counterfactual fix-validation, cross-corpus baseline, AI-vs-AI) so the doc accurately reflects the loop's current state and what's deferred.

### Verified clean (Codex)

- Snapshot vs TickDiff component shapes correct (`serializer.d.ts:66` vs `diff.d.ts:10-12`).
- `no-tick-failures` reads `bundle.failures` only; no executions filter.
- `bundleHotspots` filtered to `duration_outlier` after warmup; details narrowed.
- No `shell: true` in any script.

### Notes

Codex couldn't run the test suite because the harness blocked `npm.cmd test`. Claude review never produced output; retry next iteration.

## Action plan

Iter-2 fixes applied inline:

1. **H1.** Tail-pinned branch added to `noPinnedOrOscillating`. New test pins it.
2. **H2.** `reconstructPositions` no longer deletes timeline on `position.removed`.
3. **H3.** ARCHITECTURE.md `playtest/` paragraph rewritten.

After iter-2 lands, gates re-verified, commit, push. Claude retry queued for the next-phase combined review.
