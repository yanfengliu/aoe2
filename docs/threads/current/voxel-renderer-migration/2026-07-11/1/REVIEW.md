# Isometric voxel renderer migration — review iteration 1

Objective: `voxel-renderer-migration` · Started: 2026-07-11 · Iteration: 1

## Scope

In-process adversarial review of the shared voxel V1 package and AoE2's first composed consumer slice. Reviewers inspected live code and focused tests rather than accepting the design document as implementation evidence. The review covered public contract bounds, world/epoch/revision ordering, Three resource replacement, linked dependency identity, capture/context lifecycle, AoE projection and composition, visual evidence, parity claims, CI reproducibility, and cross-game leakage.

## Substantive findings and dispositions

### Fixed — stale GPU resources across a new world at the same local revision

Resource version strings initially contained only resource incarnation/revision. A replay or bridge replacement could start a new renderer epoch at revision one and alias the prior world's `1:1` cache entry, so accepted state changed while old pixels remained. Versions now namespace `worldId` and epoch; presentation acknowledgement requires the explicit full identity and occurs only after render succeeds. The browser replay regression asserts both epoch replacement and changed captured world pixels.

### Fixed — resource dependencies could change without a batch revision

An unchanged instance-batch version could retain a mesh bound to a replaced geometry or material. Reconciliation now checks resolved geometry/material object identity as well as the batch version. Single grouped materials remain an array because Three applies geometry draw groups only to material arrays; group-less geometry intentionally uses the batch's single material.

### Fixed — insufficient hostile-input and work bounds

Validation now rejects detached/shared buffers, positions outside declared bounds, overlapping chunks, chunks outside exact Float32 integer boundaries, dense chunks over the allocation cap, and explicit material groups that overlap, leave gaps, or split primitives. Group count and overlap-comparison budgets prevent metadata-driven quadratic work. The visible-face oracle has explicit chunk/face caps. Three compatibility is preflighted before accepted state mutates.

### Fixed — capture/context proof was too structural

The original capture check could pass on a nonblank Phaser overlay even if the Three layer was absent, and context tests dispatched synthetic DOM events. Browser coverage now decodes composite/world pixels and proves more than 1,000 real Three-contribution pixels with `preserveDrawingBuffer:false`. It destroys/restores the actual WebGL context through `WEBGL_lose_context`, observes lost/restored runtime state, and verifies presentation catches up.

### Fixed — premature default promotion and elevation mismatch

The first implementation was too close to claiming voxel as the new default while Phaser hit geometry and overlays still assume a flat plane. Phaser remains the safe default; voxel is explicit `?renderer=voxel`. The composed adapter deliberately flattens terrain/entity elevation until raised hit proxies, fog, health, selection, and placement agree with visible height. The DESIGN/PLAN/changelog state this limitation rather than treating the slice as full migration.

### Fixed — hidden legacy entity layers also hid transient feedback

Hit flashes and death feedback shared legacy world layers that voxel mode hides. Dedicated feedback layers remain active above the Three canvas. The full promotion matrix for selection, placement, health, fog, and feedback remains open, so this fix does not justify changing the default.

### Fixed — linked dependency and CI drift

AoE2 and the package now use exact Three `0.185.1` plus types `0.185.0`; Vite deduplicates Three and a browser constructor probe verifies one identity. Every local gate rebuilds the sibling package first. `.github/voxel-commit` pins the full source hash, and CI/corpus workflows fetch and build that revision before AoE2's local-file dependency is installed.

### Fixed — visual evidence captured before the minimap canvas layer painted

The first voxel full-page screenshot showed a black minimap even though its canvas contained 10,773 non-background pixels. This was a Chromium screenshot compositing-readiness race: an element paint exposed the already-drawn map. The focused browser test now polls minimap pixels, and the controlled final screenshot forces that layer to paint before capture. The final pair shares tick 0, camera, viewport, DPR, HUD, and visible minimap.

## Confirmed boundaries

- No AoE, City, or Townscaper semantic type appears in the reusable package.
- AoE simulation, commands, save data, replay data, UI, fog semantics, and art-role policy stay game-owned.
- Three is absent from portable core contracts; the meshing lane depends only on the core's numeric limits, not Three or the DOM.
- The first TypeScript mesher is a correctness oracle. Voxelize and `block-mesh-rs` remain the required bake-off before production greedy meshing; Taichi.js is not in the runtime graph.
- Phaser default behavior and the voxel proving path are separate, explicit modes with a fallback on initialization failure.

## Result

Iteration 1's substantive findings were implemented and re-reviewed. The shared engine converged with 69/69 tests plus typecheck/lint/build and zero dependency vulnerabilities. AoE's strengthened focused browser specification passes 5/5. Final whole-repository gates and independent Codex/Claude review remain iteration 2 work; default promotion remains explicitly deferred.
