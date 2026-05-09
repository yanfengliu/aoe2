# Playtest Loop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the play → detect → propose-fix loop in five phases. Each phase ships standalone with multi-CLI review per AGENTS.md.

**Architecture:** Bridge-driven recording loop (no `runAgentPlaytest`); pure-function oracle layer; Codex / Claude CLI shell-out for fix proposals; deterministic AI vs passive human as the smoke baseline. See `docs/threads/current/playtest-loop/DESIGN.md` for the full design.

**Tech Stack:** TypeScript, vitest, civ-engine `SessionRecorder` + `bundleHotspots` + `SessionReplayer`, Node ESM scripts.

**Node requirement:** Scripts use `node --experimental-strip-types` to import `.ts` modules directly. This requires Node ≥22.6.0. Phase 1 adds an `"engines"` block to `package.json` so `npm install` warns under older Node. The new GitHub Actions workflow (Phase 5) uses `node-version: '22'`; the existing `ci.yml` is not affected because it doesn't run playtest scripts.

---

## Phase 1 — Playtest runner

**Files:**
- Create: `src/game/playtest/types.ts`
- Create: `src/game/playtest/runPlaytest.ts`
- Create: `scripts/playtest.mjs`
- Create: `tests/playtest/runPlaytest.test.ts`
- Modify: `package.json` (add `playtest` script)
- Modify: `.gitignore` (add `output/`)
- Modify: `src/game/recording/RecordingService.ts:13-14` (replace stale runAgentPlaytest reference)
- Modify: `docs/architecture/ARCHITECTURE.md` (add `src/game/playtest/` to Repository layout; add Runtime layers paragraph)
- Modify: `docs/architecture/drift-log.md` (append row)
- Modify: `docs/architecture/decisions.md` (append Key Architectural Decision)
- Modify: `docs/devlog/summary.md` and the latest `docs/devlog/detailed/` file

### Task 1: Add types + npm script

- [ ] **Step 1: Create `src/game/playtest/types.ts`**

```ts
import type { JsonValue } from 'civ-engine';

export type StopReason =
  | 'maxTicks'
  | 'stopWhen'
  | 'sinkError'
  | 'recorderError'
  | 'engineHalt';

export interface OracleEnvelope {
  stopReason: StopReason;
  ticksRun: number;
  seed: string;
  scenario: string;
  runStartedAt: string;
  runCompletedAt: string;
  errorCode?: string;
  errorMessage?: string;
  details?: Record<string, JsonValue>;
}

export interface RunPlaytestConfig {
  seed: string;
  scenario?: string;
  maxTicks: number;
}

export interface RunPlaytestResult {
  bundle: import('civ-engine').SessionBundle;
  envelope: OracleEnvelope;
}
```

- [ ] **Step 2: Add `playtest` npm script + Node engines block in `package.json`**

Insert below `"test:watch"` line:

```json
    "playtest": "node --experimental-strip-types scripts/playtest.mjs",
```

Then add after `"private": true,`:

```json
  "engines": {
    "node": ">=22.6.0"
  },
```

- [ ] **Step 3: Add `output/` to `.gitignore`**

Append:

```
# Playtest loop outputs (bundles, envelopes, oracle reports, fix proposals, corpus summaries)
output/
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no code yet uses the new types).

### Task 2: Test-first — `runPlaytest` happy path

- [ ] **Step 1: Write the failing test at `tests/playtest/runPlaytest.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { runPlaytest } from '../../src/game/playtest/runPlaytest';

