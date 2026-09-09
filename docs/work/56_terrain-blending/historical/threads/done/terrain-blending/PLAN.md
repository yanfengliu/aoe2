# Implementation plan — terrain blended transitions (v0.1.43)

## Files

1. **`src/phaser/scenes/gameScene/terrainRenderer.ts`** (modify; keep < 500 LOC).
   - Keep `terrainCellTint` + `cellNoise` + `clampChannel` UNCHANGED (v0.1.30 regression-safe).
   - Add `blendTint(a, b)`: per-channel average of two tints (pure).
   - Add a deterministic edge-speck helper: given (cellX, cellY, edgeIndex, cellSize), yield a small set of feather-speck rects on the inner side of that edge, with a deterministic subset chosen per (cell, edge, index) hash. Pure.
   - Add `createTerrainKindLookup(entities)`: builds (WeakMap-memoized on the `entities` array reference) a `Map<packedXY, TerrainKind>` from the terrain entities and returns a `(x, y) => TerrainKind | null` accessor.
   - Change `drawTerrainCell` signature to `(graphics, entities, entity, cellSize)`: draws the existing jittered base fill, then — using the kind lookup built from `entities` — for each of the 4 edges whose neighbour kind differs, draws the feathered transition tinted by `blendTint(ownBase, neighbourBase)`. Reads each cell's BASE tint from its kind (a `TERRAIN_BASE_TINT` table mirroring `seedTerrain`) so the blend colour is derived from the two kinds.
   - If this pushes the file > 500 LOC, extract the blend math into `terrainBlend.ts`.

2. **`src/phaser/scenes/GameScene.ts`** (net-zero LOC).
   - Update the import on line 45 to also import `createTerrainKindLookup` if needed (the lookup is built inside `drawTerrainCell` via the memo, so GameScene may only need to pass `this.displayedEntities`).
   - Terrain branch becomes `drawTerrainCell(this.terrainLayer, this.displayedEntities, entity, CELL_SIZE)` — same line count.

3. **`tests/phaser/terrainTexture.test.ts`** (extend; TDD FIRST).
   - Keep all existing `terrainCellTint` tests (regression).
   - Add a `Graphics`-spy (mirror buildingRenderer.test.ts) recording primitive calls + points.
   - Contract tests:
     - A cell surrounded by SAME-kind neighbours draws ONLY the base fill (one `fillRect`), NO transition specks.
     - A cell adjacent to a DIFFERENT kind draws transition primitives toward THAT edge (and only that edge if only one neighbour differs).
     - Deterministic: same (entities, cell) → identical recorded draw calls.
     - Transition colour is derived from the two kinds (the blend of the two base tints appears as a `fillStyle`; not a hardcoded unrelated colour).
     - Every transition speck stays inside the cell's own rect (no draw outside `[px, px+cellSize]×[py, py+cellSize]` beyond the existing +1px overdraw tolerance).
     - Map-edge (missing neighbour) draws no transition.
   - Add `blendTint` unit tests (pure average, channel bounds).

4. **`src/game/simulation/fixtures/terrainShowcase.ts`** (new, test-only) + 2 registrations
   (`fixtures/index.ts` export, `prototypeScenario/dispatch.ts` map entry `terrain-showcase-fixture`).
   - Mirror `buildingShowcase.ts`: `disableAi: true`, imperial age, generous vision, P1 TC.
   - Terrain: start all-grass, then paint adjacent patches of forest + water + hill so the visible area has grass↔forest↔water↔hill boundaries to exercise the transitions. NOT referenced by gameplay tests.

5. **Docs:** package.json 0.1.42→0.1.43; changelog 0.1.43 entry; devlog summary line; detailed devlog entry (reviewer line `[pending]`); spec §14.5 bullet; roadmap mark done + elevation deferral; this DESIGN/PLAN.

## Visual protocol

- `tmp/terrain/capture.mjs` (mirror tmp/buildings) screenshots `?seed=terrain-showcase-fixture`.
- before = `terrainRenderer.ts` at HEAD (git stash the change), after = with change, same build.
- `tmp/terrain/diff.mjs` (mirror) → pixel-diff % + changed bounding box (must be confined to terrain, since the showcase has no units/buildings beyond the TC).

## Gates

`npm run typecheck`, `npm run lint`, `npm run build`, full `npm test` (run ALONE; baseline 1404/2 + new terrain tests). Read the EXIT= line + "Tests N passed".

## Anti-regression checklist (for the reviewer)

- No sim/bridge/save/contract touch (ProjectedEntityView + projection unchanged).
- Per-frame purity/determinism (no Math.random/Date.now/performance.now; variation from cell coords only).
- v0.1.30 jitter + +1px overdraw preserved.
- Cell geometry unchanged (unit/building/HP-bar/selection unaffected).
- 100% procedural Phaser primitives (no assets/url()/sprite).
- Blend sits UNDER entity/fog/selection/grid overlays (drawn on terrainLayer).
- GameScene net-zero; every file < 500.
