# Playtest Self-Iteration Loop — Design

Date: 2026-05-08

## Problem

Today the project has the prerequisites for an autonomous play → detect → fix → iterate loop (deterministic replay, session recording, `bundleHotspots` for outlier detection, `forkAt` for counterfactuals, `runAgentPlaytest` engine API), but none of those pieces are wired together. Closing the gap requires a small set of glue scripts and a gameplay-correctness oracle layer — no engine changes.

## Goal

Five new modules/scripts in aoe2 that compose into a closed loop:

1. **Playtest runner** drives the rule-based AI vs itself, emits a `SessionBundle`.
2. **Gameplay oracles** read bundles and report violations.
3. **Fix-bot wrapper** turns oracle violations into proposed patches via Codex / Claude CLI.
4. **Corpus runner** loops 1-2 over a config matrix, aggregates a summary.
5. **CI hookup** runs the smoke corpus on PR / main pushes.

Phases 1 + 2 are prerequisite for 3-5. Phases 3-5 land independently.

## Non-Goals

- Pixel / visual diff oracles (HUD rendering is exercised by the existing Playwright suite).
- Cross-corpus regression detection (needs baseline storage; phase-6 follow-up).
- LLM-driven `AgentDriver` (engine API supports it; this design uses the rule-based AI as the deterministic baseline so the loop's bug oracle isn't fighting a stochastic agent).
- Auto-apply patches. Per user direction the fix-bot is propose-only; an auto-apply flag is a phase-6 follow-up.

## Architecture

```
scripts/playtest.mjs ──► civ-engine runAgentPlaytest ──► SessionBundle (output/playtests/<id>.json)
                                                                      │
                                                                      ▼
                                                  src/game/playtest/oracles.ts
                                                                      │
                                                                      ▼
                                              output/playtests/<id>/REPORT.md
                                                                      │
                                                                      ▼ (on violation)
                                                  scripts/propose-fix.mjs
                                                                      │
                                                                      ▼
                          output/fix-proposals/<id>/<violation>/{proposal.diff, WHY.md}

scripts/playtest-corpus.mjs ──► loops scripts/playtest.mjs over playtest-corpus.json
                              ──► aggregates output/corpus/<date>/SUMMARY.md
```

## Component design

### Phase 1 — `scripts/playtest.mjs`

Node ESM script. Imports `runAgentPlaytest` and `SessionBundle` types from `civ-engine`, plus the existing aoe2 simulation bridge factory.

CLI:

```
npm run playtest -- --seed default-seed --max-ticks 30000 --out output/playtests/foo.json
```

Implementation:

- Build a fresh `World` via aoe2's existing scenario seed path (default scenario or a CLI-overridable fixture name).
- Wrap the existing rule-based AI planner (`Slice 10 AI`) as an `AgentDriver`. The driver's `decide(ctx)` reads the AI's intentions for all non-human owners, plus a "human-as-AI" wrapper for player 1 (so the playtest is deterministic AI vs deterministic AI, no human input).
- Pass the world + driver to `runAgentPlaytest({ world, agent, maxTicks })`.
- Write `result.bundle` as JSON to `--out`. Print `result.stopReason` and `result.ticksRun`.

Determinism: the wrapped AI is deterministic given the seed (existing project property). Bundle is byte-reproducible from `--seed`.

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

