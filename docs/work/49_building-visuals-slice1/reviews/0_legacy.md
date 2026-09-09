# REVIEW — M7 building-visuals slice 1 (v0.1.42), iteration 1

Diff reviewed: staged working tree (15 files, +885/−73) — new `gameScene/buildingRole.ts` + `buildingSilhouettes.ts` + `tests/phaser/buildingRenderer.test.ts`; modified `buildingRenderer.ts` (completed path swaps two generic body/roof methods for a per-role silhouette delegation; construction + memory paths byte-identical); test-only `building-showcase-fixture` + its 2 registrations; package.json 0.1.42; changelog/summary/spec §14.5/roadmap; thread DESIGN/PLAN.

Reviewers (all codebase-grounded, model IDs current): Codex `gpt-5.5` xhigh read-only; Claude `opus[1m]` --effort max (Read/Glob/Grep); Gemini `gemini-3.1-pro-preview` plan.

## Verdict: CONVERGED APPROVE / SHIP

No code, correctness, contract, purity, or containment defect from any reviewer. The only actionable items were two devlog LOC corrections and one test-robustness fix — all addressed in this iteration. Reviewers are at nitpick-convergence; no iteration 2 needed.

## Findings & disposition

| # | Sev | Source | Finding | Disposition |
|---|-----|--------|---------|-------------|
| 1 | MEDIUM | Claude | Detailed devlog stated `buildingRenderer.ts 162→215 LOC` — wrong and direction-inverting. `git show HEAD:…buildingRenderer.ts \| wc -l` = **241**, working tree = 215, so the file **shrank 241→215** (the 162 was a stale carry-over of the prior header's "~160 lines of methods"). | **FIXED** — devlog now reads `241→215 (shrank — the two generic body/roof methods moved out)`. Re-verified `git show HEAD … \| wc -l` = 241 independently. This also confirms the "slimmed to an orchestrator" wording in roadmap/summary is **accurate** (see #4). |
| 2 | LOW | Claude | Detailed devlog stated `buildingShowcase.ts` 70 LOC; file (and diff hunk `@@ -0,0 +1,62 @@`) is **62**. | **FIXED** — devlog now reads 62. |
| 3 | LOW | Claude | The test Graphics spy recorded `fillCircle` by center only (radius → `rest`, not `points`), so the footprint-containment assertion never verified a filled circle's radius extent. Not a current defect (wonder spire + mill hub are safely inside), but a future edge-hugging circle could overflow undetected. | **FIXED** — spy now pushes `{x±r, y±r}` for `fillCircle` like `arc`/`fillEllipse`; the 27-test suite stays green (confirms the two existing circles are within the footprint). |
| 4 | LOW | Gemini | Reword "slimmed to an orchestrator" in roadmap/summary because the file "grew 162→215". | **REJECTED** — false premise. Gemini inherited the phantom 162 (from the subagent's report); Claude's `git show HEAD` proves the file shrank 241→215, so "slimmed" is correct. No reword. |

## Verified clear (all three reviewers, against live code)

1. **No sim/contract/save impact** — changes confined to `src/phaser/scenes/gameScene/` + the test-only fixture + its 2 registrations + tests + docs; `ProjectedEntityView` (types.ts:259) untouched; the renderer reads the existing `entityType`, not a new field; `building-showcase-fixture` reachable only via its seed dispatch (repo-wide grep = only the 2 registrations + docs).
2. **Per-frame purity** — no `Math.random`/`Date.now`/`performance.now`/trig in `buildingSilhouettes.ts`/`buildingRole.ts`; `darken`/`mix` are pure channel math; every silhouette is a pure function of (role, tint, footprint rect). Deterministic.
3. **Footprint containment** — Claude traced, and Gemini independently audited, the clamps for the smallest (1×1 = 24px: tower/wall/farm) and largest (4×4 = 96px: TC/castle/wonder/market) footprints: every upward primitive is clamped to the rect top (`gableRoof` peak, `merlons` height, `drawWonder` dome+spire, `drawMill` arm, `drawMonastery` cross, `drawMilitary` pole, `drawBlacksmith` chimney) and merlons end at the inset body edge. Small-size guards prevent degenerate draws. The 18-type test backs this (+now the `fillCircle` extents, see #3).
4. **Renderer-path parity** — base rect + construction (`renderBuildingFoundation`/`renderConstructionPosts`) + memory branch byte-identical to HEAD; only the completed `else` branch changed. The six `BuildingRendererVisualState` flags are set identically (completed→body/roof/completion; construction→foundation/scaffold/construction; memory→null), which is exactly what `tests/browser/game-rendering-and-world.spec.ts` pins for TC + house.
5. **Procedural/original** — 100% Phaser primitives; no `url()`/`<image>`/sprite/texture/asset. The 13 role silhouettes are original.
6. **Role coverage** — all 18 `BuildingType`s map to a role; `as const satisfies Record<BuildingType, BuildingRole>` makes a new building type a compile error; groupings sensible (4 military → `military`, 2 walls → `wall`, 2 camps → `drop-site`). The `as BuildingType` cast under the `kind === 'building'` guard cannot fall through (the building arm of `entityType` IS `BuildingType`).
7. **File size / determinism / doc accuracy** — buildingSilhouettes 342, test 269, buildingRenderer 215, buildingRole 55, all < 500; GameScene unchanged at 1017 ≤ the 1018 pinned cap. spec §14.5 / changelog 0.1.42 / per-role descriptions all match the implementation (after the devlog LOC fixes).

## Process notes

- **Gemini transient:** hit 429 "MODEL_CAPACITY_EXHAUSTED" retries on some file-read tool calls but recovered within the same run and produced a grounded review.
- **Contamination audit:** clean — `git diff` (unstaged) empty after the Gemini run; its plan-mode `replace` tool never fired.
- **Codex sandbox:** could not run `npm test` (PowerShell `npm.ps1` block + esbuild access-denied under the read-only sandbox) — a known environment limitation, not a finding; gates were run by the lead.
