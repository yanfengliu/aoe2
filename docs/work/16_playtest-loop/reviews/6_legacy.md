# Playtest Loop — Plan Iteration 1 Review

Date: 2026-05-08

Reviewers: Codex (`gpt-5.5` xhigh, read-only sandbox) and Claude (`opus-4-7[1m]` max, Read/Glob/Grep). Both verified plan claims against the live codebase.

## Disposition

**Plan iter-2 needed before implementation.** Reviewers converged on the same five HIGH bugs in code samples; Codex adds two more HIGH (`initialSnapshot.components.position` shape; bad path in fix-bot heuristic) plus a CI-Node-version mismatch. The plan's structure (5 phases, TDD ordering, multi-CLI per phase) is sound; the bugs are localized to specific code blocks. Iter-2 fixes are inline edits.

## Findings

### HIGH (block typecheck or runtime)

**H1. `recorder.lastError.code` doesn't exist** (both).

`SessionRecordingError extends Error` only adds `.details: JsonValue | undefined` (`session-errors.d.ts:9-12`). Plan Task 3 reads `.code`. Typecheck blocks. Fix: `(recorder.lastError.details as { code?: string } | undefined)?.code ?? recorder.lastError.name`.

**H2. `require()` in ESM** (both).

Plan Task 19 (`scripts/propose-fix.mjs`) calls `require('node:path').basename(...)`. `.mjs` is ESM; `require` is undefined → `ReferenceError`. Fix: `import { basename, dirname } from 'node:path'` at the top.

**H3. `spawnSync('npm', ...)` on Windows** (both).

Project's primary platform is Windows. On Windows `npm` is `npm.cmd`; Node refuses `.cmd` without `shell: true`. Plan Task 21 will fail local smoke tests (CI on Ubuntu would silently work). Fix: `{ encoding: 'utf8', shell: true }` in all `spawnSync('npm', ...)` and `execFileSync('claude', ...)` / `execFileSync('codex', ...)` calls.

**H4. SessionBundle test stubs don't match the live shape** (both).

`SessionMetadata` requires `nodeVersion`, `persistedEndTick`, `durationTicks`. `failedTicks` is `number[]`, not `0`. `closedNormally` is not a SessionMetadata field. `SessionBundle` has no top-level `events`. `WorldSnapshot` requires `version`, `config`, `entities: {generations, alive, freeList}`, `resources`, `rng: RandomState`. `TickDiff` literals omit required `tick`, `resources`. `TickFailurePhase` is `'commands' | 'systems' | 'resources' | 'diff' | 'listeners'` — `'update'` is invalid.

Fix: change every test fixture's outer annotation from `: SessionBundle` to `as unknown as SessionBundle`. Document this as a deliberate trade-off so reviewers know fixtures intentionally bypass strict-typing for compactness. Add a single helper `makeMinimalBundle(overrides?)` in the test file that fills sane defaults for fields the oracle doesn't read, so each test only specifies the fields its oracle actually inspects.

**H5. `bundleHotspots.details` JsonValue → Record<string, unknown> mismatch** (both).

`BundleHotspot.details: JsonValue` (`bundle-hotspots.d.ts:17`). `OracleViolation.details?: Record<string, unknown>`. JsonValue includes primitives + arrays; assignment fails typecheck. Fix: narrow with `typeof hot.details === 'object' && hot.details !== null && !Array.isArray(hot.details) ? hot.details as Record<string, unknown> : { raw: hot.details }`.

**H6. `initialSnapshot.components.position` shape is wrong** (Codex, NEW).

`bundle.initialSnapshot` is a `WorldSnapshot`, not a `TickDiff`. Snapshot's `components` is `Record<string, Array<[EntityId, T]>>` (per `serializer.d.ts:66`), not `{ set, removed }`. Plan Task 16's `reconstructPositions` reads `initialPositions.set` — that property doesn't exist on a snapshot. Real bundles seed zero positions. Fix:

```ts
const initialPositions = bundle.initialSnapshot.components?.position;
if (Array.isArray(initialPositions)) {
  for (const [id, pos] of initialPositions as Array<[EntityId, Position]>) {
    byEntity.set(id, [{ tick: bundle.metadata.startTick, pos }]);
  }
}
```

**H7. Fix-bot heuristic source paths use a non-existent `bridge/createSimulationBridge.ts`** (Codex, NEW).

Plan Task 18's `SOURCE_FILES_BY_ORACLE` references `src/game/simulation/bridge/createSimulationBridge.ts` for three oracle entries (no-tick-failures, no-perf-regression, match-completes). The actual file is `src/game/simulation/createSimulationBridge.ts` (no `bridge/` segment — the bridge subfolder is for helper modules). Three oracle prompts silently omit the bridge source file. Fix: drop the `bridge/` prefix in those three entries.

### MEDIUM

**M1. Pinned-unit oracle misses the case it claims to test** (both).

`reconstructPositions` only emits events for position changes. A pinned unit with an initial position and no diffs has `events.length === 1`. The oracle skips entities with `events.length < 2` (`if (events.length < 2) continue`). The Task 16 smoke test "fires when a unit is pinned" seeds a unit and emits 60 ticks of empty diffs — that test will get 0 violations.

Fix: detect "no events past tick T despite world-tick advancing past T+window" as its own pinning signal:

