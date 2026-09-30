# Playtest Self-Iteration Loop — Design

Date: 2026-05-08 (iter-3 after design-2 review).

## Problem

Today the project has the prerequisites for an autonomous play → detect → fix → iterate loop (deterministic replay, session recording, `bundleHotspots` for outlier detection, `runAgentPlaytest` engine API), but none of those pieces are wired together. Closing the gap requires a small set of glue scripts and a gameplay-correctness oracle layer — no engine changes.

## Goal

Five new modules/scripts in aoe2 that compose into a closed loop:

1. **Playtest runner** drives the rule-based AI against a passive human, emits a `SessionBundle` plus an envelope JSON.
2. **Gameplay oracles** read bundles + envelopes and report violations.
3. **Fix-bot wrapper** turns oracle violations into proposed patches via Codex / Claude CLI.
4. **Corpus runner** loops 1-2 over a config matrix, aggregates a summary.
5. **CI hookup** runs the smoke corpus on PR / main pushes.

Phases 1 + 2 are prerequisite for 3-5. Phases 3-5 land independently.

## Non-Goals

- Pixel / visual diff oracles (HUD rendering is exercised by the existing Playwright suite).
- Cross-corpus regression detection (needs baseline storage; phase-6 follow-up).
- True AI-vs-AI (engine AI hard-codes `humanPlayerId` as the enemy target across multiple sites; the opponent-selection refactor is a phase-6 follow-up). Iter-3 uses single-AI vs passive-human as the deterministic baseline.
- LLM-driven `AgentDriver` (engine API supports it; this design uses the rule-based AI as the deterministic baseline so the loop's bug oracle isn't fighting a stochastic agent).
- Auto-apply patches. Per user direction the fix-bot is propose-only; an auto-apply flag is a phase-6 follow-up.
- `forkAt` counterfactual fix-validation. Listed in phase-6 follow-ups.

## Engine integration approach

aoe2's AI is implemented as an ECS system (`prototypeAi`) inside `world.step()`. It pushes intentions to a bridge-owned `pendingCommands` queue; the bridge drains that queue at the start of each `step()` via `drainPendingCommands(world, pendingCommands)`. `runAgentPlaytest`'s `decide(ctx)` callback contract assumes the agent RETURNS commands; it does not drain a side queue. Wrapping the existing AI as an `AgentDriver` would require either a large refactor (extract the planner from the bridge) or a brittle bridge-internals leak.

**Decision.** Phase 1 uses a bridge-driven recording loop: attach a `SessionRecorder` to the bridge's world, call `bridge.step(deltaMs)` in a loop until `maxTicks`, a stop predicate, an engine halt, or a recorder error. Then `recorder.disconnect()` and emit `recorder.toBundle()`. This reuses the existing `drainPendingCommands` flow — the AI runs every tick exactly as it does in the live game, and the recorder captures its commands and the resulting events / diffs.

**Single-AI baseline.** The runner does NOT seed an `aiState` for the human player. The AI runs for non-human players as it does in the live game; the human player has no AI and issues no commands. The AI eventually overwhelms the passive human via Conquest. This is the smoke-corpus baseline; true AI-vs-AI is deferred until the AI's opponent-selection is refactored (`aiSystem.ts:181-188, 750-752, 769-770` hard-code `humanPlayerId`).

## Architecture

