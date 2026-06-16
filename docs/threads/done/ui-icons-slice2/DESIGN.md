# M7 UI icons — slice 2: selection-panel unit + building glyphs (v0.1.44)

## Objective

Give the SELECTION panel original procedural glyph icons for the selected UNIT (by render role) and BUILDING, replacing the bare two-letter text badge as the dominant visual while keeping the text code intact as the accessible label. This is the deferred follow-up to slice 1 (v0.1.39, which iconified the resource chips + build-command buttons): the roadmap M7 "UI icons" item notes "unit-roster/selection icons (still 'V'/'TC' text badges)" as still open.

## Investigation (grounded in the live code)

- The selection panel renders in the DOM HUD (NOT the Phaser canvas): `src/ui/hud/selectionPanel.ts` (the signature-cached orchestrator) delegates the icon block to `renderSelectionIcons` in `src/ui/hud/selectionPanel/render.ts`.
- `renderSelectionIcons` has three render paths, all of which draw a badge `<div class="hud-selection-unit-badge" data-selection-(unit|entity)-icon="${kind}">${formatEntityIcon(kind)}</div>`:
  1. single NON-unit selection (buildings, lone sheep, relic, resources) → `renderSingleSelectionIcon`, badge attr `data-selection-entity-icon`.
  2. single-entry unit/sheep selection → big chip, badge attr `data-selection-unit-icon`, plus a `data-selection-unit-label` name.
  3. multi-selection → compact grid of chips, badge attr `data-selection-unit-icon` + a `data-selection-unit-count` (`x3`).
- The badge TEXT is the two-letter code from `formatEntityIcon`/`formatUnitIcon` in `src/ui/hud/displayNames/icons.ts` (villager→"V", town-center→"TC", house→"H", crossbowman→"CB", …).
- **Hard contract**: Playwright browser specs assert EXACT badge text via `toHaveText` on the badge element — `[data-selection-unit-icon="villager"]`→`'V'`, `[data-selection-entity-icon="town-center"]`→`'TC'`, `[data-selection-entity-icon="house"]`→`'H'`, `arbalest`→`'Ab'`, `camel`→`'Cm'`, `mangonel`→`'Mg'`, `longbowman`→`'LB'`, `monk`→`'Mn'`, `crossbowman`→`'CB'` (files: game-selection-click, game-selection-marquee, game-simulation-and-exploration-resources, game-progression-production/upgrades). The vitest `selectionPanelIcons.test.ts` asserts the `data-selection-(unit|entity)-icon` / `-count` HOOKS. So the badge element must keep holding ONLY its two-letter code; the glyph must be a SIBLING (exactly mirroring slice 1, where the resource glyph is a sibling of `.hud-value` which keeps holding only the number).
- `unitRole(unitType): UnitRole` (7 roles: villager / infantry / archer / cavalry / cavalry-archer / siege / monk) and the `UnitRole` type already exist in `src/phaser/scenes/gameScene/unitRenderer.ts` (the v0.1.41 units slice). The existing `buildingGlyph(BuildableBuildingType)` (slice 1, in `glyphs.ts`) already covers all 18 buildable building types.

## Slice (contained)

Add procedural inline-SVG glyphs to the selection-panel badge for:
- UNITS — one glyph per RENDER ROLE (7 glyphs), grouped exactly like `unitRenderer.ts`'s `unitRole`. 34 distinct unit silhouettes would be unreadable at badge size; role is the AoE2-meaningful glance distinction and matches the on-map silhouette the player already learns.
- BUILDINGS — reuse the existing 18-type building glyph art via a new `buildingGlyphWithClass(type, cls)` helper (the slice-1 `buildingGlyph` hardcodes the build-button `hud-command-glyph` class, so the selection panel needs the same path data under its own `hud-selection-unit-glyph` hook — no path duplication).

The glyph is rendered as a SIBLING inside the badge's chip, immediately before the badge `<div>` (which keeps its two-letter code). The two-letter code stays as the visible/asserted label; the glyph is the new dominant visual.

