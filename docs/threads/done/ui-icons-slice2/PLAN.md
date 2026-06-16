# PLAN — M7 UI icons slice 2 (selection-panel unit/building glyphs, v0.1.44)

TDD order: tests first, then implementation, then visual protocol, then docs.

1. **Write `tests/simulation/selectionGlyphs.test.ts` (RED).**
   - `unitRoleGlyph(role)` returns a self-contained inline `<svg>` for all 7 roles: matches `<svg`, contains `</svg>`, `aria-hidden="true"`, currentColor, no `url(` / `<image` / `href=` / `https?:` / `data:` / `@font-face` / `font-family` / hex hue, carries the `hud-selection-unit-glyph` hook class; 7 roles produce distinct markup.
   - `unitGlyphRole(t)` is exhaustive over `ALL_UNIT_TYPES` and AGREES with `unitRenderer.unitRole(t)` for every type (drift guard).
   - `selectionGlyph(entityType)`: unit→its role glyph; each `BuildableBuildingType`→`buildingGlyphWithClass(type, 'hud-selection-unit-glyph')` (the slice-1 building art under the selection hook); resource/wildlife/relic (sheep, boar, fish, berry-bush, tree, gold-mine, stone-mine, wolf, relic)→`''`; null→`''`.
   - `renderSelectionIcons` augment-don't-replace: single villager → contains the glyph hook AND `data-selection-unit-icon="villager"` AND the badge still has text `V` AND `data-selection-unit-label="villager"`; single town-center → glyph hook + `data-selection-entity-icon="town-center"` + badge text `TC`; multi (2 villagers + house? — use the existing unit+sheep multi shape) keeps counts + emits a glyph per chip; a single SHEEP selection emits NO glyph (out of scope) but keeps `data-selection-entity-icon="sheep"` + text `SH`.

2. **Implement `src/ui/hud/icons/unitGlyphs.ts` (GREEN).** 7 role SVG bodies + `unitGlyphRole` map (`satisfies Record<UnitType, UnitGlyphRole>`, mirror unitRenderer) + `unitRoleGlyph` + `selectionGlyph` dispatcher (imports `buildingGlyphWithClass` + `isBuildableBuildingType` from `./glyphs`, `isUnitType` from displayNames). Add `buildingGlyphWithClass(type, cls)` + `isBuildableBuildingType(value)` to `glyphs.ts`. Mirror `glyphs.ts` authoring (svg() wrapper with the `hud-selection-unit-glyph` class).

3. **Wire `src/ui/hud/selectionPanel/render.ts`.** Import `selectionGlyph`. In all THREE badge sites, emit `selectionGlyph(kind)` immediately before the badge `<div>`. Badge div + every data hook + text byte-identical otherwise.

4. **Style `src/hudIcons.css`.** `.hud-selection-unit-glyph` sizing (≈ badge inner size) + currentColor tone (gold via the accent var, like the badge), so it reads as the dominant icon while the small code stays legible. Palette stays in CSS.

5. **Gates (run isolated).** `npm run typecheck`, `npm run lint`, `npm run build`, full `npm test` (full suite ALONE — footprintVisibilityConsistency flake under load). Baseline 1416/2 + new tests.

6. **Visual protocol.** Build once; capture HEAD (text-only badge) vs this branch (glyph) with a villager AND the Town Center selected → `tmp/ui-icons-2/{before,after}.png`; pixel-diff (mirror `tmp/ui-icons/diff.mjs`); confirm change confined to the selection panel.

7. **Docs.** package.json 0.1.43→0.1.44; changelog 0.1.44; devlog summary (compact to ≤50) + detailed top entry (reviewer line pending); spec §14.5 bullet; roadmap M7 mark done + remaining deferrals; this thread DESIGN/PLAN already written.

Do NOT commit (the lead runs multi-CLI review + commit).