```
scripts/playtest.mjs
  ├─► createSimulationBridge(seed)
  ├─► new SessionRecorder({ world: bridge.world, sink: MemorySink({ allowSidecar: true }),
  │                         sourceLabel, sourceKind: 'synthetic' })
  ├─► recorder.connect()
  ├─► loop (probe order: error → engineHalt → stopWhen → maxTicks):
  │     bridge.step(100)
  │     if recorder.lastError → stopReason = 'sinkError' | 'recorderError'
  │     if bridge.getHudState().engineHalted !== null → stopReason = 'engineHalt'
  │     if bridge.getMatchState().outcome !== 'running' → stopReason = 'stopWhen'
  │     if bridge.world.tick - startTick >= maxTicks → stopReason = 'maxTicks'
  ├─► recorder.disconnect()
  └─► outputs:
      output/playtests/<id>.json           // recorder.toBundle()
      output/playtests/<id>.envelope.json  // { stopReason, ticksRun, seed, scenario, runStartedAt, runCompletedAt, errorCode?, errorMessage?, details? }

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

1. Construct the bridge via `createSimulationBridge(seed)`. No new option needed.
2. Construct a `SessionRecorder` with the live API:
   ```ts
   new SessionRecorder({
     world: bridge.world,
     sink: new MemorySink({ allowSidecar: true }),
     sourceLabel: `aoe2-playtest-${seed}`,
     sourceKind: 'synthetic',
   })
   ```
3. `recorder.connect()`.
4. Loop until one of the stop conditions fires. Probe order is `error → engineHalt → stopWhen → maxTicks`; the first matching condition wins on a tick where multiple are true.
   - `recorder.lastError` populated → `'sinkError'` if `recorder.lastError instanceof SinkWriteError` (imported from `civ-engine/session-errors`), else `'recorderError'`.
   - `bridge.getHudState().engineHalted !== null` → `'engineHalt'`. The probed value is an `EngineHaltDetails` struct, not a boolean; copy `halt.code`, `halt.message`, `halt.tick`, `halt.phase`, `halt.systemName` into the envelope's `details` so REPORT.md can surface the failed system / phase.
   - `bridge.getMatchState().outcome !== 'running'` → `'stopWhen'`.
   - `bridge.world.tick - startTick >= maxTicks` → `'maxTicks'`.
5. `recorder.disconnect()`. Emit `recorder.toBundle()` to `<out>.json`.
6. Write `<out>.envelope.json` with `{ stopReason, ticksRun, seed, scenario, runStartedAt, runCompletedAt }`. For non-`stopWhen` outcomes, additionally include `errorCode`, `errorMessage`, and `details` (the halt-struct fields above for `engineHalt`; `recorder.lastError` shape for sink/recorder errors).

Stop-reason enum:

```ts
type StopReason =
  | 'maxTicks'        // budget exhausted — match incomplete
  | 'stopWhen'        // match-over predicate fired (someone won, or score-timer ended)
  | 'sinkError'       // recorder sink write failure (mid-tick)
  | 'recorderError'   // recorder failed for non-sink reasons
  | 'engineHalt';     // bridge.getHudState().engineHalted set (system threw, was caught by tryTick)
