# Playtest Loop — Plan Iteration 2 Review

Date: 2026-05-08

Reviewers: Codex (`gpt-5.5` xhigh, read-only sandbox) and Claude (`opus-4-7[1m]` max). Both verified iter-1 fixes against the live `civ-engine` type defs and the `src/game/simulation/` tree. Findings merged below.

## Disposition

**Plan iter-3 needed before implementation.** All 11 iter-1 findings (H1–H7, M1–M4) landed cleanly. However, the iter-1 H3 fix (`shell: true` on every `npm`/`claude`/`codex` invocation) introduced a new HIGH regression: `shell: true` re-parses joined args through the platform shell, so any arg containing shell metacharacters (`"`, `$`, backtick, `&`, `|`, `{a,b}`, etc.) gets mangled. This breaks the claude prompt arg in propose-fix.mjs and the JSON `--thresholds` arg in playtest-corpus.mjs. The smoke tests don't trip the bug because the smoke corpus has no thresholds and the manual prompt smoke isn't inspected, but real usage does.

Otherwise the plan is implementation-ready — the structure is sound, prior fixes are solid, and the remaining issues are the one HIGH plus three NITs.

## Iter-1 finding verification

| ID | Status | Evidence |
|---|---|---|
| H1 (recorder.lastError.code) | FIXED | PLAN.md:179 — `recorder.lastError.details as { code?: string } \| undefined` with `?.code ?? recorder.lastError.name` fallback. Matches `SessionRecordingError.details: JsonValue \| undefined` (session-errors.d.ts:10). |
| H2 (require in ESM) | FIXED | PLAN.md:1493 — `import { basename, dirname } from 'node:path';` at top of propose-fix.mjs. No `require()` calls remain in any `.mjs` file. |
| H3 (shell: true on npm/claude/codex) | FIXED for cross-platform but **introduces new HIGH** — see N1 below. PLAN.md:1585, 1592, 1803, 1810 all add `shell: true`. |
| H4 (SessionBundle test stubs) | FIXED | PLAN.md:647-684 — `makeMinimalBundle(overrides)` helper with `as unknown as SessionBundle` cast. Required `SessionMetadata` fields (`nodeVersion`, `persistedEndTick`, `durationTicks`, `endTick` — all confirmed in session-bundle.d.ts:77-101) populated. `failedTicks: []` correctly typed as `number[]`. `TickFailure.phase: 'systems'` (PLAN.md:803) is a valid `TickFailurePhase` per world.d.ts:94. |
| H5 (bundleHotspots.details narrowing) | FIXED | PLAN.md:919-922 — `typeof hot.details === 'object' && hot.details !== null && !Array.isArray(hot.details)` narrowing with `{ raw: hot.details }` fallback. |
| H6 (initialSnapshot.components.position shape) | FIXED | PLAN.md:982-987 reads `bundle.initialSnapshot.components?.position` as `Array<[EntityId, Position]>`, matching `WorldSnapshotV5.components: Record<string, Array<[EntityId, unknown]>>` (serializer.d.ts:66). The TickDiff path (PLAN.md:991-1001) correctly uses `{set, removed}` shape per diff.d.ts:10-13. |
| H7 (bridge/createSimulationBridge paths) | FIXED | PLAN.md:1413, 1417, 1424 use `src/game/simulation/createSimulationBridge.ts` (no `bridge/` segment). Verified: file exists at that exact path; `src/game/simulation/bridge/` is a sibling subfolder for system files. |
| M1 (events.length === 1 case) | FIXED | PLAN.md:1129-1141 — explicit branch firing a violation when `events.length === 1 && endTick - last.tick >= window`. Test at PLAN.md:1222-1235 covers it. (NIT carryover — see N3.) |
| M2 (Record<string, never> cast) | FIXED | PLAN.md:170 — `let details: OracleEnvelope['details'] \| undefined`. No bad cast. Type-correct since `halt.tick: number`, `halt.phase: PhaseType`, `halt.systemName: string`, `matchState.outcome: 'running' \| 'victory' \| ...` are all `JsonValue`. |
| M3 (Task 9 review prompt template) | FIXED | PLAN.md:482-538 — concrete ~50-line template covering baseline + intent + probe-order verification + SessionRecorder API + anti-regression checklist (referencing iter-1/2/3 design reviews) + BEGIN/END markers note. |
| M4 (engines.node ≥22.6.0) | FIXED | PLAN.md:78-82 — `"engines": { "node": ">=22.6.0" }`. PLAN.md:11 also documents the requirement in the preamble. |

