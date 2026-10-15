# Restore deterministic movement replay

Status: active
Owner: Codex orchestrator (/root)
Created: 2026-10-01
Updated: 2026-10-15

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

The prepared source is frozen for root's independent review. Exact changed paths and SHA-256 digests are in [snapshots/prepared-manifest.json.txt](snapshots/prepared-manifest.json.txt), copied byte for byte by work 129 M1 from `tmp/parity-107/prepared-manifest.json` in `replay-parity-1001` (5,261 bytes, SHA-256 `c76508af4a443246e64f195cb977a96590e8cad0c141be9430594c0162ec3803`). The tracked-diff snapshot that sat beside it is not kept: the manifest names it by `trackedDiffSha256`, and the eleven product and test files it covers are byte-identical in `parity-integration-0930`. The manifest distinguishes six product files, five test files, canonical authored documents and the copied work107 allocation. Allocation metadata must be reconciled with root's current registry rather than replacing it wholesale. No worker commit exists. That worktree, `replay-parity-1001`, and the copy in `replay-parity-250` were retired through the controller by work 129 M1 on 2026-10-15, because their files are byte-identical in `parity-integration-0930`; the frozen dependency mirror `replay-parity-1001` consumed stays in `parity-gameplay-0930` until M2. Root will follow up after the priority CI test-cost repair for fresh supported engine2.5 validation, affected integrated checks/full gate, independent exact-source review and main/remote acceptance.

## Preserved review record (work 129 M1)

Copied on 2026-10-15 from `C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930/docs/work/107_replay-movement-parity/` (staged there, except round 1, round 2 and the `review1/` and `review2/` snapshots, which were untracked), and, for the manifest, from `tmp/parity-107/prepared-manifest.json` in `replay-parity-1001`:

- Review rounds: [round 0, source](reviews/0_implementation.md), [round 1, integration](reviews/1_integration.md) and [round 2, integration](reviews/2_integration.md).
- The snapshots they cite: `snapshots/independent-source-original.md` and `snapshots/inspected-inputs.json.txt` (round 0), `snapshots/review1/` (round 1), `snapshots/review2/` (round 2). Beside them: `snapshots/engine-2.5-retest.md`, `snapshots/gate-proof.md` and `snapshots/prepared-manifest.json.txt`.

The bytes are exact, so every size and SHA-256 a round cites for a copied file matches the stored file, and each file is under 256 KiB (the largest is 231,939 bytes). One exception: round 2's last line ended in CRLF while every other line of every copied file is LF, which `checkoutLineEndings.test.ts` rejects as mixed, so it is stored with LF. Original 3,603 bytes, SHA-256 `75e755a65d409718995a874bbeda05745325a85e9886af6fc439584974628c10`; stored 3,602 bytes, SHA-256 `e832aa450aa11245ac56011dbcabfd7b737d03ff141146db05e0a4d37bd33cf4`; putting the one CR back before the final LF restores the original.

What this record is and is not. The rounds and snapshots describe a candidate that is not on main: the persisted move-path cache (`persistedMovePathCache.ts`, `movePathPersistenceTypes.ts`, edits to `bridgeState.ts`, `bridgeStateSerialize.ts`, `playerCommandsSystem.ts` and `wireBridgeOps.ts`, and five tests). Its eleven source and test files are byte-identical, by SHA-256 on 2026-10-15, in `parity-integration-0930` (staged), `replay-parity-1001` and `replay-parity-250`. [Work 129](../129_codex-lane-retirement/plan.md) M1 retired the last two on 2026-10-15, so `parity-integration-0930` holds the only copy, and M2 lands the candidate (persistence, so an independent review first) or cancels it. Not copied: the newer plan, spec, register and architecture text that checkout staged. Round 1 names the final `design/spec-final.md`, this plan and plan 108 as its published-after files, and the staged bytes of all three match its digests today, so its reversible prose delta can be applied only while they exist there; M2 commits or preserves them before it retires that checkout. Also not kept: the run evidence in the retired checkouts' ignored `tmp/` (logs, mutant results, a 5 MB recording, the engine 2.5 retest's receipts). `snapshots/inspected-inputs.json.txt` hashes the inputs the reviewers read, and the candidate's tests reproduce its controls. Round 2 links the work 109 plan preimage as `reviewed-before-red-plan.md`; main spells it `reviewed-before-RED-plan.md`, and the link stays as authored.
