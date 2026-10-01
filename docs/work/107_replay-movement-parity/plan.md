# Restore deterministic movement replay

Status: active
Owner: Codex orchestrator (/root)
Created: 2026-10-01
Updated: 2026-10-01

## Problem and outcome

The frozen engine 2.4.2 runtime reproduces an inherited movement recording divergence at segment 70→140. Diagnose the first live/replayed difference and restore snapshot continuation without changing movement or resource occupation behavior.

## Scope

The implementation owner works only in `replay-parity-1001` from `c4024020a09c99f74728f2a880a86fbcbaef8e48`. Scope is localized movement/replay bridge code and dedicated contract tests. Root owns expensive gates, independent review, integration and hosted acceptance. The initial runtime is the frozen work106 dependency mirror (engine 2.4.2, voxel 1.2.0); no sibling or dependency files are written. Persistence/interface changes require the integration owner's contract agreement.

## Approach

Reproduce the exact recorded one-gather/280-move case. Triage with `bundleHotspots`, check `SessionReplayer.selfCheck`, fold `snapshotAtTick` as zero-world ground truth, and compare the first executed difference with live history and bridge debug state. Actual live/resumed world equality and a route-only clear control establish the warm-path/cold-path cause. Preserve the original live path instead of changing the engine path planner.

## Acceptance criteria

- [x] Freshly reproduce the exact inherited case under the pinned runtime, with five checked segments and zero skipped segments.
- [x] Identify the first causal live/replay difference with independent snapshot state and a discriminating control.
- [x] Add tests first for the movement continuation class, including a nonzero checkpoint and relevant legacy/modern boundaries, and prove the defect reintroduction goes red under frozen engine 2.4.2.
- [ ] Preserve real movement/contact/traffic/counters/resource occupation behavior and compatibility; root verifies the final integrated revision and reviews persistence changes independently.

## Implementation steps

- [x] Initialize required remote status and isolate dependencies to the frozen runtime.
- [x] Agree the additive version-1 `aoe2.movePaths` contract before implementation; cause is recorded in the session debug document.
- [x] Implement route-event persistence after the new regression test fails.
- [x] Hand over exact paths, focused checks, mutation evidence and limitations for root acceptance.

## Outcome

Implementation prepared on c4024020 under frozen engine 2.4.2. Warm live and cold checkpoint worlds first differ at tick89 because their route suffixes differ; clearing only the warm route map at tick70 makes their complete serialized worlds equal through140. Seven new tests produced five RED failures and two passing controls before production changes. The approved slot preserves the full chosen path, original requested target, resolved destination and entity generation; cursor progress stays runtime-only and route updates use the existing dirty accessor flush. Exact reproduction now self-checks five intervals with zero skips. Focused eight-file tests pass 87/87; the later schema-1/2 legacy migration lane passes 2/2, and direct typecheck passes. Four restored-source mutation controls fail by assertion. See `gate-proof.md` for exact bounds and counters.

Required remote status initially exited 0 with c4024020 CI running and corpus green. Root later observed the sole Windows CI failure: the existing 600-tick occupation comparison timed out, with no product assertion failure. Its separate owner repairs that priority test cost; work107 does not edit its test or helpers. Work107 expensive gates, fresh engine 2.5 replay checks, independent review, commit, integration and hosted acceptance remain pending. The dependency junction still consumes the retained frozen work106 mirror. The temporary c402 comparison checkout and branch were retired through `controlWorktree.mjs`, with link targets verified intact. The separately observed unrecorded mutable Gatherer progress remains OPEN; this route repair does not establish whole-game recording fidelity.

## Review handoff

The prepared source is frozen for root's independent review. Exact changed paths and SHA-256 digests are in ignored `tmp/parity-107/prepared-manifest.json`, with a snapshot of the tracked diff in the same directory. The manifest distinguishes six product files, five test files, canonical authored documents and the copied work107 allocation. Allocation metadata must be reconciled with root's current registry rather than replacing it wholesale. No worker commit exists. Keep this unmerged worktree and the frozen dependency mirror alive; the safe controller already retired only the owned comparison checkout. Root will follow up after the priority CI test-cost repair for fresh supported engine2.5 validation, affected integrated checks/full gate, independent exact-source review and main/remote acceptance.
