# Isometric voxel renderer migration — review iteration 2

Objective: `voxel-renderer-migration` · Started: 2026-07-11 · Iteration: 2

## Scope

Final local adversarial review and gate synthesis after the reusable engine converged and AoE2's composed renderer was exercised against the whole repository. This pass reviewed the live diff, the six initially failing browser flows, the production Playwright result, package identity and CI pinning, source-size limits, dependency audits, visual evidence, and the remaining promotion claims.

## Findings and dispositions

### Fixed — browser commands depended on incidental animation frames

Six gameplay tests queued a command and assumed Phaser would run a frame before the test API stepped the simulation. The larger bundle made that assumption fail consistently. Paused boots now bind pause intent to the final installed browser API, and `advanceTicks()` performs a bounded unpause/step/repause sequence. Tests explicitly advance after commands instead of consuming uncontrolled wall-clock frames.

### Fixed — the anti-Archer fixture passed vacuously

The enemy Archer overlapped the player's Archery Range, disappeared before the Skirmisher completed, and allowed the canonical test's final “Archer absent” assertion to pass without combat. The target now occupies `(18, 7)`: outside passive Town Center range, outside every building footprint, and reachable once the new Skirmisher's batched vision projection catches up. Headless and browser tests both require the Archer to be authoritative and rendered before issuing an attack, then require its removal after bounded deterministic steps.

### Fixed — sub-grid browser sampling used a blocked pointer route

The browser test's rightward click route spent a tick dispatching and then reached a coarse waypoint. It now uses the same explicit, known-clear leftward move contract as the canonical simulation test and samples the first fine-grid movement tick. Pointer command delivery remains covered by the broader browser suite.

### Fixed — source-size gate

`sceneRenderer.ts` briefly reached 501 lines. Removing redundant commentary returned it to 499 lines; the repository file-size test passes without a new exception.

## Verification

- Shared `voxel`: 69/69 tests, typecheck, zero-warning lint, build, package dry-run, runtime/full audits with zero vulnerabilities.
- AoE2 unit suite: 249 files passed, one skipped; 2,046 tests passed, two skipped.
- AoE2 production browser suite: 100 passed, two intentionally skipped out of 102; all five voxel renderer tests passed.
- AoE2 typecheck/build: 447 modules transformed successfully.
- AoE2 lint: zero warnings or errors.
- AoE2 runtime and full dependency audits: zero vulnerabilities.
- Controlled visual evidence: 343,580 of 480,000 RGB pixels changed (71.58%) with matching seed, tick, camera, viewport, DPR, HUD, and minimap.

## External review and publication boundary

The prescribed Codex `gpt-5.6-sol` and Claude review invocations were prepared, but the safety reviewer refused both because sending the private live diffs to external CLI services requires explicit user consent. No external finding or approval is claimed. Publishing the locally committed engine (`7fbae42`) and AoE2 implementation (`a22fe8d`) also requires explicit remote-publication approval; the engine must be pushed first because AoE2 CI pins its full commit hash.

## Result

The opt-in local vertical slice is gate-complete and the substantive in-process findings are fixed. Phaser correctly remains the default. External multi-CLI review, both pushes, full voxel-mode interaction parity, elevation-aware hit/overlay geometry, measured promotion performance, and City/Townscaper proving adapters remain open and are not represented as complete.
