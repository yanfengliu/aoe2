# Playtest Self-Iteration Loop — Design

Date: 2026-05-08 (iter-2 after design-1 review).

## Problem

Today the project has the prerequisites for an autonomous play → detect → fix → iterate loop (deterministic replay, session recording, `bundleHotspots` for outlier detection, `runAgentPlaytest` engine API), but none of those pieces are wired together. Closing the gap requires a small set of glue scripts and a gameplay-correctness oracle layer — no engine changes.

## Goal

Five new modules/scripts in aoe2 that compose into a closed loop:

1. **Playtest runner** drives the rule-based AI vs itself, emits a `SessionBundle` plus an envelope JSON.
2. **Gameplay oracles** read bundles + envelopes and report violations.
3. **Fix-bot wrapper** turns oracle violations into proposed patches via Codex / Claude CLI.
4. **Corpus runner** loops 1-2 over a config matrix, aggregates a summary.
5. **CI hookup** runs the smoke corpus on PR / main pushes.

Phases 1 + 2 are prerequisite for 3-5. Phases 3-5 land independently.

## Non-Goals

- Pixel / visual diff oracles (HUD rendering is exercised by the existing Playwright suite).
- Cross-corpus regression detection (needs baseline storage; phase-6 follow-up).
- LLM-driven `AgentDriver` (engine API supports it; this design uses the rule-based AI as the deterministic baseline so the loop's bug oracle isn't fighting a stochastic agent).
- Auto-apply patches. Per user direction the fix-bot is propose-only; an auto-apply flag is a phase-6 follow-up.
- `forkAt` counterfactual fix-validation. Listed in phase-6 follow-ups.

## Engine integration approach (revised after iter-1 review)

aoe2's AI is implemented as an ECS system (`prototypeAi`) inside `world.step()`. It pushes intentions to a bridge-owned `pendingCommands` queue; the bridge drains that queue at the start of each `step()` via `drainPendingCommands(world, pendingCommands)`. `runAgentPlaytest`'s `decide(ctx)` callback contract assumes the agent RETURNS commands; it does not drain a side queue. So we cannot wrap the existing AI as an `AgentDriver` without either a large refactor (extract the planner from the bridge) or a brittle bridge-internals leak.

**Decision.** Phase 1 uses a bridge-driven recording loop: attach a `SessionRecorder` to the bridge's world, call `bridge.step(deltaMs)` in a loop until `maxTicks` (or a stop predicate), then `recorder.disconnect()` and emit `recorder.bundle()`. This reuses the existing `drainPendingCommands` flow — the AI runs every tick exactly as it does in the live game, and the recorder captures its commands and the resulting events / diffs.

