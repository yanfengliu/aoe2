# Playtest Loop — Design Iteration 2 Review

Date: 2026-05-08

Reviewers: Codex (`gpt-5.5` xhigh, read-only sandbox) and Claude (`opus-4-7[1m]` max, Read/Glob/Grep). Both verified iter-2 changes against the live codebase and the iter-1 REVIEW.md.

## Disposition

**Iter-2 has two real HIGH findings + one CONFIG mismatch + several NITs.** Iter-1's H1 (AgentDriver mismatch) and most M-class findings landed cleanly. The new bridge-driven loop is valid, but two assumptions inside it don't hold: `match-completes` still treats abnormal stops as success (Codex H1), and `seedAiForHuman` doesn't actually produce AI-vs-AI because the AI hard-codes `humanPlayerId` as the enemy target (Codex H2). The `SessionRecorder` API also doesn't match the live declaration (Codex H3 + Claude L1/L2). Iter-3 addresses these and converts the remaining NITs.

## Findings

### HIGH

**H1. `match-completes` still treats abnormal stops as non-failures** (Codex H1; Claude M1/M2 reach the same gap from a different angle).

DESIGN.md:141 (iter-2): `match-completes` fails when `stopReason !== 'stopWhen'` AND `stopReason !== 'recorderError'`. So a recorder failure mid-run silently passes the oracle. That repeats the iter-1 H2 spirit (abnormal stops counting as completion). Plus, Claude flagged that the bridge's `tryTick` (`tickHaltGuard.ts:22-33`) catches system throws internally and sets `haltState.halted` without rethrowing — so a downstream system crash makes `bridge.step` a silent no-op until `maxTicks` of iterations elapse. There is no `engineHalt` stop reason in iter-2.

**Resolution.** Expand the stop-reason enum to `'maxTicks' | 'stopWhen' | 'sinkError' | 'recorderError' | 'engineHalt'`. The runner polls `bridge.getHudState().engineHalted` (or equivalent halt-state probe) every tick; `engineHalt` fires when set. `match-completes` fails on every stop reason except `'stopWhen'`. The envelope carries `errorCode`, `errorMessage`, and `details` for non-`stopWhen` outcomes so REPORT.md can explain the failure.

**H2. `seedAiForHuman` is necessary but not sufficient for AI-vs-AI** (Codex H2 — new finding).

`aiSystem.ts:181-188` finds the enemy TC by `humanPlayerId`. `aiSystem.ts:750-752` and `:769-770` push attack intentions against entities owned by `humanPlayerId`. If we seed an `aiState` for owner 1 and the AI runs for both players, both planners target owner 1's entities — owner 2's AI now attacks owner 1 (correct) but owner 1's AI also tries to attack owner 1 (same-owner attacks are rejected at `unitCommandOps.ts:230`). Player 1's attack behavior silently no-ops. We get half-symmetric AI-vs-AI: economy / build behavior runs for both; combat only runs for owner 2.

**Resolution.** Drop the AI-vs-AI plan entirely. Phase 1 uses **Single AI vs passive human**: the existing AI targets `humanPlayerId` as it does today; the human player has no `aiState` (so no commands are issued for owner 1); the recorder captures the AI's economic + military behavior against a non-acting human. This dodges the opponent-selection refactor that would otherwise be needed. The smoke corpus exercises:

- AI economic ramp (villagers, age-ups).
- AI build order.
- AI military production + attack against the human.
- AI eventually wins via Conquest (passive human is overwhelmed; ~5-15k ticks).
- Simulation doesn't crash, no tick-budget regressions.

We lose true AI-vs-AI, but the regression signal is strong enough for the loop's purpose. The opponent-selection refactor is filed as a phase-6 follow-up.

**H3. `SessionRecorder` API in the design doesn't match the live declaration** (Codex H3 + Claude L1/L2).

DESIGN.md:42, 45, 89 use `new SessionRecorder(bridge.world, sink, { sourceLabel })` (positional) and `recorder.bundle()`. The live API per `node_modules/civ-engine/dist/session-recorder.d.ts:10-58, 86` is:

```ts
new SessionRecorder({ world, sink, sourceLabel, sourceKind: 'synthetic', policySeed?: number })
recorder.connect()
recorder.disconnect()
recorder.toBundle()
```

The constructor takes a single config object. `sourceKind: 'synthetic'` matches the convention used by `runSynthPlaytest` and `session-fork` for harness-recorded streams.

**Resolution.** Update DESIGN.md to use the actual API.

### MEDIUM

**M1. Stale `RecordingService` ADR comment will become a live contradiction** (Codex M1).

`RecordingService.ts:13-14`: "Per ADR 3: ... Agents driving aoe2 use civ-engine's runAgentPlaytest, which owns its own SessionRecorder." Iter-2 design declares the playtest runner does NOT use `runAgentPlaytest`. Once Phase 1 lands, the comment becomes a source-vs-design contradiction.

**Resolution.** Phase 1 commit also updates the `RecordingService.ts` comment to point at the new playtest runner instead.

### LOW (NITs)

**L1.** Use `bridge.getMatchState().outcome !== 'running'` in default `stopWhen`, not `world.state.aoe2.matchState` direct (Claude L3). The `getMatchState()` API is the stable surface; the slot path may move under Phase 2D-style migrations.

**L2.** `no-pinned-or-oscillating-units` reconstruction: name the diff path explicitly. Position changes live in `bundle.ticks[i].diff.components.position.set` (`[entityId, Position][]`) per `diff.d.ts:10-13`. Worth one sentence so PLAN-time readers don't grep for `diff.entities.created` and miss in-place updates (Claude L4).

**L3.** Document `seedAiForHuman` as moot (per H2). Remove from the design.

**L4.** `bundleHotspots` won't produce duration_outlier results when bundles have <10 metric-bearing ticks (Claude inline note). The 200-tick `runPlaytest.test.ts` integration test won't exercise outlier detection. Document as "outlier oracle requires ≥10 ticks; smoke test is shape-only."

**L5.** `git apply --check` only verifies textual applicability — not that the patched code compiles or passes tests. Document the gap in the propose-fix section so a reader doesn't conflate "applies cleanly" with "is correct" (Claude verified-claims note).

## Verified claims (both reviewers, no further action)

- `SessionRecorder.connect`/`disconnect`/`toBundle` exist; the bridge-driven loop is mechanically valid; `bridge.step` drains pending commands inside the tick loop.
- `bundleHotspots` returns `duration_outlier` kinds; warmup-tick filter is straightforward.
- `TickDiff` carries position + state changes; reconstruction is feasible.
- `bundle.failures` is on `SessionBundle`.
- AGENTS.md "Architecture" rule applies; ARCHITECTURE.md + drift-log.md + decisions.md updates are required.
- `endStateEquivalence` is feasible via `SessionReplayer.fromBundle(...).stateAtTick(N)` plus `createReplayWorldOnly` / `makeReplayBridge`.
- `git apply --check` is the right dry-run validator.

## Action plan for iter-3

Required (real findings):

1. Expand stop-reason enum: `'maxTicks' | 'stopWhen' | 'sinkError' | 'recorderError' | 'engineHalt'`. Poll `engineHalted` each tick. Fail `match-completes` on every non-`stopWhen` reason. Carry error details in envelope (H1 / Claude M1+M2).
2. Drop AI-vs-AI plan; use single-AI vs passive-human. Drop `seedAiForHuman`. Document the trade-off (H2 / Codex H2).
3. Fix `SessionRecorder` API in the design: config-object constructor, `recorder.toBundle()`, `sourceKind: 'synthetic'` (H3 / Codex H3, Claude L1+L2).
4. Phase 1 also updates `RecordingService.ts:13-14` to remove the `runAgentPlaytest` reference (M1).
5. Use `bridge.getMatchState().outcome !== 'running'` in default `stopWhen` (L1).
6. Name the position diff path in the `no-pinned-or-oscillating-units` description (L2).
7. Document the `<10 metric-bearing ticks → no outliers` constraint (L4).
8. Document the `git apply --check` ≠ "code is correct" gap in propose-fix (L5).

After iter-3 design, multi-CLI re-review.
