# Slice 12 — Engine-debt refactors

Date: 2026-04-17.
Roadmap: `docs/superpowers/plans/2026-04-17-post-sheep-roadmap.md` (slice 12).

## Goal

Pay down the engine-integration debt captured in `docs/engine-feedback.md`:

1. Replace hand-rolled placement/footprint scans with `civ-engine`'s
   `OccupancyGrid` + path helpers where that actually simplifies the
   code. (Only refactor spots that are clean wins; leave the rest.)
2. Extract a reusable "find nearest legal spawn with egress" helper
   from the trapped-spawn fix so producer + scenario spawns share it.
3. Add a lightweight `WorldDebugger` probe for coarse-vs-fine unit
   position. Exposed via the existing Slice 11 F2 debug overlay as a
   new "coarse-vs-fine" mode if that drops in cleanly.
4. Fixture-validation pass at scenario boot: when a fixture spawns
   units inside building footprints or resource cells, throw a clear
   error instead of producing a wedged world.
5. Record observations about sub-cell occupancy / crowding in
   `docs/engine-feedback.md` as a suggested future `civ-engine` feature.

## Non-goals

- Rewriting everything that could theoretically live on `OccupancyGrid`.
  Only the hand-rolled scans whose call sites are tight and obviously
  DRY.
- Shipping a new `civ-engine` version or modifying the engine repo.
  That's a separate stream per `AGENTS.md`.
- Post-factum auditing of historical devlog accuracy beyond spot-
  checks; the auto-devlog rules now handle future entries.

## Scope

### 1. OccupancyGrid for placement / footprint

The existing placement-legality check (`getPlacementPreview`,
`isValidBuildingPlacement`, whatever the current helper is called)
scans every tree / mine / fish / building / unit cell manually.
`civ-engine` provides `OccupancyGrid` which indexes cell occupancy
in a typed structure.

**Refactor:** replace the hand-rolled scan with a single
`occupancy.isCellClear(x, y, footprint)` call. If
`civ-engine`'s API is missing a piece (e.g., it can't distinguish
"blocked by unit" from "blocked by building"), flag that in
`docs/engine-feedback.md` and keep the hand-rolled scan there —
don't force a lossy refactor.

### 2. `findSafeSpawnWithEgress(near, footprint)` helper

Slice 6 / earlier work grew a "find a free cell adjacent to this
building that a newly-trained unit can actually walk out of"
pattern in multiple spots (producer unit spawns, scenario validation,
ungarrison). Extract to `src/game/simulation/spawn.ts` or similar:
```ts
function findSafeSpawnWithEgress(
  world: World,
  anchor: Position,
  footprint: { width: number; height: number },
  passabilityFn: (x: number, y: number) => boolean,
): Position | null
```
All existing callers switch to the helper. No behavior change
expected; call sites shrink.

### 3. Coarse-vs-fine debug probe

One more F2 debug overlay mode: "coarse-vs-fine" — for every unit,
draw a line from its coarse `position` cell center to its
interpolated fine `unitTransform` projected coordinate. Helps spot
"unit is at coarse A but rendering at B" integration bugs (flagged in
`docs/engine-feedback.md`).

### 4. Fixture validation

At scenario boot, run a pass that:
- Verifies every spawn cell is inside the map bounds.
- Verifies no two buildings share a footprint cell.
- Verifies unit spawns are on passable terrain and not inside
  building footprints.
- Verifies resource spawns are on passable terrain.

If any check fails, throw with a clear message identifying the
scenario seed + offending spawn. This catches "fixture wedged"
setups before they silently produce weird sim state.

### 5. `docs/engine-feedback.md` refresh

Audit the file for items that have since been fixed or that shipped
inside this repo rather than needing engine work. Remove or mark as
"addressed in repo". Add observations from Slices 2-11.

## Plan

### Task A: `findSafeSpawnWithEgress` extraction

1. Write failing vitest against the helper's contract.
2. Extract from existing call sites (search for trapped-spawn /
   ungarrison spawn / producer spawn).
3. Swap every call site to the helper.
4. Commit: `Extract findSafeSpawnWithEgress helper and migrate call sites`.

### Task B: Fixture-validation pass

1. Write failing vitest: a deliberately-wedged fixture throws on
   bridge construction.
2. Implement the pass in `createSimulationBridge` after scenario
   spawn.
3. Ensure every existing fixture passes (fix them if not).
4. Commit: `Validate scenario fixtures at bridge construction`.

### Task C: OccupancyGrid migration (only if clean)

1. Attempt the refactor. If the existing `civ-engine` surface is
   awkward, skip and flag in feedback.
2. Vitest: existing placement / footprint tests must stay green.
3. Commit: `Migrate placement scans onto civ-engine OccupancyGrid` OR
   flag as no-op and document.

### Task D: Coarse-vs-fine debug mode

1. Extend F2 cycle from Slice 11 with `'coarse-vs-fine'`.
2. Phaser draws line per unit.
3. Commit: `Add coarse-vs-fine debug overlay mode`.

### Task E: engine-feedback.md refresh

1. Sub-dispatch a subagent to audit the file (per AGENTS.md).
2. Apply its output.
3. Commit: `Refresh engine-feedback.md with Slices 2-11 observations`.

### Task F: Slice gate

1. Full four-step gate.
2. Devlog + summary.
3. Commit: `Close Slice 12 with passing gate`.

## Out of scope

- Engine fork / submit PRs to `civ-engine`.
- Architecture restructure of the bridge (beyond the helper
  extraction in Task A).
- Moving content tables to a real data layer (still hard-coded
  switches).
