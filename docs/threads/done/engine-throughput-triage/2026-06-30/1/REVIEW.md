# engine-throughput-triage — Review iteration 1

Change under review (two co-evolving repos): (1) civ-engine `scripts/rts-benchmark.mjs` + `benchmarks/baseline.json` — a new `commands` benchmark-gate scenario (strict world + per-tick validated commands + in-tick emitting handlers/systems + 14 systems over 60 ticks) closing the gate's aoe2-load blind spot; (2) aoe2 9 `tests/simulation/*.test.ts` — timeout caps ratcheted from the `x2 2026-06-12` doubled values to data-driven ~3×-contended values (90s/45s/30s) with corrected annotations; (3) docs in both repos correcting the "civ-engine 0.8.24→1.0.1 sim-throughput regression" claim to NOT-A-REGRESSION (full-suite thread-pool contention).

Reviewers: Codex (gpt-5.5, xhigh, from `civ-engine/`), Claude (opus[1m], read Read/Glob/Grep + git). Gemini unreachable (headless OAuth — needs interactive auth in this env). Contamination audit: clean (both trees only my edits).

## Verdict: SHIP after fixes — Claude APPROVE; Codex 2×MEDIUM + Claude 1 minor, all addressed; re-verified green.

## The core empirical claim was independently re-verified (Claude tried to refute it)
Claude re-ran `git diff a53efc2..8a10966` over the six hot-path files (empty — byte-identical), then checked the files the audit did NOT list but are per-tick-relevant: `world-entities` (destroyCallbacks Array→Set — registration/destroy, O(1)), `world-observers` (`.length`→`.size` in a manifest method), `player-observer` (manifest hoisted out of a per-entity loop + a redundant clone dropped — both *reduce* per-tick cost), `world.ts` (+63 all serialize/deserialize — off the step path), `world-core` (the strict flip + Set field). Confirmed `createWorld.ts:55` passes no `strict`, so 1.0.0's `!== false` flipped aoe2 worlds false→true. Strict guard is O(1)/allocation-free. Conclusion "no engine regression; the +50-75% is contention" is well supported.

## Findings and disposition

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | MEDIUM | Codex | The gate did not exact-count that the accepted `move` HANDLER ran/mutated — a regression that drops/no-ops handler execution is *faster*, so the time-only tier-2 ratio can't catch it, and no tier-1 counter reflected handler execution. | FIXED — added two exact tier-1 counters: `commandsProcessed` (from engine `metrics.commandStats.processed`, proves queued handlers executed) and `moveHandlerRuns` (incremented inside the `move` handler after `setPosition`, proves accepted handlers ran + mutated). Baseline re-generated: `commandsProcessed 8640`, `moveHandlerRuns 3840`. A no-op-handler regression now fails tier-1. |
| 2 | MEDIUM | Codex | Doc drift: debugging doc said "verification pending"; devlog had a "Code reviewer comments" placeholder; `summary.md` retained a stale "regression +50-75% … 10 fixture files … ratchet back later" historical line — the exact session-start drift that re-sends an agent toward a resolved/nonexistent bisect. | FIXED — debugging-doc Verification finalized; devlog reviewer section filled; the historical `summary.md` line annotated with a `→ 2026-06-30: NOT-a-regression` resolution pointer (kept as history, corrected 10→9 files). |
| 3 | minor | Claude | Off-by-one command target: `id = 1 + (… % entities)` yields 1..800, but `EntityManager.create()` is 0-based (0..799), so id 800 no-ops and id 0 is never commanded. Deterministic, baked into baseline, no gate impact — cosmetic. | FIXED — dropped the `1 +` so ids are 0..799; every entity exercised. Counters/baseline updated (`eventsHandled` 17394→17400). |
| — | note | Claude | `commands.perTick` reported the move budget (80) while 160 submissions/tick occur. | Relabeled to `perTickMoves` with a comment noting the paired `damage` submissions. |

## Verified-correct (cross-checked)
- All benchmark APIs real, signatures match; validator returns `boolean | CommandValidationRejection` correctly; no strict-mode violation (handlers run inside `_inTickPhase`, set before `processCommands`); counters deterministic (harness's identical-counters-across-3-runs assert + tier-1 gate).
- Cap ratchet: all 9 files ratcheted, zero remaining `x2 2026-06-12`, no non-timeout value altered, ~3× headroom over worst contended per-test.
- Docs match code (strict flip `=== true`→`!== false`, 9 files, counter values, createWorld pointer).

## Convergence
Iter-1 reached substantive convergence: the one real gate-sensitivity gap (Codex #1) and doc drift (#2) are fixed and re-verified; no correctness/determinism/safety defect remains. No second iteration needed (the fixes are additive counters + docs; `benchmark:check` and engine gates re-run green).
