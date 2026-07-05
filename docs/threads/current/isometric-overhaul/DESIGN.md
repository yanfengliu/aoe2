# Isometric 2.5D + detailed-art overhaul — DESIGN

**Decision (user, 2026-07-05):** the graphics look too simplistic vs Age of Empires II. Direction chosen = "Full isometric 2.5D + detailed art". Constraint (unchanged): ORIGINAL/procedural art only — no copyrighted AoE2 assets; the target is a game that EVOKES AoE2, not one that is pixel-identical. This is a multi-session engine refactor, executed increment-by-increment (each with tests + the visual protocol + a commit), never a big-bang.

## Why isometric is the biggest lever

The current renderer is top-down: cell `(x,y)` → pixel `(x·cellSize, y·cellSize)`, drawn with geometric primitives (units = tinted circles, buildings = rectangle + triangle roof, terrain = flat tinted squares), viewed by a plain Phaser 2D camera. The single largest reason it does not read as AoE2 is the top-down projection. AoE2 is a 2:1 diamond-tile isometric view. Switching projection — even before the art gets richer — is what makes it "feel" like the genre at a glance.

## Approach: a projection SEAM, camera unchanged

Keep the world as a flat cell grid and keep the normal Phaser 2D camera (pan/zoom/bounds). Change only the PER-CELL placement: everywhere a renderer computes `cell * cellSize`, it instead runs the cell through `worldToIso(cellX, cellY, elevation)` (increment 1, in `src/phaser/scenes/gameScene/isoProjection.ts`). Pointer→cell hit-testing runs through `isoToWorld`. This localizes the projection change to one pure, tested module that every renderer and the input path consume, instead of a scattered rewrite.

Standard 2:1 iso: `isoX = (cellX - cellY)·W/2`, `isoY = (cellX + cellY)·H/2 - elevation·step` with `W=64, H=32`. `isoToWorld` is the ground-plane inverse (elevation 0) for clicks.

## Increment sequence (each shippable, TDD + visual protocol + commit)

1. **Projection foundation** — pure `worldToIso`/`isoToWorld` + tests. SHIPPED increment 1. Inert until the renderers consume it.
2. **Terrain in iso** — `terrainRenderer` draws each cell as a diamond (rhombus) tile via `worldToIso`, painted back-to-front (increasing `cellX+cellY`). The per-cell brightness jitter + edge blend (v0.1.30/43) carry over onto the diamond. This is the first VISIBLE iso increment. Update the terrain browser assertions.
3. **Entity iso placement + depth-sort** — `unitRenderer` / `buildingRenderer` / `resourceRenderer` place entities at `worldToIso(cell)` and draw in a single depth-sorted pass (painter's order by `cellX+cellY`, then a stable tiebreak) so nearer entities occlude farther ones. Footprint anchoring for multi-cell buildings uses the footprint's back corner. Keep the shadow (v0.1.102) → an iso ground ellipse.
4. **Hit-testing + selection in iso** — `selectionLayers` / `GameScene` convert pointer→cell via `isoToWorld`; the selection ring / footprint outline / drag-rect become iso diamonds. Update selection browser specs.
5. **Camera bounds + minimap** — `cameraController` clamps to the iso world extent (a diamond bounding box, wider than tall). Minimap can STAY top-down (a legitimate, common choice) initially; an iso minimap is a later polish.
6. **Detailed procedural buildings** — replace rectangle+triangle with genuinely modelled iso structures: a 3/4 view with visible wall faces (light + shadowed side for a consistent light direction), pitched/tiled roofs, doors, and per-role detail — inside the diamond footprint. Biggest art payoff.
7. **Detailed procedural units** — units as small 3/4-view figures (body + head + limbs + weapon silhouette) with the owner tint + shading, oriented by facing, instead of circles.
8. **Idle/walk/attack animation** — a scene-clock phase driving bob/step/lunge on the figures (composes with facing). Motion isn't in a static PNG, so validate via the pure phase helper + the graphics spy + a representative frame.
9. **Elevation + cliffs** — lift higher terrain via the elevation term (already in `worldToIso`). BLOCKED until the render projection carries per-cell elevation — the render contract (`ProjectedEntityView` / terrain projection) does not today. Needs a contract change; deferred to last.

## Key decisions / risks

- **Browser tests assert rendered pixel positions** (selection rects, chip/entity boxes, minimap). Every projection increment must update the affected specs — expect meaningful spec churn; that is the cost of the projection change, not a regression.
- **Depth-sort correctness** is the main new bug surface: entities and terrain must interleave by depth so a unit behind a building is occluded. Start with a single sorted draw pass keyed on `cellX+cellY` (+ y tiebreak).
- **Keep each increment behind green gates.** The projection seam means increments 2–4 can each ship independently and stay playable.
- **Art is procedural/original throughout.** Detail comes from more/better primitives + consistent lighting, not sprite assets.
- **The LLM playtest agent sees the rendered canvas** (`llmPromptBuilder.ts` image block), so every readability gain helps the automated playtester too — but also means iso must stay LEGIBLE, not just pretty.

## Status

Increment 1 (projection foundation) shipped. Increments 2–5 shipped together as v0.1.103 (the coordinate switch): terrain diamonds, entity iso-placement + depth-sorted draw copy, pointer/marquee/selection/placement-preview hit-testing in iso, and the camera + minimap moved into iso-pixel space (frames the TC on the first frame; minimap consumes the new `viewCell*` cell-AABB seam). The v0.1.43 square edge-feather was dropped (returns as a diamond feather later); the v0.1.102 unit shadow carried over. Pure view/camera math extracted to `gameScene/isoViewHelpers.ts` to keep GameScene under its 1018-line cap.

Increment 6a shipped as v0.1.104 (buildings as 3/4-view iso VOLUMES): new pure `gameScene/isoBuilding.ts` (`isoBuildingPolys` extrudes the footprint diamond into ground/roof/left-face/right-face polygons; `drawIsoBuilding` paints them lit/shadowed with an owner-tint roof) + `buildingRoofAccents.ts` (per-role roof feature: Wonder dome, Monastery cross, Castle/Tower/Wall merlons, military banner, Mill blades, TC turret) + per-role heights (`ISO_HEIGHT_CELLS_BY_ROLE`). Deleted the dead flat `buildingSilhouettes.ts` (moved `darken` into isoBuilding). NEXT = 6b (detailed per-building FACADES — windows/doors/wall texture on the iso faces), then 7 (units as 3/4-view figures instead of circles), 8 (idle/walk/attack animation), 9 (elevation/cliffs, still blocked on the per-cell-elevation render contract). Also open polish: the diamond edge-feather re-add (terrain), and the building HP-bar anchor could rise with the taller volume.
