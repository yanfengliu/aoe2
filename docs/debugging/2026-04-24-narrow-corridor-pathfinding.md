# Debugging session — Narrow-corridor pathfinding "stuck" report

## Symptom
User report: "When units are close to each other and way forward is narrow,
pathfinding is broken and they seem to be stuck if ordered to go in that
direction."

No exact reproduction steps, no specific fixture seed, no screenshot. The
description maps to an in-game scenario with clustered player units and a
1-cell-wide passage ahead.

## Expected vs actual
- Expected: a unit ordered through a narrow corridor populated by neighboring
  friendly units reaches the destination; friendlies do not act as path
  blockers.
- Reported: the ordered unit(s) appear stuck.

## Reproduction
No direct reproduction obtained. Exercised the most plausible simulation-level
scenarios via a new `narrow-corridor-fixture` (see
`src/game/simulation/fixtures/economyBasics.ts`) that places a 1-cell-wide
corridor (tree walls at y=7 and y=9, x=12..28) with a 2x2 cluster of friendly
villagers just west of the mouth.

Tests live in `tests/simulation/narrowCorridorMovement.test.ts`. Each test runs
the real bridge (not mocks), issues a move command, and steps ticks until the
mover reaches the destination or a max-tick budget is exhausted.

## Hypotheses

- [x] H1: `isCellPassableForUnit` incorrectly blocks friendlies. **Disproved**
      by reading the helper and by a synthetic-corridor vitest test.
- [x] H2: `moveUnitOneSubgridStep` sticks at cell boundaries. **Disproved** by
      tracing the transform stepper and running a plug-corridor test.
- [x] H3: Cached path cache-validation uses unit-blind passability so unit
      crowd changes don't invalidate cached routes. **Confirmed as designed**.
- [x] H4: Group moves / cluster plug fails. **Disproved** by the new
      `narrow-corridor-fixture` tests.
- [x] H5: The user's scenario is the PROCEDURAL DEFAULT MAP, not a synthetic
      corridor, and the resource-cluster walker in
      `applyStandardPlayerOpeningProcedural` can wrap a cluster all the way
      around a ring so its arc meets an adjacent cluster's arc, forming an
      impassable wall around the villager cluster. **Confirmed**: the 36-cell
      near-base scan in `defaultMapNarrowPath.test.ts` caught villagers at
      (6,8) and (6,9) completely unable to reach (2,8) on seed
      `aoe2-prototype`. The berry cluster placed at angle π + jitter laid a
      5-cell diagonal (5,7)→(9,5) abutting the sheep cluster at (5,8)(5,9)(6,10),
      and the villagers at (6,8)/(6,9)/(7,9) plus scout at (10,7) were left
      inside a pocket that could only reach points east and north of the base.
      `findMovementPathToCandidates` correctly returned null for the west
      target, `resolveMovePlanFromCache` cleared the move command silently,
      and the villagers never moved — exactly matching the user report.

## Investigation log
- 2026-04-24 09:45..09:56 — Ruled out simulation-layer hypotheses H1-H4 by
  reading the movement pipeline and running a hand-crafted narrow-corridor
  fixture. Tests passed. Prematurely concluded "no engine ask" in
  engine-feedback and tried to stop.
- 2026-04-24 10:05 — User pushed back: the bug IS real, it lives in the
  procedural default map (`npm run dev`), and absence-of-bug is not engine
  feedback. Reverted the engine-feedback note and pivoted to driving the
  actual default map.
- 2026-04-24 10:13 — Dumped the default map at `DEFAULT_SEED`. Saw the
  starting resource clusters form a near-continuous wall on the NW side of
  player 1's base.
- 2026-04-24 10:30 — Stress test (`defaultMapNarrowPath.test.ts`) iterated
  each starting villager × near-base target and found two stuck cases:
  unit 2205 at (6,8) ordered to (2,8), and unit 2206 at (6,9) ordered to
  (2,8), both staying put for 150 ticks.
