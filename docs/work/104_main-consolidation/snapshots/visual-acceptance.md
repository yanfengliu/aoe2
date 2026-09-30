# Final combined building-sight visual acceptance

Checked 2026-09-29 22:14 PDT. Scoped result: the completed House gains visible terrain around its footprint and a matching minimap reveal at both 800x600 and 1280x800; the House geometry stays unchanged. No material visual defect found in the four paired views.

## Provenance and bound

Baseline: primary `C:/Users/38909/Documents/github/aoe2`, main `3bc906af51af5f29a48d11400d21aab79d714449`, build asset `index-BOjMiMOd.js`.

After: frozen integration `C:/Users/38909/Documents/github/aoe2-worktrees/codex-consolidate-main`, build asset `index-BFZTj7oK.js`. Integration owner supplied frozen product SHA `efd658891215f4d5b8a23eaa6afff734e59076e86254790fdf84159fbf36236d` and tree `17621d488624ba69a398dceb5b0d193c09fb69b0` before the build. CSS is `index-D_Jao2Ic.css` in both builds.

Both `npm run build` commands passed. The initial sandboxed baseline Vite build was blocked by ancestor-directory ACL; the authorized elevated retry passed. Both builds warned about the existing bundle-size budget.

Every capture used the maintained `scripts/captureMapScreenshot.mjs`, explicit `STYLE=de` (Natural), `RASTERISER=gpu`, paused `TICKS=0`, and matched viewport, seed, focus and zoom. The script verified build freshness, the served hashed assets, the selected style and the canvas renderer. Every log names `ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)` and Natural ground tier `blend`.

This is static visual acceptance on the GPU at tick zero. It does not prove SwiftShader behavior, complete building roster sight radii, construction input reach, save/replay fidelity, simulation-time progression or performance. Camera staging is direct API setup and supplies no human-input claim. The integrated full gate remains the integration owner's separate acceptance work.

## Paired results

| Pair | Settings | Changed RGB pixels | World / minimap / other HUD rectangles | Interpretation |
| --- | --- | ---: | ---: | --- |
| default-800 | aoe2-prototype, 800x600, boot camera | 111,771 / 480,000 | 84,909 / 524 / 26,338 | Expanded Town Centre footprint sight reveals the surrounding ground. Differences also reach translucent HUD backgrounds through the changed map beneath them. Central building, units and controls stay unchanged. |
| house-sight-800 | raid-warning-fixture, 800x600, focus 45,26, zoom 1.2 | 10,149 / 480,000 | 9,917 / 232 / 0 | Previously black ground immediately around the isolated completed House becomes visible; matching minimap reveal. House geometry unchanged. |
| house-sight-1280 | raid-warning-fixture, 1280x800, focus 45,26, zoom 1.2 | 10,354 / 1,024,000 | 9,917 / 437 / 0 | Same 9,917 changed world pixels as the smaller viewport, shifted with the camera projection; only minimap scale changes the remaining count. House geometry unchanged. |
| terrain-control-1280 | terrain-showcase-fixture, 1280x800, focus 12,10, zoom 1.2 | 5,293 / 1,024,000 | 0 / 19 / 5,274 | The already revealed visible terrain, water, debris and geometry are pixel identical. The TC's explicit radius 60 provides the no-fog local control. Differences are a small reveal at the map's far edge on the minimap and the corresponding backdrop through the top HUD. |

Pixel differences came from the maintained `scripts/diffMapScreenshots.mjs`. `analyse.mjs` only reads its PNG evidence and counts regions; it does not create or alter capture images. Region counts do not silently treat a HUD-backdrop difference as a world rectangle. A literal requirement for zero differences inside every HUD rectangle would fail in the opening and terrain-control pairs: translucent backgrounds show the intended visibility change behind them. Native inspection found stable text, icons, layout and opaque controls; the differences follow revealed map regions and their compositing, with no unrelated geometry change.

`raid-warning-fixture` is common to both trees and is the positive sight control: human House at (44,26), human Town Centre at (4,4), no human units, no explicit House vision. The maintained footprint fixture instead pins the human sight radii explicitly, so it cannot prove the recovered sight change. Its two baseline views were inspected but deliberately left unpaired when the integration owner narrowed the time budget.

All eight baseline PNGs, all four after PNGs and all four diff PNGs were inspected individually at native resolution with `view_image(detail=original)`, not via a contact sheet. `manifest.json` binds the exact bytes to SHA-256, dimensions, byte counts and paired measurements. Manifest SHA-256: `8ca1e897ec54c35516fd817ba438a920205e9da54bc0d83ca29b3556af2c5b1f`.

## Existing browser input coverage inspected

`tests/browser/game-progression-and-production.spec.ts` has a real Build House button click and map click followed through completed construction, although its initial unit selection uses the test seam. `tests/browser/play-opening.spec.ts` adds the idle bell, Build House, hover, mouse placement and timed completion path. `tests/browser/game-combat-and-meta-meta.spec.ts` exercises real menu save, Load, source selection and Restore. `tests/browser/replay-load-dialog.spec.ts` exercises live/prior replay entry and Escape exit; `tests/browser/replay-scrub.spec.ts` exercises the range and step controls. These are identified coverage, not claims that this worker ran those tests. No duplicate browser suite or new tests were added.

## Commands and cleanup

The owned wrapper was run with `-Checkout C:/Users/38909/Documents/github/aoe2 -Arm before -Port 4281`, then after the freeze with `-Checkout C:/Users/38909/Documents/github/aoe2-worktrees/codex-consolidate-main -Arm after -Port 4282`. It launches hidden Vite previews, uses maintained headless captures, remembers exact PID/start-time identities and has a `finally` cleanup path. Each maintained capture closes its browser in `finally`.

Diff command per stem: set `OUT_DIR` to this evidence directory, set `LABEL` to `default-800`, `house-sight-800`, `house-sight-1280` or `terrain-control-1280`, then `node scripts/diffMapScreenshots.mjs`; finally `node tmp/main-consolidation-20260929/combined-visual/analyse.mjs`.

Before cleanup ledger: 52 observed task-owned process identities, 0 remaining, port 4281 unheld. After cleanup ledger: 27 observed identities, 0 remaining, port 4282 unheld. Final fresh CIM check at 22:14:45 PDT compared every remembered PID's creation time and found 0 surviving owned identities; ports 4281 and 4282 both unheld. Proof is `before-process-cleanup.json`, `after-process-cleanup.json` and `final-cleanup.json`. No shared browser was terminated.

Only ignored task-owned evidence under this directory was authored. Captures, digest manifest and report remain intentionally available for the active integration handoff. No source, tests or tracked docs were edited by this worker.
