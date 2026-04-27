Iter-2 review complete. Findings:

**High (2):**
- **V5-1** `GameScene.ts` 1034 LOC > strict 1000 ceiling. Iter-4 buildingRenderer extract stopped 34 lines short.
- **V5-2** V4-12 fix regresses steady-state cost. `countOwnedUnits` walks `world.query('unit')`, same as `assignAiMonkTasks`. AI with monks (typical mid-late game) now does 2 walks instead of 1. Iter-1 review explicitly noted side-map alternative was preferred.

**Medium (4):**
- **V5-3** AGENTS.md mandates `docs/api-reference.md` / `docs/guides/` / `docs/README.md` — none exist. Mirror V4-22 reconciliation.
- **V5-4** V4-7 throttle test injects fake-id, orphan-prune deletes it on load, asserts `[]`. Verifies schema field, not contract.
- **V5-5** V4-14 tick-tagged guard has no regression test for the missed-clear failure mode.
- **V5-6** `getSelectableEntitiesAtCell` walks full unit/building/resource queries per click. Use `queryInRadius`.

**Low/Nit (6):** `assembleBridgeApi` Omit list duplication, `pruneOrphanEntityKeys` typing, `isCellPassableForUnit` pass-through, eliminated-AI cleanup, `prototypeScenario.ts` 869 LOC cosmetic, 10 bridge files near 500-line ceiling.

**Verified (12 patterns):** All 33 side maps, destroy symmetry, V4-3/V4-11/V4-13/V4-14/V4-19/V4-22 fix shapes, conquest wildlife handling, H-3 invariant ordering, throttle save/load semantics, monk per-tick guard semantics, facade thinness.

Wrote `docs/reviews/full/2026-04-26/2/REVIEW.md`. No files modified, no patches proposed.