- 2026-04-24 10:40 — Diagnostic trace confirmed A* path was never found
  (all near-target candidates unreachable from the villager pocket).
- 2026-04-24 10:48..10:52 — Added guaranteed cardinal exit corridors
  (2-row horizontal + 2-column vertical, extending 13 cells from TC
  center) to `cellBlockedByScenarioEntity` in
  `applyStandardPlayerOpeningProcedural`. Resource cluster walker now
  skips those cells, so no ring arc can close around the base.
- 2026-04-24 10:55..11:14 — Re-ran the stuck-diagnostic, the
  narrow-corridor and movement-caching tests, the new
  `defaultMapNarrowPath.test.ts`, then `npx tsc --noEmit`, the full vitest
  suite, and `npx vite build`. All green.

## Root cause
The procedural default-map resource placer in
`src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts`
(`placeResourceCluster`) walks the full perimeter of each ring starting
at `preferredAngle ± jitter` until `count` cells are placed. When several
clusters share a ring band (sheep at ring 3-5 east, berries at ring 3-4
west, gold at ring 5-6 NE, stone at ring 5-6 N, forest at ring 6-12 SW/W/NW)
and some preferred positions are blocked by earlier placements, the
fallback walk can lay down a continuous arc of resources around the TC.
For seed `aoe2-prototype` the berry arc (5,7)→(9,5) met the sheep arc
(5,8)(5,9)(6,10) and the villager cluster was sealed inside a small
pocket with no path to the western half of the map.

## Fix
Reserved four guaranteed-clear cardinal exit corridors through the
resource-placement predicate:

- Horizontal 2-row corridor at `y = TC.y` and `y = TC.y + 1`, spanning
  `|x − (TC.x + 1)| ≤ 13`.
- Vertical 2-column corridor at `x = TC.x + 1` and `x = TC.x + 2`, spanning
  `|y − (TC.y + 1)| ≤ 13`.

The extent (13 cells) reaches past the outermost forest ring (ring 12),
so no cluster walker can close a ring around the TC. The corridors
align with the villager spawn rows (`TC.y` and `TC.y + 1`) so the
starting villagers have a direct east/west path, and with the TC center
columns so the scout and any units that walk around the TC have a
straight north/south path.

Files changed:
- `src/game/simulation/mapGeneration/applyStandardPlayerOpening.ts`
  (extended `cellBlockedByScenarioEntity` inside
  `applyStandardPlayerOpeningProcedural`).

## Verification
- `npx vitest run tests/simulation/defaultMapNarrowPath.test.ts` — 4/4 pass
  (each starting villager reaches each cardinal exit target).
- `npx vitest run tests/simulation/narrowCorridorMovement.test.ts` — 4/4 pass
  (the hand-crafted corridor regression still holds).
- `npx vitest run tests/simulation/movementPathCaching.test.ts` — 5/5 pass.
- `npx tsc --noEmit` — clean.
- `npx vitest run` (full suite) — 43/43 files, 373 passed + 1 skipped. The
  6 `[vitest-worker] onTaskUpdate` errors are the documented pre-existing
  Windows-only worker warnings (see `docs/devlog/summary.md` entries for
  Batch FU8 and Slice 12); they do not fail individual tests.
- `npx vite build` — clean.
- Live dev: `npm run dev` was spun up earlier in the session; its stuck
  scenario at (6,8)→(2,8) now resolves via the guaranteed west corridor
  (verified via `_stuckDiagnostic` trace before cleanup: villager walks
  (6,8) → (5,8) → (4,8) → (3,8) → (2,8)).

## Follow-ups
- No architecture update (the change is inside an existing helper, no new
  module boundary).
- No engine ask: `civ-engine` pathfinding and occupancy primitives behaved
  correctly at every layer; this was a repo-side map-generator problem.
- Regression coverage: `tests/simulation/defaultMapNarrowPath.test.ts` is
  the guardrail. If a future cluster-placer change lets a new ring arc
  close the base, the four cardinal-exit tests will catch it.
