# REVIEW — M7 terrain blended transitions (v0.1.43), iteration 1

Diff reviewed: staged working tree (14 files, +638/−21) — `terrainRenderer.ts` (59→215) gains neighbour-aware blended-edge feathering; `GameScene.ts` one call-site (`drawTerrainCell` now takes `displayedEntities`); test-only `terrain-showcase-fixture` + its 2 registrations; `terrainTexture.test.ts` (6→18); package.json 0.1.43; changelog/summary/spec §14.5/roadmap; thread DESIGN/PLAN.

Reviewers (all codebase-grounded, model IDs current): Codex `gpt-5.5` xhigh read-only; Claude `opus[1m]` --effort max (Read/Glob/Grep); Gemini `gemini-3.1-pro-preview` plan.

## Verdict: CONVERGED APPROVE / SHIP

No code, correctness, contract, determinism, or containment defect from any reviewer. One doc-accuracy LOW (the WeakMap memo's cross-frame claim), independently found by 2 of 3 reviewers — fixed in this iteration (comment + DESIGN.md + devlog). Reviewers are at nitpick-convergence; no iteration 2.

## Findings & disposition

| # | Sev | Source | Finding | Disposition |
|---|-----|--------|---------|-------------|
| 1 | LOW | Codex + Claude | The `terrainKindGrid` WeakMap memo claim was overstated. It is keyed on the array passed to `drawTerrainCell` (`this.displayedEntities`), but `interpolateProjectedEntities` returns a fresh `entities.map(...)` array every render — so the cache misses **across frames**. The comment + DESIGN.md + devlog claimed the build "runs once per unique frame / is free on repeats across RAF frames," which is false for the live path. | **FIXED (doc-only).** Verified against live code: `interpolateProjectedEntities.ts:13` is `entities.map(...)`; `GameScene.ts:521` assigns `displayedEntities`, `:533` passes it to every cell. The memo is **load-bearing intra-frame** (all N cells in one render pass share the same array → one O(n) build, not O(n²) per-cell), so the WeakMap STAYS; removing it would reintroduce the O(n²). Corrected the cross-frame overclaim in `terrainRenderer.ts` (the `terrainKindGrid` comment), `DESIGN.md` ("Why neighbor lookup is cheap"), and the devlog entry to describe the real intra-frame win + the honest once-per-render-pass rebuild (O(n)/frame, negligible at this scale). No code/behavior change; no correctness risk (a fresh key each render makes a stale grid impossible). |

(Gemini returned no findings. It noted GameScene as "1018 ≤ 1018 cap" vs the project's "1017" — the trailing-newline `wc -l` off-by-one it flagged itself; Claude confirmed HEAD is also 1017, so it is true net-zero. Not a finding.)

## Verified clear (against live code)

1. **No sim/contract/save impact** — non-doc code changes are exactly `terrainRenderer.ts`, the one call-site `GameScene.ts:533`, the test-only `terrainShowcase.ts` + its export (`fixtures/index.ts`) + dispatch entry (`prototypeScenario/dispatch.ts`), and the tests. `ProjectedEntityView` (types.ts:255–274) unchanged; the renderer reads only existing projected fields.
2. **Cast soundness** — `entity.entityType as TerrainKind` is sound: `visibility.ts` sets `entityType = terrain.kind` for terrain tiles, `entityType`'s union already includes `TerrainKind`, and the cast is reached only under the `layer === 'terrain'` guard (call-site + `terrainKindGrid` filter).
3. **Full-grid neighbour resolution** — `seedTerrain` emits one renderable per terrain cell, and terrain bypasses the fog filter in both `visibility.ts` and `renderStateOps.ts`, so neighbour lookups resolve; map-edge (missing neighbour) correctly draws no transition.
4. **Determinism / purity** — only `Math.imul`/`Math.round`; no `Math.random`/`Date.now`/`performance.now`. Specks derive solely from `(cellX, cellY, edgeIndex, slot)` via `cellNoise3`; `blendTint` is commutative so the two interlocking bands across a seam share one colour. No frame-to-frame shimmer.
5. **Speck containment (all 4 edges)** — with `BAND_DEPTH=0.34`, `SLOTS_ALONG_EDGE=5`, `speck=slot*0.62=0.124·cellSize`: max along-axis reach = `5·slot − speck = cellSize − speck` (far edge tops out at exactly `cellSize`), max depth = `0.34·cellSize`; since `cellNoise3 ∈ [0,1)` strictly, every speck stays strictly inside the cell rect. v0.1.30 jitter + 1px overdraw byte-identical; same-kind interiors draw only the base fill; blend drawn on `terrainLayer` (bottom), under all overlays. (Gemini + Claude both re-derived this independently.)
6. **Procedural/original** — only `graphics.fillStyle`/`fillRect`. No `url()`/image/sprite/texture/atlas/asset.
7. **Sizes & counts (exact)** — `terrainRenderer.ts` 215 (HEAD 59); `GameScene.ts` 1017 (HEAD 1017 → true net-zero, ≤ 1018 cap); tests 18 (HEAD 6 → "6→18"/"+12" exact); full suite 1416 passed / 2 skipped. `fileSizeBudget` test green.
8. **Doc accuracy — elevation deferral TRUE** — `ProjectedEntityView` has no `elevation` field; `elevation: number` exists only on `TerrainComponent` (types.ts:190) and is never projected, so elevation shading genuinely requires a contract change and is correctly deferred. `TERRAIN_BASE_TINT` matches `seedTerrain`'s tints exactly for all four kinds.

## Process notes

- **Contamination audit:** clean — `git diff` (unstaged) empty after the Gemini run; its plan-mode `replace` tool never fired.
- **Gemini transient:** none this run (earlier slices saw 429 "no-capacity"); it completed first and clean.
- **Codex sandbox:** could not run `npm test` (PowerShell `npm.ps1` block + esbuild access-denied resolving `vitest.config.ts`) — known environment limitation, not a finding; gates were run by the lead (1416/2).
- **Devlog placement:** the subagent appended the entry to the older `###` sub-log at the file bottom; moved it to the top as a `##` entry (the newest-first recent-work convention the 0.1.36–0.1.42 entries follow).
