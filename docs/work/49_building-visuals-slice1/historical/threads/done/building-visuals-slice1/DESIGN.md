# DESIGN — M7 building-visuals slice 1 (v0.1.42)

## Problem / investigation

Roadmap M7 "Building visuals: construction→complete animation and a richer procedural form; later, distinct silhouettes per building."

`src/phaser/scenes/gameScene/buildingRenderer.ts` draws EVERY building type with the SAME generic shape: a tinted rounded-rect base, then either (construction) a foundation slab + scaffold posts, or (completed) a body rect + door + roof triangle. It branches only on `entity.kind`/`visualVariant`/`isMemory` and NEVER reads `entity.entityType` — which already carries the `BuildingType` (`'town-center'`, `'house'`, `'barracks'`, …). So a Town Center, a House, a Castle, and a Wonder are indistinguishable except by footprint SIZE and owner `tint`.

`visualVariant` is `'construction' | 'complete' | 'default'` (a binary build state, not a continuous fraction — `entityCreateOps` sets `isComplete ? 'complete' : 'construction'`). There is no construction-progress fraction render-side; the construction/complete distinction already EXISTS (scaffold vs body). So the construction-visual alternative is the weaker slice.

## Decision: distinct per-building-ROLE silhouettes (the units-slice analogue)

Buildings are GENERIC → the highest-value contained slice is distinct per-type silhouettes, the direct analogue of v0.1.41's per-role unit silhouettes. 18 building types is too many readable silhouettes at this zoom, so group by ROLE (the same grouping principle as `unitRole`). 13 roles:

| Role | Building types | Silhouette idea (completed) |
|---|---|---|
| `town-center` | town-center | Landmark hall: wide body, central gable roof + two flanking corner posts/turrets |
| `fortress` | castle | Crenellated keep: tall body with battlement notches across the top |
| `wonder` | wonder | Grand domed structure: body + a large semicircle dome + spire pip |
| `house` | house | Simple home: small body + pitched roof + door |
| `mill` | mill | Windmill: body + four-blade cross over a hub |
| `farm` | farm | Tilled field: rows of furrow lines (no roof) within the 1×1 plot |
| `drop-site` | lumber-camp, mining-camp | Open resource camp: low body + a stockpile mound + a lean-to roof slope |
| `military` | barracks, stable, archery-range, siege-workshop | Training hall: body + flat/low roof + a banner pole flag |
| `blacksmith` | blacksmith | Forge: body + an anvil glyph + a chimney/smoke stub |
| `market` | market | Open-air stall: body + a striped awning band + posts |
| `monastery` | monastery | Chapel: body + steep roof + a cross finial |
| `tower` | watch-tower | Tall narrow tower: slim body + battlement cap (1×1) |
| `wall` | stone-wall, palisade-wall | Low battlement segment: short body + merlon notches, no roof (1×1) |

`buildingRole(buildingType)` is a pure exhaustive `satisfies Record<BuildingType, BuildingRole>` map (same compile-guard style as `unitRole`/`ALL_UNIT_TYPES`) so adding a `BuildingType` is a TS error here.

## Boundaries / constraints honored

- **Render-only.** No sim/bridge/save/contract change. Pure per-frame draw from `ProjectedEntityView` already in hand. No `Math.random`/time; any variation derives from `entity.entityType`/`id`.
- **Contract preserved.** `BuildingRendererVisualState` keeps its fields + the browser test's flag semantics: a COMPLETED building still reports `hasStructureBody / hasRoofAccent / hasCompletionAccent = true`; a CONSTRUCTION building still reports `hasFoundationSlab / hasScaffoldPosts / hasConstructionIndicator = true`; memory buildings still return null. The per-role silhouette is the *content* of the completed body+roof, not a new flag surface. (Walls/farms have no "roof" in real life, but the completed silhouette still draws a structure body + a top accent, so the flags stay truthful for the test's house/TC cases and consistent across roles.)
- **Footprint-rect bounds.** Every primitive stays within the building's footprint rect `[px, py, widthPx, heightPx]` (the units slice's bounding-circle discipline; buildings are rect-bounded). HP-bar/selection/footprint geometry unchanged.
- **Construction + memory paths unchanged.** Only the COMPLETED body+roof is replaced by per-role silhouettes. Construction (foundation+posts) and memory (flat ghost) are byte-for-byte the same — they read as "any building under construction / last-seen ghost," role-agnostic by design (deferred: per-role construction + rubble/damage states).

## File layout (all <500 LOC)

- `src/phaser/scenes/gameScene/buildingRole.ts` — pure `BuildingRole` type + `buildingRole(buildingType)` exhaustive map. (~60 LOC)
- `src/phaser/scenes/gameScene/buildingSilhouettes.ts` — the per-role completed-silhouette draw functions, each taking a small `(g, rect, tint, outline, fillAlpha, outlineAlpha)` dep set, all primitives within the rect. (~280 LOC)
- `src/phaser/scenes/gameScene/buildingRenderer.ts` — slimmed orchestrator: base rect + construction/memory paths unchanged; for completed buildings, resolve the role and call the matching silhouette; build the visual-state record. (stays well under 500)

`GameScene.ts` is UNTOUCHED (1017 LOC; the call-site already delegates to `buildingRenderer.renderBuildingEntity`) — net-zero, ≤1018 cap held.

## Test plan (TDD, contract-first)

`tests/phaser/buildingRenderer.test.ts` (new), with a Graphics spy mirroring `unitRenderer.test.ts`:
- `buildingRole` maps each representative type to its role + exhaustive over all `BuildingType`.
- `drawBuildingSilhouette`/`renderBuildingEntity` for completed buildings: every role draws ≥1 fill primitive; uses `entity.tint`; ALL points within the footprint rect (a small outline tolerance).
- Distinct primitive sets across a few roles (mill has the blade cross lines; wonder has an arc dome; wall/tower differ from house) so the silhouettes are provably different, not the same shape.
- Variant contract: completed → body/roof/completion flags true; construction → foundation/scaffold/construction flags true; memory → null. (Mirrors the browser test, at the unit level.)

Plus the existing browser test `game-rendering-and-world.spec.ts` (TC + house flags) must stay green — it pins the flag contract end-to-end.

## Visual protocol

New test-only `building-showcase-fixture` (P1, imperial age, generous vision) placing one completed building of each ROLE in a tidy grid, captured BEFORE/AFTER on a fresh preview port → `tmp/buildings/{before,after,diff}.png`. Confirm the diff is confined to building regions.

## Deferred (noted)

Per-building (vs per-role) silhouettes; construction→complete ANIMATION / progress fill (no fraction render-side today); per-role construction scaffolding; rubble/damage states; per-civ architecture; isometric. (All M7 follow-ups.)
