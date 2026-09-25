# Debugging session — the Natural ground's cost on SwiftShader

## Symptom
With Natural the default (v0.3.233, `78071b77`), main's CI (run 36077810827) failed two browser shards on the first attempt, both on frame timing: `game-hud-and-camera-camera.spec.ts:323` timed out polling the minimap after a drag, and `selection-panel-height.spec.ts:233` hit its 30 s test timeout waiting for two animation frames at 1920x1080. Every browser shard ran 50-60% longer than on the run before (17.7, 15.9, 12.5 and 16.5 minutes against 11.7, 10.0, 8.0 and 11.0 on run 36073613836), and `unit-motion-smoothness.spec.ts` logged a live animation-frame median of 233.3 ms against 116.6 ms. v0.3.234 put Moebius back as the default; its run (36085203873) was green with shards of 11.9, 11.2, 8.2 and 8.8 minutes.

## Expected vs actual
- Expected: the Natural ground costs no more on SwiftShader than the voxel ground it replaces (the lane measured it cheaper).
- Actual: about 1.7 times Moebius's frame on four CPUs locally, and twice on CI.

## Reproduction
- Instrument named first: none of the engine's tools applies. The question is how long SwiftShader takes to draw a frame of a live page; `replay:inspect`, `diffBundles` and `snapshotAtTick` read world state, and the world is the same in both styles. The suite's own report (`unit-motion-smoothness.spec.ts`, `[motion] live rAF` in each CI shard's log) is the CI-side measure, once per shard and with the sim moving, so it cannot A/B two shaders on one page.
- The probe that answers it locally (scratch, `tmp/probes/frameFinish.mjs` in the worktree, copied to `tmp/de-terrain-evidence/cost/`): a paused `aoe2-prototype` boot at 800x600 on `--use-angle=swiftshader`, and for each of 30 frames the time from the animation frame's start to a one-pixel `gl.readPixels` returning in a callback that runs after the game's own; the lower quartile is the figure. The browser runs under `cpuMask.ps1`, which re-applies an affinity of four CPUs to every process under it every 250 ms (Chrome starts its GPU process, where SwiftShader draws, on every CPU whatever its parent's mask). Arms are interleaved and each is a fresh browser. Repeats agreed within about 5% when the machine was quiet.
- Instruments that misled first, and why: the median interval between animation frames (the GPU process pipelines frames, so most callbacks return in about a millisecond whatever a frame costs; that produced the withdrawn 0.8-0.9 ms GPU figure); frames in five seconds on all 32 threads (fragment work spreads thin there, so the ground's cost hides; locally unmasked Natural was only 1.13 times Moebius); `gl.finish()` as the sync point (it returned in 1-8 ms, so Chrome does not wait for SwiftShader); the GPU process's CPU time (SwiftShader's idle workers spin, and the spin dominates).

## Hypotheses
- [x] The step-1 style, not the ground, is the cost. Ruled out: the style before its ground (control build `eda31608`) drew in 53-66 ms against Moebius's 71-83 on the same runs, so it was the cheaper of the two.
- [x] Branches save the work they skip. Ruled out on SwiftShader, which runs every block of a shader under lane masks for all four fragments of a quad (its `SpirvShaderControlFlow.cpp`), and skips only a loop that none of the four enters. Confirmed by a variant with the whole ground inside a loop no fragment enters: close to a ground of one constant colour.
- [x] Nine cell fetches and the arrays they fill are the cost. Partly: an array-free single pass cost the same as the shipped shader; decoding the 3x3 from one 16-bit texel instead of nine fetches cost the same too, because the decode's arithmetic is itself about 20-26 ms of the frame.
- [x] Most known fragments could skip the blend. Ruled out on this map: `aoe2-prototype`'s terrain is a grass-and-hill patchwork over most of the known ground, so about four fifths of known fragments have another surface among their four nearest cells (painted magenta in `tmp/de-terrain-evidence/cost/blend-region-*.png`).

## Investigation log
- 2026-09-24 evening — measured, lower quartile of 30 frames, 800x600, four CPUs, ms (two or three repeats each):

| Arm | ms |
| --- | --- |
| Moebius (voxel ground) | 68.0-72.7 |
| Natural as shipped | 117.8-121.3 |
| Natural, ground a constant colour | 50.1-55.5 |
| Natural, own cell and one surface sample per fragment, no neighbours | 67.3-77.2 |
| as shipped, no surface samples | 89.4-101.2 |
| as shipped, no macro or fog samples | 116.0-123.9 |
| one 16-bit neighbourhood fetch, loop-guarded blend | 120.8-137.6 |
| the same, every fragment blended | 124.5-143.9 |
| the same, 3x3 decoded but one sample everywhere | 103.6-111.4 |

The patch for the neighbourhood variant (packer, texture, shader) is kept at `tmp/de-terrain-evidence/cost/one-fetch-neighbourhood.patch`; its picture matches the shipped shader's (a paused 800x600 boot: 0 pixels changed on SwiftShader, 4 on the GPU).

## Root cause
The shipped ground ran nine cell fetches, six mipmapped surface samples and the whole blend for every ground fragment, unexplored ones included, because SwiftShader runs every branch; and on this map most known ground genuinely needs a blend of two surfaces plus the per-fragment 3x3 arithmetic, which cost as much again as the samples they feed. Only a fragment with nothing but its own surface near is as cheap as Moebius.

## Fix
The coordinator chose the software tier (2026-09-25), and it landed in v0.3.237 (`src/rendering/voxel/aoeDeGroundTier.ts`): a CPU rasteriser, named by the game's own WebGL context, draws one surface sample per pixel, and a GPU keeps the blend, unchanged to the pixel on both rasterisers. Two findings changed what this record measured:
- The one-sample arm below cost about Moebius only by luck of its sampling call. SwiftShader's explicit-gradient read (`textureGrad`, which the blend needs inside its branches) cost 0.18 of Moebius's whole frame more than a read at a mip level worked out from the fragment's own derivatives. A surface read inside a loop that a quad of unexplored fragments never enters also spares unexplored ground its read.
- The `frameFinish.mjs` method counts the compositor's previous frame, the same in both styles, and so pulls every ratio toward 1 (the one-sample tier read 0.92 to 0.98 of Moebius on CI with it). Draining the GPU process's queue before the game's own callback, and timing only that callback, measures the game's frame: 0.85 to 0.87 on CI, 2.12 for the blend. `tests/browser/de-ground-frame-cost.spec.ts` uses that, and it is the gate the lesson named.

What would have made the Natural default cheap enough, with what each costs, as weighed before the choice:
- A software tier. When the renderer is SwiftShader (or another CPU rasteriser), draw each known fragment as its own surface with the fog rules kept (measured at 67-77 ms, about Moebius); a GPU keeps the blend. Costs a second path, and CI would then test a ground a GPU player does not see.
- The suite pins Moebius for specs that are not about the look, and the Natural specs opt in. Keeps CI's time; leaves the Natural gameplay path untested on CI and the software-rendering player's cost unchanged. The decision record of 2026-09-24 argued against it.
- A cheaper exact blend. The best exact structure measured is about 1.5-1.7 times Moebius; parity needs changes to the look, such as the kind weights from a hardware-filtered one-hot texture, the fade from a filtered explored mask instead of box distances, and one mip level per surface sample.
- Accept the cost. CI 50-60% slower and two frame-timed specs to rework; against the constitution's rule on slowness (R22).

## Verification
- None of the variants above shipped; each was built into its own `dist-*` folder of worktree `de-ground-cost` and served on its own port.
- The revert's checks are in its commit (`0e00e74d`).

## Follow-ups
- Closed 2026-09-25: the call among the options above was the software tier (v0.3.237), and the lesson in `docs/learning/lessons.md` left with the SwiftShader frame-cost spec that retires it (`docs/learning/gate-proofs.md`). The spec does not use `frameFinish.mjs`'s method, for the reason under Fix.
