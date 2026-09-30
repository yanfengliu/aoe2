# Playtest Loop — Phase 1 Implementation Review (iter-1)

Date: 2026-05-08

Reviewers: Codex (`gpt-5.5` xhigh, read-only) and Claude (`opus-4-7[1m]` max). Both verified against the live codebase.

## Disposition

**Iter-2 fixes applied inline.** Both reviewers verified all iter-1/2/3 design + plan findings remain addressed in the code. Two real HIGH issues + one MEDIUM + one LOW surfaced in the implementation review; all four fixed in iter-2.

## Findings

### HIGH

**H1. Three checked-in surfaces reference `docs/threads/done/playtest-loop/` — that path doesn't exist yet** (Claude H1, Codex finding 3).

The thread is at `docs/threads/current/playtest-loop/` until Phase 5 closeout. Forward-pointing the docs to `done/` produces dead links until weeks from now.

**Fix.** All three sites updated to `current/`:
- `docs/architecture/ARCHITECTURE.md` (one occurrence).
- `docs/architecture/drift-log.md` (one occurrence; row also rephrased to scope down to Phase 1 + reference future phases).
- `src/game/recording/RecordingService.ts:16` (one occurrence).

The closeout step in PLAN.md Task 23 will re-flip these to `done/` after Phase 5.

**H2. ARCHITECTURE.md describes Phase 2-5 artifacts as already present** (Codex finding 2).

The Phase-1 commit's ARCHITECTURE.md update mentioned `oracles.ts`, `scripts/run-oracles.mjs`, `scripts/playtest*.mjs` (plural), and the CI workflow — none of which exist yet. Forward-looking documentation misleads the next implementer.

**Fix.** ARCHITECTURE.md `playtest/` paragraph rescoped: lists only `runPlaytest.ts` + `scripts/playtest.mjs` (singular) as currently shipped; explicitly notes "only Phase 1 is currently shipped" and lists the subsequent phases as work-in-thread. drift-log.md row rephrased identically.

### MEDIUM

**M1. `scripts/playtest.mjs:3` comment is stale** (both reviewers).

The comment said "Requires Node >=22.6.0 (uses `--experimental-strip-types` for .ts imports)." But the actual script runs via `tsx` (per `package.json`), which works on Node ≥18. The stale comment misleads anyone running the script directly.

**Fix.** Comment rewritten: "Run via `tsx scripts/playtest.mjs` (set up by the `npm run playtest` script). tsx handles TypeScript module resolution at runtime so this .mjs file can import .ts modules directly."

### LOW

**L1. `OracleEnvelope.details` not populated for `sinkError` / `recorderError` outcomes** (Claude L1, Codex finding 1).

DESIGN.md:112 specifies that non-`stopWhen` outcomes include `details` (`recorder.lastError` shape for sink/recorder errors). The Phase 1 runner extracted only `errorCode` (from `details.code`) and `errorMessage`, dropping the rest of `recorder.lastError.details`. Phase 2's REPORT.md will have less to surface for sink failures — e.g., a FileSink failure carries `{ path, errno }` in its details.

**Fix.** runPlaytest.ts now narrows `recorder.lastError.details` (object-and-not-array check, same pattern as Plan iter-1 H5's `bundleHotspots` narrowing) and copies the resulting `Record<string, unknown>` into `envelope.details`. The narrowing leaves primitive / array values undefined (consistent with the `OracleEnvelope.details` type).

### Other (not findings)

- **Claude L2** (Runtime layers paragraph absorbed into Repository layout): the design / plan called for a separate paragraph under "Runtime layers." The implementation consolidated the description into the `playtest/` Repository-layout entry. The text is present and the rationale is preserved; this is a deviation but not a defect. Leaving as-is.
- **Claude L3** (engines.node block not called out in devlog): the devlog does explain why `tsx` replaced `--experimental-strip-types`; the engines block removal is implicit. Adding an explicit note is a NIT; leaving as-is.

## Verified clean (both reviewers)

- Probe order `error → engineHalt → stopWhen → maxTicks` correct.
- `SessionRecorder` config-object constructor + `connect`/`disconnect`/`toBundle`/`lastError` API matches civ-engine.
- `engineHalted !== null` (not boolean compare).
- `recorder.lastError instanceof SinkWriteError` discriminator.
- `bridge.getMatchState().outcome !== 'running'` probe.
- All 3 tests pass.
- `output/` in `.gitignore`.
- KAD-0015 in decisions.md with full reasoning.
- No `runAgentPlaytest` references remain in `src/`.
- All design + plan iter-1/2/3 findings remain addressed in code.

## Action plan

Iter-2 fixes:

1. ARCHITECTURE.md, drift-log.md, RecordingService.ts: `done/` → `current/`.
2. ARCHITECTURE.md: rescope `playtest/` paragraph to Phase 1; add "subsequent phases tracked in thread" note. drift-log.md row rephrased identically.
3. scripts/playtest.mjs comment rewritten to reference `tsx`.
4. runPlaytest.ts: narrow `recorder.lastError.details` and surface in `envelope.details`.

After iter-2 lands, gates re-verified, commit, push. No iter-3 needed since findings are isolated and reviewers already verified the iter-1/2/3 design + plan findings remain clean.
