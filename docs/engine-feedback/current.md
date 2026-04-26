# civ-engine Feedback

Live engine feedback belongs here. Historical observations and slice-by-slice notes live in [past.md](./past.md).

## Current verdict

- Status: `civ-engine` remains viable as the authoritative simulation core for this project.
- Coverage so far: the repo has now shipped through Slice 12 on top of the current engine boundary.
- What still fits cleanly behind the bridge: upgrades, age gating, combat bonuses, conversion, relics, win conditions, save/load, AI, maps, and debug overlays.
- The earlier occupancy revisit is now closed in both repos: `civ-engine` shipped `OccupancyBinding`, and `aoe2` now uses it for bridge-side occupancy queries.

## Current engine asks

- None right now.
- The previous occupancy/crowding concerns have moved to [past.md](./past.md).
- Why they moved: `civ-engine` now ships a higher-level `OccupancyBinding`, measurable occupancy scan counters, and blocker metadata that closed the earlier FU8 revisit conditions.

## Current recommendation

- Continue building on top of `civ-engine`.
- The engine is not the blocker today.
- Revisit engine work only if a new integration cost appears that cannot be kept cleanly behind the current bridge.
