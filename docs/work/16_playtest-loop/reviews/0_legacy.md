# Playtest Loop — Design Iteration 1 Review

Date: 2026-05-08

Reviewers: Codex (`gpt-5.5` xhigh, read-only sandbox) and Claude (`opus-4-7[1m]` max, Read/Glob/Grep). Both verified claims against the live codebase.

## Disposition

**Iter-1 design must be revised before Phase 1 commits land.** Both reviewers independently flagged the same HIGH-severity blocker (H1) — the proposed `runAgentPlaytest` integration is structurally incompatible with how aoe2's AI is implemented. Both also flagged a HIGH-severity oracle-contract mismatch (H2) where the oracle definitions reference `SessionBundle` fields that don't exist.

## Findings

### HIGH

**H1. AI-as-AgentDriver is not a clean adapter** (Claude H1 + Codex HIGH-1).

The design says "Wrap the existing rule-based AI planner as an `AgentDriver`." This doesn't work as written:

- The AI runs as an ECS system inside `world.step()` (`prototypeAi` registered in `aiSystem.ts:177-180`), pushing intentions to the bridge-owned `pendingCommands` queue.
- The bridge drains that queue in its own `step()` via `drainPendingCommands(world, pendingCommands)` (`createSimulationBridge.ts:303-311`) before each `world.step()`.
- `runAgentPlaytest` only submits commands the `decide()` callback returns; it never drains the bridge queue.
- AI is also asymmetric: `aiSystem.ts:250` only iterates owners with an `aiState` registered, and `scenarioSeedOps.ts` skips `humanPlayerId` when seeding aiStates. A "human-as-AI" self-play wrapper has to seed an `aiState` for player 1.

**Resolution.** Switch Phase 1 to a bridge-driven loop: attach `SessionRecorder` to the bridge's world, call `bridge.step(deltaMs)` in a loop until `maxTicks` or stop predicate, then `recorder.disconnect()` and emit `recorder.bundle()`. This reuses the existing `drainPendingCommands` flow and avoids the AgentDriver mismatch. We lose `runAgentPlaytest`'s built-in `stopWhen` / `agentError` plumbing, but those are easy to re-create at the loop level. We also seed an `aiState` for player 1 (Claude L6) to make the playtest deterministic AI vs deterministic AI.

### H2. Oracle contracts reference fields that don't exist (Codex HIGH-2).

Several oracle definitions in the design reference shapes that aren't on `SessionBundle`:

- `bundle.ticks.every(t => !t.failure)` — `SessionTickEntry` has no `failure` field. Tick failures live in `bundle.failures` and `metadata.failedTicks`.
- `stopReason` is on `AgentPlaytestResult`, not on `SessionBundle`. If `playtest.mjs` writes only the bundle, the `match-completes` oracle can't read `stopReason`.
- `stopReason !== 'maxTicks'` would treat `agentError`/`poisoned`/`sinkError` as match-completion success.

**Resolution.** Phase 1 writes a small envelope JSON next to the bundle: `output/playtests/<id>.envelope.json` with `{ stopReason, ticksRun, seed, scenario, runStartedAt, runCompletedAt }`. Oracles read both. `match-completes` checks the envelope for `stopReason === 'stopWhen'` (with a "match over" predicate) AND `bundle.failures.length === 0`. `no-tick-failures` reads `bundle.failures` only.

### MEDIUM

**M1. `no-stuck-units` doesn't catch oscillation** (Claude M1).

A unit oscillating A↔B every 1-2 ticks never sits at one position long enough to trip a 50-tick threshold; it appears "moving." That's exactly the §12.7 redirect-oscillation failure mode.

**Resolution.** Rename to `no-pinned-or-oscillating-units` and use a different metric: "net Manhattan progress < K cells over M ticks while a `unit.move` command is active." Default: `K=3`, `M=50`. Catches both the pin (no progress) and the oscillation (progress oscillates around zero).

**M2. `no-tick-failures.executions.every(e => e.executed !== false)` fires on normal play** (Claude M2).

`CommandExecutionResult.executed = false` is the normal "stale-state silent no-op" pattern (`aiSystem.ts:276-283`). Filtering by it would fire constantly.

**Resolution.** Use `bundle.failures` only (engine-fault). Drop the `executions` filter. Optionally count `executed: false` per command type for a future "diagnostics" oracle that's informational, not pass/fail.

**M3. Threshold defaults are scenario-coupled but stated as global** (Claude M3 + Codex MEDIUM).

"Feudal by tick 5000, 8 villagers" is plausible for `ai-planner-fixture` but meaningless for `ai-rush-fixture` (Dark-Age combat) or `ai-difficulty-fixture` (1500-tick).

**Resolution.** Move thresholds OUT of oracle defaults INTO the corpus row. Each corpus entry declares its expected thresholds. Oracle takes thresholds as input. Defaults in the oracle remain but are documented as "applicable to the default-seed full-game scenario only."

**M4. `no-perf-regression` 50ms p99 needs warmup exclusion** (Claude M4).

Bootstrap ticks are legitimately slower than steady-state. On a 200-tick smoke test, p99 absorbs the warmup; on a 30k-tick run, it doesn't.

