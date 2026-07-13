# Speed-matched voxel gait — adversarial review

Date: 2026-07-12

Scope: AoE2 v0.1.150 displayed-distance locomotion, replay/manual pause clocks, direction-aligned rigid poses, bounded batch packing, browser evidence, and the unchanged reusable-engine boundary

Verdict: approved locally; all substantive findings are closed and the complete gates are green

## Findings and dispositions

- **Wall-time and selection-dependent resume:** the first sampler divided displayed distance by Phaser wall time. A long pause therefore collapsed resume speed for an unselected scene while selection-forced redraws refreshed history. The final path injects `(tick + interpolationAlpha) * 1000 / TPS`, and repeated identical samples reuse the complete prior state.
- **Replay pause rewound presentation:** final review found `ReplayController.pause()` reset a nonzero interpolation alpha, making gait jump back within its tick. Fresh playback and resumed playback now have distinct clock states: pause preserves accumulator/alpha, the first resumed frame consumes zero delta, and genuinely fresh playback retains its established immediate first tick. A real-bridge regression freezes alpha at 0.5 and proves the next 50 ms completes the tick.
- **Travel-plane mismatch and corner snaps:** fixed-axis pitch bent limbs sideways for some headings, while direction changed instantly at axis-aligned path corners. The final matrix applies heading-conjugated pitch, headings take the shortest eased turn, and X, Z, and diagonal transformed-corner tests prove feet and horse legs remain above ground.
- **Static scenery inherited active-batch limits:** one animated unit previously made an entire matte or metal batch active, lowering large static populations to the engine's 16,384-total-slot ceiling. Six stable lanes now separate static and animated matte/metal parts from shadow and memory geometry. A 16,385-static-plus-one-active regression proves static capacity remains independent.
- **Animation-budget admission was under-specified:** enabled parts are grouped by canonical identity and admitted all-or-none up to 8,192 active slots. Reversed input produces identical packing, and a two-part identity at a one-slot cutoff remains wholly visible in the static lane.
- **Unsupported animated surfaces could disappear:** future shadow or memory parts with accidental animation no longer enter an unsupported active lane; they remain visible in their static lane with animation stripped. Both surfaces have a focused regression.
- **Browser proof observed too little state:** the final test reads a copied, data-only gait diagnostic, advances exact simulation time, checks root/phase/speed/weight, proves complete equality across a wall-time pause plus forced sync, waits for accepted/presented parity, and then proves the next simulation advance resumes phase. No Three object or mutation seam is exposed.
- **Stale ambient-count expectations:** distance-baked locomotion intentionally removes harmonic animation from gait limbs, leaving 26 independent ambient-active parts in the controlled scene. Two old `>30` checks were corrected to a still-nontrivial `>20`; the full seven-test voxel browser specification then passed.

The locomotion reviewer, AoE voxel reviewer, and shared-engine boundary reviewer each re-read the final live code after their findings were fixed. Final verdicts report no substantive correctness, determinism, lifecycle, direction, ground-clearance, batch-capacity, replay-clock, browser-evidence, file-size, public-contract, or cross-game ownership defect.

## Visual evidence

`docs/devlog/2026-07-12-voxel-gait-{before,after,diff}.png` uses seed `aoe2-prototype`, an exact paused command sequence, viewport 800x600, world capture 800x480, and DPR 1. The observed unit moves from phase 0.2724 at root `(6.575,8)` to phase 2.4144 at `(7.325,8)` and 5 world units/s. A 150 ms wall wait plus forced sync leaves its entire gait sample unchanged; the next explicit simulation advance reaches phase 3.1599. Both evidence frames have accepted/presented parity, 12 chunks, five materials, one geometry resource, six batches, 1,000 instances, two animated batches, 26 ambient-active instances, ten draw calls, 16,632 triangles, five renderer geometries, and one texture. Pixelmatch changes 534/384,000 pixels (0.14%), localized to visible units.

## Final gates

- Shared engine: unchanged code/schema; `npm run verify` passes 80/80 tests, typecheck, zero-warning lint, and build. Documentation diff/fence/link/path/whitespace checks pass.
- Focused AoE behavior/architecture: 55/55, including gait, matrices, resources, adapter lifecycle, replay interpolation, browser host, and the 500-line gate.
- AoE unit gate: 253 files and 2,084 tests passed; one file/two integration tests intentionally skipped.
- AoE typecheck and zero-error lint passed; production build transformed 456 modules.
- Focused Chromium: all seven voxel-renderer tests passed; the speed-matched pause test also passed 5/5 repeated runs.
- Complete Playwright: the first 104-test run passed 100 and skipped two but exposed two stale ambient-count assertions. After correction, the complete production rerun passed 102 tests with the same two intentional visual-baseline skips.

No dependency declaration, third-party version, shared-engine source, shader, texture, model, or imported asset changed, so dependency audits and the AoE engine pin were not changed or retriggered.
