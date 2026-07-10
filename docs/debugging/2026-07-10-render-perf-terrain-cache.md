# Debugging session — "the game is slow" (render perf)

## Symptom

User report: the game is slow. No specific repro; the browser experience felt laggy.

## Measurement (engine/tools first, before touching code)

All numbers from throwaway Playwright measurements on the REAL default view (`aoe2-prototype`, WITH fog), built dist, headless Chromium. Scratch specs were deleted after capture; screenshots under `tmp/perf/`.

1. **Sim tick cost (headless bundle).** `npm run playtest -- --seed aoe2-prototype --max-ticks 3000`, read per-tick `metrics.durationMs.total`: mean 2.69ms, p50 1.57ms, p90 6.67ms, p99 13.18ms, max 24.98ms. Against a 100ms tick budget (TPS=10) the sim is NOT the bottleneck. Dominant system: `prototypeVillagerEconomy` ~1.59ms/tick (59% of the tick), still well within budget.
2. **RAF frame time (first, misleading).** A tight RAF loop reported ~223ms/frame (~4.5 FPS). This was a RED HERRING: a bare RAF control loop with NO game work also measured ~229ms/frame, and paused-sim ~200ms. Headless Chromium throttles `requestAnimationFrame` to ~4–5 FPS regardless of load, so RAF-delta timing cannot measure real FPS here.
3. **Direct per-op timing (the real signal).** Timing operations directly (not via RAF): a forced full re-render (`advanceTicks(0)` → `syncFromBridge(true)`) cost ~3.64ms; a sim step + render ~14ms. Instrumenting the scene's `update()` split: render ~2.8ms EVERY frame; sim step 0–20ms only on the ~6 ticks/sec that actually advance.

## Root cause

The render redraws the entire terrain layer — ~2160 isometric-diamond fills (per-cell brightness jitter + kind-to-kind edge feather) — on EVERY frame, even though terrain is a deterministic pure function of cell kind + coordinates and never changes after load. Fog-of-war is a SEPARATE, already-memoized layer, and the Phaser camera transform pans/zooms a drawn layer for free. So the per-frame terrain redraw was pure waste and the dominant per-frame render cost.

## Fix

`src/phaser/scenes/gameScene/sceneRenderer.ts`: stop clearing/redrawing `terrainLayer` per frame. A `createTerrainCache()` controller (new `terrainCache.ts`) holds the last-drawn signature; `renderTerrainIfChanged` calls `terrainCache.renderIfChanged`, which repaints the layer only when `computeTerrainSignature` (a cheap integer checksum of each terrain cell's count + position + tint) changes — the initial draw, or after a bridge swap where `resetForBridgeSwap` calls `terrainCache.reset()`. The per-frame `drawOrder` now filters out terrain (it lives on its own cached layer below the entity layer, so it plays no part in the entity depth sort). Non-terrain entities (units, buildings, resources, fog, health bars, selection) still redraw every frame as before. Extracting the gate state into the controller (rather than a closure variable) makes the skip/redraw/reset contract unit-testable independent of Phaser.

## Verification (measurable before/after)

- Forced full re-render: **~3.64ms → ~0.60ms (≈6×)** — the terrain redraw was ~83% of per-frame render cost. Render runs every frame, so this is ~3ms/frame of main-thread budget returned.
- Visual: default-view screenshot identical to before (grass/dirt/water/trees/gold/stone + edge feathering all intact); a minimap pan confirms the cached terrain layer moves correctly with the camera and unexplored areas stay under fog.
- `tests/phaser/terrainCache.test.ts` (11): `computeTerrainSignature` stable for identical terrain, unaffected by non-terrain (unit) churn, flips on re-tint / cell move / count change, empty-stable; and the `createTerrainCache` gate — draws on first frame, skips on unchanged, no redraw on unit churn, redraws on re-tint, redraws again after `reset()`.
- Four gates green.

## Notes / follow-ups

- The sim is within budget; no sim optimization shipped. If future profiling wants the next lever, `prototypeVillagerEconomy` is the dominant system but is not a problem today.
- Headless RAF throttling means real FPS can't be measured in CI; direct per-op timing is the reliable browser perf signal here. Recorded so the next perf pass doesn't chase the RAF red herring again.