NON-unit, NON-building entities (resources, wildlife, relic — sheep/boar/fish/berry-bush/tree/gold-mine/stone-mine/wolf/relic) are OUT of scope for this slice (the roadmap deferral is unit-roster/selection icons; resources/wildlife are not player units or buildings). For those, no glyph is emitted — the existing text badge renders unchanged. This keeps the slice contained and readable.

## Module layout (each file < 500 LOC)

- NEW `src/ui/hud/icons/unitGlyphs.ts`: `UnitGlyphRole` (a LOCAL alias of the 7 roles — NOT imported from the Phaser layer, so the DOM bundle stays Phaser-free; a test asserts parity), a pure `unitGlyphRole(UnitType): UnitGlyphRole` map (`satisfies Record<UnitType, ...>`, mirroring `unitRenderer.ts`), the 7 inline-SVG role bodies, `unitRoleGlyph(role)`, and `selectionGlyph(entityType)` — the dispatcher the panel calls: unit→role glyph, building→`buildingGlyphWithClass(type, 'hud-selection-unit-glyph')` (imported from `glyphs.ts`), else→`''`. Glyphs use `stroke=currentColor`, `aria-hidden`, 24×24 viewBox, ZERO `url()`/`<image>`/`<use href>`/font ref — identical authoring rules to slice 1.
- `glyphs.ts` gains `buildingGlyphWithClass` + `isBuildableBuildingType` (256→278 LOC) so the selection panel reuses the slice-1 building art under its own hook class without duplicating the path data.
- `render.ts`: each of the three badge sites emits `selectionGlyph(kind)` as a sibling before the badge div, behind a new `hud-selection-unit-glyph` CSS hook. The badge div is byte-identical otherwise (text code preserved).
- `src/hudIcons.css`: size/tone `.hud-selection-unit-glyph` (currentColor, gold tone via the accent var like the badge). Palette stays in CSS.

## Contract preservation

- Badge text codes unchanged (every `toHaveText` browser assertion still passes).
- `data-selection-unit-icon` / `data-selection-entity-icon` / `data-selection-unit-count` / `data-selection-unit-label` / `data-selection-unit-chip` hooks unchanged; click/selection/hotkey behavior untouched (this is render-string-only).
- The glyph is decorative (`aria-hidden`) — the two-letter code + the `data-selection-unit-label` full name remain the accessible text.
- NO `src/phaser/` change, NO simulation/bridge/save-format/contract change. Consumes existing `SelectionState` + `EconomyState`.

## Drift guard

`unitGlyphRole` duplicates the role grouping that lives in `unitRenderer.ts`. To prevent the two from drifting, a test imports `unitRole` from `unitRenderer.ts` and asserts `unitGlyphRole(t) === unitRole(t)` for every `UnitType`. (Production code does NOT import from the Phaser layer — that would pull Phaser into the DOM bundle and couple the HUD to rendering. Only the test couples them.)

## Verification

- TDD: `tests/simulation/selectionGlyphs.test.ts` — every role/type maps to a self-contained inline-SVG glyph (no external ref, currentColor, aria-hidden), the dispatcher routes unit→role glyph / building→building glyph / other→empty, the role map agrees with `unitRenderer.unitRole`, and `renderSelectionIcons` emits the glyph as a sibling while the badge keeps its two-letter code + every data hook (single-unit, single-building, multi-select paths).
- Four gates: typecheck, lint, build, full test.
- Visual protocol: before/after/pixel-diff in `tmp/ui-icons-2/` with a villager (unit badge) and the Town Center (building badge) selected; diff confined to the selection panel.

## Deferred

- Glyphs for resource / wildlife / relic selection badges (out of slice scope).
- Non-build command-card icons (train / action / market / research buttons still text-only) — the other open M7 `[ui]` item.
- A per-UNIT-TYPE (vs per-role) selection glyph.
- Minimap terrain layer + fog gradient fade (separate M7 `[ui]` items).
