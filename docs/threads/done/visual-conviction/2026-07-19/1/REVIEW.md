# Tree-form review — pass 1

## Scope

This pass reviewed the v0.3.3 tree-form slice against the live resource recipes, recipe-derived hit geometry, file-size boundary, tests, specification, changelog, and fixed paused production capture.

## Evidence

- TDD began with 18 passing tests and two RED contracts because the old recipe exposed only the broadleaf form and one canopy palette across the representative coordinate set.
- Focused rendering verification passed 74 tests; the final variation and file-size boundary passed 23/23.
- The reviewer independently passed 60/60 recipe, hit-proxy, and file-size checks.
- Full commit gates passed 2,168 tests with 2 skipped across 287 passed and 1 skipped files, typecheck, zero-warning lint, and the 565-module production build.
- The fixed paused 800×600 production capture changed 16,854/480,000 pixels (3.5113%); the changed bounds cover the forest cluster and translucent HUD pixels composited over that cluster.

## Findings and disposition

1. **Closed — spec guaranteed every normal forest would contain all forms and palettes.** The independent coordinate hash only guarantees deterministic selection across positions; a small cluster can legitimately contain a subset. The spec now requires map-position diversity without claiming cluster-level stratification, matching the implementation and tests.
2. **Closed — changelog implied presented picking polygons were unchanged.** Recipes intentionally change the visible and therefore recipe-derived hit geometry. The changelog now promises the actual invariant: picking stays synchronized with the presented forms while occupancy and game rules remain unchanged.

## Verdict

Approved after the two documentation corrections. No code blocker remains. The implementation retains the exact semantic part-key set, deterministic position seeding, bounded rotated geometry, and synchronized recipe-derived picking.
