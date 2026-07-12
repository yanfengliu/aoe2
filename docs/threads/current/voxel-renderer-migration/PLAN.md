# Isometric voxel renderer migration — implementation plan

Status: opt-in vertical slice implemented and locally gate-complete as of 2026-07-12. External CLI review and remote publication remain approval-blocked; the default-promotion backlog remains active. This file is the cross-session execution ledger. Mark an item complete only when its named test or artifact exists. Keep implementation discoveries and changed assumptions synchronized with `DESIGN.md`, the canonical architecture docs, the game spec, changelog, and devlog.

## Preflight

- [x] Read root instructions, devlog summary, and architecture.
- [x] Fetch and verify `main` is clean and `0/0` with `origin/main` before any AoE edit (`23f99b7`).
- [x] Capture the current 800x600 default-view baseline at `output/playwright/voxel-migration/before.png`.
- [x] Record the cross-game architecture and package plan in the sibling `voxel` repository.

## Increment 1: projection contract and tests

- [x] Add tests proving terrain elevation enters the projected view (`tests/simulation/projectedElevation.test.ts`).
- [x] Add tests proving fog-memory views retain their stored generation (`tests/simulation/fogMemory.test.ts`).
- [x] Add renderer-mode parsing tests for absent, `voxel`, `phaser`, and invalid values (`tests/app/rendererMode.test.ts`).
- [x] Add pure camera-sync tests comparing the Phaser viewport centre/zoom with the Three ground plane (`tests/rendering/aoeCameraSync.test.ts`).
- [x] Implement only the additive projection and mode seams needed to turn those tests green.

Gate: targeted Vitest files, typecheck, and a reviewed diff. Simulation results and save schema remain unchanged.

## Increment 2: shared package dependency and AoE adapter

- [x] Add exact Three `0.185.1`, matching types `0.185.0`, and `voxel: file:../voxel`; refresh the lockfile and configure Vite `resolve.dedupe: ['three']`.
- [x] Run runtime-only and full npm audits; block new high/critical findings.
- [x] Add AoE-owned deterministic geometry recipes and adapter output for terrain chunks, geometry resources, and instance batches.
- [x] Use `id:generation` stable instance keys and a renderer-owned epoch/revision counter.
- [x] Test copied data, lane separation, add/update/remove/recycle identity, bridge-epoch reset, and absence of AoE semantic fields in reusable payloads.

Gate: adapter tests plus the sibling package's full `verify`; `npm ls three` shows one runtime Three identity.

## Increment 3: composed renderer lifecycle

- [x] Add the Three canvas with deterministic CSS stacking and pointer behavior.
- [x] In voxel mode make Phaser transparent and hide only its terrain/entity/legacy-occlusion layers.
- [x] Construct the AoE voxel world renderer during `GameScene.create()`; apply snapshots from displayed/interpolated state.
- [x] Synchronize viewport and orthographic camera after Phaser camera movement each frame.
- [x] Reset the renderer epoch during `setBridge()` and force a full snapshot.
- [x] Dispose the runtime and remove its canvas on scene shutdown; test idempotence.
- [x] Add a composite-canvas capture path that performs explicit Three readback without `preserveDrawingBuffer`.
- [x] Expose renderer kind and data-only metrics through the browser API.

Gate: targeted browser smoke proves two canvases compose into one visible game, input remains on Phaser, capture is nonblank, and teardown returns metrics to zero.

## Increment 4: playable visual coverage

- [x] Render every projected terrain kind through voxel chunks.
- [x] Render every visible non-terrain entity through deterministic fallback recipes.
- [x] Give units two-part body/head geometry and multi-cell buildings inset wall/roof volumes.
- [x] Preserve construction and memory visual distinctions.
- [ ] Verify fog, selection, placement, health, minimap, pan/zoom, commands, save/load, and replay under `?renderer=voxel`.
- [x] Capture controlled `before.png`/`after.png`, generate `diff.png`, and record the 343,580/480,000 (71.58%) changed-pixel result after waiting for the DOM minimap canvas to paint.

Gate status: `tests/browser/voxel-renderer.spec.ts` passes its five focused checks at the controlled viewport, including composition, epoch reset, replay pixel change, context restoration, and safe Phaser default. The full voxel-specific interaction matrix above remains open.

## Increment 5: promotion, review, and delivery

- [x] Run final post-documentation `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` in AoE2.
- [x] Run the focused voxel browser specification.
- [x] Run the complete applicable browser suite after restoring Phaser as the safe default.
- [x] Run the sibling `voxel` package's complete `verify` and both npm audits in both repositories.
- [x] Run in-process adversarial review grounded in the live diff and record iteration 1.
- [ ] Run final multi-CLI review because the change adds a local package and graphics dependency surface.
- [x] Fix every substantive in-process finding and re-review the final local behavior.
- [x] Update `design/spec-final.md`, README, architecture, decisions, drift log, detailed devlog, summary, and the durable thread artifacts.
- [x] Update changelog/version for v0.1.147.
- [x] Leave Phaser as the default and record the exact unmet promotion gates in `DESIGN.md`.
- [x] Commit the coherent AoE2 increment directly to `main` after the final diff/secret/content checks (`a22fe8d`).
- [x] Push the committed engine revision first so the pinned CI source exists remotely (`voxel` `7fbae42`).
- [x] Push the AoE2 commits to `origin/main` after recording the external-review outcome.

External-review blocker: the user explicitly approved private-diff review on 2026-07-12, but the platform safety reviewer still denied the Codex and AoE2 Claude exports before invocation. The voxel Claude Fable invocation returned only its quota-limit message. No external reviewer inspected code, no external approval is claimed, and the prohibited export was not rerouted through another model. Publication was separately approved and completed in engine-first order.

## Deferred backlog

- Standalone Three renderer host and Phaser removal.
- Elevation-aware voxel presentation, pointer projection, fog/health/selection placement, and raised-building hit geometry.
- Elimination of hidden legacy draw work in the composed path.
- Three-native fog/selection/placement/health/death/debug passes.
- Depth-aware unit x-ray/outline treatment.
- General animated crowds and richer per-civilization assets.
- Worker/WASM/greedy meshing after the Voxelize and `block-mesh-rs` bake-off.
- City embedded-batch proof and Townscaper geometry-resource proof.
