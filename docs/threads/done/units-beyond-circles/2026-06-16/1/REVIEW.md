# M7 "units beyond colored circles" slice 1 (v0.1.41) — Review iteration 1

Change under review: render units as per-role procedural silhouettes + facing instead of flat tinted circles. New `src/phaser/scenes/gameScene/unitRenderer.ts` (extracted from GameScene's circle-draw block) draws each unit as one of 7 role silhouettes (all 34 `UnitType`s mapped via an exhaustive `satisfies Record`), owner-tinted, oriented by a facing derived render-side from `previousUnitProjectedPositions`. Phaser-canvas only — no sim/bridge/save/contract change. A test-only `unit-showcase-fixture` stages the screenshot. Implemented by a fresh-context subagent (design-aware — it confirmed facing was available render-side, no rescope); the LOOK was judged by the main agent via before/after screenshots; reviewed + gated by the main agent.

Reviewers: Codex (gpt-5.5, xhigh, BEGIN/END), Claude (opus[1m], --effort max), Gemini (gemini-3.1-pro, plan). All read the live codebase. Contamination audit: `git diff` (unstaged) empty — no reviewer wrote to the tree.

## Verdict: APPROVE / SHIP — converged at iter-1 after one fix.

The LOOK is a clear win (judged via screenshots: uniform circles → distinct per-type figures, owner-tinted, HP-bars + canvas otherwise pixel-identical; pixel-diff 0.29% confined to the 7 unit positions). The CODE: Codex 0 findings; Claude APPROVE (all 7 scrutiny points verified — no sim impact, per-frame purity, extraction parity with HP-bar/selection geometry preserved, procedural-only, exhaustive role coverage); Gemini verified the same. All three confirmed: change confined to `src/phaser/` + a test-only fixture + 2 registrations + docs; per-frame draw is pure (no random/time, deterministic); GameScene net −1 (1017 ≤ the 1018 pinned cap); 100% procedural Phaser graphics (no assets); facing angle is α-invariant.

## Findings and disposition

| # | Severity | Source | Finding | Disposition |
|---|---|---|---|---|
| 1 | HIGH (Gemini) / LOW (Claude) / non-defect (Codex) | all three | **Facing alpha-epsilon edge.** Facing was gated on the INTERPOLATED per-frame displacement (`α·Δ`) vs a fixed 0.02 epsilon, so a moving unit could read "idle" (snap to the rest pose) for the small-α early frames of a tick. Gemini rated it a HIGH "continuous flicker"; Claude verified it's α-invariant in ANGLE and rated the idle-misclassification LOW ("imperceptible for normal movers; only very slow movers"); Codex a non-defect. | FIXED (Claude's prescription) — `unitFacingRadians` now takes `alpha` and gates on the RAW per-tick displacement (`hypot(dx,dy) < epsilon·α` ⟺ `|Δ| < epsilon`), making the idle classification **α-INDEPENDENT** (no flicker at any unit speed or frame rate; the angle is unchanged). +2 regression tests (a fast mover at α=0.03 stays facing; α=0 boundary → rest). I verified the actual severity (at ~60 FPS the first frame is α≈0.17, so normal movers never flicker — Claude's LOW read is accurate, Gemini's HIGH overstated), but applied the robust fix anyway since it's cheap and removes the edge entirely. GameScene stayed net-zero (the call gained one arg). |
| 2 | LOW | Gemini, Codex, Claude | Cavalry uses an axis-aligned `fillEllipse` (4-way-quantized mount orientation) because Phaser can't rotate a fill ellipse; the rider/lance are continuously oriented. | ACCEPTED — all three agree it's a readable approximation, not a defect, for this slice (true rotation deferred with the rest of the per-unit-silhouette/animation polish). |
| 3 | LOW (nit) | Claude | `entity.entityType as UnitType` leans on the call-site `kind==='unit'` guard; a regressed guard would draw nothing (silent, not a crash). | No action — unreachable by construction (the unit branch is reached only after the terrain/resource/building branches `continue`); Claude itself flagged it as optional belt-and-suspenders. |
| — | LOW (info) | Claude | LOW-1's idle window is interpolation-α-dependent. | Resolved by the finding-1 fix (α-independent gate). |

## Notes
- The facing fix is exactly Claude's suggested remedy and resolves Gemini's concern, so no iter-2 re-review was warranted (verified by typecheck/lint + the 37 renderer tests, incl. the 2 new α-regression cases; GameScene held at 1017).
- Operator: orphaned `:4173-4176` vite preview servers from prior screenshot captures remain running (harmless port-occupiers) — to be cleaned up when convenient.