```ts
for (const [entity, events] of timeline.byEntity) {
  if (events.length === 0) continue;
  const last = events[events.length - 1]!;
  const remainder = bundle.metadata.endTick - last.tick;
  if (events.length === 1 && remainder >= window) {
    violations.push({
      oracle: 'no-pinned-or-oscillating-units',
      severity: 'medium',
      tick: last.tick,
      message: `unit ${entity} stayed at (${last.pos.x}, ${last.pos.y}) for ${remainder} ticks after tick ${last.tick}`,
      details: { entity, sinceTick: last.tick, durationTicks: remainder, position: last.pos },
    });
    continue;
  }
  // existing sliding-window logic ...
}
```

Also: the design says "with an active unit.move command" but the implementation never checks. For iter-2 we ship the position-only check (matches the spec literally) and document that future iterations could cross-reference `aoe2.unitCommands` slot reads from the bundle.

**M2. `Record<string, never>` cast in OracleEnvelope.details is wrong** (Claude).

Task 3 has `{ details: details as Record<string, never> }`. `Record<string, never>` means values must be `never` — opposite of intent. Fix: drop the cast; the local `details` is already `Record<string, unknown> | undefined` and assigns directly.

**M3. Task 9 review prompt underspecified** (both).

Plan says "Use the AGENTS.md baseline + diff-against-prior-commit pipe" without a starter prompt. AGENTS.md mandates baseline + intent + prior findings + focus files + anti-regression checklist + (Codex) BEGIN/END markers. Add a concrete prompt template into Task 9 that the implementer can adapt per phase.

**M4. Live CI uses Node 20; `--experimental-strip-types` needs Node 22.6+** (Codex).

The new `.github/workflows/playtest.yml` (Task 22) pins Node 22 — fine. But the existing `.github/workflows/ci.yml` uses Node 20. The package.json scripts that wrap `.mjs` files calling into `.ts` rely on Node 22.6+'s `--experimental-strip-types`. If anyone runs `npm run playtest` against Node 20 (local or CI), it fails.

Fix: add a `"engines": { "node": ">=22.6.0" }` block to `package.json` so npm warns. Also add a comment to the new playtest scripts noting the Node requirement.

### LOW

- **L1.** `halt.code ?? 'engine_halt'` fallbacks are dead — `EngineHaltDetails.code` and `.message` are non-nullable. Style only (Claude).
- **L2.** The fix-bot's REPORT.md regex captures messages with escaped `\|` — robust by anchor design, but downstream consumers see literal `\|` (Claude).
- **L3.** Smoke-test commands use `rm -rf` and `cat`. PowerShell needs `Remove-Item -Recurse` and `Get-Content`. Implementer can use the harness's Bash tool, but document the expectation (Claude).
- **L4.** `as never` casts in test fixtures hide future schema evolution. Recommend targeted casts (Claude).
- **L5.** `--experimental-strip-types` works on Node 22.6+; local dev is 22.14, CI is 20 (M4 above) (both).
- **L6.** Position diff path verified correct against `diff.d.ts:10-13` (Claude).
- **L7.** `--no-warnings` could suppress experimental-flag stderr (Claude).
- **L8.** Codex's `--ignore-user-config` correctly omitted; `claude`'s allowedTools subset for engineer-mode is fine (Claude).

### Verified clean (both reviewers)

- `MemorySink`, `SinkWriteError`, `SessionRecorder`, `bundleHotspots` exported from `civ-engine`.
- `SessionRecorder` config-object constructor + `connect`/`disconnect`/`toBundle` shape.
- `bridge.getHudState().engineHalted: EngineHaltDetails | null` (`types.ts:412-426`); probe `!== null`.
- `bridge.getMatchState().outcome: 'running' | 'victory' | 'defeat' | 'draw'` (`types.ts:466-481`); probe `!== 'running'`.
- Probe order in DESIGN.md matches plan: error → engineHalt → stopWhen → maxTicks.
- TPS = 10 (`prototypeScenario.ts:18`); `bridge.step(100)` advances exactly one tick per call.
- `createSimulationBridge(seed)` signature.
- REPORT.md violation regex robust to escaped pipes.

## Action plan for plan-iter-2

Apply inline to PLAN.md, then commit:

1. **H1.** Task 3: replace `recorder.lastError.code` with `(recorder.lastError.details as { code?: string } | undefined)?.code`.
2. **H2.** Task 19: `import { basename, dirname } from 'node:path'`; replace `require('node:path').basename(...)` with `basename(...)`.
3. **H3.** Task 21 + Task 19: add `shell: true` to all `spawnSync('npm', ...)` and `execFileSync('claude' | 'codex', ...)` calls.
4. **H4.** Tasks 11 / 13 / 15 / 16: introduce `makeMinimalBundle(overrides)` helper at top of test file; rewrite each test to use it. Outer annotation `as unknown as SessionBundle` for any direct literals.
5. **H5.** Task 15: narrow `hot.details` with the `typeof === 'object' && !Array.isArray` check before assignment.
6. **H6.** Task 16: fix `reconstructPositions` to handle `bundle.initialSnapshot.components.position` as `Array<[EntityId, Position]>` directly.
7. **H7.** Task 18: drop `bridge/` from the three `createSimulationBridge.ts` paths.
8. **M1.** Task 16: extend `noPinnedOrOscillating` with the no-diffs-past-tick-T branch; update the smoke test to expect the violation.
9. **M2.** Task 3: drop `as Record<string, never>` cast; let TypeScript infer.
10. **M3.** Task 9: add a concrete review prompt template (≈40 lines) covering baseline + intent + prior-iteration findings + focus files + anti-regression + BEGIN/END markers.
11. **M4.** Task 1: add `"engines": { "node": ">=22.6.0" }` to `package.json`. Document Node requirement in PLAN.md preamble.

After plan-iter-2, run plan-2 multi-CLI review. Convergence target: nits.