**Resolution.** Skip the first 200 ticks (warmup). Configurable. Document the rationale.

**M5. "Bundle is byte-reproducible" is false** (Claude M5 + Codex MEDIUM).

`SessionRecorder.sessionId = randomUUID()` and `metadata.recordedAt` is a timestamp string. Bundles vary across runs at the metadata layer.

**Resolution.** Reword the invariant: "The simulation stream (ticks, commands, executions, diffs, snapshots) is reproducible from `--seed`. `metadata.sessionId` and `metadata.recordedAt` vary across runs." Tests that need bundle equality compare `bundle.ticks` / `bundle.commands` / `bundle.executions` directly, not the full JSON.

**M6. propose-fix.mjs is under-specified and conflicts with AGENTS review baseline** (Codex MEDIUM).

The AGENTS code-review prompt says "Do NOT modify files or propose patches." The design has the fix-bot do exactly that. Specifics on CLI availability checks, model failure handling, diff validation, and bundle/report-context size limits are missing.

**Resolution.**
- The fix-bot uses a DIFFERENT prompt prefix from the review prompt — explicitly "you are an engineer producing a patch" rather than "you are a reviewer." Document the divergence in `propose-fix.mjs` so it's clear the fix-bot is exempt from the review-prompt no-patch rule.
- Validate the model's output: must contain a fenced ```diff or ```patch block; must parse via `git apply --check` (dry-run). Failure → log to `WHY.md` with reason; no proposal.diff is written.
- Cap bundle context: include only `bundle.metadata`, the violation's tick neighborhood (±5 ticks of relevant entries), and the heuristic source files (≤3, ≤500 LOC each).
- Pre-flight: check the CLI binary is on PATH; refuse with a clear error if not.

**M7. Architecture docs need updating** (Codex MEDIUM).

Adding `src/game/playtest/`, new scripts, and CI tooling is structural. AGENTS.md "Architecture" rule requires `docs/architecture/ARCHITECTURE.md` Component Map + `docs/architecture/drift-log.md` row.

**Resolution.** Add ARCHITECTURE.md + drift-log.md updates to the Phase 1 commit.

### LOW

**L1.** `bundleHotspots` listed as prereq but unused. Wire it as the `no-perf-regression` outlier source (3σ above bundle mean) — more robust than a hard p99 threshold and self-tuning. Alternatively drop from prereqs.

**L2.** `forkAt` listed as prereq but unused. Defer to Phase 6 (counterfactual fix-validation).

**L3.** `stopWhen?` from the bridge loop equivalent should fire when match-over is detected. Drives early-exit on successful matches and makes "match never ends" a structural detection.

**L4.** `agentDriver.test.ts` anchor doesn't exist. Replace with end-state-equivalence assertion: run the bridge loop directly vs the playtest loop, diff the final `getEconomyState()`. Or drop this test and rely on integration coverage.

**L5.** `playtest-corpus.json` schema undefined. Add a TS interface in `src/game/playtest/types.ts` with full required/optional shape.

**L6.** Folded into H1 resolution.

**L7.** Add `output/` to `.gitignore` in the Phase 1 commit.

## Verified claims (both reviewers)

- `runAgentPlaytest`, `SessionBundle`, `AgentDriver`, `AgentDriverContext`, `bundleHotspots` all exist as named exports.
- `metrics.durationMs.total` exists at `world.d.ts:59-60`, populated at `world.js:1219`.
- `SessionTickEntry.diff: TickDiff` carries enough state to reconstruct unit positions tick-by-tick.
- File paths `src/game/playtest/`, `scripts/playtest.mjs`, etc. don't collide with existing tree.
- The Phase / Sequencing / Risks tables and multi-CLI-review-per-phase align with AGENTS.md.

## Action plan for iter-2

1. Replace Phase 1's `runAgentPlaytest` adapter with a bridge-driven recording loop (H1).
2. Add envelope JSON sidecar; rewrite oracle definitions against the actual `SessionBundle` shape (H2).
3. Rename `no-stuck-units` → `no-pinned-or-oscillating-units` with the net-progress metric (M1).
4. Drop `executions.every` from `no-tick-failures`; rely on `bundle.failures` (M2).
5. Move thresholds into corpus rows; oracles take them as inputs (M3).
6. Add warmup-exclusion to `no-perf-regression` (M4).
7. Reword byte-reproducibility invariant (M5).
8. Tighten `propose-fix.mjs` spec: distinct prompt, output validation via `git apply --check`, context size caps, CLI pre-flight (M6).
9. Add ARCHITECTURE.md + drift-log.md updates to Phase 1 (M7).
10. Wire `bundleHotspots` into `no-perf-regression`; defer `forkAt` to Phase 6; drop both from the prereqs list (L1, L2).
11. Add stop-on-match-over to the bridge loop (L3).
12. Replace agentDriver.test.ts with end-state-equivalence integration test (L4).
13. Add `playtest-corpus.json` schema as a TS interface (L5).
14. Seed `aiState` for player 1 in playtest scenarios (L6).
15. Add `output/` to `.gitignore` in Phase 1 (L7).

After iter-2 design, multi-CLI re-review.
