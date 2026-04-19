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
  and `neighborsWithSpace` for smaller-than-cell unit packing.
- Higher-level `OccupancyGrid` ergonomics are still a secondary ask, not a blocker.
  The raw block/unblock/occupy/release lifecycle is heavy enough that this repo
  still prefers simple scan helpers for buildings, resources, and units.

## Current recommendation

Continue building on top of `civ-engine`.

The engine is not the blocker today. Revisit engine work when:

- sub-cell crowding starts leaking more policy into repo code
- occupancy scan costs become measurable
- the raw `OccupancyGrid` lifecycle becomes worth replacing with a higher-level binding