All 11 iter-1 fixes verified. None re-flagged.

## New findings

### HIGH

**N1. `shell: true` mangles args containing shell metacharacters.** (NEW; introduced by the iter-1 H3 fix.)

`shell: true` on `child_process.spawnSync`/`execFileSync` joins all args with spaces and re-parses through the platform shell (cmd.exe on Windows, /bin/sh on Linux/macOS). Node performs no escaping. From the Node source: `command = [file].concat(args).join(' ')` then `cmd.exe /d /s /c "${command}"` or `sh -c '${command}'`. Any shell metacharacter inside an arg is interpreted by the shell.

Two concrete breakage sites:

1. **propose-fix.mjs claude call (PLAN.md:1581-1586).** `args = ['-p', prompt, '--model', 'claude-opus-4-7[1m]', ...]` with `shell: true`. The `prompt` is a multi-block string containing source-file content (likely `"`, `$`, backticks, possibly `&`/`|`), violation messages, JSON envelope, and code fences. On Linux this triggers variable expansion (`$user` → empty), command substitution (backtick), word-splitting on `&`/`|`. On Windows cmd.exe, `"` chars get stripped (changing word boundaries) and `&` splits the command. The model string `claude-opus-4-7[1m]` is unquoted: bash treats `[1m]` as glob pattern → no files match → potentially passes through, potentially errors with `failglob`/`nullglob`. AGENTS.md explicitly warns "Quote the model string so the shell doesn't glob-expand the brackets."

2. **playtest-corpus.mjs `--thresholds` arg (PLAN.md:1809-1810).** `oracleArgs.push('--thresholds', JSON.stringify(run.thresholds))` with `spawnSync('npm', oracleArgs, { shell: true })`. JSON like `{"economyByTick":1000,"economyMinAge":"feudal"}` contains `"` (cmd.exe and sh strip these from words), `,` inside `{}` (bash brace-expands `{X,Y}` into two words), and `{`/`}` (bash brace-expansion triggers). On Linux this either crashes JSON.parse downstream or passes a corrupted threshold object. The smoke corpus (PLAN.md:1772-1781) sets no thresholds, so the bug is invisible to the smoke gate, but the design intent of per-corpus-row thresholds will trip on the first multi-key entry.

Why this is HIGH and not just a smell: the iter-1 reviewer recommended `shell: true` as the universal fix for cross-platform `.cmd` invocation, but that recommendation traded one bug (Node refuses `.cmd` without a shell) for a more subtle one (shell parses every arg). The codex call (PLAN.md:1588-1593) accidentally avoids the prompt issue by passing prompt via `input: stdin` rather than as a CLI arg — exactly the safer pattern.

Recommended fix (pick one):

- **Resolve `.cmd` shims explicitly and drop `shell: true`.** `const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';` then `spawnSync(npmBin, args, { encoding: 'utf8' })`. Same pattern for `claude.cmd` / `codex.cmd`. Verify the actual shim filename on the target machines (npm uses `.cmd`, claude/codex installed via npm typically use `.cmd` too). This is the canonical cross-platform pattern and what `cross-spawn` does internally.
- **Pass risky data via stdin or temp file.** For the claude prompt: drop `-p prompt` from args, leave `-p` (print mode), add `input: prompt` to options — match the codex pattern exactly. For corpus thresholds: write thresholds to a JSON file in `tmp/` and pass `--thresholds-file <path>` instead of inline JSON. The script reads with `JSON.parse(readFileSync(path))`.

Either fix removes the regression. The first is cleaner; the second is mechanical and preserves the existing `shell: true` semantics for simple-arg cases.

**N2. `economy-progression` is a registered no-op** (Codex; Claude missed this).

Plan Task 16 documents the oracle as a deliberate skeleton (returns `[]`), but registers it in `ORACLES`. A failing economy run reports clean. Design lists `economy-progression` as a real oracle, not a placeholder.

