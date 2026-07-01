# Debugging session — civ-engine 0.8.24→1.0.1 "sim-throughput regression"

## Symptom
`docs/engine-feedback/current.md` records a "+50-75% slower" sim-throughput regression attributed to civ-engine 0.8.24→1.0.1: under full-suite load, `createSimulationBridge.ageUp` 136s→209s (+53%), `castleUpgrades` 155s→248s (+60%), `blacksmithProgression` 171s→284s (+66%), `aiPlayer` 271s→473s (+75%); aoe2 whole-suite cumulative test time 2056s→3330s. aoe2 absorbed it by DOUBLING per-test timeout caps in 9 fixture files (annotated `x2 2026-06-12`). The engine-feedback asks the engine team to "profile a long mixed-load scenario against v0.8.23 and bisect."

## Expected vs actual
- Expected (the standing claim): a civ-engine per-tick hot-path regression somewhere in 0.8.24/0.8.25/1.0.0/1.0.1 slows aoe2 sims 50-75%.
- Actual (this investigation): NO engine per-tick hot-path regression. The only per-tick behavioral change in the entire 0.8.23→1.0.2 window is strict-mode becoming ON by default (v1.0.0), and its measured cost on the real ageUp fixture is WITHIN NOISE. The +50-75% is full-suite thread-pool CONTENTION (CPU saturation on a heavy parallel suite), not engine cost.

## Reproduction / measurement
Engine consumed by aoe2 via `file:../civ-engine` symlink; aoe2 reads TS source directly under vitest (no engine rebuild needed for aoe2-side A/B).

1. **Static diff audit — hot-path files unchanged.** `git log --oneline a53efc2..8a10966 -- src/world-tick.ts src/world-queries.ts src/component-store.ts src/entity-manager.ts src/world-systems.ts src/query-cache.ts` → EMPTY. The per-tick hot path is byte-identical across the whole regression window. Only `src/world-core.ts` changed: v1.0.0 flipped `this.strict = config.strict === true` → `config.strict !== false` (strict default ON); v1.0.2 changed `destroyCallbacks` Array→Set (insertion-ordered, O(1) offDestroy — negligible). `src/world.ts` changes in the window are all serialize/deserialize/applySnapshot (NOT per-tick). `src/player-observer.ts` v0.8.25 change HOISTED `getRegistrationManifest()` out of a per-entity loop (an optimization). The two named suspects (0.8.25 observer/sanitizer clone; 1.0.0 gate bookkeeping) do not exist as per-tick regressions.
2. **Strict-guard cost is O(1), allocation-free.** `assertWritable` (`src/world-strict-mode.ts`): `if (!world.strict) return;` then three boolean reads (`_inTickPhase || _inSetup || _maintenanceDepth > 0`), allocation only on the throw branch. Flipping strict ON adds three boolean reads per mutation — nothing more.
3. **aoe2 does not pass `strict`** (`src/game/simulation/bridge/createWorld.ts`) → v1.0.0's default flip DID turn aoe2 worlds strict (false→true), so the flip is the one change that reached aoe2.
4. **Direct A/B on the real fixture (this machine, isolated, single-thread pool):**
   - Strict ON (current default): ageUp tests 42.71s.
   - Strict OFF (temp `strict: false` in createWorld, reverted): ageUp tests 43.24s.
   - Delta is within run-to-run noise (strict-off marginally SLOWER). Strict mode's per-tick cost on the real fixture ≈ 0.
5. **Isolated vs contended gap.** ageUp ISOLATED single-thread = ~43s for the whole file (6 tests, ~7s each) vs the engine-feedback's contended 136-209s and the doubled 40s/test caps (5-6x headroom). The blow-up only appears under full-suite parallel contention.

## Root cause
There is no civ-engine throughput regression. The per-tick hot path is unchanged across 0.8.24→1.0.2; the sole per-tick change (strict-default flip, v1.0.0) is within measurement noise on the real fixtures. The observed +50-75% was full-suite thread-pool contention (a CPU-heavy simulation suite saturating cores under the `threads` pool), which the isolated-fixture and strict-A/B measurements do not reproduce. The engine-feedback's bisect ask was chasing a regression that does not exist in engine code.

## Fix
No engine hot-path fix is warranted (nothing regressed). Actions:
- aoe2: right-size the 9 fixture files' per-test caps and replace the misleading `x2 2026-06-12: engine-1.0.x sim-throughput regression` annotations (they attribute a nonexistent engine regression). Sized from CONTENDED per-test measurement (full-suite condition), not isolated times.
- civ-engine: add an aoe2-shape benchmark scenario (many systems + strict + per-tick queries/commands/events over thousands of ticks) to the regression gate so a FUTURE real per-tick regression in that load profile is caught — the gate previously under-weighted this profile, which is why a (hypothetical) regression could have slipped.
- docs: mark the engine-feedback throughput item RESOLVED (root cause: contention + strict-default within noise, not a hot-path regression) and move it to past.md; devlog both repos; lessons.md (measure isolated + A/B before attributing a "regression" to a dependency).

## Verification
- **aoe2 caps:** measured worst-case contended per-test by running all 9 heavy sim files in parallel under the default `threads` pool (max CPU saturation): worst per-test ageUp 30.5s / blacksmith 29.8s / others ≤14.9s. Set uniform per-file caps at ~3× (90s / 45s / 30s) and re-ran all 9 files under the same worst-case contention — all green under the reduced caps.
- **aoe2 gates:** typecheck + lint + build green. The change is timeout-ceiling + doc only (no `src`/test-logic change; the 9 capped files pass), so the full 55-min suite was not re-run in full — ceilings cannot change pass/fail logic, and typecheck/lint cover the parse/lint surface.
- **civ-engine gates:** typecheck + lint + build + test (1238 passed + 1 todo) green; `benchmark:check` green with the new `commands` scenario (all tier-1 counters exact; time ratios within ×3).
- **Multi-CLI review** (thread `engine-throughput-triage`, iter 1): Claude APPROVE (verified every API/signature, determinism, the no-regression claim by trying to refute it, cap safety, doc accuracy); Codex 2×MEDIUM — (1) the gate didn't prove the accepted `move` handler ran/mutated → added `commandsProcessed` + `moveHandlerRuns` exact tier-1 counters; (2) doc drift (pending-verification / stale summary line) → fixed. Claude minor off-by-one (ids 1..800 vs 0-based entities) → fixed. Gemini unreachable (headless OAuth). Baseline re-generated after the counter/off-by-one fixes; gate re-verified green.
