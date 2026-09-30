# unit-occlusion-outline — review iteration 1 (2026-07-15)

In-process adversarial Workflow: 4 dimension reviewers (fog-leak, determinism, render-contract, predicate-truth) + 9 refuting verifiers, all reading the live working tree. 13 agents, 0 errors.

## Confirmed findings → all fixed in-tree

- **HIGH (predicate-truth): farms white-ghosted adjacent farmers.** Ground-pixel anchor + any-part hulls meant ankle-high geometry that merely paints at the feet (farm soil/team marker, tallest 0.51 wu) fired the full-body cue for a ~1.24 wu villager standing in plain sight; the verifier reproduced it end-to-end with real recipes and the real sim (a farm's diagonal corner cell — which the gather system itself assigns as a neighbor's approach cell — fired permanently). FIX: the cover anchor now samples the unit's MID-BODY (`visualTop * 0.55`), so an occluder must actually reach over the unit; regression test `never cues a unit standing beside a farm`.
- **MED (predicate-truth): construction sites ghosted their own builders.** Foundation slab (0.14 wu), knee-high wall course (top 0.52), and scaffold rails fired the cue on the sim's own north-row approach cells — probed live: 26/29 construction ticks ghosted a builder. FIX: mid-body anchor resolves the slab/course class geometrically; the thin scaffold members fall to the hairline filter; regression test `never cues builders beside a construction site`.
- **MED (predicate-truth): hairline accents cut flickering ghost corridors.** The TC flag pole (0.072 wu ≈ 2.3 px) projected a corridor that full-body-flashed units on open ground cells behind every town center (verified sweep: on/off inside a 5–12 px band, no hysteresis). FIX: occluder parts need real horizontal mass (`min(width, depth) >= 0.15 wu`); regression test `never cues through hairline accents`.
- **MED (fog-leak dimension, spec): the spec still recorded the cue as an unshipped gap.** Timing artifact of reviewing mid-flight — the flips (§14.5 supersession paragraph + the units-behind-buildings bullet rewritten as shipped v0.2.5 behavior) were applied and are in the ship commit.
- **LOW ×3 (all DOWNGRADEd as unreachable-today, fixed anyway):** `resetForBridgeSwap` retained the occluded-unit list across bridge swaps (fixed + regression test); the lift/offset constants were duplicated without a lift-vs-building-height guard (now shared exports `SCREEN_LOCKED_DEPTH_LIFT/OFFSET` in aoeVoxelOverlayParts + a guard test asserting every recipe in `AUTHORITATIVE_BUILDING_FOOTPRINTS` stays under the lift); the unfenced `getOccludedUnitStates` seam was judged consistent with the accepted-state seam family it mirrors (documented, no change).

## Notable refuted/adjusted claims

- The "unfenced seam disagrees with pixels" scenario was refuted as unreachable through every existing call path (the sole consumer force-syncs first; rejected snapshots throw through the same call).

## Fix fallout caught during re-testing

- The test fixture's hardcoded `visualTop: 2` (vs the real ~1.24) silently moved the mid-body anchor above the TC hall's hull — the helper now computes visualTop from real parts, mirroring the adapter.
- The original "deep flank (7,9) behind the TC" positive was itself a plinth false-positive: the TC's tall hall is inset, so a unit there is ~95 % visible. The max-corner depth gate is now pinned on the castle (whose corner towers genuinely cover the flank — probed), and the TC (7,9) case became an explicit plinth NEGATIVE.

## State after iteration 1 fixes

tests/rendering 170/170, tsc, eslint, browser occlusion spec green; default-map evidence re-captured (1,416/480,000 px, 804 new near-white px in one villager-sized bbox — the boot-scene cue is genuine: the slot-displaced villager at (7.25, 9) sits behind the hall's wing corner). Iteration 2 (fix-completeness + fix-regression reviewers) launched on the delta; ship gated on its result.