**Resolution.** Remove the registration in Phase 2; document as Phase-6 follow-up. The full implementation requires `SessionReplayer.fromBundle(bundle).stateAtTick(T)` reconstruction + economy-state extraction, which is materially more scope than other oracles and depends on replay-bridge wiring beyond this thread.

**N3. `playtest-corpus.mjs` ignores `run-oracles` exit status** (Codex; Claude missed this).

`run-oracles.mjs` exits with `high.length`. Corpus runner spawns it via `spawnSync` and discards the result. Writes SUMMARY.md; exits 0 even with HIGH violations. CI passes silently on regression.

**Resolution.** Capture the spawnSync result; sum `high` counts across runs; `process.exit(totalHigh > 0 ? 1 : 0)` after writing SUMMARY.md.

### NITs

**N4. Unused `dirname` imports in two scripts.**

`scripts/run-oracles.mjs` (PLAN.md:1253) and `scripts/propose-fix.mjs` (PLAN.md:1493) both `import { dirname, basename }` but only use `basename`. `scripts/playtest.mjs` correctly uses `dirname` at PLAN.md:321. Drop the unused import in the two affected scripts. Lint rule `no-unused-vars` will flag if enabled; otherwise just stylistic clutter.

**N3. `noPinnedOrOscillating` sliding-window can fire on sparse-but-genuinely-moving units.**

In `netManhattanProgress` (PLAN.md:1006-1017), when a window contains only one event (sparse trajectory like ticks 0, 100, 200), `inWindow.length < 2` returns 0. The caller then sees `progress = 0 < minProgress = 3` and fires a violation — even though the unit is actively moving, just outside the window. The iter-2 fix correctly handled the `events.length === 1` case at the entity level, but the same single-event problem at the window level remains. Concretely: a unit emitting one event per 60 ticks (slower than `pinnedWindowTicks = 50`) would false-positive on every iteration of the outer loop until events become denser. Not a regression vs iter-1 (which had the broader M1 issue), and consistent with the design's "best-effort scaffolding" framing for this oracle. Recommend either (a) skip the window when `inWindow.length < 2` instead of returning 0 progress, or (b) accept the false-positive for now and add a test that pins the behavior so future tightening is intentional.

**N4. CI workflow's "post SUMMARY.md" reads `readdirSync` order without sorting.**

`.github/workflows/playtest.yml` (PLAN.md:1898-1904) does `dates[dates.length - 1]` against `fs.readdirSync(corpusDir)`. `readdirSync` order is filesystem-dependent (usually insertion or alphabetical, but not guaranteed). In the CI fresh-container case there's only one dated subdir (today's), so this works. If the artifact ever caches or the workflow accumulates multiple dates in one run, the wrong directory may be picked. Cheap fix: `.sort()` before `dates[dates.length - 1]` since YYYY-MM-DD sorts lexically into chronological order. Not blocking — the smoke run hits the safe path.

**N5. Imports presented as "Append" in tasks 15/16 must actually go at top of file.**

The plan instructs implementers to "Append" `import { bundleHotspots } from 'civ-engine';` (Task 15 Step 2) and `import { reconstructPositions, ... }` + `import type { Position, EntityId }` (Task 16 Step 4) to `oracles.ts`, but these must land at the top of the file alongside the existing `import type { SessionBundle } from 'civ-engine';`. Same for `import { reconstructPositions, ... }` in oracles.test.ts (Task 16 Step 2). ESM imports are hoisted at runtime so it would technically execute, but lint and code-style conventions require imports at the top. NIT — implementer is expected to know this, but the plan wording invites a literal-minded mistake.

### Verified clean (no issue)

