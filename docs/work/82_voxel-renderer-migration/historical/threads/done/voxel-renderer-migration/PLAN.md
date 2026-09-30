# Isometric voxel renderer migration — implementation plan

Status: closed and archived after Increment 9's standalone voxel-only runtime was implemented and verified on 2026-07-13. The previous opt-in composed slice and its later visual/animation increments are preserved below as history. This file is the cross-session execution ledger. Mark an item complete only when its named test or artifact exists. Keep implementation discoveries and changed assumptions synchronized with `DESIGN.md`, the canonical architecture docs, the game spec, changelog, and devlog.

## Increment 9: mandatory voxel-only graphics

- [x] Re-audit bootstrap, scene lifecycle, renderer selection, hidden painters, overlays, capture, browser API, tests, and package/build surfaces against the live code.
- [x] Capture the current composed `?renderer=voxel` browser baseline before edits.
- [x] Decide the migration boundary: Three/`voxel` owns every world and world-overlay pixel; DOM HUD/minimap remain UI; a standalone AoE host owns input/camera/frame orchestration.
- [x] Add red tests proving default and legacy renderer queries produce mandatory voxel presentation with no fallback state.
- [x] Add an architectural test proving production code imports no deleted painters and retains no Phaser source, dependency, lock entry, or Vite chunk policy; audit the generated bundle separately in the build gate.
- [x] Extract renderer-neutral projection, interpolation, role, hit-test, camera/input view-state, and selection helpers from `src/phaser`.
- [x] Replace `createGameSceneRenderer` with a renderer-neutral AoE voxel presentation coordinator driven by displayed state and injected simulation-display time.
- [x] Emit critical fog, selection, placement, health, hit/death feedback, and selection-preview visuals as AoE-owned voxel parts or terrain data; retain AoE semantics outside the reusable engine.
- [x] Make voxel construction mandatory and failure terminal; remove renderer parsing, graphics fallback, hidden legacy drawing, nullable renderer/capture states, and composite Canvas2D capture.
- [x] Delete the complete Phaser runtime/painter tree and obsolete painter tests; replace it with `AoeVoxelGameView` and renderer-neutral controllers.
- [x] Update Playwright boot/canvas helpers and replace hidden-painter assertions with voxel diagnostics and visible-output evidence.
- [x] Restore visible interaction parity with recipe-derived raised-entity hit regions, a four-segment voxel drag marquee, authored-part health-bar clearance, and paused selection invalidation.
- [x] Make startup transactional and visibly fatal, keep annotation markers on capture failure, and replace the 50 ms simulation-time discard with bounded visible catch-up plus hidden-tab clock reset.
- [x] Record fixed-camera after/diff evidence for the one-canvas output and measure draw calls, triangles, instances, resources, rebuilds, and teardown stability.
- [x] Run focused tests, AoE's four mandatory gates, applicable browser tests, sibling engine `verify`, both dependency audits, adversarial live-code review, and verifier re-review. Final: AoE 1,905 unit tests plus two skips, 104 browser tests plus two intentional skips, typecheck, lint, and 442-module build; engine 80/80 plus typecheck, lint, and build; zero audit findings.
- [x] Update spec, README, architecture, decisions, drift log, changelog/version, detailed/summary devlogs, review artifact, and this ledger; prepare the coherent local migration commit without pushing absent fresh publication approval.

Exit gate: every playable world pixel and world feedback pixel comes from the voxel/Three scene; no runtime or query can activate Phaser graphics; hidden legacy work and misleading painter diagnostics are gone; commands, camera, fog comprehension, selection, placement, health, save/load, replay, capture, context recovery, and teardown remain proven.

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
- [x] Verify fog, selection, placement, health, minimap, pan/zoom, commands, save/load, and replay under `?renderer=voxel`; Increment 9 later repeated and superseded this matrix on the mandatory one-canvas path.
- [x] Capture controlled `before.png`/`after.png`, generate `diff.png`, and record the 343,580/480,000 (71.58%) changed-pixel result after waiting for the DOM minimap canvas to paint.

Historical gate status: `tests/browser/voxel-renderer.spec.ts` passed its five focused checks at the controlled viewport, including composition, epoch reset, replay pixel change, context restoration, and safe Phaser default. The interaction matrix was subsequently closed by Increment 9 on the mandatory standalone path.

## Increment 5: promotion, review, and delivery

