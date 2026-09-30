# M7 "units beyond colored circles" — slice 1 (DESIGN)

## Problem

Units render as flat tinted circles (`GameScene.renderState` final branch: `entityLayer.fillStyle(tint); fillCircle(center, CELL_SIZE*size*0.5)`). At a glance you cannot tell a villager from a knight from a mangonel — only the owner colour (the tint already encodes owner + a per-type hue) distinguishes them, and there is no facing. This is the single biggest "not AoE2" tell for the unit layer.

## Goal (this slice)

Make units READABLE PER ROLE with FACING, using 100% original procedural Phaser graphics — no sprites, no copyrighted art. Out of scope (deferred, noted in roadmap): a walk/idle animation cycle, sprite assets, isometric projection, building visuals, projectile rendering.

## What the render path gives us

- The per-frame loop in `GameScene.renderState` iterates `displayedEntities: ProjectedEntityView[]`. For a unit it has: `entityType` (one of 34 `UnitType`s), `tint` (owner+type colour, from `unitTint`), `size` (per-type footprint scale, `unitSize`, ~0.45–0.85), `x`/`y` (cell-space, interpolated), `isMemory` (always false for units — units are never fog-memory), `owner`.
- `ProjectedEntityView` carries NO `facing`/`velocity`/`heading`. The civ-engine `RenderAdapter` projects only `RenderableComponent` (kind/layer/tint/size/footprint/variant). So a sim-sourced heading is unavailable WITHOUT an engine/bridge change.
- BUT the scene already keeps `previousUnitProjectedPositions: Map<id, {x,y}>` — the prior TICK's raw projected position per unit (snapshotted on tick change, line ~472; the same data `interpolateProjectedEntities` consumes). `current - previous` per unit is the true per-tick displacement → a render-side movement heading. Idle units (no/near-zero delta) get a consistent default orientation; we do NOT fabricate a heading for them.

Decision: **facing IS shipped, derived render-side from the per-tick projected-position delta.** Pure function of (prev, current). No sim/bridge/contract change. Idle fallback = a fixed resting orientation (down-and-right, the conventional AoE2 three-quarter rest pose).

## Roles (silhouette grouping)

7 roles cover all 34 unit types (grouped by role since per-unit would be 34 silhouettes — unreadable at this zoom). Membership cross-checked against the authoritative sim sets (`prototypeUnitRules/statTables.ts`: `INFANTRY_UNITS`, `ARCHER_LINE_UNITS`, `CAVALRY_UNITS`, `MELEE_UNITS`), but the role map is a render-OWNED pure function (the visual must not couple to combat-class semantics, and `skirmisher` is ranged-but-not-in-ARCHER_LINE_UNITS).

- `villager` — villager. Shape: small rounded body + a tool tick (civilian, unarmed read).
- `infantry` — militia/man-at-arms/long-swordsman/two-handed-swordsman/champion/spearman/pikeman/halberdier. Shape: a shield-ish rounded square body + a blade line pointing in facing (foot melee).
- `archer` — archer/crossbowman/arbalest/skirmisher/longbowman/elite-longbowman. Shape: a slim body + a bow arc on the facing side (foot ranged).
- `cavalry` — scout/light-cavalry/hussar/camel/heavy-camel/knight/cavalier/paladin. Shape: an elongated mount body (horizontal oval oriented to facing) + a rider bump (mounted, bigger footprint).
- `cavalry-archer` — cavalry-archer/heavy-cavalry-archer. Shape: the cavalry mount body + a bow arc (mounted ranged).
- `siege` — mangonel/onager/scorpion/heavy-scorpion/battering-ram/siege-ram/bombard-cannon/trebuchet. Shape: a boxy chassis (rect) + a wheel pair + an arm/barrel pointing in facing (machine; biggest footprint).
- `monk` — monk. Shape: a hooded triangle/robe body + a cross tick (distinct, unarmed, no facing weapon).

All shapes are drawn within the unit's bounding circle (`radius = CELL_SIZE*size*0.5`, centred at the cell centre) so the existing health-bar layout (`worldLayers.computeHealthBarLayout`, which assumes the unit top is `size*0.5` above centre) and selection-ring geometry stay correct. Owner colour = `entity.tint` (unchanged) as the body fill; a darkened outline of the tint gives separation from terrain. `isMemory` alpha is honoured (units pass fillAlpha=1 today, but the parameter is threaded for parity).

## Where the code goes (extraction)

GameScene is a pinned legacy file at exactly 1018 LOC; the file-size budget requires edits to be net-zero-or-down. So the new unit-drawing lives in `src/phaser/scenes/gameScene/unitRenderer.ts` (mirrors the v0.1.30 `terrainRenderer.ts` + the `buildingRenderer.ts`/`worldLayers.ts` dep-bag precedent). GameScene loses the 6-line circle block and gains a renderer construction + a per-unit facing+call; net LOC ≤ 0.

`unitRenderer.ts` (target < 250 LOC):
- `export type UnitRole` + `export function unitRole(unitType: UnitType): UnitRole` (pure, exhaustive — a `satisfies Record<UnitType, UnitRole>` table makes a new UnitType a compile error here, same guard style as `unitTypeMap.ts`).
- `export function unitFacingRadians(previous, current): number | null` (pure; null = no meaningful movement → caller uses the default rest angle).
- `export function createUnitRenderer({ entityLayer, cellSize })` → `{ drawUnit(entity, px, py, facingRadians, fillAlpha) }`.

## Determinism / purity

The shape + facing are a pure function of (entityType, tint, size, prev-pos, current-pos). No `Math.random` per frame; no time input. Any per-unit variation (none needed for this slice) would be derived from `entityId`. The facing source (`previousUnitProjectedPositions`) is already maintained; reading it adds no state.

## Tests (TDD, vitest, no Phaser stage)

`tests/phaser/unitRenderer.test.ts`:
- `unitRole` returns the expected role for a representative unit of each role + is exhaustive (compile guard) — and the specific `skirmisher → archer` (ranged, not ARCHER_LINE) case.
- `unitFacingRadians`: a rightward delta → ~0 rad; a downward delta → ~π/2; below-threshold delta → null (idle).
- `createUnitRenderer.drawUnit` against a Graphics SPY (a tiny stub recording fillStyle/fillCircle/fillTriangle/fillRect calls) draws different primitive sets per role (e.g. siege emits rects+wheels; monk emits the cross; cavalry emits an elongated body) and always stays within the bounding radius (centre ± radius), so health-bar/selection geometry is preserved.

Visual verification per the AGENTS.md protocol: a dedicated `unit-showcase-fixture` (test-only scenario placing one P1 unit of every role in a visible row) is captured before/after with a pixel diff (`tmp/units/{before,after,diff}.png`).