To get AI vs AI, we seed an `aiState` for player 1 in the playtest scenario (the existing scenario seeder skips player 1's `aiState` because that slot is the human in normal play). With both sides driven by the same planner, the playtest is fully deterministic.

## Architecture

```
scripts/playtest.mjs
  ├─► createSimulationBridge(seed, { seedAiForHuman: true })
  ├─► new SessionRecorder(bridge.world, sink, { sourceLabel })
  ├─► loop bridge.step(100) until maxTicks OR stopWhen(world)
  └─► outputs:
      output/playtests/<id>.json           // SessionBundle (recorder.bundle())
      output/playtests/<id>.envelope.json  // { stopReason, ticksRun, seed, scenario, runStartedAt, runCompletedAt }

src/game/playtest/oracles.ts
  ├─► (bundle, envelope, thresholds) -> OracleViolation[]
  └─► oracles compose via array concat

scripts/run-oracles.mjs
  ├─► reads bundle + envelope + corpus row's thresholds
  ├─► writes output/playtests/<id>/REPORT.md (markdown table)
  └─► exit code = high-severity violation count

scripts/propose-fix.mjs
  ├─► reads REPORT.md, picks first high-severity violation (or --oracle <name>)
  ├─► builds Codex / Claude prompt: violation + envelope + tick neighborhood + heuristic source files
  ├─► validates output: must contain fenced ```diff and pass `git apply --check`
  └─► writes output/fix-proposals/<bundle-id>/<oracle>/{proposal.diff, WHY.md}

scripts/playtest-corpus.mjs
  ├─► reads playtest-corpus.json (TypeScript-typed schema)
  ├─► loops playtest -> oracles per row
  └─► aggregates output/corpus/<date>/SUMMARY.md

.github/workflows/playtest.yml
  └─► runs npm run playtest:corpus on PR + main; uploads output/corpus/ artifact
```

## Component design

### Phase 1 — `scripts/playtest.mjs`

Node ESM script. CLI:

```
npm run playtest -- --seed default-seed --max-ticks 30000 --out output/playtests/foo
```

`--out` is a base path; the runner writes `<out>.json` (bundle) and `<out>.envelope.json`.

Implementation:

1. Construct the bridge via the same `createSimulationBridge(seed)` factory the live game uses, with a new `seedAiForHuman: true` option that initializes an `aiState` for player 1 too. (Engine API option; small bridge-side change.)
2. Construct a `SessionRecorder` with `MemorySink({ allowSidecar: true })` and `sourceLabel: 'aoe2-playtest-<seed>'`. Attach to `bridge.world`.
3. Loop `bridge.step(100)` until either `bridge.world.tick - startTick >= maxTicks` OR `stopWhen(bridge.world)` returns true. The default `stopWhen` checks if a match-over flag is set in `world.state.aoe2` (any player's win condition triggered).
4. `recorder.disconnect()`. Emit `recorder.bundle()` to `<out>.json`.
5. Write `<out>.envelope.json` with `stopReason ∈ 'maxTicks' | 'stopWhen' | 'recorderError'`, plus `ticksRun`, `seed`, `scenario`, `runStartedAt`, `runCompletedAt`.

Stop reasons:
- `maxTicks`: hit the budget without anyone winning.
- `stopWhen`: match-over predicate fired (someone won, or score-timer ended).
- `recorderError`: `recorder.lastError` populated mid-run.

**Determinism**: simulation stream (ticks, commands, executions, diffs, snapshots) is reproducible from `--seed`. `bundle.metadata.sessionId` and `bundle.metadata.recordedAt` vary across runs. Tests that compare bundles compare `bundle.ticks` / `bundle.commands` / `bundle.executions` directly, not the full JSON.

### Phase 2 — `src/game/playtest/oracles.ts` + `scripts/run-oracles.mjs`

`oracles.ts` exports:

```ts
interface OracleViolation {
  oracle: string;
  severity: 'low' | 'medium' | 'high';
  tick: number | null;       // null = whole-bundle violation
  message: string;
  details?: Record<string, unknown>;
}

interface OracleEnvelope {
  stopReason: 'maxTicks' | 'stopWhen' | 'recorderError';
  ticksRun: number;
  seed: string;
  scenario: string;
  runStartedAt: string;
  runCompletedAt: string;
}

interface OracleThresholds {
  matchCompleteRequired?: boolean;        // default true
  perfP99WarmupTicks?: number;            // default 200
  perfP99BudgetMs?: number | 'auto';      // default 'auto' (uses bundleHotspots z-score)
  economyByTick?: number;                 // default 5000
  economyMinVillagers?: number;           // default 8
  economyMinAge?: 'feudal' | 'castle' | 'imperial';  // default 'feudal'
  pinnedNetProgressCells?: number;        // default 3
  pinnedWindowTicks?: number;             // default 50
}

function runOracles(
  bundle: SessionBundle,
  envelope: OracleEnvelope,
  thresholds: OracleThresholds,
): OracleViolation[];
```

Each oracle is pure: `(bundle, envelope, thresholds) => OracleViolation[]`. They compose via array concat. Initial set:

- **match-completes** — when `thresholds.matchCompleteRequired === true`, fail if `envelope.stopReason !== 'stopWhen'` AND `envelope.stopReason !== 'recorderError'` (i.e., we hit `maxTicks`).
- **no-tick-failures** — fail when `bundle.failures.length > 0`. Read engine-fault failures only; do NOT inspect `executions[i].executed` (legitimate stale-state churn).
- **no-perf-regression** — uses `bundleHotspots(bundle, { durationStdevThreshold: 3 })`, filters to `kind === 'duration_outlier'` and `tick >= warmupTicks`. Each remaining hotspot is a low-severity violation. If `perfP99BudgetMs` is set explicitly (not 'auto'), also fail any tick whose `metrics.durationMs.total > budget` after warmup.
- **economy-progression** — for each player with an `aiState`: replays `bundle.initialSnapshot + bundle.ticks[*].diff` to reconstruct state at `economyByTick`, checks villager count ≥ `economyMinVillagers` and age ≥ `economyMinAge`. Violation per failing player.
- **no-pinned-or-oscillating-units** — replays unit positions tick by tick. For each unit with an active `unit.move` command over a sliding window of `pinnedWindowTicks` ticks, computes net Manhattan progress. If `progress < pinnedNetProgressCells`, fire a violation. Catches both pinned units (zero progress) and oscillating units (progress oscillates around zero).

`scripts/run-oracles.mjs`: reads `<out>.json` + `<out>.envelope.json` + thresholds (from CLI flags or corpus row), runs the oracles, writes `output/playtests/<id>/REPORT.md`. Exit code = high-severity violation count.

### Phase 3 — `scripts/propose-fix.mjs`

Reads `REPORT.md`, picks the first high-severity violation in document order (or accepts `--oracle <name>` to target a specific one).

**Pre-flight checks.**
- The selected CLI binary (`codex` or `claude`) is on PATH; if not, error with a clear message and exit non-zero.
- The bundle JSON parses; the envelope JSON parses.

**Prompt construction.** Distinct from the AGENTS.md review prompt — explicitly instructs the model to PROPOSE A PATCH. Bundles:
- Violation summary + tick + details (≤500 chars).
- Envelope metadata (engineVersion, seed, scenario).
- Tick neighborhood: 5 ticks before and after the violation tick from `bundle.ticks` (commands + events). Truncated to 8KB if needed.
- Heuristic source files: a per-oracle list (e.g., `no-pinned-or-oscillating-units` → `src/game/simulation/bridge/systems/playerCommandsSystem.ts`, `src/game/simulation/worldOccupancy.ts`, `src/game/simulation/worldOccupancyAllocators.ts`). Each file capped at 500 LOC; if a file exceeds the cap, include the first 500 LOC and a "[…truncated]" marker.
- The instruction: "produce a unified diff in a fenced ```diff block. Explain in 3-5 sentences in a separate fenced ```why block."

**Output validation.**
- The model's response must contain at least one fenced ```diff block.
- Run `git apply --check` against the candidate diff in a tempfile. If it fails to apply, log the failure to `WHY.md` and emit no proposal.diff.
- If it applies, write `output/fix-proposals/<bundle-id>/<oracle>/proposal.diff` (the diff content) and `WHY.md` (the reasoning + git-apply-check status).

**Propose-only.** No `git apply` for real, no commit. Human inspects and applies.

CLI: `npm run propose-fix -- --bundle output/playtests/foo --oracle no-pinned-or-oscillating-units --reviewer codex|claude`.

### Phase 4 — `scripts/playtest-corpus.mjs`

Reads `playtest-corpus.json` at repo root. TypeScript schema in `src/game/playtest/corpusSchema.ts`:

```ts
interface PlaytestCorpus {
  runs: PlaytestCorpusRun[];
}

interface PlaytestCorpusRun {
  name: string;
  seed: string;
  maxTicks: number;
  thresholds?: OracleThresholds;
}
```

For each entry: run `playtest.mjs`, then `run-oracles.mjs`, then append a row to `output/corpus/<date>/SUMMARY.md` (run name, ticks run, stop reason, violation count by severity).

Single command: `npm run playtest:corpus`. Initial corpus: 1 row (`default-seed-2p`, 30000 ticks, default thresholds).

### Phase 5 — `.github/workflows/playtest.yml`

GitHub Actions workflow that runs `npm run playtest:corpus` on PR + main pushes. Uploads `output/corpus/<date>/` directory as an artifact and posts SUMMARY.md to the PR check via `actions/github-script`.

(`/.github/workflows/` already exists in the tree.)

## Data flow & invariants

- All bundles, envelopes, reports, proposals, corpus summaries live under `output/`. **Phase 1 adds `output/` to `.gitignore`.**
- The only checked-in artifacts are `playtest-corpus.json` (corpus matrix) and `.github/workflows/playtest.yml`.
- Reproducibility: simulation content is deterministic from seed; metadata varies (sessionId, timestamps).

## Architecture surface (per AGENTS.md "Architecture" rule)

Phase 1 also updates:

- `docs/architecture/ARCHITECTURE.md` — Component Map row for `src/game/playtest/`; Boundaries paragraph noting that the playtest runner does NOT use `RecordingService` (per ADR 3 in `RecordingService.ts`) and that the AI's bridge-internal queue model is why `runAgentPlaytest` is unsuitable for aoe2.
- `docs/architecture/drift-log.md` — append a row "2026-05-08: added playtest infrastructure (`src/game/playtest/`, `scripts/playtest*.mjs`, CI workflow)".
- `docs/architecture/decisions.md` — append a Key Architectural Decision: "Playtest runner uses bridge.step() rather than runAgentPlaytest because the AI lives inside the bridge as an ECS system, not as a `decide()` callback."

## Test plan

### Unit tests (vitest)

- `tests/playtest/oracles.test.ts` — for each oracle, hand-construct minimal bundles + envelopes that pass and that fail; assert violations are reported correctly.
- `tests/playtest/corpusSchema.test.ts` — schema validation: required fields, wrong types, extra fields.

### Integration tests (vitest)

- `tests/playtest/runPlaytest.test.ts` — actually run the bridge loop for `maxTicks: 200` against the default scenario; assert the bundle is well-formed (correct shape, has tick entries, has the recorder snapshot at start) and the oracles run without errors.
- `tests/playtest/endStateEquivalence.test.ts` — run the bridge loop and compare its final `bridge.getEconomyState()` against the equivalent state-at-tick-N reconstructed from the recorded bundle. Catches bundle-incompleteness regressions.

### Manual

- `npm run playtest:corpus` against the smoke corpus produces a green SUMMARY.md.
- A deliberately-broken commit (e.g., delete the §12.7 lazy redirect) makes `no-pinned-or-oscillating-units` fire, and `propose-fix` emits a credible patch.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI planner not deterministic across runs | Existing project property; pinned via `endStateEquivalence.test.ts` snapshot. |
| Oracle threshold tuning is finicky | Per-corpus-row thresholds; `'auto'` for perf via `bundleHotspots` z-score. |
| Fix-bot prompts produce bad patches | Propose-only; `git apply --check` validation; human reads `WHY.md`. |
| Bundles are large (megabytes) | Gitignored. CI uploads as artifacts only. |
| Engine API changes | Pinned `civ-engine` version; bundle-format version in `bundle.metadata.engineVersion`. |
| Bridge-driven loop misses an `agentError` analog | Wrap `bridge.step` in try/catch. Catching becomes `recorderError` stop reason. |

## Sequencing

| Phase | Commit | Depends on | Multi-CLI review |
|---|---|---|---|
| 1 | feat: playtest runner + bridge `seedAiForHuman` opt | — | yes |
| 2 | feat: gameplay oracles | phase 1 (uses bundle + envelope) | yes |
| 3 | feat: fix-bot wrapper | phase 2 (consumes REPORT.md) | yes |
| 4 | feat: corpus runner | phases 1+2 (loops them) | yes |
| 5 | ci: playtest workflow | phase 4 (calls it) | yes |

Each phase = one commit + one multi-CLI review iteration. Thread folder: `docs/threads/current/playtest-loop/`.

## Versioning

Internal tooling — no version bump in `package.json`, no `docs/changelog.md` entry. All changes documented in the devlog.

## Open questions for iter-2 review

- Confirm `seedAiForHuman: true` is the right name / shape for the new bridge option, vs. `playerAiSlots: number[]` or similar.
- Confirm `bundleHotspots` z-score threshold of 3σ is the right default for `no-perf-regression`; or should we use the engine's default (also 3σ)?
- Confirm the heuristic source-file list per oracle: should it be data-driven (a JSON map) or code-driven (a switch in `propose-fix.mjs`)?
