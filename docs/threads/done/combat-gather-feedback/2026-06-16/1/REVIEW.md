# REVIEW — M7 combat/gather feedback + selection polish (v0.1.45), iteration 1

Diff reviewed: staged working tree (18 files, +998/−32) — new `gameScene/feedbackEffects.ts` (pure pulse/flash logic + facade) + `resourceRenderer.ts` (byte-identical extraction); `selectionLayers.ts` (optional pulse param, static default = unchanged ring); `GameScene.ts` (feedbackRenderer + isAnimating cache-bust + recordTick + drawUnitFlash); test-only `feedback-showcase-fixture` + 2 registrations; `feedbackEffects(19)`/`selectionLayers(4)`/`resourceRenderer(2)` tests; package.json 0.1.45; changelog/summary/spec §14.5/roadmap; thread DESIGN/PLAN.

Reviewers (all codebase-grounded, model IDs current): Codex `gpt-5.5` xhigh read-only; Claude `opus[1m]` --effort max (Read/Glob/Grep); Gemini `gemini-3.1-pro-preview` plan.

## Verdict: APPROVE / SHIP (after fixes)

No HIGH defect. One **MEDIUM** (a render-cache edge that leaves a faint stale flash frame at expiry — found by Codex, **missed** by Claude's cache-bust pass, so a genuine reviewer divergence) + 5 LOW across the three reviewers. The MEDIUM was verified real against the live code and fixed; the LOWs were addressed or consciously waived. All fixes are render-layer only; no behavior/contract change. Reviewers are at nitpick-convergence; no iteration 2.

## Findings & disposition

| # | Sev | Source | Finding | Disposition |
|---|-----|--------|---------|-------------|
| 1 | MEDIUM | Codex (Claude missed) | Stale final flash frame: at the frame a hit flash expires (`intensityAt`→0 at 260ms) with nothing else animating, `isAnimating` goes false → `renderState` early-returns (`GameScene.ts:472-480`) **without** clearing the layer (`clear()` is at `:516-517`, after the guard) → the faint last-drawn flash lingers until the next invalidation. Reachable indefinitely when paused/no-tick at expiry (e.g. a paused replay; Phaser keeps drawing frames, but renderState early-returns). | **VERIFIED real** (read the guard + clear lines + traced the expiry frame). **FIXED:** added `FLASH_CLEAR_GRACE_MS = 80`; `hasActiveFlash` stays true for the grace **past** the visual end (`intensityAt` is already 0 there, so nothing is drawn) so the scene runs ≥1 more clear-render that wipes the layer, then settles to the static fast-path. Frame-rate-robust for any playable rate. Test updated (intensity 0 + hasActiveFlash true within grace; false past it). |
| 2 | LOW | Codex | `drawHitFlash` rim: `strokeCircle(r)` with a 2px centered stroke bleeds ~1px past `r`, so "confined to radius r" was imprecise. | **FIXED:** rim now drawn at `r - rimWidth/2` (= r−1), keeping every stroke pixel within `r`. Containment test still green. |
| 3 | LOW | Codex | `shouldFlashHit` comment says "finite" but only null/undefined were rejected — `Infinity`/`NaN` fell through to `<`. Not reachable (projected hp is finite). | **FIXED:** added `Number.isFinite` guards; +1 test (Infinity/-Infinity/NaN → false). |
| 4 | LOW | Claude | The HitFlashTracker armed (and reported `hasActiveFlash` for) **buildings** too (they carry `currentHp`), but the flash is only **drawn** for units — so a damaged building with nothing selected held the animated (non-cached) path 260ms with nothing visible. Harmless, but the "fast-path-when-idle" property wasn't tight. | **FIXED (facade-side):** `feedHitFlashTracker` now skips non-`'unit'` entities (`HpSample` gained a structural `kind` — `feedbackEffects.ts` stays import-free), so the tracker only tracks/arms what `drawUnitFlash` actually draws and a damaged building never holds the animated path. Put in the facade (not GameScene) so the filter is testable and the pinned scene stays lean at **1011** (no doc-figure churn); +1 test (`feedHitFlashTracker` tracks only units). |
| 5 | LOW | Claude | Theoretical stale-flash if the engine reuses a raw entity id **within a single projected frame** (record-then-prune order) — needs generationless same-frame id reuse. | **NO ACTION (waived).** Degenerate (the engine prunes on disappearance; normal id lifecycle is safe) and cosmetically trivial for a 260ms flash. Acknowledged for awareness. |
| 6 | LOW | Claude | Thread-doc wording: DESIGN/PLAN said the fixture is "Imperial age" (it is `castle-age`) and called the swell a "sine phase" (code uses `Math.cos`). Thread docs only; user-facing surfaces accurate. | **FIXED:** PLAN "Imperial age"→"Castle age"; DESIGN "sine phase"→"cosine phase (`(1 - Math.cos(...)) / 2`)". |

## Verified clear (against live code, all three reviewers)

1. **No sim/contract/save impact** — `git diff` for `types.ts`/`visibility.ts`/`createSimulationBridge.ts` empty; `ProjectedEntityView` untouched; both effects read only existing `selected`/`currentHp` + a render-side per-tick hp delta. Gather sparks correctly skipped (gather task not projected → would be a contract change).
2. **Time/random render-only** — no `Math.random`/`Date.now`/`performance.now` introduced in `src/game/`; the pulse derives from `this.time.now` (Phaser clock) fed into pure fns; `feedbackEffects.ts` imports nothing. Animation never feeds the deterministic sim/replay.
3. **Cache-bust** — `isAnimating` ANDed into the early-return guard: selection ⇒ pulse every frame; flash keeps the loop awake for its life (+ now the clear-grace); idle ⇒ static fast-path restored. `recordTick` runs once per TICK (not per frame), fed projected (not interpolated) hp.
4. **Geometry unchanged** — `STATIC_SELECTION_PULSE` default reproduces the exact prior ring; building rect inflates symmetrically (origin/center fixed), unit circle keeps center with `radius+offset`; `drawHitFlash` within the bounding radius (now provably, post-fix).
5. **resourceRenderer extraction** — `drawResourceEntity` is byte-identical to the removed inline branch (mechanical `this.entityLayer→graphics`/`CELL_SIZE→cellSize` rename only).
6. **HitFlashTracker** — first sample arms nothing; heal/no-change doesn't arm; re-arms on a second drop; `pruneTo` drops absent ids (safe map-delete during iteration); null hp deletes the entry; decay has no off-by-one.
7. **Sizes / determinism / docs** — GameScene unchanged at 1011 (the unit-filter fix went in the facade, not the scene; ≤ 1018 cap); feedbackEffects 303, resourceRenderer 40, selectionLayers 234 — all < 500; pure fns deterministic; changelog/spec/roadmap figures accurate; deferrals (gather sparks / death particles / projectiles) documented.

## Process notes

- **Reviewer divergence (the value of multi-CLI):** Codex caught the MEDIUM stale-frame edge that Claude's higher-level cache-bust verification missed and Gemini didn't surface. Per AGENTS.md "substantive finding count, not vote count," it was verified against the codebase and fixed despite 2 APPROVEs.
- **Contamination audit:** clean — `git diff` (unstaged) empty after the Gemini run; plan-mode `replace` never fired.
- **Codex sandbox:** could not run `npm test` (PowerShell block) — known limitation; gates run by the lead (full suite + the post-fix feedbackEffects re-run).