```

Phase 1 also:

- Adds `output/` to `.gitignore`.
- Updates `RecordingService.ts:13-14` to remove the stale `runAgentPlaytest` reference (replace with a pointer to `scripts/playtest.mjs`).
- Updates `docs/architecture/ARCHITECTURE.md` (Component Map row + Boundaries paragraph), `docs/architecture/drift-log.md` (one-line entry), and `docs/architecture/decisions.md` (Key Architectural Decision: bridge-driven loop chosen over `runAgentPlaytest` because of the AI's bridge-internal queue model).

**Determinism.** Simulation stream (ticks, commands, executions, diffs, snapshots) is reproducible from `--seed`. `bundle.metadata.sessionId` and `bundle.metadata.recordedAt` vary across runs. Tests that compare bundles compare `bundle.ticks` / `bundle.commands` / `bundle.executions` directly, not the full JSON.

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
  stopReason: 'maxTicks' | 'stopWhen' | 'sinkError' | 'recorderError' | 'engineHalt';
  ticksRun: number;
  seed: string;
  scenario: string;
  runStartedAt: string;
  runCompletedAt: string;
  errorCode?: string;
  errorMessage?: string;
  details?: Record<string, unknown>;
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

- **match-completes** — when `thresholds.matchCompleteRequired === true`, fail (HIGH severity) on every `envelope.stopReason !== 'stopWhen'`. The four abnormal reasons surface as distinct messages so REPORT.md explains the failure (`maxTicks` = "match did not finish in budget"; `engineHalt` = "engine halted at tick X"; etc.).
- **no-tick-failures** — fail when `bundle.failures.length > 0`. Read engine-fault failures only; do NOT inspect `executions[i].executed` (legitimate stale-state churn).
- **no-perf-regression** — uses `bundleHotspots(bundle, { durationStdevThreshold: 3 })`, filters to `kind === 'duration_outlier'` and `tick >= warmupTicks`. Each remaining hotspot is a low-severity violation. If `perfP99BudgetMs` is set explicitly (not `'auto'`), also fail any tick whose `metrics.durationMs.total > budget` after warmup. Bundle-shape note: `bundleHotspots` requires ≥10 metric-bearing ticks to compute z-scores; smaller bundles return no outliers (the 200-tick smoke test won't exercise outlier detection — that's expected).
- **economy-progression** — for each player with an `aiState`: replays `bundle.initialSnapshot + bundle.ticks[*].diff` to reconstruct state at `economyByTick`, checks villager count ≥ `economyMinVillagers` and age ≥ `economyMinAge`. Violation per failing player.
- **no-pinned-or-oscillating-units** — replays positions tick by tick using `bundle.initialSnapshot.components.position` (`Array<[entityId, Position]>`) for the seed plus `bundle.ticks[i].diff.components.position` (`{ set, removed }`) for incremental updates. The oracle considers any entity that ever held a `unit` component (we filter terrain, resources, buildings out via the unit-set). For each such entity it slides a window of `pinnedWindowTicks` ticks across its position events: net Manhattan progress (`|x_end - x_start| + |y_end - y_start|`) below `pinnedNetProgressCells` fires a violation. Two extra branches catch the edge cases the sliding window misses: a single-event branch (unit was seeded with a position and never moved through the window) and a tail-pinned branch (unit moved and then stayed put through the bundle's effective end). The effective evaluation horizon clamps to `min(position.removed_tick, unit.removed_tick, endTick)` so garrisoning (position removed, unit kept) and destruction (unit removed) do not masquerade as pinning. The intentional broader rule — "stationary unit," not "stationary unit with active `unit.move`" — catches deadlocks even when pathfinding never issued a move command (e.g., the redirect-oscillation regression that motivated the oracle: a unit *should* have moved but couldn't).

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
- If it applies, write `output/fix-proposals/<bundle-id>/<oracle>/proposal.diff` (the diff content) and `WHY.md` (the reasoning + `git apply --check` status).

**Validation gap.** `git apply --check` only confirms textual applicability — the patch will land cleanly. It does NOT confirm that the patched code compiles, type-checks, or passes tests. The propose-only contract is what bridges this gap: the human reads `WHY.md`, runs the gates locally, and commits only if green. Auto-apply (a phase-6 flag) would chain `npm run typecheck && npm run lint && npm run build && npm test` after `git apply` and revert on failure; that is out of scope here.

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

GitHub Actions workflow that runs `npm run playtest:corpus` on PR + main pushes. Uploads `output/corpus/<date>/` directory as an artifact and posts SUMMARY.md to the PR check via `actions/github-script`. (`/.github/workflows/` already exists in the tree.)

## Data flow & invariants

- All bundles, envelopes, reports, proposals, corpus summaries live under `output/`. **Phase 1 adds `output/` to `.gitignore`.**
- The only checked-in artifacts are `playtest-corpus.json` (corpus matrix) and `.github/workflows/playtest.yml`.
- Reproducibility: simulation content is deterministic from seed; metadata varies (sessionId, timestamps).

## Architecture surface (per AGENTS.md "Architecture" rule)

Phase 1 also updates:

- `docs/architecture/ARCHITECTURE.md` — add `src/game/playtest/` to the existing `Repository layout` section; add a paragraph to `Runtime layers` noting the bridge-vs-RecordingService boundary (per ADR 3 in `RecordingService.ts`) and the playtest runner's external-recorder approach (the runner attaches its own `SessionRecorder` to `bridge.world`, distinct from the live game's `RecordingService`).
- `docs/architecture/drift-log.md` — append a row "2026-05-08: added playtest infrastructure (`src/game/playtest/`, `scripts/playtest*.mjs`, CI workflow)".
- `docs/architecture/decisions.md` — append a Key Architectural Decision: "Playtest runner uses bridge.step() rather than runAgentPlaytest because the AI lives inside the bridge as an ECS system, not as a `decide()` callback."
- `src/game/recording/RecordingService.ts:13-14` — replace the `runAgentPlaytest` reference with "Headless playtest agents go through `scripts/playtest.mjs`, which runs its own SessionRecorder externally."

## Test plan

### Unit tests (vitest)

- `tests/playtest/oracles.test.ts` — for each oracle, hand-construct minimal bundles + envelopes that pass and that fail; assert violations are reported correctly.
- `tests/playtest/corpusSchema.test.ts` — schema validation: required fields, wrong types, extra fields.

### Integration tests (vitest)

- `tests/playtest/runPlaytest.test.ts` — actually run the bridge loop for `maxTicks: 200` against the default scenario; assert the bundle is well-formed (correct shape, has tick entries, has the recorder snapshot at start), `envelope.stopReason === 'maxTicks'` (200 ticks ≪ economy ramp; pinning this catches a future engine change that ends matches in <200 ticks), and the oracles run without errors.
- `tests/playtest/endStateEquivalence.test.ts` — run the bridge loop for N ticks, capture `bridge.getEconomyState()`, then construct a `SessionReplayer` from the bundle via `SessionReplayer.fromBundle(...)`. Use `createReplayWorldOnly` + `makeReplayBridge` to reconstruct an `EconomyState` at tick N from the replayer. Diff the two — should match. Catches bundle-incompleteness regressions.

### Manual

- `npm run playtest:corpus` against the smoke corpus produces a green SUMMARY.md.
- A deliberately-broken commit (e.g., delete the §12.7 lazy redirect) makes `no-pinned-or-oscillating-units` fire, and `propose-fix` emits a credible patch.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI planner not deterministic across runs | Existing project property; pinned via `endStateEquivalence.test.ts`. |
| Oracle threshold tuning is finicky | Per-corpus-row thresholds; `'auto'` for perf via `bundleHotspots` z-score. |
| Fix-bot prompts produce bad patches | Propose-only; `git apply --check` validation; human reads `WHY.md`. |
| Bundles are large (megabytes) | Gitignored. CI uploads as artifacts only. |
| Engine API changes | Pinned `civ-engine` version; bundle-format version in `bundle.metadata.engineVersion`. |
| Engine halt swallowed by bridge tryTick | Runner polls `bridge.getHudState().engineHalted` each tick; distinct `engineHalt` stop reason surfaces it. |
| Single-AI baseline lacks AI-vs-AI signal | Accepted trade-off; the smoke corpus still exercises every AI behavior path because the AI eventually attacks the passive human. Phase-6 follow-up adds opponent-selection refactor + AI-vs-AI. |

## Sequencing

| Phase | Commit | Depends on | Multi-CLI review |
|---|---|---|---|
| 1 | feat: playtest runner + .gitignore + ARCHITECTURE.md | — | yes |
| 2 | feat: gameplay oracles | phase 1 (uses bundle + envelope) | yes |
| 3 | feat: fix-bot wrapper | phase 2 (consumes REPORT.md) | yes |
| 4 | feat: corpus runner | phases 1+2 (loops them) | yes |
| 5 | ci: playtest workflow | phase 4 (calls it) | yes |

Each phase = one commit + one multi-CLI review iteration. Thread folder: `docs/threads/current/playtest-loop/`.

## Versioning

Internal tooling — no version bump in `package.json`, no `docs/changelog.md` entry. All changes documented in the devlog.
