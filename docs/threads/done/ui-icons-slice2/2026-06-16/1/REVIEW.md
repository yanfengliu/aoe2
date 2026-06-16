# REVIEW — M7 UI icons slice 2 (selection-panel unit/building glyphs, v0.1.44), iteration 1

Diff reviewed: staged working tree (13 files, +701/−4) — new `src/ui/hud/icons/unitGlyphs.ts` (7 role glyphs + `unitGlyphRole` + `selectionGlyph`); `glyphs.ts` +`buildingGlyphWithClass`/`isBuildableBuildingType`; `selectionPanel/render.ts` (glyph sibling at 3 badge sites); `hudIcons.css` (`.hud-selection-unit-glyph`); new `tests/simulation/selectionGlyphs.test.ts` (13); package.json 0.1.44; changelog/summary/spec §14.5/roadmap; thread DESIGN/PLAN.

Reviewers (all codebase-grounded, model IDs current): Codex `gpt-5.5` xhigh read-only; Claude `opus[1m]` --effort max (Read/Glob/Grep); Gemini `gemini-3.1-pro-preview` plan.

## Verdict: CONVERGED APPROVE / SHIP

No code-correctness/contract/leakage defect from any reviewer. Findings: one doc-accuracy LOW (thread DESIGN/PLAN stale, found by Codex + Claude) and one zero-cost defensive hardening (Claude, an unreachable-today `in` footgun) — both addressed this iteration. Nitpick-convergence; no iteration 2.

## Findings & disposition

| # | Sev | Source | Finding | Disposition |
|---|-----|--------|---------|-------------|
| 1 | LOW | Codex + Claude | Thread `DESIGN.md` (and `PLAN.md`, per Codex) are stale vs the implementation: they describe buildings routing through/importing `buildingGlyph` directly and say "glyphs.ts stays as-is (256 LOC)", but the shipped code added `buildingGlyphWithClass(type, cls)` (the build-button `buildingGlyph` hardcodes the `hud-command-glyph` class; selection needs the `hud-selection-unit-glyph` hook) and glyphs.ts is now 278 LOC. Code correct; the authoritative thread docs drifted. | **FIXED (doc-only).** Verified against live code (`glyphs.ts:262-278`, `unitGlyphs.ts:196-197`). Updated DESIGN.md (the Slice "BUILDINGS" bullet + the Module-layout `buildingGlyphWithClass`/256→278 lines) and PLAN.md (steps 1 + 2) to describe `buildingGlyphWithClass` + `isBuildableBuildingType` and the 256→278 growth. |
| 2 | LOW | Claude | `isBuildableBuildingType` used `value in BUILDING_GLYPH_BODY`; `in` walks the prototype chain, so `'constructor'`/`'toString'`/`'valueOf'`/`'hasOwnProperty'` would test `true` and route to non-string garbage markup. **Not reachable today** — the parameter domain is the typed union `SelectionState['selectedEntityType'] \| 'sheep'`, none of whose members are prototype keys — but the guard takes `value: unknown`, inviting wider inputs. | **FIXED (1-line hardening).** Switched to `Object.hasOwn(BUILDING_GLYPH_BODY, value)` (keeps the `typeof === 'string'` narrowing). Behaviour-identical for every real input; closes the theoretical hole at zero cost. Re-ran the 3 icon test files (26 pass) + typecheck + lint green. |

Gemini returned no actionable findings — its two LOW items were self-resolved observations (the local role-map duplication is correctly drift-guarded by a test; the resource/wildlife/relic skip is in-scope).

## Verified clear (against live code, by ≥2 reviewers)

1. **No `src/phaser` / sim / contract impact** — `git diff --cached --name-only` is exactly `src/hudIcons.css`, `src/ui/hud/icons/{glyphs,unitGlyphs}.ts`, `src/ui/hud/selectionPanel/render.ts`, the new test, + docs. `unitGlyphs.ts` imports only `game/simulation/types` (type-only), the `displayNames` barrel, and `./glyphs` — **no Phaser runtime import** (`UnitGlyphRole` is re-declared locally); the only `unitRenderer` import is in the test. DOM bundle stays Phaser-free.
2. **Contract preserved** — `selectionGlyph(kind)` is emitted as a **sibling immediately before** the `hud-selection-unit-badge` div at all 3 sites (`render.ts:42/151/180`); the badge keeps only `formatEntityIcon(kind)` + its `data-selection-(entity|unit)-icon`/`-count`/`-label` hooks. Claude grepped the Playwright specs (`game-selection-click`/`-marquee`, `game-progression-production`/`-upgrades`, `game-simulation-and-exploration-resources`) — every `toHaveText('V'/'TC'/'H'/'Ab'/'Cm'/'Mg'/'LB'/'Mn'/'CB'/'SH'/'F')` locates the badge element whose text is unchanged; the SVG sits outside it. All hold.
3. **Role-map drift guard is real + green** — `unitGlyphs.UNIT_GLYPH_ROLES` is byte-identical to `unitRenderer.UNIT_ROLES` (Claude diffed all 34 entries); both `satisfies Record<UnitType, …>`; the test iterates `ALL_UNIT_TYPES` and asserts `unitGlyphRole(t) === unitRole(t)` (a genuine value-level guard, not a tautology).
4. **Procedural/original** — all 7 unit bodies + the 18 reused building bodies are hand-authored `<path>`/`<rect>`/`<circle>` on a 24×24 viewBox, `currentColor`, `aria-hidden`; no `url()`/`<image>`/`<use>`/`href`/font/`data:`/`http`. The test's `expectNoExternalAssetRefs` covers all of these.
5. **`farm` hybrid edge** — `farm` is both `BuildableBuildingType` and `ResourceKind`; `isUnitType('farm')` is false and `isBuildableBuildingType('farm')` is true, so a selected farm takes the **building** branch → the farm building glyph (correct for the building+resource hybrid; deterministic, building branch precedes the `''` fallthrough). Every selectable building is in `BUILDING_GLYPH_BODY` (`town-center` is buildable), so no selectable-but-unbuildable gap.
6. **Sizes / determinism** — unitGlyphs 200, glyphs 278, render 289, hudIcons.css 96, test 326 — all < 500. Glyph fns are pure string builders (no Date/random). Full suite 1429 passed / 2 skipped (+13). Test in `tests/simulation/` matches the existing `selectionPanelIcons.test.ts`/`hudIcons.test.ts` convention (pure UI tests living there) — acceptable, not a misplacement.

## Process notes

- **Contamination audit:** clean — `git diff` (unstaged) empty after the Gemini run; its plan-mode `replace` tool never fired.
- **Gemini transient:** none this run; completed first and clean.
- **Codex sandbox:** could not run `npm test` (PowerShell `npm.ps1` block) — known limitation, not a finding; gates run by the lead (1429/2; + the post-fix 26-icon-test re-run after the `Object.hasOwn` change).