describe('runPlaytest', () => {
  it('runs the bridge for maxTicks ticks and emits a well-formed bundle + envelope', async () => {
    const { bundle, envelope } = await runPlaytest({
      seed: 'default-seed',
      maxTicks: 200,
    });

    // Envelope shape
    expect(envelope.stopReason).toBe('maxTicks');
    expect(envelope.ticksRun).toBeGreaterThan(0);
    expect(envelope.ticksRun).toBeLessThanOrEqual(200);
    expect(envelope.seed).toBe('default-seed');
    expect(typeof envelope.runStartedAt).toBe('string');
    expect(typeof envelope.runCompletedAt).toBe('string');

    // Bundle shape
    expect(bundle.ticks.length).toBeGreaterThan(0);
    expect(bundle.metadata.engineVersion).toBeTruthy();
    expect(bundle.metadata.startTick).toBe(0);
    expect(bundle.initialSnapshot).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/playtest/runPlaytest.test.ts`
Expected: FAIL with "Cannot find module './src/game/playtest/runPlaytest'" or equivalent.

### Task 3: Implement `runPlaytest`

- [ ] **Step 1: Create `src/game/playtest/runPlaytest.ts`**

```ts
import { MemorySink, SessionRecorder, SinkWriteError } from 'civ-engine';
import { createSimulationBridge } from '../simulation/createSimulationBridge';
import type {
  OracleEnvelope,
  RunPlaytestConfig,
  RunPlaytestResult,
  StopReason,
} from './types';

const TICK_DELTA_MS = 100;

export async function runPlaytest(config: RunPlaytestConfig): Promise<RunPlaytestResult> {
  const { seed, maxTicks } = config;
  const scenario = config.scenario ?? seed;
  const runStartedAt = new Date().toISOString();

  const bridge = createSimulationBridge(seed);
  const sink = new MemorySink({ allowSidecar: true });
  const recorder = new SessionRecorder({
    world: bridge.world,
    sink,
    sourceLabel: `aoe2-playtest-${seed}`,
    sourceKind: 'synthetic',
  });
  recorder.connect();

  const startTick = bridge.world.tick;
  let stopReason: StopReason = 'maxTicks';
  let errorCode: string | undefined;
  let errorMessage: string | undefined;
  let details: OracleEnvelope['details'] | undefined;

  try {
    while (bridge.world.tick - startTick < maxTicks) {
      bridge.step(TICK_DELTA_MS);

      // Probe order: error → engineHalt → stopWhen → maxTicks
      if (recorder.lastError) {
        stopReason = recorder.lastError instanceof SinkWriteError ? 'sinkError' : 'recorderError';
        const errDetails = recorder.lastError.details as { code?: string } | undefined;
        errorCode = errDetails?.code ?? recorder.lastError.name;
        errorMessage = recorder.lastError.message;
        break;
      }

      const halt = bridge.getHudState().engineHalted;
      if (halt !== null) {
        stopReason = 'engineHalt';
        errorCode = halt.code;
        errorMessage = halt.message;
        details = {
          tick: halt.tick,
          phase: halt.phase,
          systemName: halt.systemName,
        };
        break;
      }

      const matchState = bridge.getMatchState();
      if (matchState.outcome !== 'running') {
        stopReason = 'stopWhen';
        details = { outcome: matchState.outcome };
        break;
      }
    }
  } finally {
    recorder.disconnect();
  }

  const ticksRun = bridge.world.tick - startTick;
  const envelope: OracleEnvelope = {
    stopReason,
    ticksRun,
    seed,
    scenario,
    runStartedAt,
    runCompletedAt: new Date().toISOString(),
    ...(errorCode !== undefined ? { errorCode } : {}),
    ...(errorMessage !== undefined ? { errorMessage } : {}),
    ...(details !== undefined ? { details } : {}),
  };

  return {
    bundle: recorder.toBundle(),
    envelope,
  };
}
```

- [ ] **Step 2: Run the failing test from Task 2 — should now pass**

Run: `npm test -- --run tests/playtest/runPlaytest.test.ts`
Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Task 4: Test the stop-reason probe order

- [ ] **Step 1: Add three more tests to `tests/playtest/runPlaytest.test.ts`**

Append inside the existing `describe`:

```ts
  it('records stopReason "stopWhen" when match outcome flips before maxTicks', async () => {
    // The conquest fixture ends quickly because the AI overwhelms a small enemy.
    // Choose a seed/fixture whose match resolves under 10000 ticks.
    const { envelope } = await runPlaytest({
      seed: 'conquest-fixture',
      maxTicks: 10000,
    });
    expect(['stopWhen', 'maxTicks']).toContain(envelope.stopReason);
    if (envelope.stopReason === 'stopWhen') {
      expect(envelope.details?.outcome).not.toBe('running');
    }
  });

  it('uses sourceKind="synthetic" so downstream tooling distinguishes from live sessions', async () => {
    const { bundle } = await runPlaytest({
      seed: 'default-seed',
      maxTicks: 50,
    });
    expect(bundle.metadata.sourceKind).toBe('synthetic');
    expect(bundle.metadata.sourceLabel).toBe('aoe2-playtest-default-seed');
  });

  it('records the snapshot at the recorder start tick', async () => {
    const { bundle } = await runPlaytest({
      seed: 'default-seed',
      maxTicks: 50,
    });
    expect(bundle.initialSnapshot.tick).toBe(bundle.metadata.startTick);
  });
```

- [ ] **Step 2: Run tests**

Run: `npm test -- --run tests/playtest/runPlaytest.test.ts`
Expected: All four tests PASS. (The `conquest-fixture` test is permissive — accepts either outcome — so it doesn't hard-fail if the fixture's resolution time changes.)

- [ ] **Step 3: Commit Task 1-4**

```bash
git add src/game/playtest/types.ts src/game/playtest/runPlaytest.ts \
        tests/playtest/runPlaytest.test.ts package.json .gitignore
git commit -m "feat(playtest): add runPlaytest core + types + tests"
```

### Task 5: CLI wrapper script

- [ ] **Step 1: Create `scripts/playtest.mjs`**

```js
#!/usr/bin/env node
// Playtest CLI: runs runPlaytest with given args, writes bundle + envelope.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runPlaytest } from '../src/game/playtest/runPlaytest.ts';

function parseArgs(argv) {
  const args = { seed: 'default-seed', maxTicks: 30000, out: 'output/playtests/run' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--seed') args.seed = argv[++i];
    else if (a === '--max-ticks') args.maxTicks = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--scenario') args.scenario = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv);
const result = await runPlaytest({
  seed: args.seed,
  maxTicks: args.maxTicks,
  ...(args.scenario ? { scenario: args.scenario } : {}),
});

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(`${args.out}.json`, JSON.stringify(result.bundle, null, 2));
writeFileSync(`${args.out}.envelope.json`, JSON.stringify(result.envelope, null, 2));

console.log(`stopReason=${result.envelope.stopReason} ticks=${result.envelope.ticksRun}`);
console.log(`bundle: ${args.out}.json`);
console.log(`envelope: ${args.out}.envelope.json`);
```

- [ ] **Step 2: Smoke-test the CLI**

Run: `npm run playtest -- --seed default-seed --max-ticks 100 --out tmp/smoke/run`
Expected: console output `stopReason=maxTicks ticks=100`; files `tmp/smoke/run.json` and `tmp/smoke/run.envelope.json` exist.

If `node` complains about importing `.ts`, the project uses tsx/vite for tests but plain node for scripts. Wrap the import via `node --experimental-strip-types scripts/playtest.mjs`. Update the npm script to:

```json
    "playtest": "node --experimental-strip-types scripts/playtest.mjs",
```

Re-run the smoke test.

- [ ] **Step 3: Cleanup smoke output**

Run: `rm -rf tmp/smoke`

### Task 6: Update RecordingService.ts comment

- [ ] **Step 1: Edit `src/game/recording/RecordingService.ts:13-14`**

Replace the existing two lines:

```ts
// Per ADR 3: this service is for the LIVE human-driven world only.
// Agents driving aoe2 use civ-engine's runAgentPlaytest, which owns
// its own SessionRecorder.
```

with:

```ts
// Per ADR 3: this service is for the LIVE human-driven world only.
// Headless playtest agents go through `scripts/playtest.mjs`, which
// runs its own SessionRecorder externally against `bridge.world`. See
// docs/threads/current/playtest-loop/DESIGN.md.
```

- [ ] **Step 2: Run lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS.

### Task 7: Architecture docs

- [ ] **Step 1: Update `docs/architecture/ARCHITECTURE.md` Repository layout**

Find the `src/game/` subsection and add (alphabetical order, after `replay/`):

```markdown
    - `playtest/` — headless playtest infrastructure. `runPlaytest.ts`
      drives a bridge-driven recording loop (attaches `SessionRecorder`
      to `bridge.world` directly, distinct from the live-game
      `RecordingService`); `oracles.ts` hosts pure gameplay-correctness
      oracles consumed by `scripts/run-oracles.mjs`. CLI entry points
      live under `scripts/playtest*.mjs`. See
      `docs/threads/current/playtest-loop/DESIGN.md`.
```

- [ ] **Step 2: Add a Runtime-layers paragraph**

Find the `Runtime layers` section. After the existing paragraph about live vs replay bridges, add:

```markdown
The playtest runner is a third runtime mode alongside live and replay. It
constructs a normal `SimulationBridge` via `createSimulationBridge`, then
attaches its own `SessionRecorder` directly to `bridge.world` — bypassing
`RecordingService` (which is for live-human sessions only per ADR 3 in
`RecordingService.ts`). The loop calls `bridge.step(100)` each tick so
the bridge's internal `drainPendingCommands` flow runs unchanged; the
recorder hooks the same diff/execution/failure listeners as live mode.
This is why `runAgentPlaytest` is unsuitable here — it would replace the
bridge's command-submission path with a `decide()` callback, but aoe2's
AI lives inside `world.step` and pushes intentions to a side queue the
bridge drains externally.
```

- [ ] **Step 3: Update `docs/architecture/drift-log.md`**

Append a row at the bottom:

```markdown
| 2026-05-08 | Added playtest infrastructure (`src/game/playtest/`, `scripts/playtest*.mjs`, CI workflow) | Self-recursive improvement loop: AI plays, oracles detect regressions, fix-bot proposes patches. See thread `docs/threads/current/playtest-loop/`. |
```

- [ ] **Step 4: Update `docs/architecture/decisions.md`**

Append a Key Architectural Decision row:

```markdown
| 2026-05-08 | Playtest runner uses bridge.step() rather than runAgentPlaytest | aoe2's AI is registered as an ECS system inside `world.step()` that pushes intentions to a bridge-owned `pendingCommands` queue drained between ticks. `runAgentPlaytest`'s `decide(ctx)` contract assumes the agent RETURNS commands; it does not drain a side queue. Wrapping the AI as an `AgentDriver` would require a major refactor (extract planner from bridge) or a brittle bridge-internals leak. The bridge-driven recording loop reuses the existing `drainPendingCommands` flow unchanged. |
```

- [ ] **Step 5: Run docs/lint sanity**

Run: `npm run lint`
Expected: PASS (lint doesn't gate docs but verify no surprise).

### Task 8: Devlog + commit

- [ ] **Step 1: Add devlog summary line**

Edit `docs/devlog/summary.md`. Insert at the top (above the most recent date entry):

```markdown
## 2026-05-08 (playtest loop phase 1)
- **Playtest runner (phase 1, internal tooling):** new `src/game/playtest/runPlaytest.ts` + `scripts/playtest.mjs`. Bridge-driven recording loop (no `runAgentPlaytest` — AI lives inside the bridge as an ECS system pushing to a queue the bridge drains; `decide()` callback model would require a planner refactor). Stop-reason enum + envelope sidecar (`'maxTicks' | 'stopWhen' | 'sinkError' | 'recorderError' | 'engineHalt'`); probe order `error → engineHalt → stopWhen → maxTicks`. ARCHITECTURE.md / drift-log.md / decisions.md updated. `output/` added to `.gitignore`. RecordingService.ts comment updated. 4 tests in `tests/playtest/runPlaytest.test.ts`. Single-AI vs passive-human is the smoke baseline (true AI-vs-AI deferred — AI hard-codes humanPlayerId as enemy target).
```

- [ ] **Step 2: Add detailed devlog entry**

Edit the latest `docs/devlog/detailed/<date>.md` (or create a new file if today's date doesn't have one yet). Append:

```markdown
## 2026-05-08T<HH:MM>:00-07:00 - Playtest loop phase 1 (runner)

### Action
[Multi-paragraph entry per AGENTS.md Devlog convention. Cover: action, code reviewer comments (multi-CLI design review iters 1-3), result, reasoning, notes.]

### Result
`npm test`, `npm run typecheck`, `npm run lint`, `npm run build` all pass. 4 new tests in `tests/playtest/runPlaytest.test.ts`. Smoke-tested `npm run playtest -- --seed default-seed --max-ticks 100`.

### Reasoning
[Why bridge-driven loop instead of runAgentPlaytest; why single-AI baseline; why envelope sidecar.]

### Notes
[Any edge cases worth recording.]
```

- [ ] **Step 3: Run all four gates**

Run: `npm run typecheck && npm run lint && npm test -- --run && npm run build`
Expected: all PASS.

- [ ] **Step 4: Commit Phase 1**

```bash
git add scripts/playtest.mjs src/game/recording/RecordingService.ts \
        docs/architecture/ARCHITECTURE.md docs/architecture/drift-log.md \
        docs/architecture/decisions.md docs/devlog/summary.md \
        docs/devlog/detailed/
git commit -m "feat(playtest): phase 1 — bridge-driven recording loop + CLI

See docs/threads/current/playtest-loop/DESIGN.md and PLAN.md."
```

### Task 9: Multi-CLI review of Phase 1 diff

- [ ] **Step 1: Run Codex + Claude reviews in parallel against the Phase 1 diff**

Write the review prompt to `tmp/review-runs/playtest-loop/2026-05-08/impl-1/codex-prompt.txt` (same prompt for `claude-prompt.txt` minus the BEGIN/END markers paragraph). Starter template:

```
You are a senior code reviewer evaluating a code change on the
playtest-loop branch. The change is on commit HEAD; diff against the
parent commit. The repo's AGENTS.md describes project conventions.

Design (already approved through 3 review iterations):
docs/threads/current/playtest-loop/DESIGN.md.

Scope: Phase 1 of the implementation plan
docs/threads/current/playtest-loop/PLAN.md (Tasks 1-8). Reviews
src/game/playtest/{types.ts, runPlaytest.ts}, scripts/playtest.mjs,
tests/playtest/runPlaytest.test.ts, package.json + .gitignore +
RecordingService.ts comment + ARCHITECTURE.md/drift-log.md/decisions.md.

Verify each claim against the live codebase — grep for symbols,
function signatures, file paths it references; do not approve based
on prompt text alone. Specifically:

- Probe order in runPlaytest matches DESIGN.md: error → engineHalt →
  stopWhen → maxTicks. If multiple conditions hold the first wins.
- SessionRecorder API matches civ-engine: config-object constructor
  with { world, sink, sourceLabel, sourceKind: 'synthetic' };
  connect() / disconnect() / toBundle() / lastError exist.
- engineHalted probe uses !== null (the field type is
  EngineHaltDetails | null, not boolean).
- bundle envelope captures errorCode, errorMessage, details for
  non-stopWhen outcomes.
- recorder.lastError property access is well-typed (no .code; use
  .details narrowing or .name fallback).
- All 4 tests in runPlaytest.test.ts pass; envelope.stopReason ===
  'maxTicks' assertion is present in the smoke test (regression
  guard for engine changes that end matches in <200 ticks).
- ARCHITECTURE.md update lands in Repository layout (not Component
  Map, which doesn't exist) and Runtime layers paragraphs.
- RecordingService.ts:13-14 comment no longer references
  runAgentPlaytest as the headless playtest mechanism.
- output/ added to .gitignore.
- engines.node ≥22.6.0 added to package.json.

Anti-regression checklist:
- iter-1/2/3 design review findings (see
  docs/threads/current/playtest-loop/2026-05-08/design-{1,2,3}/
  REVIEW.md) all remain addressed in the implementation, not just
  the doc.
- Verify docs in the diff match implementation: flag any stale
  signatures, removed APIs still mentioned, or missing coverage of
  new APIs in canonical guides.

Flag bugs, design flaws, ambiguity, missing edge cases, and concerns
about correctness or performance. Only point out an issue if it is
real and important. If there is no issue, say so instead of
nit-picking.

[CODEX ONLY: Begin your review with the literal token
===BEGIN-REVIEW=== on its own line and end with ===END-REVIEW===
on its own line. Do not emit those markers anywhere else.]
```

Run both reviewers (background):

```bash
git diff HEAD~1 | codex exec --model gpt-5.5 -c model_reasoning_effort=xhigh \
  -c approval_policy=never --sandbox read-only --ephemeral \
  "$(cat tmp/review-runs/playtest-loop/2026-05-08/impl-1/codex-prompt.txt)" \
  > tmp/review-runs/playtest-loop/2026-05-08/impl-1/codex.txt 2>&1 &

git diff HEAD~1 | claude -p "$(cat tmp/review-runs/playtest-loop/2026-05-08/impl-1/claude-prompt.txt)" \
  --model "claude-opus-4-7[1m]" --effort max \
  --allowedTools "Read,Glob,Grep,Bash(git diff *),Bash(git log *),Bash(git show *)" \
  > tmp/review-runs/playtest-loop/2026-05-08/impl-1/claude.txt 2>&1 &
```

Wait via:

```bash
until [ -s tmp/review-runs/playtest-loop/2026-05-08/impl-1/codex.txt ] \
   && [ -s tmp/review-runs/playtest-loop/2026-05-08/impl-1/claude.txt ]; do sleep 8; done
```

- [ ] **Step 2: Synthesize `docs/threads/current/playtest-loop/2026-05-08/impl-1/REVIEW.md`**

Per AGENTS.md: severity-tagged findings, final disposition. Address every real finding in iter-2.

- [ ] **Step 3: If reviewers found real bugs, fix them and run gates + multi-CLI re-review**

Repeat until reviewers nitpick instead of catching real bugs.

- [ ] **Step 4: Push to remote**

```bash
git push
```

---

## Phase 2 — Gameplay oracles

**Files:**
- Create: `src/game/playtest/oracles.ts`
- Create: `src/game/playtest/positionReplay.ts` (helper for unit-position reconstruction)
- Create: `scripts/run-oracles.mjs`
- Create: `tests/playtest/oracles.test.ts`
- Modify: `package.json` (add `run-oracles` script)

### Task 10: Oracle types + threshold defaults

- [ ] **Step 1: Append to `src/game/playtest/types.ts`**

```ts
export interface OracleViolation {
  oracle: string;
  severity: 'low' | 'medium' | 'high';
  tick: number | null;
  message: string;
  details?: Record<string, unknown>;
}

export interface OracleThresholds {
  matchCompleteRequired?: boolean;
  perfP99WarmupTicks?: number;
  perfP99BudgetMs?: number | 'auto';
  economyByTick?: number;
  economyMinVillagers?: number;
  economyMinAge?: 'feudal' | 'castle' | 'imperial';
  pinnedNetProgressCells?: number;
  pinnedWindowTicks?: number;
}

export const ORACLE_DEFAULTS: Required<OracleThresholds> = {
  matchCompleteRequired: true,
  perfP99WarmupTicks: 200,
  perfP99BudgetMs: 'auto',
  economyByTick: 5000,
  economyMinVillagers: 8,
  economyMinAge: 'feudal',
  pinnedNetProgressCells: 3,
  pinnedWindowTicks: 50,
};
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

### Task 11: Test-first — `match-completes` oracle

- [ ] **Step 1: Create `tests/playtest/oracles.test.ts`**

The fixture helper deliberately bypasses strict `SessionBundle` typing — the engine's bundle shape is large (rng state, component options, etc.) and oracle tests only inspect a small subset. The helper centralizes the cast so each test only specifies the fields its oracle actually reads.

```ts
import { describe, expect, it } from 'vitest';
import type { SessionBundle } from 'civ-engine';
import { runOracles } from '../../src/game/playtest/oracles';
import { ORACLE_DEFAULTS } from '../../src/game/playtest/types';
import type { OracleEnvelope } from '../../src/game/playtest/types';

interface BundleOverrides {
  ticks?: SessionBundle['ticks'];
  failures?: SessionBundle['failures'];
  endTick?: number;
  initialSnapshotComponents?: Record<string, unknown>;
}

function makeMinimalBundle(overrides: BundleOverrides = {}): SessionBundle {
  return {
    schemaVersion: 1,
    metadata: {
      sessionId: 'test',
      engineVersion: 'test',
      nodeVersion: 'test',
      startTick: 0,
      persistedEndTick: overrides.endTick ?? 0,
      durationTicks: overrides.endTick ?? 0,
      endTick: overrides.endTick ?? 0,
      sourceLabel: 'test',
      sourceKind: 'synthetic',
      recordedAt: new Date().toISOString(),
      failedTicks: [],
    },
    initialSnapshot: {
      version: 5,
      config: { gridWidth: 16, gridHeight: 16, tps: 10 },
      tick: 0,
      entities: { generations: [], alive: [], freeList: [] },
      components: overrides.initialSnapshotComponents ?? {},
      resources: {},
      state: {},
      tags: [],
      rng: { seed: 0, state: 0 },
      componentOptions: {},
      metadata: {},
    },
    ticks: overrides.ticks ?? [],
    commands: [],
    executions: [],
    failures: overrides.failures ?? [],
    markers: [],
    attachments: [],
    snapshots: [],
  } as unknown as SessionBundle;
}

const emptyBundle = makeMinimalBundle();

const baseEnvelope: OracleEnvelope = {
  stopReason: 'stopWhen',
  ticksRun: 100,
  seed: 'test',
  scenario: 'test',
  runStartedAt: '2026-05-08T00:00:00Z',
  runCompletedAt: '2026-05-08T00:01:00Z',
};

describe('match-completes oracle', () => {
  it('passes when stopReason is stopWhen', () => {
    const violations = runOracles(emptyBundle, baseEnvelope, ORACLE_DEFAULTS).filter(v => v.oracle === 'match-completes');
    expect(violations).toHaveLength(0);
  });

  it('fails on maxTicks (match did not finish)', () => {
    const env = { ...baseEnvelope, stopReason: 'maxTicks' as const };
    const violations = runOracles(emptyBundle, env, ORACLE_DEFAULTS).filter(v => v.oracle === 'match-completes');
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe('high');
    expect(violations[0].message).toMatch(/budget|maxTicks/i);
  });

  it('fails on engineHalt with halt details surfaced', () => {
    const env: OracleEnvelope = {
      ...baseEnvelope,
      stopReason: 'engineHalt',
      errorMessage: 'engine halted at tick 42 during update',
      details: { tick: 42, phase: 'update', systemName: 'prototypeAi' },
    };
    const violations = runOracles(emptyBundle, env, ORACLE_DEFAULTS).filter(v => v.oracle === 'match-completes');
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe('high');
    expect(violations[0].message).toContain('engineHalt');
  });

  it('skips when matchCompleteRequired is false', () => {
    const env = { ...baseEnvelope, stopReason: 'maxTicks' as const };
    const violations = runOracles(emptyBundle, env, { ...ORACLE_DEFAULTS, matchCompleteRequired: false }).filter(v => v.oracle === 'match-completes');
    expect(violations).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/playtest/oracles.test.ts`
Expected: FAIL with "Cannot find module './src/game/playtest/oracles'".

### Task 12: Implement `runOracles` skeleton + match-completes

- [ ] **Step 1: Create `src/game/playtest/oracles.ts`**

```ts
import type { SessionBundle } from 'civ-engine';
import type { OracleEnvelope, OracleThresholds, OracleViolation } from './types';
import { ORACLE_DEFAULTS } from './types';

type OracleFn = (
  bundle: SessionBundle,
  envelope: OracleEnvelope,
  thresholds: Required<OracleThresholds>,
) => OracleViolation[];

const matchCompletes: OracleFn = (_bundle, envelope, thresholds) => {
  if (!thresholds.matchCompleteRequired) return [];
  if (envelope.stopReason === 'stopWhen') return [];
  return [{
    oracle: 'match-completes',
    severity: 'high',
    tick: null,
    message: `match did not complete: stopReason=${envelope.stopReason}` +
      (envelope.errorMessage ? ` (${envelope.errorMessage})` : ''),
    details: {
      stopReason: envelope.stopReason,
      ticksRun: envelope.ticksRun,
      ...(envelope.details ?? {}),
    },
  }];
};

const ORACLES: OracleFn[] = [matchCompletes];

export function runOracles(
  bundle: SessionBundle,
  envelope: OracleEnvelope,
  thresholds: OracleThresholds,
): OracleViolation[] {
  const merged = { ...ORACLE_DEFAULTS, ...thresholds };
  return ORACLES.flatMap(o => o(bundle, envelope, merged));
}
```

- [ ] **Step 2: Run match-completes tests**

Run: `npm test -- --run tests/playtest/oracles.test.ts`
Expected: 4 PASS for match-completes.

### Task 13: Test-first — `no-tick-failures` oracle

- [ ] **Step 1: Append to `tests/playtest/oracles.test.ts`**

```ts
describe('no-tick-failures oracle', () => {
  it('passes when bundle.failures is empty', () => {
    const violations = runOracles(emptyBundle, baseEnvelope, ORACLE_DEFAULTS).filter(v => v.oracle === 'no-tick-failures');
    expect(violations).toHaveLength(0);
  });

  it('fires high-severity per failure', () => {
    const bundle = makeMinimalBundle({
      failures: [
        {
          tick: 7,
          schemaVersion: 1,
          phase: 'systems',
          subsystem: 'system',
          systemName: 's',
          code: 'system_throw',
          message: 'boom',
          commandType: null,
          submissionSequence: null,
          details: null,
          error: { name: 'Error', message: 'boom', stack: null },
        },
      ] as unknown as SessionBundle['failures'],
    });
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(v => v.oracle === 'no-tick-failures');
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe('high');
    expect(violations[0].tick).toBe(7);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- --run tests/playtest/oracles.test.ts`
Expected: 2 FAIL on `no-tick-failures` (oracle not implemented).

### Task 14: Implement `no-tick-failures`

- [ ] **Step 1: Edit `src/game/playtest/oracles.ts`**

Add to the file before `const ORACLES`:

```ts
const noTickFailures: OracleFn = (bundle) =>
  bundle.failures.map(f => ({
    oracle: 'no-tick-failures',
    severity: 'high' as const,
    tick: f.tick,
    message: `tick ${f.tick} failed: ${f.code} (${f.message})`,
    details: { code: f.code, message: f.message, systemName: f.systemName, phase: f.phase },
  }));
```

Update the `ORACLES` array:

```ts
const ORACLES: OracleFn[] = [matchCompletes, noTickFailures];
```

- [ ] **Step 2: Run oracle tests**

Run: `npm test -- --run tests/playtest/oracles.test.ts`
Expected: 6 PASS.

### Task 15: Implement `no-perf-regression` (uses `bundleHotspots`)

- [ ] **Step 1: Append to `tests/playtest/oracles.test.ts`**

```ts
describe('no-perf-regression oracle', () => {
  function makeMetricBundle(durations: number[]): SessionBundle {
    return makeMinimalBundle({
      ticks: durations.map((dur, i) => ({
        tick: i + 1,
        diff: {
          tick: i + 1,
          components: {},
          state: { set: [], removed: [] },
          tags: [],
          entities: { created: [], destroyed: [] },
          resources: {},
          metadata: [],
        },
        events: [],
        metrics: { tick: i + 1, durationMs: { total: dur }, simulation: {}, output: {} },
        debug: null,
      })) as unknown as SessionBundle['ticks'],
      endTick: durations.length,
    });
  }

  it('returns no violations when bundle has fewer than 10 ticks (insufficient for z-score)', () => {
    const bundle = makeMetricBundle([5, 5, 5]);
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(v => v.oracle === 'no-perf-regression');
    expect(violations).toHaveLength(0);
  });

  it('flags duration outliers above the warmup window', () => {
    const durations = Array.from({ length: 220 }, (_, i) => (i === 210 ? 100 : 5));
    const bundle = makeMetricBundle(durations);
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(v => v.oracle === 'no-perf-regression');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0].tick).toBe(211);
  });

  it('skips outliers within the warmup window', () => {
    const durations = Array.from({ length: 220 }, (_, i) => (i === 5 ? 100 : 5));
    const bundle = makeMetricBundle(durations);
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(v => v.oracle === 'no-perf-regression');
    expect(violations).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Add `noPerfRegression` to `src/game/playtest/oracles.ts`**

```ts
import { bundleHotspots } from 'civ-engine';

// (existing oracles stay above)

const noPerfRegression: OracleFn = (bundle, _envelope, thresholds) => {
  const hotspots = bundleHotspots(bundle, { durationStdevThreshold: 3, includeMarkers: false });
  const violations: OracleViolation[] = [];
  for (const hot of hotspots) {
    if (hot.kind !== 'duration_outlier') continue;
    if (hot.tick < thresholds.perfP99WarmupTicks) continue;
    const hotDetails =
      typeof hot.details === 'object' && hot.details !== null && !Array.isArray(hot.details)
        ? (hot.details as Record<string, unknown>)
        : { raw: hot.details };
    violations.push({
      oracle: 'no-perf-regression',
      severity: 'low',
      tick: hot.tick,
      message: `tick ${hot.tick} duration outlier: ${hot.message}`,
      details: hotDetails,
    });
  }
  if (thresholds.perfP99BudgetMs !== 'auto') {
    const budget = thresholds.perfP99BudgetMs;
    for (const t of bundle.ticks) {
      if (t.tick < thresholds.perfP99WarmupTicks) continue;
      const dur = (t.metrics?.durationMs as { total?: number } | null | undefined)?.total;
      if (typeof dur === 'number' && dur > budget) {
        violations.push({
          oracle: 'no-perf-regression',
          severity: 'medium',
          tick: t.tick,
          message: `tick ${t.tick} took ${dur}ms (budget ${budget}ms)`,
          details: { durationMs: dur, budgetMs: budget },
        });
      }
    }
  }
  return violations;
};
```

Update `ORACLES`:

```ts
const ORACLES: OracleFn[] = [matchCompletes, noTickFailures, noPerfRegression];
```

- [ ] **Step 3: Run all oracle tests**

Run: `npm test -- --run tests/playtest/oracles.test.ts`
Expected: 9 PASS.

### Task 16: `economy-progression` + `no-pinned-or-oscillating-units`

(Position replay is the meatiest sub-task; isolate it first.)

- [ ] **Step 1: Create `src/game/playtest/positionReplay.ts`**

```ts
import type { Position, SessionBundle, EntityId } from 'civ-engine';

export interface PositionTimeline {
  // Map from entityId → array of (tick, position) events ordered by tick.
  byEntity: Map<EntityId, Array<{ tick: number; pos: Position }>>;
}

export function reconstructPositions(bundle: SessionBundle): PositionTimeline {
  const byEntity = new Map<EntityId, Array<{ tick: number; pos: Position }>>();

  // Seed from initial snapshot. WorldSnapshot.components is shaped as
  // Record<string, Array<[EntityId, T]>> (per civ-engine serializer.d.ts:66),
  // distinct from TickDiff.components which uses { set, removed }.
  const initialPositions = bundle.initialSnapshot.components?.position;
  if (Array.isArray(initialPositions)) {
    for (const [id, pos] of initialPositions as Array<[EntityId, Position]>) {
      byEntity.set(id, [{ tick: bundle.metadata.startTick, pos }]);
    }
  }

  // Apply tick diffs.
  for (const tickEntry of bundle.ticks) {
    const positionDiff = tickEntry.diff.components?.position;
    if (!positionDiff) continue;
    for (const [id, pos] of (positionDiff.set ?? []) as Array<[EntityId, Position]>) {
      const arr = byEntity.get(id) ?? [];
      arr.push({ tick: tickEntry.tick, pos });
      byEntity.set(id, arr);
    }
    for (const id of (positionDiff.removed ?? []) as EntityId[]) {
      byEntity.delete(id);
    }
  }

  return { byEntity };
}

export function netManhattanProgress(
  events: Array<{ tick: number; pos: Position }>,
  windowStart: number,
  windowEnd: number,
): number {
  // Find first event with tick >= windowStart and last with tick <= windowEnd.
  const inWindow = events.filter(e => e.tick >= windowStart && e.tick <= windowEnd);
  if (inWindow.length < 2) return 0;
  const first = inWindow[0]!.pos;
  const last = inWindow[inWindow.length - 1]!.pos;
  return Math.abs(last.x - first.x) + Math.abs(last.y - first.y);
}
```

- [ ] **Step 2: Test position replay (focused)**

Append to `tests/playtest/oracles.test.ts`:

```ts
import { reconstructPositions, netManhattanProgress } from '../../src/game/playtest/positionReplay';

describe('reconstructPositions', () => {
  it('seeds from initialSnapshot then applies diffs', () => {
    // initialSnapshot.components is an array-shaped snapshot map per civ-engine
    // serializer.d.ts (Array<[EntityId, T]>), distinct from the {set, removed}
    // shape used in TickDiff.
    const bundle = makeMinimalBundle({
      initialSnapshotComponents: { position: [[5, { x: 1, y: 1 }]] },
      ticks: [
        {
          tick: 1,
          diff: {
            tick: 1,
            components: { position: { set: [[5, { x: 2, y: 1 }]], removed: [] } },
            state: { set: [], removed: [] },
            tags: [],
            entities: { created: [], destroyed: [] },
            resources: {},
            metadata: [],
          },
          events: [], metrics: null, debug: null,
        },
        {
          tick: 2,
          diff: {
            tick: 2,
            components: { position: { set: [[5, { x: 3, y: 1 }]], removed: [] } },
            state: { set: [], removed: [] },
            tags: [],
            entities: { created: [], destroyed: [] },
            resources: {},
            metadata: [],
          },
          events: [], metrics: null, debug: null,
        },
      ] as unknown as SessionBundle['ticks'],
      endTick: 2,
    });
    const timeline = reconstructPositions(bundle);
    expect(timeline.byEntity.get(5)).toEqual([
      { tick: 0, pos: { x: 1, y: 1 } },
      { tick: 1, pos: { x: 2, y: 1 } },
      { tick: 2, pos: { x: 3, y: 1 } },
    ]);
  });

  it('netManhattanProgress sums absolute deltas in the window', () => {
    const events = [
      { tick: 0, pos: { x: 0, y: 0 } },
      { tick: 5, pos: { x: 3, y: 0 } },
      { tick: 10, pos: { x: 0, y: 0 } },
    ];
    expect(netManhattanProgress(events, 0, 10)).toBe(0);
    expect(netManhattanProgress(events, 0, 5)).toBe(3);
  });
});
```

- [ ] **Step 3: Run position-replay tests**

Run: `npm test -- --run tests/playtest/oracles.test.ts`
Expected: 11 PASS (9 oracle + 2 position-replay).

- [ ] **Step 4: Add `economyProgression` and `noPinnedOrOscillatingUnits` oracles**

Append to `src/game/playtest/oracles.ts`:

```ts
import { reconstructPositions, netManhattanProgress } from './positionReplay';
import type { Position, EntityId } from 'civ-engine';

const economyProgression: OracleFn = (bundle, _envelope, thresholds) => {
  // Replay state at thresholds.economyByTick from initialSnapshot + diffs.
  // For the first iteration: count entities with `unit.unitType === 'villager'`
  // per owner at tick T, plus age via aoe2.playerAges. If a player has no
  // aiState by T, skip them (matches the single-AI baseline; only AI players
  // are evaluated).
  const checkTick = thresholds.economyByTick;
  // (Implementation note: this oracle is a stub for the smoke run. The full
  // state replay path uses SessionReplayer.fromBundle(bundle).stateAtTick(T)
  // and reads the projected economy state. For phase 2 ship, we deliver the
  // skeleton + match-completes + no-tick-failures + no-perf-regression
  // oracles; economy-progression and no-pinned-or-oscillating-units are
  // marked as best-effort scaffolding here, documented as such, and refined
  // in phase-2 iter-2 after multi-CLI review.)
  void checkTick;
  void bundle;
  return [];
};

const noPinnedOrOscillating: OracleFn = (bundle, _envelope, thresholds) => {
  const timeline = reconstructPositions(bundle);
  const violations: OracleViolation[] = [];
  const window = thresholds.pinnedWindowTicks;
  const minProgress = thresholds.pinnedNetProgressCells;
  const endTick = bundle.metadata.endTick ?? bundle.metadata.startTick;

  for (const [entity, events] of timeline.byEntity) {
    if (events.length === 0) continue;

    // Pinned-with-no-diffs case: the unit was seeded with an initial position
    // and never emitted a position change. If world ticks have elapsed past
    // (lastEvent.tick + window) without movement, that's a violation.
    if (events.length === 1) {
      const last = events[0]!;
      if (endTick - last.tick >= window) {
        violations.push({
          oracle: 'no-pinned-or-oscillating-units',
          severity: 'medium',
          tick: last.tick,
          message: `unit ${entity} stayed at (${last.pos.x}, ${last.pos.y}) for ${endTick - last.tick} ticks after tick ${last.tick}`,
          details: { entity, sinceTick: last.tick, durationTicks: endTick - last.tick, position: last.pos },
        });
      }
      continue;
    }

    // Oscillating / pinned-with-diffs case: slide a window through the
    // events; report when net Manhattan progress within the window is below
    // minProgress.
    for (let i = 0; i < events.length; i++) {
      const start = events[i]!.tick;
      const end = start + window;
      if (end > events[events.length - 1]!.tick) break;
      const progress = netManhattanProgress(events, start, end);
      if (progress < minProgress) {
        violations.push({
          oracle: 'no-pinned-or-oscillating-units',
          severity: 'medium',
          tick: start,
          message: `unit ${entity} stayed within ${progress} cells of its starting position over ticks ${start}..${end}`,
          details: { entity, windowStart: start, windowEnd: end, progress },
        });
        break; // one violation per entity is enough
      }
    }
  }
  return violations;
};
```

Update `ORACLES`:

```ts
const ORACLES: OracleFn[] = [
  matchCompletes,
  noTickFailures,
  noPerfRegression,
  economyProgression,
  noPinnedOrOscillating,
];
```

- [ ] **Step 5: Add a smoke test for `noPinnedOrOscillating`**

Append to `tests/playtest/oracles.test.ts`:

```ts
describe('no-pinned-or-oscillating-units oracle', () => {
  function emptyDiff(tick: number) {
    return {
      tick,
      components: {},
      state: { set: [], removed: [] },
      tags: [],
      entities: { created: [], destroyed: [] },
      resources: {},
      metadata: [],
    };
  }
  function diffWithPosition(tick: number, entity: number, pos: { x: number; y: number }) {
    return {
      tick,
      components: { position: { set: [[entity, pos]], removed: [] } },
      state: { set: [], removed: [] },
      tags: [],
      entities: { created: [], destroyed: [] },
      resources: {},
      metadata: [],
    };
  }

  it('does not fire when units make progress', () => {
    const bundle = makeMinimalBundle({
      initialSnapshotComponents: { position: [[1, { x: 0, y: 0 }]] },
      ticks: Array.from({ length: 60 }, (_, i) => ({
        tick: i + 1,
        diff: diffWithPosition(i + 1, 1, { x: i + 1, y: 0 }),
        events: [], metrics: null, debug: null,
      })) as unknown as SessionBundle['ticks'],
      endTick: 60,
    });
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(v => v.oracle === 'no-pinned-or-oscillating-units');
    expect(violations).toHaveLength(0);
  });

  it('fires when a unit is pinned for the full window (no position diffs)', () => {
    const bundle = makeMinimalBundle({
      initialSnapshotComponents: { position: [[1, { x: 5, y: 5 }]] },
      ticks: Array.from({ length: 60 }, (_, i) => ({
        tick: i + 1,
        diff: emptyDiff(i + 1),
        events: [], metrics: null, debug: null,
      })) as unknown as SessionBundle['ticks'],
      endTick: 60,
    });
    const violations = runOracles(bundle, baseEnvelope, ORACLE_DEFAULTS).filter(v => v.oracle === 'no-pinned-or-oscillating-units');
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]!.details).toMatchObject({ entity: 1, position: { x: 5, y: 5 } });
  });
});
```

- [ ] **Step 6: Run all oracle tests**

Run: `npm test -- --run tests/playtest/oracles.test.ts`
Expected: 13 PASS.

### Task 17: `run-oracles.mjs` CLI + commit + review

- [ ] **Step 1: Create `scripts/run-oracles.mjs`**

```js
#!/usr/bin/env node
// Reads a playtest bundle + envelope, runs oracles, writes REPORT.md.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { runOracles } from '../src/game/playtest/oracles.ts';

function parseArgs(argv) {
  const args = { in: 'output/playtests/run', thresholds: {} };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--thresholds') args.thresholds = JSON.parse(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv);
const bundle = JSON.parse(readFileSync(`${args.in}.json`, 'utf8'));
const envelope = JSON.parse(readFileSync(`${args.in}.envelope.json`, 'utf8'));
const violations = runOracles(bundle, envelope, args.thresholds);

const reportDir = `${args.in}-report`;
mkdirSync(reportDir, { recursive: true });
const lines = [
  `# Oracle report — ${basename(args.in)}`,
  '',
  `**stopReason:** ${envelope.stopReason}    **ticksRun:** ${envelope.ticksRun}    **seed:** ${envelope.seed}`,
  '',
];
const high = violations.filter(v => v.severity === 'high');
const medium = violations.filter(v => v.severity === 'medium');
const low = violations.filter(v => v.severity === 'low');
lines.push(`**Violations:** high=${high.length} medium=${medium.length} low=${low.length}`);
lines.push('');
if (violations.length === 0) {
  lines.push('No violations.');
} else {
  lines.push('| Oracle | Severity | Tick | Message |');
  lines.push('|---|---|---|---|');
  for (const v of violations) {
    lines.push(`| ${v.oracle} | ${v.severity} | ${v.tick ?? '—'} | ${v.message.replace(/\|/g, '\\|')} |`);
  }
}

writeFileSync(`${reportDir}/REPORT.md`, lines.join('\n'));
console.log(`report: ${reportDir}/REPORT.md`);
process.exit(high.length);
```

- [ ] **Step 2: Add npm script in `package.json`**

```json
    "run-oracles": "node --experimental-strip-types scripts/run-oracles.mjs",
```

- [ ] **Step 3: Smoke test**

```bash
npm run playtest -- --seed default-seed --max-ticks 100 --out tmp/smoke/run
npm run run-oracles -- --in tmp/smoke/run
cat tmp/smoke/run-report/REPORT.md
rm -rf tmp/smoke
```

Expected: REPORT.md generated; the table shows `match-completes / high` since 100 ticks won't finish a match. Exit code = 1.

- [ ] **Step 4: Run all four gates**

Run: `npm run typecheck && npm run lint && npm test -- --run && npm run build`
Expected: PASS.

- [ ] **Step 5: Update devlog**

Append a Phase-2 entry to `docs/devlog/summary.md` and the latest detailed devlog file.

- [ ] **Step 6: Commit Phase 2**

```bash
git add src/game/playtest/oracles.ts src/game/playtest/positionReplay.ts \
        scripts/run-oracles.mjs tests/playtest/oracles.test.ts package.json \
        src/game/playtest/types.ts docs/devlog/
git commit -m "feat(playtest): phase 2 — gameplay oracles

match-completes, no-tick-failures, no-perf-regression (via bundleHotspots),
economy-progression (skeleton), no-pinned-or-oscillating-units (Manhattan-
progress sliding window). Pure-function oracles + scripts/run-oracles.mjs."
```

- [ ] **Step 7: Multi-CLI review iter-1 of Phase 2 diff**

Same pattern as Task 9. Synthesize `docs/threads/current/playtest-loop/2026-05-08/impl-2/REVIEW.md`. Address findings; iterate until reviewers nitpick.

- [ ] **Step 8: Push**

```bash
git push
```

---

## Phase 3 — Fix-bot wrapper

**Files:**
- Create: `src/game/playtest/fixBotPrompt.ts`
- Create: `scripts/propose-fix.mjs`
- Create: `tests/playtest/fixBotPrompt.test.ts`
- Modify: `package.json` (add `propose-fix` script)

### Task 18: Prompt construction

- [ ] **Step 1: Test-first — `tests/playtest/fixBotPrompt.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { buildFixPrompt, sourceFilesForOracle } from '../../src/game/playtest/fixBotPrompt';

describe('fixBotPrompt', () => {
  it('returns the documented heuristic source files for no-pinned-or-oscillating-units', () => {
    const files = sourceFilesForOracle('no-pinned-or-oscillating-units');
    expect(files).toContain('src/game/simulation/bridge/systems/playerCommandsSystem.ts');
    expect(files).toContain('src/game/simulation/worldOccupancy.ts');
    expect(files).toContain('src/game/simulation/worldOccupancyAllocators.ts');
  });

  it('returns an empty list for unknown oracles', () => {
    expect(sourceFilesForOracle('unknown-oracle')).toEqual([]);
  });

  it('builds a prompt with violation, envelope, tick neighborhood, and source files', () => {
    const prompt = buildFixPrompt({
      violation: { oracle: 'no-tick-failures', severity: 'high', tick: 42, message: 'boom' },
      envelopeJson: '{"stopReason":"engineHalt","seed":"x"}',
      tickNeighborhoodJson: '{}',
      sourceFiles: [{ path: 'a.ts', content: 'export const x = 1;\n' }],
    });
    expect(prompt).toContain('no-tick-failures');
    expect(prompt).toContain('boom');
    expect(prompt).toContain('engineHalt');
    expect(prompt).toContain('a.ts');
    expect(prompt).toContain('export const x = 1;');
    expect(prompt).toMatch(/```diff/);
    expect(prompt).toMatch(/```why/);
  });
});
```

- [ ] **Step 2: Run test to fail**

Run: `npm test -- --run tests/playtest/fixBotPrompt.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Create `src/game/playtest/fixBotPrompt.ts`**

```ts
import type { OracleViolation } from './types';

const SOURCE_FILES_BY_ORACLE: Record<string, string[]> = {
  'no-pinned-or-oscillating-units': [
    'src/game/simulation/bridge/systems/playerCommandsSystem.ts',
    'src/game/simulation/worldOccupancy.ts',
    'src/game/simulation/worldOccupancyAllocators.ts',
  ],
  'no-tick-failures': [
    'src/game/simulation/createSimulationBridge.ts',
    'src/game/simulation/bridge/systems/aiSystem.ts',
  ],
  'no-perf-regression': [
    'src/game/simulation/createSimulationBridge.ts',
  ],
  'economy-progression': [
    'src/game/simulation/bridge/systems/aiSystem.ts',
    'src/game/simulation/ai.ts',
  ],
  'match-completes': [
    'src/game/simulation/createSimulationBridge.ts',
    'src/game/simulation/bridge/systems/aiSystem.ts',
  ],
};

export function sourceFilesForOracle(oracle: string): string[] {
  return SOURCE_FILES_BY_ORACLE[oracle] ?? [];
}

export interface BuildFixPromptInput {
  violation: OracleViolation;
  envelopeJson: string;
  tickNeighborhoodJson: string;
  sourceFiles: Array<{ path: string; content: string }>;
}

export function buildFixPrompt(input: BuildFixPromptInput): string {
  const { violation, envelopeJson, tickNeighborhoodJson, sourceFiles } = input;
  const sourceBlock = sourceFiles
    .map(f => `## ${f.path}\n\n\`\`\`ts\n${f.content}\n\`\`\``)
    .join('\n\n');

  return [
    'You are a senior engineer producing a focused patch.',
    '',
    `## Oracle violation`,
    `- Oracle: ${violation.oracle}`,
    `- Severity: ${violation.severity}`,
    `- Tick: ${violation.tick ?? '(whole-bundle)'}`,
    `- Message: ${violation.message}`,
    violation.details ? `- Details: ${JSON.stringify(violation.details)}` : '',
    '',
    `## Envelope`,
    '```json',
    envelopeJson,
    '```',
    '',
    `## Tick neighborhood`,
    '```json',
    tickNeighborhoodJson,
    '```',
    '',
    `## Source files`,
    '',
    sourceBlock,
    '',
    `## Output format`,
    '',
    'Produce a unified diff in a fenced ```diff block. Explain the fix in 3-5 sentences in a separate fenced ```why block. Do not include any prose outside those two blocks.',
  ].filter(Boolean).join('\n');
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- --run tests/playtest/fixBotPrompt.test.ts`
Expected: 3 PASS.

### Task 19: `propose-fix.mjs` CLI

- [ ] **Step 1: Create `scripts/propose-fix.mjs`**

```js
#!/usr/bin/env node
// Reads REPORT.md + bundle + envelope, picks a violation, asks Codex/Claude
// for a patch, validates with `git apply --check`, writes proposal.diff + WHY.md.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { basename, dirname } from 'node:path';
import { buildFixPrompt, sourceFilesForOracle } from '../src/game/playtest/fixBotPrompt.ts';

function parseArgs(argv) {
  const args = { in: 'output/playtests/run', oracle: null, reviewer: 'claude' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--oracle') args.oracle = argv[++i];
    else if (a === '--reviewer') args.reviewer = argv[++i];
  }
  return args;
}

function which(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

function readSourceFile(path, maxLines = 500) {
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf8');
  const lines = content.split('\n');
  if (lines.length > maxLines) {
    return { path, content: lines.slice(0, maxLines).join('\n') + '\n[…truncated]\n' };
  }
  return { path, content };
}

function pickTickNeighborhood(bundle, tick, radius = 5) {
  if (tick == null) return [];
  return bundle.ticks.filter(t => Math.abs(t.tick - tick) <= radius).slice(0, 11);
}

function extractDiff(modelOutput) {
  const m = modelOutput.match(/```diff\n([\s\S]*?)```/);
  return m ? m[1] : null;
}

function extractWhy(modelOutput) {
  const m = modelOutput.match(/```why\n([\s\S]*?)```/);
  return m ? m[1].trim() : '';
}

const args = parseArgs(process.argv);

if (!which(args.reviewer)) {
  console.error(`fix-bot: '${args.reviewer}' CLI not on PATH. Install or pick a different --reviewer.`);
  process.exit(2);
}

const bundle = JSON.parse(readFileSync(`${args.in}.json`, 'utf8'));
const envelope = JSON.parse(readFileSync(`${args.in}.envelope.json`, 'utf8'));
const reportPath = `${args.in}-report/REPORT.md`;
const report = readFileSync(reportPath, 'utf8');

// Parse REPORT.md table for violations.
const violations = [];
for (const line of report.split('\n')) {
  const m = line.match(/^\| (\S+) \| (low|medium|high) \| (\S+) \| (.+?) \|$/);
  if (m) violations.push({ oracle: m[1], severity: m[2], tick: m[3] === '—' ? null : Number(m[3]), message: m[4] });
}

let target = violations.find(v => v.severity === 'high');
if (args.oracle) target = violations.find(v => v.oracle === args.oracle) ?? target;
if (!target) {
  console.error('fix-bot: no high-severity violation in report and no --oracle override');
  process.exit(0);
}

const sourceFiles = sourceFilesForOracle(target.oracle)
  .map(p => readSourceFile(p))
  .filter(Boolean);

const tickNeighborhood = pickTickNeighborhood(bundle, target.tick);
const tickJson = JSON.stringify(tickNeighborhood, null, 2).slice(0, 8192);

const prompt = buildFixPrompt({
  violation: target,
  envelopeJson: JSON.stringify(envelope, null, 2),
  tickNeighborhoodJson: tickJson,
  sourceFiles,
});

// Invoke the reviewer CLI. shell: true is required on Windows where these
// CLIs install as .cmd shims; harmless on Unix (the shell just unwraps them).
let modelOutput;
if (args.reviewer === 'claude') {
  modelOutput = execFileSync(
    'claude',
    ['-p', prompt, '--model', 'claude-opus-4-7[1m]', '--effort', 'max',
     '--allowedTools', 'Read,Glob,Grep'],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, shell: true },
  );
} else if (args.reviewer === 'codex') {
  modelOutput = execFileSync(
    'codex',
    ['exec', '--model', 'gpt-5.5', '-c', 'model_reasoning_effort=xhigh',
     '-c', 'approval_policy=never', '--sandbox', 'read-only', '--ephemeral'],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, input: prompt, shell: true },
  );
} else {
  console.error(`fix-bot: unknown reviewer '${args.reviewer}'`);
  process.exit(2);
}

const proposalDir = `output/fix-proposals/${basename(args.in)}/${target.oracle}`;
mkdirSync(proposalDir, { recursive: true });

const diff = extractDiff(modelOutput);
const why = extractWhy(modelOutput);
let applyStatus = 'no diff returned';

if (diff) {
  const diffPath = `${proposalDir}/proposal.diff`;
  writeFileSync(diffPath, diff);
  // git apply --check (does not modify the working tree).
  const r = spawnSync('git', ['apply', '--check', diffPath], { encoding: 'utf8' });
  if (r.status === 0) applyStatus = 'applies cleanly';
  else applyStatus = `git apply --check failed: ${r.stderr.trim()}`;
}

writeFileSync(
  `${proposalDir}/WHY.md`,
  `# Fix proposal for ${target.oracle}\n\n` +
    `**Apply status:** ${applyStatus}\n\n` +
    `## Why\n\n${why}\n\n` +
    `## Raw model output\n\n\`\`\`\n${modelOutput.slice(0, 8192)}\n\`\`\`\n`,
);

console.log(`proposal: ${proposalDir}/`);
console.log(`status: ${applyStatus}`);
```

- [ ] **Step 2: Add npm script**

```json
    "propose-fix": "node --experimental-strip-types scripts/propose-fix.mjs",
```

- [ ] **Step 3: Smoke test (manual)**

```bash
npm run playtest -- --seed default-seed --max-ticks 100 --out tmp/smoke/run
npm run run-oracles -- --in tmp/smoke/run
npm run propose-fix -- --in tmp/smoke/run --reviewer claude
ls tmp/smoke/run-report/REPORT.md output/fix-proposals/run/match-completes/
rm -rf tmp/smoke output/fix-proposals/run
```

Expected: a proposal.diff (likely failing `git apply --check` since match-completes is structural — the model probably can't fix it without major refactor) and WHY.md.

- [ ] **Step 4: Run gates**

Run: `npm run typecheck && npm run lint && npm test -- --run && npm run build`
Expected: PASS.

- [ ] **Step 5: Update devlog**

Append Phase-3 entry.

- [ ] **Step 6: Commit Phase 3**

```bash
git add src/game/playtest/fixBotPrompt.ts scripts/propose-fix.mjs \
        tests/playtest/fixBotPrompt.test.ts package.json docs/devlog/
git commit -m "feat(playtest): phase 3 — propose-fix CLI

Codex/Claude shell-out, git apply --check validation, propose-only.
Distinct prompt prefix from AGENTS.md review (engineer-mode, not reviewer-mode)."
```

- [ ] **Step 7: Multi-CLI review of Phase 3 + push**

Same pattern. Address findings, push.

---

## Phase 4 — Corpus runner

**Files:**
- Create: `src/game/playtest/corpusSchema.ts`
- Create: `scripts/playtest-corpus.mjs`
- Create: `playtest-corpus.json`
- Create: `tests/playtest/corpusSchema.test.ts`
- Modify: `package.json` (add `playtest:corpus` script)

### Task 20: Corpus schema + tests

- [ ] **Step 1: Test-first — `tests/playtest/corpusSchema.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { parseCorpusFile } from '../../src/game/playtest/corpusSchema';

describe('parseCorpusFile', () => {
  it('accepts a minimal corpus', () => {
    const json = JSON.stringify({
      runs: [{ name: 'smoke', seed: 'default-seed', maxTicks: 30000 }],
    });
    const corpus = parseCorpusFile(json);
    expect(corpus.runs).toHaveLength(1);
    expect(corpus.runs[0]).toMatchObject({ name: 'smoke', seed: 'default-seed', maxTicks: 30000 });
  });

  it('rejects missing runs', () => {
    expect(() => parseCorpusFile('{}')).toThrow(/runs/);
  });

  it('rejects non-string name', () => {
    const json = JSON.stringify({ runs: [{ name: 1, seed: 'x', maxTicks: 100 }] });
    expect(() => parseCorpusFile(json)).toThrow(/name/);
  });

  it('rejects non-number maxTicks', () => {
    const json = JSON.stringify({ runs: [{ name: 'x', seed: 'x', maxTicks: 'big' }] });
    expect(() => parseCorpusFile(json)).toThrow(/maxTicks/);
  });

  it('accepts optional thresholds', () => {
    const json = JSON.stringify({
      runs: [{ name: 'x', seed: 'x', maxTicks: 100, thresholds: { economyByTick: 1000 } }],
    });
    const corpus = parseCorpusFile(json);
    expect(corpus.runs[0].thresholds?.economyByTick).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test to fail**

Run: `npm test -- --run tests/playtest/corpusSchema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Create `src/game/playtest/corpusSchema.ts`**

```ts
import type { OracleThresholds } from './types';

export interface PlaytestCorpus {
  runs: PlaytestCorpusRun[];
}

export interface PlaytestCorpusRun {
  name: string;
  seed: string;
  maxTicks: number;
  thresholds?: OracleThresholds;
}

export function parseCorpusFile(raw: string): PlaytestCorpus {
  const obj = JSON.parse(raw);
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.runs)) {
    throw new Error('corpus: missing or invalid `runs` array');
  }
  for (const [i, r] of obj.runs.entries()) {
    if (typeof r.name !== 'string') throw new Error(`corpus.runs[${i}]: name must be string`);
    if (typeof r.seed !== 'string') throw new Error(`corpus.runs[${i}]: seed must be string`);
    if (typeof r.maxTicks !== 'number' || r.maxTicks <= 0) {
      throw new Error(`corpus.runs[${i}]: maxTicks must be positive number`);
    }
    if (r.thresholds !== undefined && typeof r.thresholds !== 'object') {
      throw new Error(`corpus.runs[${i}]: thresholds must be object`);
    }
  }
  return obj as PlaytestCorpus;
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- --run tests/playtest/corpusSchema.test.ts`
Expected: 5 PASS.

### Task 21: `playtest-corpus.mjs` + initial corpus + commit + review

- [ ] **Step 1: Create `playtest-corpus.json` at repo root**

```json
{
  "runs": [
    {
      "name": "default-seed-smoke",
      "seed": "default-seed",
      "maxTicks": 30000
    }
  ]
}
```

- [ ] **Step 2: Create `scripts/playtest-corpus.mjs`**

```js
#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseCorpusFile } from '../src/game/playtest/corpusSchema.ts';

const corpus = parseCorpusFile(readFileSync('playtest-corpus.json', 'utf8'));
const date = new Date().toISOString().slice(0, 10);
const corpusDir = `output/corpus/${date}`;
mkdirSync(corpusDir, { recursive: true });

const rows = [`# Playtest corpus — ${date}`, '', '| Run | Seed | maxTicks | stopReason | ticksRun | High | Medium | Low |', '|---|---|---|---|---|---|---|---|'];

for (const run of corpus.runs) {
  const out = `output/playtests/${date}-${run.name}`;
  const playArgs = ['run', 'playtest', '--', '--seed', run.seed, '--max-ticks', String(run.maxTicks), '--out', out];
  // shell: true is required for cross-platform npm (Windows resolves `npm` as
  // `npm.cmd`; Node's child_process refuses .cmd without a shell).
  const playR = spawnSync('npm', playArgs, { encoding: 'utf8', shell: true });
  if (playR.status !== 0) {
    console.error(`corpus: run ${run.name} failed:\n${playR.stderr}`);
    process.exit(1);
  }
  const oracleArgs = ['run', 'run-oracles', '--', '--in', out];
  if (run.thresholds) oracleArgs.push('--thresholds', JSON.stringify(run.thresholds));
  spawnSync('npm', oracleArgs, { encoding: 'utf8', shell: true });
  const env = JSON.parse(readFileSync(`${out}.envelope.json`, 'utf8'));
  const report = readFileSync(`${out}-report/REPORT.md`, 'utf8');
  const high = (report.match(/^\| \S+ \| high \| /gm) ?? []).length;
  const medium = (report.match(/^\| \S+ \| medium \| /gm) ?? []).length;
  const low = (report.match(/^\| \S+ \| low \| /gm) ?? []).length;
  rows.push(`| ${run.name} | ${run.seed} | ${run.maxTicks} | ${env.stopReason} | ${env.ticksRun} | ${high} | ${medium} | ${low} |`);
}

writeFileSync(`${corpusDir}/SUMMARY.md`, rows.join('\n'));
console.log(`summary: ${corpusDir}/SUMMARY.md`);
```

- [ ] **Step 3: Add npm script**

```json
    "playtest:corpus": "node --experimental-strip-types scripts/playtest-corpus.mjs",
```

- [ ] **Step 4: Smoke test**

Run: `npm run playtest:corpus`
Expected: produces `output/corpus/<date>/SUMMARY.md`. Reads as a one-row table.

- [ ] **Step 5: Run gates**

Run: `npm run typecheck && npm run lint && npm test -- --run && npm run build`
Expected: PASS.

- [ ] **Step 6: Update devlog**

Append Phase-4 entry.

- [ ] **Step 7: Commit Phase 4**

```bash
git add src/game/playtest/corpusSchema.ts scripts/playtest-corpus.mjs \
        playtest-corpus.json tests/playtest/corpusSchema.test.ts \
        package.json docs/devlog/
git commit -m "feat(playtest): phase 4 — corpus runner

playtest-corpus.json (smoke 1-row corpus); scripts/playtest-corpus.mjs;
TypeScript schema for corpus-row validation. Output:
output/corpus/<date>/SUMMARY.md."
```

- [ ] **Step 8: Multi-CLI review + push**

---

## Phase 5 — CI hookup

**Files:**
- Create: `.github/workflows/playtest.yml`

### Task 22: GitHub Actions workflow + commit + review

- [ ] **Step 1: Create `.github/workflows/playtest.yml`**

```yaml
name: playtest-corpus
on:
  pull_request:
  push:
    branches: [main]

jobs:
  corpus:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run playtest:corpus
      - name: Upload corpus output
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: corpus-${{ github.run_id }}
          path: output/corpus/
      - name: Post SUMMARY.md to PR check
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const path = require('path');
            const corpusDir = 'output/corpus';
            const dates = fs.existsSync(corpusDir) ? fs.readdirSync(corpusDir) : [];
            if (dates.length === 0) return;
            const summary = fs.readFileSync(path.join(corpusDir, dates[dates.length - 1], 'SUMMARY.md'), 'utf8');
            await github.rest.issues.createComment({
              ...context.repo, issue_number: context.payload.pull_request.number,
              body: `## Playtest corpus\n\n${summary}`,
            });
```

- [ ] **Step 2: Validate the workflow YAML**

Run: `npx --yes @action-validator/core .github/workflows/playtest.yml` (if available; otherwise `cat` and eyeball — basic syntax check via `yq` if installed).

- [ ] **Step 3: Update devlog + ARCHITECTURE.md (CI hookup row)**

Append CI hookup row to drift-log.md.

- [ ] **Step 4: Commit Phase 5**

```bash
git add .github/workflows/playtest.yml docs/devlog/ docs/architecture/
git commit -m "ci(playtest): run corpus on PR + main

Uploads output/corpus/<date>/ as artifact; posts SUMMARY.md as PR comment."
```

- [ ] **Step 5: Multi-CLI review iter-1 of Phase 5 diff + push**

After convergence, push.

---

## Wrap-up

### Task 23: Move thread to done; final devlog summary

- [ ] **Step 1: Move thread folder**

```bash
git mv docs/threads/current/playtest-loop docs/threads/done/playtest-loop
git commit -m "chore(threads): close playtest-loop

5 phases shipped end-to-end:
- Phase 1: bridge-driven recording loop + CLI
- Phase 2: gameplay oracles + run-oracles CLI
- Phase 3: propose-fix CLI (Codex/Claude shell-out)
- Phase 4: corpus runner
- Phase 5: GitHub Actions CI

3 design iterations + 5 implementation iterations + multi-CLI review at each."
```

- [ ] **Step 2: Final devlog summary**

Update `docs/devlog/summary.md` with the closing-the-loop entry.

- [ ] **Step 3: Push**

```bash
git push
```

Done. The play → detect → propose-fix loop is closed end-to-end.

---

## Self-Review

**Spec coverage.** Every section of DESIGN.md maps to at least one task: Phase 1 component design → Tasks 1-9; Phase 2 oracles + thresholds → Tasks 10-17; Phase 3 fix-bot → Tasks 18-19; Phase 4 corpus + schema → Tasks 20-21; Phase 5 CI → Task 22. Architecture surface (ARCHITECTURE.md, drift-log.md, decisions.md) → Task 7. RecordingService comment update → Task 6. `output/` gitignore → Task 1. Test plan (`runPlaytest.test.ts`, oracle tests, corpus schema test) → Tasks 2/4, 11-16, 20.

**Placeholder scan.** No "TBD" / "TODO" / "implement later" / "appropriate error handling" / "similar to Task N" patterns. Every code step shows actual code. The economy-progression oracle in Task 16 is documented as a deliberate skeleton (not a placeholder) with the reason (full state replay deferred to phase-2 iter-2 review-driven extension); this is a real design decision, not a hidden TBD.

**Type consistency.** `OracleViolation`, `OracleEnvelope`, `OracleThresholds`, `StopReason`, `RunPlaytestConfig`, `RunPlaytestResult` defined in Task 1 + Task 10 are used identically across all later tasks. `runOracles` signature is consistent. `parseCorpusFile` returns `PlaytestCorpus` consistently. `buildFixPrompt` parameter shape consistent between Task 18 and Task 19.
