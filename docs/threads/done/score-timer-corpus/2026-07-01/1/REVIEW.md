# Score-timer corpus follow-up — Review iteration 1 (2026-07-01)

Change under review: wire a `gameLength` override into the deterministic playtest corpus so the smoke run ENDS on score (spec §4.3) instead of stalemating at the tick cap, and re-enable the `matchCompleteRequired` completion oracle. New plumbing: `CreateSimulationBridgeOptions.gameLength` → `createWorld` stamps `scenario.gameLength` (no-op on save-load) → wireBridgeOps forwards it; `RunPlaytestConfig.gameLength` + `--game-length` CLI on both `playtest.mjs` and `playtest-corpus.mjs`; `corpusSchema.ts` gains a validated `gameLength` field; `playtest-corpus.json` set to `maxTicks 8100 / gameLength 8000` with the `matchCompleteRequired: false` override dropped.

End-to-end verified before review: `npm run playtest:corpus` → `stopReason=stopWhen`, ticksRun 8001, 0 HIGH, exit 0. Four gates green (full suite 1507 passed).

Reviewers: **Codex** (gpt-5.5 xhigh) and **Claude** (opus[1m]). Gemini not run (headless OAuth). Both verified against the live codebase.

## Findings

### Codex — MEDIUM (real, fixed): `gameLength` not validated as an integer; CLI accepts NaN
`corpusSchema.ts` accepted a positive but fractional `gameLength`, and `playtest.mjs` accepted `NaN` from `Number(--game-length)`. Concrete failure: `maxTicks=100, gameLength=99.5` passes the schema, but the timer only fires on an integer `world.tick >= gameLength`, so the run can still hit `maxTicks` and trip the re-enabled completion oracle. Claude independently flagged the same NaN passthrough as a non-blocking note (shared with `--max-ticks`).
- **Fix:** `corpusSchema.ts` now requires `Number.isInteger(gameLength) && gameLength > 0` (+ a fractional-rejection test). `playtest.mjs` gained a guard that throws on a non-positive-integer `--max-ticks` or `--game-length` (closes Claude's `--max-ticks` note too). Verified: fractional test passes, `--max-ticks abc` throws.

## Confirmed correct by both reviewers (no action)
- **Override plumbing** — `createSimulationBridge` → `createWorld` stamps only a freshly-built (non-shared) non-save scenario, same pattern as the existing `disableAi` mutation; `wireBridgeOps` forwards `scenario?.gameLength`. The real app bootstrap and the save-load path never pass `gameLength` (save-load's scenario is null → genuine no-op).
- **`gameLength >= maxTicks` guard is tight** — both reviewers traced that `gameLength = maxTicks - 1` still fires (resolution observable at `world.tick = gameLength + 1`, and the loop enters that step because `gameLength < maxTicks`), while `gameLength = maxTicks` would miss — exactly what the guard blocks. (Independently re-derived here.)
- **Oracle re-enable** — removing the corpus `thresholds` object only flips `matchCompleteRequired` false→true; every other oracle default was already applied via the `{ ...ORACLE_DEFAULTS, ...thresholds }` merge. Single-run corpus, no cross-run exposure.
- **CLI consistency** — `--game-length` forwarded consistently from `playtest-corpus.mjs` (only when the row sets it) through `playtest.mjs` to `runPlaytest`.

## Disposition — CONVERGED
One MEDIUM (integer/NaN validation) fixed with schema + CLI guards + a test; mechanically verified. All other aspects confirmed correct by both reviewers. The fix does not change corpus run behavior (the manifest still uses valid integers 8000/8100), so the end-to-end `stopWhen`/0-HIGH result stands. Internal test-harness change — no version bump / changelog (game behavior unchanged). LLM-corpus completion oracle remains a separate open item (roadmap M6).
