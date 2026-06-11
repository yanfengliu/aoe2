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
