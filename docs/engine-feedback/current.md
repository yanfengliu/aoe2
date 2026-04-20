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

- Sub-cell occupancy / crowding primitive.
  The repo currently layers quarter-cell unit slots and fine movement on top of
  coarse `position`, but the engine still only exposes whole-cell occupancy
  semantics. An RTS-shaped primitive should answer `canOccupy`, `bestSlotForUnit`,
  and `neighborsWithSpace` for smaller-than-cell unit packing. `SubcellOccupancyGrid`
  in `civ-engine` is close — the remaining gap is lifecycle management (the repo
  would have to mirror every spawn / move / destroy into the grid) plus the
  blocked-cell callback still taking policy decisions at call time rather than
  baking them into the grid.
- Higher-level `OccupancyGrid` ergonomics remain a secondary ask.
  Revisited in FU8 (2026-04-20); the raw `OccupancyGrid` API supports the low-level
  operations but has no built-in distinction between "blocked by building",
  "blocked by resource", and "blocked by unit" — our passability helpers need
  exactly that distinction (`isCellPassableForWildlife` ignores a specific
  wildlife resource id but still blocks on buildings and other resources + units,
  etc.). Maintaining three separate `OccupancyGrid` instances plus the
  block / unblock / occupy / release lifecycle on every building, resource, and
  unit spawn / move / destroy is strictly more bookkeeping than the current
  `world.query('building')` / `world.query('position', 'resource')` /
  `world.query('position', 'unit')` scans, which remain small and obvious at
  the current 50-200-entity match scale. The migration is a permanent skip
  until one of the "revisit when" conditions below actually lands.

## Current recommendation

Continue building on top of `civ-engine`.

The engine is not the blocker today. Revisit engine work when:

- sub-cell crowding starts leaking more policy into repo code
- occupancy scan costs become measurable (hundreds of buildings / thousands of
  units per match, not 5-20 buildings and 50-150 units)
- the raw `OccupancyGrid` lifecycle becomes worth replacing with a higher-level
  binding that owns spawn / destroy hooks and exposes `blockedBy` metadata so
  the repo can distinguish building-vs-resource-vs-unit without running three
  parallel grids
