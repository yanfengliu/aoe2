# Animated voxel units — adversarial review

Date: 2026-07-12

Scope: sibling `voxel` v0.1.2 rigid-instance playback plus AoE2 v0.1.149 unit profiles, browser evidence, and lifecycle integration

Verdict: approved locally; all substantive findings closed and complete gates green

## Findings and dispositions

- **Lossy matrix decomposition and unsafe Float32 output:** the first presenter decomposed and recomposed every base transform, corrupting zero scale/shear and risking overflow. The final sampler post-multiplies local rotation/scale over an affine base, adds world translation, rejects perspective matrices and unsafe linear headroom, and has explicit regressions.
- **Unbounded dynamic workload and whole-batch bounds scans:** the final contract caps one snapshot at 8,192 active slots and an active batch at 16,384 total slots. Conservative affine-safe bounds are computed once per accepted batch version, so frame sampling touches animated slots only while frustum culling and raycast broad phase remain valid.
- **Stale static GPU matrices after reconciliation:** a full-upload-pending state now survives the first animated frame after initial/replacement writes. Later animation-only frames use partial updates; tests change an unanimated slot in a reused mesh and prove the full upload range is preserved.
- **Excessive sparse GPU commands:** contiguous ranges are coalesced and merged to at most 64 upload ranges per active batch and frame.
- **Incomplete browser stability claim:** the paused-simulation browser test now compares material, geometry, chunk, visible-chunk, batch, animated-batch, instance, renderer-geometry, renderer-texture, draw-call, accepted revision, presented revision, and epoch values across phases.
- **Movement-history lifecycle:** a direct adapter regression proves new `id:generation` identities and bridge resets begin from idle history. Fog memory and contact shadows remain static.

Both reviewers re-read live code after fixes. The final engine review found no substantive correctness, performance-boundary, upload, bounds, context-loss, replacement, or disposal defect. The AoE review approved ownership, phase stability, canonical packing, role profiles, memory/static exclusions, lifecycle reset, browser evidence, and all changed source files under 500 lines.

## Visual evidence

`docs/devlog/2026-07-12-voxel-animation-{phase-a,phase-b,diff}.png` uses seed `aoe2-prototype`, paused tick 0, camera scroll `(-400,80)`, zoom 1.4, viewport 800x600, game size 800x480, and DPR 1. Accepted/presented revision remains 2. Both frames report 12 chunks, five materials, one geometry resource, four batches, 1,000 instances, two animated batches, 54 animated instances, eight draw calls, 16,632 triangles, five renderer geometries, and one texture. Matrix updates increase from 1,026 to 2,376; pixelmatch changes 300/480,000 pixels (0.0625%), localized to visible units.

## Final gates

- Shared engine: `npm run verify` — 80/80 tests, typecheck, zero-warning lint, build.
- Shared package: `npm pack --dry-run` — `voxel@0.1.2`, 87 files.
- AoE unit gate: 251 files passed and one skipped; 2,071 tests passed and two skipped.
- AoE typecheck and zero-warning lint passed.
- AoE production build transformed 456 modules.
- AoE Playwright: 101 passed and two intentional visual-baseline tests skipped; all six voxel-renderer tests passed.

No dependency declaration, third-party version, or third-party source changed, so dependency audits were not retriggered. Engine `f85f10e961896de26e2be4fd0f1985b89a291929` was published first; AoE pins that exact source and publishes v0.1.149 second.
