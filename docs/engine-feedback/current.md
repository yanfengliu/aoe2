# civ-engine Feedback

Live engine feedback belongs here. Historical observations and slice-by-slice notes live in [past.md](./past.md).

## Current verdict

- Status: `civ-engine` remains viable as the authoritative simulation core for this project.
- Coverage so far: the repo has now shipped through Slice 12 on top of the current engine boundary.
- What still fits cleanly behind the bridge: upgrades, age gating, combat bonuses, conversion, relics, win conditions, save/load, AI, maps, and debug overlays.
- The earlier occupancy revisit is now closed in both repos: `civ-engine` shipped `OccupancyBinding`, and `aoe2` now uses it for bridge-side occupancy queries.

## Current engine asks

- **`SessionRecorder` / `SessionReplayer` need a `TComponents` (and ideally `TState`) generic parameter (surfaced 2026-06-10 by v0.8.15).** Both classes hardcode `World<TEventMap, TCommandMap>` with default `TComponents = Record<string, unknown>`. Before v0.8.15 a component-typed world (`World<E, C, GameComponents>`) was still assignable into those signatures; the 0.8.15 layer-chain split surfaced `TComponents`-dependent declarations (e.g. `validators`, `transaction().require`) in protected position, making the parameter effectively invariant — the changelog's "no public API change" claim holds for the export list but not for generic assignability (96 type errors in aoe2). aoe2 absorbed it with a sanctioned cast seam (`toEngineWorld`/`fromEngineWorld` in `src/game/simulation/bridge/pureHelpers.ts`), but the casts erase component-type safety at exactly the recorder/replayer boundary where a component-name typo would now compile. Ask: thread `TComponents`/`TState` through `SessionRecorder`, `SessionReplayer`, `worldFactory`, and `openAt`, defaulted for back-compat.
- The previous occupancy/crowding concerns have moved to [past.md](./past.md).
- Why they moved: `civ-engine` now ships a higher-level `OccupancyBinding`, measurable occupancy scan counters, and blocker metadata that closed the earlier FU8 revisit conditions.

## Current recommendation

- Continue building on top of `civ-engine`.
- The engine is not the blocker today.
- Revisit engine work only if a new integration cost appears that cannot be kept cleanly behind the current bridge.

- **Sim-throughput regression in 0.8.24→1.0.1: aoe2's heavy fixtures run +50-75% slower (surfaced 2026-06-12 by the 1.0 absorb).** Same machine, same suite, engine 0.8.23 → 1.0.1: `createSimulationBridge.ageUp` 136s → 209s (+53%), `castleUpgrades` 155s → 248s (+60%), `blacksmithProgression` 171s → 284s (+66%), `aiPlayer` 271s → 473s (+75%) under full-suite load; aoe2's whole-suite cumulative test time went 2056s → 3330s. NOT the strict-mode default: an A/B with `strict: false` on aoe2's world construction measured ~4% (150.4s vs 156.6s on ageUp isolated). The regression is somewhere else in 0.8.24/0.8.25/1.0.0/1.0.1's hot path — candidates worth profiling from the changelog: 0.8.25's observer/sanitizer hardening if any per-event/per-listener clone landed on the tick path, or 1.0.0's gate bookkeeping outside the strict flag itself. The engine's own benchmark gate stayed green across these versions, so its scenario set likely under-weights whatever aoe2's fixtures stress (long sims with heavy command/event traffic and many entities). aoe2 absorbed by doubling per-test timeout caps in 10 fixture files (annotated `x2 2026-06-12`); those caps should ratchet back down when this is found. Note on versions: the measured tree's lockfile captured 1.0.2, and the additive 1.1.0 landed in the sibling during the same session — so the bisect range is 0.8.24..1.0.2 (1.1.0's additions are off the tick path). Ask: profile a long mixed-load scenario (entities + events + commands + queries over thousands of ticks) against v0.8.23 and bisect.