function runOracles(bundle: SessionBundle): OracleViolation[];
```

Each oracle is pure: takes a `SessionBundle`, returns zero or more violations. They compose via array concat. Initial set:

- **match-completes** — bundle ends with someone winning OR with `stopReason !== 'maxTicks'`. Failure: infinite-game regression.
- **no-tick-failures** — `bundle.ticks.every(t => !t.failure)` AND `bundle.executions.every(e => e.executed !== false)`. Failure: engine error.
- **no-perf-regression** — per-tick `metrics.durationMs.total` ≤ configurable budget (default 50ms p99). Failure: simulation slowdown.
- **economy-progression** — by tick T (default 5000), each player produced ≥ N villagers (default 8) and reached Feudal. Failure: AI is broken.
- **no-stuck-units** — no unit with an active `unit.move` command stayed at one integer position for more than M ticks (default 50). Failure: redirect oscillation regression (catches the §12.7 lazy-redirect contract being broken).

`scripts/run-oracles.mjs`: reads a bundle JSON, runs the oracles, writes `output/playtests/<id>/REPORT.md`. Exit code = number of high-severity violations.

### Phase 3 — `scripts/propose-fix.mjs`

Reads `REPORT.md`, picks the first high-severity violation in document order (or accepts `--oracle <name>` to target a specific one). Builds a Codex / Claude CLI prompt:

- Violation summary + tick + details.
- Bundle metadata (engineVersion, seed).
- Heuristic glob of relevant source files keyed off the oracle name (e.g., `no-stuck-units` → `src/game/simulation/bridge/systems/playerCommandsSystem.ts`, `src/game/simulation/worldOccupancy.ts`).
- The standard "you are a senior engineer" review/fix prompt prefix from AGENTS.md.

Captures the model's response as:

- `output/fix-proposals/<bundle-id>/<oracle-name>/proposal.diff` — the unified diff.
- `output/fix-proposals/<bundle-id>/<oracle-name>/WHY.md` — the model's reasoning.

**Propose-only.** No `git apply`, no commit. Human inspects and applies via `git apply` if convinced.

CLI: `npm run propose-fix -- --bundle output/playtests/foo.json --oracle no-stuck-units`.

### Phase 4 — `scripts/playtest-corpus.mjs`

Reads `playtest-corpus.json` at repo root:

```json
{
  "runs": [
    { "name": "default-seed-2p", "seed": "default-seed", "maxTicks": 30000 }
  ]
}
```

For each entry:

1. Run `playtest.mjs` to produce a bundle.
2. Run `run-oracles.mjs` on the bundle.
3. Append the per-run row to `output/corpus/<date>/SUMMARY.md` (run name, ticks run, stop reason, violation count by severity).

Single command: `npm run playtest:corpus`.

### Phase 5 — `.github/workflows/playtest.yml`

GitHub Actions workflow that runs `npm run playtest:corpus` on PR + main pushes. Uploads the `output/corpus/<date>/` directory as a workflow artifact and posts SUMMARY.md to the PR check.

(The repo already has `.github/` per the recent thread; this is one new YAML file.)

## Data flow & invariants

- All bundles live under `output/playtests/`. Gitignored.
- Reports + proposals live under `output/playtests/<id>/` and `output/fix-proposals/`. Gitignored.
- Corpus summaries live under `output/corpus/<date>/`. Gitignored.
- The only checked-in artifact is `playtest-corpus.json` (the matrix config) and the workflow YAML.
- Bundle determinism: same seed + same code → same bundle bytes. Tests assert this.

## Test plan

### Unit tests (vitest)

- `tests/playtest/oracles.test.ts` — for each oracle, hand-construct minimal bundles (or fixtures) that pass and that fail; assert violations are reported correctly.
- `tests/playtest/agentDriver.test.ts` — the rule-based-AI-as-AgentDriver wrapper produces the same per-tick command stream as the live game's AI planner (anchor against an existing AI-planner test fixture).

### Integration tests (vitest)

- `tests/playtest/runPlaytest.test.ts` — actually run `runAgentPlaytest` for a small `maxTicks: 200` against the default scenario; assert the bundle is well-formed and the oracles run without errors.

### Manual

- `npm run playtest:corpus` against the smoke corpus produces a green SUMMARY.md.
- A deliberately-broken commit (e.g., delete the §12.7 lazy redirect) makes `no-stuck-units` fire, and `propose-fix` emits a credible patch.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| AI planner not deterministic across runs | Existing project property; recent devlog entries cite deterministic AI in tests. Pin via the `agentDriver.test.ts` snapshot. |
| Oracle threshold tuning is finicky | All thresholds are CLI / config flags. Defaults documented in `oracles.ts`. |
| Fix-bot prompts produce bad patches | Propose-only. Human reads `WHY.md`. Phase-6 auto-apply only with green-gates check. |
| Bundles are large (megabytes) | Gitignored. CI uploads them as artifacts only. Long-term retention is not a goal for the smoke corpus. |
| Engine `runAgentPlaytest` API changes | Pin `civ-engine` version; bundle-format version is captured in `SessionBundle.metadata.engineVersion`. |

## Sequencing

| Phase | Commit | Depends on | Multi-CLI review |
|---|---|---|---|
| 1 | feat: playtest runner | engine `runAgentPlaytest` (already shipped) | yes |
| 2 | feat: gameplay oracles | phase 1 (uses bundle shape) | yes |
| 3 | feat: fix-bot wrapper | phase 2 (consumes REPORT.md) | yes |
| 4 | feat: corpus runner | phases 1+2 (loops them) | yes |
| 5 | ci: playtest workflow | phase 4 (calls it) | yes |

Each phase ships standalone with its own multi-CLI review iteration. Thread folder: `docs/threads/current/playtest-loop/`.

## Versioning

This is internal tooling — not user-visible game behavior. No version bump in `package.json`, no changelog entry. Documented in the devlog only.

## Open questions for review

- Are the initial oracle thresholds (50ms p99, 8 villagers by tick 5000, 50 ticks stuck) reasonable for a smoke run? Multi-CLI review should sanity-check.
- The `human-as-AI` wrapper for player 1 — should it use the same planner as the AI opponents, or a simpler "do nothing" baseline so the test is more diagnostic?
- Should `propose-fix.mjs` invoke Codex specifically (cheaper, more terse), Claude (more capable), or both and let the user pick?
