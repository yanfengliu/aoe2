# Movement continuation on published engine 2.5

Status: focused verification complete; independent review, integrated full gate and main/hosted acceptance pending.

## Source and runtime bound

The private controller checkout is `C:\Users\38909\Documents\github\aoe2-worktrees\replay-parity-250`, branch `codex/replay-parity-250`, base/main `10c26f52f0810321784603a7b73f3fbf6789dc44`. The six product and five test files are copied exactly from the prepared packet; all eleven SHA-256 digests match. Main has no changes in those paths since the original c402 base. Root's current work107/work108 plans and registry remain byte-identical before and after preparation and execution. The current work107 canonical header is `Status: active`; the historical frozen packet is preserved instead of replacing it with root's corrected header.

The original worktree `replay-parity-1001`, all22 prepared rows and manifest SHA-256 `c76508af4a443246e64f195cb977a96590e8cad0c141be9430594c0162ec3803` remain unchanged. Its node_modules junction still points to the retained frozen engine2.4.2/voxel1.2.0 mirror. No rebase, sibling write, dependency installation or old-tree junction replacement occurs.

The new tree's controller-created node_modules junction points to actual primary game dependencies. Node is24.12.0, engine package and actual `ENGINE_VERSION` are2.5.0, voxel is1.2.0. All376 actual engine dist files and the complete path inventory match published release `eb61e448789a95ef907ae6f6e28e2dd33ae4c8a8` before and after execution. Published tarball648,792 bytes/SHA-256 `478d0aa36b49bd02a9a75df87ad08f6e672801011bee570887f84e5217c17fff`, asset602452190, has hosted engineCI36816404419 green. Its retained manifest SHA-256 is `59d03515bf9db7c2e372b7b13cd0551482f59184f53ad3f5ef4a948d36aeef8d`. No new download/build or engine source change is performed. The engine owner's adopted-runtime witness is used, rather than its earlier pre-adoption2.4.2 witness.

## Executed checks

One bounded runtime slot executes the unchanged original M7 instrument SHA-256 `52564fa57bf1aeda2e383358e50dbd805a20be99eb319d8590dbe905f23e01c8`: default `aoe2-prototype`, AI owners1/2 disabled, occupation-only legacy field removal, one gather tick,280 move ticks to(16,12), checkpoint70 and terminal snapshot. A temporary read-only return observer records `SessionReplayer.selfCheck()` coverage without changing its arguments/result or invoking a second check, and restores the native method in finally.

Actual exit0: one check, five checked intervals, zero skipped intervals and zero state/event/execution divergences. Coverage is complete with all three default checks enabled, horizon0→281, checked ranges0→70/70→140/140→210/210→280/280→281, no uncovered range and state-comparison endpoints70/140/210/280/281. Completeness does not mean state comparison at every intermediate tick.

The existing affected lane runs exactly eight files: replay `movementCheckpointContinuation`, `movementRoutePersistence`, `bridgeStateAccessor`, `snapshotEquivalence`; simulation `movementPathCaching`, `movementPlanOpsCacheKey`, `saveLoad`, `saveLoadIntegrity`. Actual Vitest exit0:88 passed, zero failed/skipped, eight executed files. The two dedicated movement files cover complete continuously stepped/resumed actual world state at nonzero checkpoints, original live pacing, user-loaded move/attack-move routes, modern/occupation-legacy recordings, schema-1/2 old user saves, historical absent-slot behavior, generation/format/alias/fallback/order-lifecycle boundaries and route-event writes. There is no new product/test change or mutant in this retest; earlier tests-first and restored-source sensitivity controls retain their frozen2.4.2 provenance.

Source-bound receipt SHA-256 is `fc4adb48932eb448dc55bbaaf54e271b9f0d65a2dca357c7be918374a3409b3c`. Post-run execution proof SHA-256 is `acd45f870603051a8bf0ec4719ceade18fc88aad89d74d7f66ea2e0538a06985`; it binds runtime/source invariance and exact stdout/result/report digests. All run artifacts remain ignored under `tmp/parity-107-250`. Git diff whitespace check passes. No broad gate, typecheck, browser, profiler or benchmark runs in this bounded follow-up.

## Remaining acceptance and ownership

Root owns independent review of the exact current-main source, integrated cross-task/full verification, commit/main/push and hosted CI/corpus acceptance. At the initial status check, new corpus36839039607 is green and CI36839039491 is running; ci:status exits1 because the previous c402 Windows timeout remains the latest completed red CI result. This retest does not close that hosted condition. The independently observed mutable Gatherer recording-diff defect remains OPEN; repaired route self-checks do not prove whole-game recording fidelity or broader DE parity.

The single runtime slot is released after both completed commands. No browser, GUI, localhost server or persistent watcher is launched. Both unmerged implementation trees, the original frozen mirror and the engine owner's release evidence remain retained for active review/integration; none is removed by this follow-up. Root must reconcile the original authored canonical packet with current main rather than copying the old plans/registry wholesale.