- `SessionRecorderConfig` (session-recorder.d.ts:10-34) is a config-object constructor with `world`, `sink?`, `sourceLabel?`, `sourceKind?: 'session'|'scenario'|'synthetic'` — matches PLAN.md:158-163 exactly.
- `recorder.lastError: SessionRecordingError | null` (session-recorder.d.ts:64). Probe `if (recorder.lastError)` (PLAN.md:177) is valid (truthy on non-null Error instance).
- `bundleHotspots` exported from `civ-engine/index.d.ts:36`.
- `MemorySink`, `SinkWriteError` exported from `civ-engine/index.d.ts:25-28`.
- `SessionMetadata.endTick: number` is a required field (session-bundle.d.ts:83). The `bundle.metadata.endTick ?? bundle.metadata.startTick` fallback at PLAN.md:1121 is dead-code-style but not incorrect.
- `RandomState = { state: number }` (random.d.ts:1-3). The helper's `rng: { seed: 0, state: 0 }` (PLAN.md:672) has an extra `seed` field but the `as unknown as SessionBundle` cast neutralizes it. Oracles don't read rng so runtime is fine.
- `WorldSnapshotV5` (serializer.d.ts:57-73) has all the fields the helper populates: `version: 5`, `config`, `tick`, `entities`, `components`, `componentOptions?`, `resources`, `rng`, `state`, `tags`, `metadata`. The helper provides incorrect runtime types for `tags` (provides `[]`, expected `Record<number, string[]>`) and `metadata` (provides `{}`, expected `Record<number, ...>`) and `resources` (provides `{}`, expected `ResourceStoreState`), but `as unknown as` plus oracles-don't-read-these neutralizes both.
- `TickDiff.components` shaped as `Record<string, { set: Array<[EntityId, unknown]>; removed: EntityId[] }>` (diff.d.ts:10-13). Test data at PLAN.md:1037-1046 conforms.
- `TickFailure` shape (world.d.ts:95-111) matches the test fixture at PLAN.md:800-812 — all required fields populated, `phase: 'systems'` is valid.
- `WorldMetrics.durationMs.total` (world.d.ts:60) is the path `bundleHotspots` reads (per iter-1 L6).
- All 6 oracle source-file paths (PLAN.md:1407-1426) verified to exist: `src/game/simulation/createSimulationBridge.ts`, `bridge/systems/playerCommandsSystem.ts`, `bridge/systems/aiSystem.ts`, `worldOccupancy.ts`, `worldOccupancyAllocators.ts`, `ai.ts`.

## Action plan for plan-iter-3

Single inline edit needed:

1. **N1 (HIGH).** Replace `shell: true` with explicit `.cmd` resolution OR pass risky args via stdin/file. Concretely:
   - **scripts/propose-fix.mjs claude call (PLAN.md:1581-1586):** drop `prompt` from the args array, add `input: prompt` to options. Args become `['-p', '--model', 'claude-opus-4-7[1m]', '--effort', 'max', '--allowedTools', 'Read,Glob,Grep']`.
   - **scripts/playtest-corpus.mjs npm calls (PLAN.md:1803, 1810):** either swap to explicit `.cmd` resolution (`const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';`) and drop `shell: true`, or write `run.thresholds` to a temp `.json` file and pass `--thresholds-file <path>` (requires updating `scripts/run-oracles.mjs` to accept this flag).
   - **scripts/propose-fix.mjs codex call (PLAN.md:1588-1593):** if you adopt the explicit-`.cmd`-resolution path above, drop `shell: true` here too — the codex call already passes the prompt safely via stdin, so it's the model/config args that are at glob risk on bash.
   - **scripts/propose-fix.mjs `which` call (PLAN.md:1508):** unaffected (no shell-special chars in the bin name arg).
   - Update Task 9's review prompt template (PLAN.md:498-509) to add a verification bullet: "no `shell: true` is used to pass user-controlled or template-built strings as args; risky data goes via stdin or a temp file."

Optional cleanup:

2. **N2.** Drop unused `dirname` imports in run-oracles.mjs and propose-fix.mjs (PLAN.md:1253, 1493 — change `import { dirname, basename }` to `import { basename }`).
3. **N3.** Either skip the window in `noPinnedOrOscillating` when `inWindow.length < 2`, or add a test pinning the current false-positive behavior.
4. **N4.** Add `.sort()` before `dates[dates.length - 1]` in the workflow's post-summary script.
5. **N5.** In Tasks 15 and 16, add a one-line note "place this import at the top of the file" so the implementer doesn't literally append.

After plan-iter-3, run plan-3 multi-CLI review. Convergence target: nits only.
