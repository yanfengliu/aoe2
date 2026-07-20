# Visual conviction design

## Goal

Make the voxel battlefield convincing at normal RTS zoom through readable form, material, and motion detail: varied trees; textured land and animated reflective water cues; building-specific architecture; and unit-type equipment that agrees with locomotion and attack poses.

## Invariants

All authored variation is deterministic from serialized identity or map coordinates. Visual parts remain bounded to existing presentation footprints, and the same recipes continue to drive presented silhouette picking for raised or moving entities. Simulation occupancy, combat, fog filtering, selection priority, saves, and replay authority do not change. The dense terrain ray helper remains limited to uniform caller-owned terrain occupancy and never replaces entity recipe hits.

Every visible slice is test-first, stays under the 500-LOC cap through focused modules, preserves the production single-Three identity check, and is verified in the production bundle with fixed paused before/after screenshots plus pixel confinement. Time-varying water additionally needs equal-time identity and deterministic-time movement evidence.

## Art direction

Trees use several strong silhouettes and natural palette families rather than one jittered stamp. Terrain gains material-scale flecks, litter, logs, strata, stone clusters, shoreline foam, and deterministic color variation without pretending flat simulation terrain has raised collision. Water uses shallow geometry, low-roughness material, phase-offset wave crests, and bright reflected-sky cues; literal scene-mirror rendering is a separate performance-heavy feature and is not implied by this slice. Buildings share coherent masonry, timber, roof, door, and window grammar while major types retain unmistakable props. Units share body construction but choose per-type armor and equipment profiles whose animated attack rig matches the weapon shown.

## Non-goals

This objective does not add bitmap texture-map support to the sibling Voxel package, true planar scene reflection, shadow maps, raised-terrain collision, per-civilization architecture sets, skeletal assets, projectiles, or authoritative animation state.
