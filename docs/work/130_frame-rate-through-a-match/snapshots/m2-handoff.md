# Work 130 M2 B handoff — 2026-10-17

Review target is the complete `frame-rate` M1 branch at `6ff29963` plus this staged overlay. Integration owner retains final gate, independent integrated review, version/changelog/devlog changes, merge, push and worktree retirement. No worker code commit, sibling source change or dependency change was made.

## Implementation and checks

- `aoeVoxelSnapshotDelta.ts` uses the exact CI pin's public delta API, omits unchanged objects and patches sparse stable-order batches. Changed key order/count/layout, changed translucent bounds and animation envelopes use full batches. New epoch/descriptor or a refused/resync delta uses a full snapshot. The full snapshot remains the renderer's rollback source.
- `aoeVoxelTranslucentBounds.ts` prevents conservative sparse bounds changing transparency sorting. Its real-presenter test failed before the guard and passes after it.
- `aoeVoxelSnapshotDelta.test.ts` and `AoeVoxelWorldRendererDelta.test.ts`: 10 passing cases through the actual public reducer/runtime, including interpolated real play, byte/order equivalence, actual presenter writes and bounds, fog, terrain, animation, removal/rebirth, style changes, resync and bridge rollback. They also pass against a compiled archive of exact voxel pin `08398b573ad54bcb5c764ad0c2ef3cedc3cce33f` (1.2.0), independently of the linked newer sibling HEAD.
- Recovered M1 rendering subset: 20/20 passing. Game `tsc --noEmit`, scoped ESLint, final Vite build and the two browser count/DOM gates pass. The stronger browser count gate fails with the full-snapshot path restored: 0.57898 against 0.25. Full `npm run verify` and integrated review have not run in this worker checkout.
- Exact archived-pin compilation needed archive-only `--skipLibCheck` for an unrelated installed Vite/Rollup declaration conflict. The game's ordinary typecheck passes without it. No pin was bumped.
- Late-state Node counter A/B: 2,018 to 302 matrix writes per frame; guarded repeat retains the gain. Original player GPU viewport now holds 60 fps late. Software viewport acceptance remains open as the plan states; do not report work 130 complete on the B counter evidence alone.

## Pixel evidence

Maintained `captureMapScreenshot.mjs` and `diffMapScreenshots.mjs`, exact M1 before build versus final guarded B, 1280×800, opening tick 1/zoom 1.2 and saved tick 11,700 plus one tick/zoom 2.4. All eight before/after pairs differ by zero pixels. Each after image was inspected at native resolution; the final guard leaves the inspected bytes identical. Evidence remains ignored at `tmp/captures/work130-m2/`; each name below has prefix `work130-m2-` and suffix `-after.png`. No PNG belongs in ordinary Git.

| Rasteriser/style/state | PNG bytes | Inspected SHA-256 |
| --- | ---: | --- |
| gpu-de-opening | 470406 | 84afddf6ae7b4568ccd4dc4c5e0361e8b25245e864ab185c27c22941357bdb74 |
| gpu-de-late | 722181 | 562160075ddd055081cd94b6e79eae618bdbb8a1dd6db2ddf92fffbc4faf069b |
| gpu-moebius-opening | 184163 | 45e4ecfbbdbd487e0ca2d43e0d59c3dfccf7376ec4174d8d7c5d85a5799dbb8f |
| gpu-moebius-late | 271432 | 5306b884ce7b3a2e15788b59e1d483853bf46d28a978cdc81a9d1d21e3ef35a3 |
| swiftshader-de-opening | 449301 | 2fb0077856910340aaa85c62edcf1abcd4a5d9c73904a2a3d991bbb648bb1519 |
| swiftshader-de-late | 705086 | f9aed69c1ba0ff9a9e5d8910bbee0669300cf8befa8b26de550bb4d59b14bb81 |
| swiftshader-moebius-opening | 184544 | 67d14149f574bc9986c5626079330c4adab08542c0448d4e18708f7f7235663f |
| swiftshader-moebius-late | 270120 | 34cb3211eec2c989d3d5896c9caa5f2e7a8497ee70543f4d91118ff9e11d8e1b |

Raw measurements and capture logs remain ignored at `tmp/frame-rate/m2/`. The M1 baseline bundle is retained there as `baseline-dist`, index SHA-256 `40783fbb28e962a4bbe0e88fa8d2c17ca8454a492770149ac756ec9a77211b34`. They are needed until integrated acceptance and should then be cleaned along with the worktree using the controller.

## Integration notes

Update the defect-register's work-130 paragraph: still shadows no longer need full rewrites when their order and bounds remain unchanged; the software frame-rate target stays open. Append the public-delta/transparent-bounds decision after the historical M1 decision, update the architecture module list, add the final shipped devlog/version/changelog lines, and preserve the explicit remaining acceptance criterion in this plan. Existing M1 screenshots establish its tiny opaque-depth-tie differences; B adds zero pixels in the eight final pairs above.

Both browser drivers close browsers in `finally`, and their wrappers stop only owned child trees. Final preview PIDs 57200/50964, prior comparison PIDs 31936/47608 and ports 4760/4761 are gone; a WMI audit found no owned runner or preview process. No server is intentionally retained.
