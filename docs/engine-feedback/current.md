# civ-engine Feedback

Live engine feedback belongs here. Historical observations and slice-by-slice notes
live in [past.md](./past.md).

## Current verdict

`civ-engine` remains viable as the authoritative simulation core for this project.

The repo has now shipped through Slice 12 on top of the current engine boundary.
Upgrades, age gating, combat bonuses, conversion, relics, win conditions, save/load,
AI, maps, and debug overlays all fit behind the existing bridge without requiring
engine changes.

## Current engine asks

No active engine asks at the moment.

The previous occupancy/crowding concerns have moved to [past.md](./past.md):
`civ-engine` now ships a higher-level `OccupancyBinding`, measurable occupancy
scan counters, and blocker metadata that closes the earlier FU8 revisit
conditions.

## Current recommendation

Continue building on top of `civ-engine`.

The engine is not the blocker today.

Revisit engine work only if a new integration cost appears that cannot be kept
cleanly behind the current bridge.
