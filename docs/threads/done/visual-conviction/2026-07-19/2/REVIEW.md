# Terrain and water review — pass 2

## Scope

This pass reviewed the v0.3.4 terrain-material and water-motion slice against the live AoE adapter, exact reachable Voxel 0.1.4 pin `faa00bf2ef83e5134bd9ca62c0b36cd0cfbe394b`, fog filtering, animation budgeting, full-cycle geometry, terrain picking, production-browser timing, performance metrics, and fixed visual evidence.

## TDD and implementation evidence

- The focused terrain-detail file began RED with four expected failures and one passing flat-terrain/picking invariant because the old renderer exposed only sparse matte glints, rocks, tufts, and logs.
- The source adds deterministic grass flecks and tufts, forest litter and logs, hill strata and rocks, visible-land shoreline foam, dark water ripples, pale sky-and-sun reflection strips, and spatially phased crests on a dedicated low-roughness standard-material water surface.
- Six focused source files pass 65/65 tests after the shoreline-budget correction. A 65-sample complete-period sweep bounds each animated part; an 8,193-crest case admits exactly 8,192 animations and retains the excess crest in the static water lane.
- The dedicated headless production-browser test proves equal-time capture identity, visible change after forward displayed simulation time, refreeze identity, seven materials, nine declared batches, one active animated water batch in the terrain fixture, and bounded instances/draws/triangles. The existing eight-test renderer suite also passes with three active animated batches on the default map.

## Visual evidence

- A clean parent-commit/current pair used the same `terrain-showcase-fixture`, 800×600 viewport, tick 0, and accepted/presented revision 2. The material pass changed 20,591/480,000 pixels (4.2898%); changed pixels begin below the top HUD and end above the bottom HUD, covering only world terrain detail.
- The two-player `terrain-water-motion-fixture` keeps the match alive without moving actors. Its canvas-only 1,000 ms comparison changed 1,631/384,000 visible pixels (0.4247%), confined to the rendered water streaks. At the initial sample the scene used 1,699 instances, 30 animated crests, 10 draw calls, and 24,636 triangles.

## Review findings and disposition

1. **Closed — declared browser metrics still described six materials and seven batches.** Production assertions now require seven materials and nine batches; the default scene proves three active animated lanes.
2. **Closed — two sine extrema could miss a combined scale/rotation corner extremum.** Bounds now sample 65 evenly spaced poses across every part's complete phase-shifted period.
3. **Closed — static companions did not prove animation-budget overflow.** The direct 8,193-crest test proves one unadmitted crest remains visible in `aoe2:batch:water-parts` with no animation payload.
4. **Closed — the first browser proof used a terminal one-player terrain fixture and overconstrained its atomic advance to exactly one tick.** A dedicated inert two-player fixture keeps displayed time live; the assertion requires forward progress and demonstrates advance/refreeze on the world capture.
5. **Closed — design promised shoreline foam but the initial draft authored only interior marks.** Visible water-to-land edges now emit bounded matte foam; missing fog neighbors do not reveal their kind.

## Verdict

Approved. Independent adversarial review found no remaining source or test issue after checking the reachable pin, material/lane exhaustiveness, deterministic whole-identity animation admission, overflow visibility, fog isolation, full-cycle bounds, terrain-hit separation, and browser timing proof. Full repository gates passed 2,175 tests with 2 skipped across 288 passed and 1 skipped files, typecheck, zero-warning lint, and the 565-module production build.
