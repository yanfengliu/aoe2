# Concrete building detail review — pass 3

## Scope

This pass reviewed the v0.3.5 completed-building detail layer against all 18 `BuildingType` values, authoritative footprints, construction-state separation, fog memory, presented silhouette picking, occlusion, material/batch budgets, the expanded evidence fixture, fixed visual captures, and the 500-line cap.

## TDD and implementation evidence

- The exhaustive concrete-type signature contract began RED because shared role recipes could not expose recognizable per-type props. The implementation appends deterministic facade, equipment, stockpile, landmark, wall, or farm details only after the construction early return.
- Exact transformed corners stay within authoritative footprints, complete recipes stay at or below 48 parts, part keys and matrices are finite and deterministic, and every building retains exactly one contact shadow.
- Adapter tests prove the prepared building hit state contains the same detail parts and instance matrices presented in Voxel batches; no parallel simplified hit or occlusion recipe was added.
- The final focused reviewer suite passed 5 files and 60 tests. A nested independent contract audit passed 4 files and 55 tests, covering fog memory, construction, visual-top authority, picking, occlusion, and batching.

## Visual evidence

- The final matched pair uses the same nonterminal two-owner fixture, tick 0, a 1,200×720 raw world capture, and all 18 owner-1 building types in frame. The no-detail baseline has 903 instances and 19,028 triangles; the detail frame has 959 instances and 19,700 triangles. Both retain seven materials, nine batches, and 14 draw calls.
- The detail layer changed 4,148/864,000 pixels (0.4801%), bounded to x=289..981 and y=32..511. The after frame visibly localizes type-specific cues to building geometry without terrain/HUD contamination.

## Review finding and disposition

1. **Closed — the first evidence fixture ended by conquest and let the victory card/minimap obscure several types.** A regression that steps through the conquest evaluation interval failed with `victory`; the fixture now has an inert fog-hidden second owner, the same test passes with `running`, and the recaptured wide pair frames every type without post-game UI.

## Verdict

Approved with no unresolved production, test, or visual finding. Full gates passed 2,180 tests with 2 skipped across 289 passed and 1 skipped files, typecheck, zero-warning lint, and the 566-module production build.
