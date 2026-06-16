# Terrain kind-to-kind blended transitions (M7, v0.1.43)

## Objective

Soften the hard rectangular seam between adjacent terrain cells of different KINDS (grass↔forest↔water↔hill) with a deterministic, procedural, render-only transition, so the terrain layer stops reading as a grid of solid blocks meeting at sharp lines. This is the single biggest remaining "not-AoE2" tell on the terrain layer after the v0.1.30 per-cell brightness jitter.

## Investigation (design-aware feasibility check)

- **Terrain data model render-side.** The RenderAdapter projection (`src/game/simulation/bridge/visibility.ts:projectEntity`) sets a terrain tile's `ProjectedEntityView.entityType = terrain.kind` (one of `'grass' | 'forest' | 'water' | 'hill'`, `TerrainKind` in `src/game/simulation/types.ts`). So each terrain cell's KIND is already available render-side via `entity.entityType`. Terrain tiles cover the FULL grid (`scenarioSeedOps.seedTerrain` adds a renderable terrain tile for every `scenario.terrain` cell) and are NOT fog-filtered (`renderStateOps` only fog-filters `building`/`resource`). So the renderer already iterates a complete per-cell terrain kind set inside `state.entities`.
- **Elevation.** `TerrainComponent` carries `elevation: number`, BUT `ProjectedEntityView` has NO elevation field — elevation is never projected. Adding it would be a projection/contract change, which this slice forbids. **Therefore elevation shading is OUT OF SCOPE for v0.1.43** (deferred to a future slice that would extend the projection). This slice does the blended-transitions half only.
- **Base tints (from `seedTerrain`):** grass `0x587f4e`, forest `0x2f5e34`, water `0x295a75`, hill `0x8c7d5a`.
- **The "before" look.** Every terrain cell is a flat `fillRect` of its (jittered) per-kind tint with a +1px overdraw. Two adjacent cells of different kinds meet at a hard rectangular edge — a grass cell beside a water cell is a perfectly straight grass/water line, the classic tile-grid tell.

## Slice (what we implement)

Neighbor-aware blended edges, computed as a PURE function of (cell kind, the 4 von-Neumann neighbor kinds, cell coords):

1. Preserve the v0.1.30 base fill EXACTLY — `terrainCellTint` jitter + the +1px overdraw rect are unchanged (regression-guarded by the existing tests).
2. For each terrain cell, for each of its 4 edges (N/E/S/W) whose neighbor cell is a DIFFERENT kind, draw a deterministic FEATHERED transition: a band of small square "stipple" specks straddling the shared edge, tinted with the BLEND of the two cells' base tints (50/50 channel average), at partial alpha. The specks' positions + which subset is drawn are chosen by a deterministic per-(cell, edge, index) hash (no `Math.random`/time), so the boundary reads as a dithered/feathered interlock rather than a straight line. A missing neighbor (map edge) is treated as same-kind → no transition (we don't blend the world border).
3. The blend specks stay strictly inside the cell's own rect (we feather on the INNER side of the owning cell, and the symmetric neighbor cell feathers back toward this one, so the two stipple bands interlock across the seam). This keeps cell geometry untouched: unit/building/HP-bar/selection geometry is unaffected, and the blend sits UNDER the entity/fog/selection/grid overlays (it is drawn on `terrainLayer`, the bottom layer).

Determinism: every speck derives from `hash(cellX, cellY, edgeIndex, speckIndex)`; same inputs → identical draws. No per-frame state, no random, no time.

Color derivation: the transition colour is `blendTint(ownTint, neighbourTint)` (per-channel average of the two KINDS' base tints), not a hardcoded unrelated colour — a grass/water seam feathers grass-green into water-blue.

## Why neighbor lookup is cheap + contained

The scene loop iterates a flat `displayedEntities` list, calling `drawTerrainCell` once per terrain cell. To read a cell's neighbor KINDS we build a `Map<packedXY, TerrainKind>` from the terrain entities and memoize it on the `entities` array reference (a module-level `WeakMap<entities, grid>`). The load-bearing win is WITHIN a single render pass: the scene passes the same `displayedEntities` array to all N `drawTerrainCell` calls, so the grid is built once (first terrain cell) and reused O(1) for the rest — turning an O(n²) per-frame cost into O(n). The memo does NOT carry across frames: the live path assigns `displayedEntities = interpolateProjectedEntities(state.entities, …)`, whose `.map()` returns a FRESH array every render, so the WeakMap misses and the grid rebuilds once per render pass. That per-frame O(n) build is the same order as the render path's existing per-frame `.map()` + N terrain fills, so it is negligible at this map scale; and because the key is a fresh array each render, a stale grid is impossible. Old arrays are GC'd with the WeakMap.

## Containment / boundaries respected

- RENDER-ONLY. No simulation/bridge/save-format/contract change. `ProjectedEntityView` and the terrain projection are untouched — the renderer consumes EXISTING projected `entityType` per terrain cell.
- `GameScene.ts` stays at its pinned 1017/1018 cap (the terrain branch stays the same line count; only the call args + import change). `terrainRenderer.ts` stays < 500 (a `terrainBlend.ts` helper module is extracted if needed).
- The v0.1.30 jitter + +1px overdraw are preserved byte-for-byte.

## Deferred (explicitly)

- Light/shadow by ELEVATION — needs `elevation` projected onto `ProjectedEntityView` (a contract change), out of scope here.
- Diagonal (8-neighbour) corner blends — the 4-edge feather already removes the dominant straight-seam tell; corners are a polish follow-up.
- Per-kind bespoke transition textures (e.g. a beach gradient for grass↔water) — the generic two-tint feather is the contained win; bespoke shorelines are a later slice.