- [x] Run final post-documentation `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` in AoE2.
- [x] Run the focused voxel browser specification.
- [x] Run the complete applicable browser suite after restoring Phaser as the safe default.
- [x] Run the sibling `voxel` package's complete `verify` and both npm audits in both repositories.
- [x] Run in-process adversarial review grounded in the live diff and record iteration 1.
- [ ] Historical non-blocking external gate: run final multi-CLI review because the change adds a local package and graphics dependency surface. Invocation was denied before review, as recorded below; in-process adversarial review and publication completed without claiming external approval.
- [x] Fix every substantive in-process finding and re-review the final local behavior.
- [x] Update `design/spec-final.md`, README, architecture, decisions, drift log, detailed devlog, summary, and the durable thread artifacts.
- [x] Update changelog/version for v0.1.147.
- [x] Leave Phaser as the default and record the exact unmet promotion gates in `DESIGN.md`.
- [x] Commit the coherent AoE2 increment directly to `main` after the final diff/secret/content checks (`a22fe8d`).
- [x] Push the committed engine revision first so the pinned CI source exists remotely (`voxel` `7fbae42`).
- [x] Push the AoE2 commits to `origin/main` after recording the external-review outcome.
- [ ] Historical non-blocking infrastructure follow-up: restore GitHub Actions billing/spending availability and rerun CI plus `playtest-corpus`; runs `29208222795` and `29208222802` were rejected before their first step. This external account state is not an open renderer-migration implementation gate.

External-review blocker: the user explicitly approved private-diff review on 2026-07-12, but the platform safety reviewer still denied the Codex and AoE2 Claude exports before invocation. The voxel Claude Fable invocation returned only its quota-limit message. No external reviewer inspected code, no external approval is claimed, and the prohibited export was not rerouted through another model. Publication was separately approved and completed in engine-first order.

## Increment 6: voxel visual quality

- [x] Capture the true `?renderer=voxel` baseline at `output/playwright/voxel-visual-quality/before.png` and verify the URL/mode.
- [x] Audit the live AoE recipes and reusable Three runtime; keep AoE semantics local and select only a target-tracked daylight rig for the shared package.
- [x] Add red tests for representative building, unit, resource, terrain-detail, material-batch, and daylight contracts.
- [x] Split the 489-line adapter into focused recipe/resource/terrain modules before increasing vocabulary.
- [x] Implement detailed original procedural recipes, neutral material palettes with faction accents, sparse deterministic terrain detail, memory/construction treatment, contact shadows, and antialiased presentation.
- [x] Capture a fixed-view after image and pixel diff, inspect both at full resolution, and record changed-pixel plus renderer-budget evidence. The accepted `docs/devlog/2026-07-12-voxel-visual-quality-{before,after,diff}.png` set uses seed `aoe2-prototype`, tick 0, camera `(-400,80)`, zoom `1.4`, 800x600 viewport, 800x480 game size, and DPR 1. Pixelmatch changed 71,616/480,000 pixels (14.92%).
- [x] Run focused tests while iterating, then the voxel package `verify`, AoE's four mandatory gates, focused and complete browser gates, dependency audits if the dependency surface changes, and adversarial live-code review. The final browser matrix passed 100 tests with two intentional visual-baseline skips after replacing one RAF-timing-dependent interpolation probe with a deterministic half-tick probe and giving the two multi-thousand-tick age-up scenarios a 60-second wall-clock budget.
- [x] Update the game spec, architecture/drift records, changelog/version, detailed devlog, summary, review artifact, and this ledger; prepare the coherent local AoE change after the engine commit in dependency order.
- [x] Commit the reusable engine increment locally as `dd9b811d0dd3a5912cbc4626cc1b7ade94895e74`.
- [x] Commit the coherent AoE v0.1.148 increment locally after final staged content and secret review.
- [x] After explicit approval, push engine commit `dd9b811d0dd3a5912cbc4626cc1b7ade94895e74` first, then push AoE v0.1.148 commit `5a42649` whose CI pin names that exact engine revision.

Exit gate: the controlled seed has recognisable AoE-style voxel architecture, units, resources, and terrain detail with bounded draw calls/resources, deterministic snapshots, aligned overlays/input, stable lifecycle behavior, and reviewed before/after/diff evidence. Phaser remains the safe default until the separate promotion gates pass.

## Increment 7: animated voxel units

- [x] Decide the ownership boundary: reusable bounded harmonic rigid-instance playback belongs in `voxel`; AoE owns roles, part names, gait profiles, memory policy, and future gameplay clip semantics.
- [x] Add red engine tests for copied/validated animation arrays, deterministic injected-time sampling, static-slot stability, replacement, conservative bounds, full-versus-partial GPU uploads, context-loss fencing, metrics, and disposal.
- [x] Add red AoE tests for deterministic identity phase, memory exclusion, idle bob, opposing humanoid gait, cavalry gait, monk motion, siege motion, generation replacement, and bridge reset without animating buildings/resources/shadows.
- [x] Implement the reusable optional instance-animation lane without per-frame snapshots or Three/DOM imports in portable core; bound it to 8,192 active slots, 16,384 total slots per active batch, and 64 upload ranges.
- [x] Implement `aoeVoxelUnitAnimation.ts`, attach motion profiles to existing rigid parts, and keep the adapter orchestration-only and every source file below 500 lines.
- [x] Add browser evidence that two world captures at one paused simulation revision differ because animation continues, while draw calls, instances, resources, accepted revision, and presented revision remain bounded/stable.
- [x] Capture and inspect fixed-camera before/after/diff evidence; record animated instance/update counts and named viewport/DPR/time separation.
- [x] Update spec, README, architecture/decisions/drift, changelog/version, devlogs, shared-engine docs, review artifact, and this ledger.
- [x] Run focused tests, engine `verify`, AoE's four gates, focused and complete browser suites, then adversarial live-code review and re-review. Final: engine 80/80 plus typecheck/lint/build and package dry-run; AoE 2,071 unit tests plus two skips, typecheck, zero-warning lint, 456-module build, and 101 browser tests plus two intentional visual-baseline skips.
- [x] Commit and publish engine-first (`voxel` `f85f10e961896de26e2be4fd0f1985b89a291929`), update AoE's exact pin, then commit and publish AoE v0.1.149 second.

Exit gate: live non-memory voxel units visibly breathe or move their rigid limbs/tools/mounts/machines under the renderer clock even when no new world snapshot is accepted; static world geometry and gameplay state remain unchanged. General skeletal animation, attack/gather clip events, projectiles, and imported character assets remain later increments.

## Increment 8: smooth speed-matched locomotion

- [x] Trace the displayed interpolation path and record why gait speed/stride/feet stay AoE-owned while `voxel` remains a history-free harmonic sampler.
- [x] Add red tests for injected sample time, faster-speed cadence, split-distance phase invariance, opposing feet, foot clearance, deterministic histories, and generation/disappearance/bridge/clock-rewind reset.
- [x] Replace binary movement classification with bounded per-identity gait history driven by displayed distance and injected simulation-display time.
- [x] Bake role-scaled distance phase, eased direction, direction-aligned grounded foot/limb pose, wheel rotation, and short start/stop amplitude ramps into AoE part transforms without changing authoritative root position, saves, replay, hit geometry, shadows, or the reusable animation schema.
- [x] Split static/animated instance lanes at the engine's active limits; add a focused browser gait diagnostic plus fixed-camera before/after/diff evidence and record renderer/simulation metrics.
- [x] Run focused tests, AoE's four mandatory gates, the applicable browser suite, and the unchanged sibling engine `verify`.
- [x] Complete grounded adversarial review, update durable architecture/changelog/devlog records, bump the user-visible AoE version, then commit and push `main`.

Exit gate: a live displayed unit's root remains smoothly interpolated, its foot cadence increases with displayed speed, its feet visibly lift and oppose one another, and speed transitions preserve phase without changing gameplay authority or the reusable engine schema.

## Deferred backlog

- Raised terrain/cliffs plus a game-neutral presented-state voxel/heightfield ray query; the current AoE recipe proxy covers raised entity silhouettes only.
- Depth-aware unit x-ray/outline treatment.
- General skeletal crowds, attack/gather event clips, imported character assets, and richer per-civilization art.
- Worker/WASM/greedy meshing after the Voxelize and `block-mesh-rs` bake-off.
- City embedded-batch proof and Townscaper geometry-resource proof.
- Static terrain/building/resource deltas versus dynamic unit/interaction deltas; the current whole-snapshot adapter still revalidates and republishes interpolated state each display frame.
