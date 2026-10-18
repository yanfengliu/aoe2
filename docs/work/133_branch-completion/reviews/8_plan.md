# Work 130 — prepared transparent-compaction proof review

## Target

2026-10-17, work 130 prepared culling proof, reviewed before execution. Workspace: `C:/Users/38909/Documents/github/aoe2-worktrees/software-culling-proof-1017`, commit `63443d0dfe9eaefe900be02b10f0e46e94235dbc`, tree `661cf37ec42d514c09a976bc167e6e7dce6491c1`.

Target directory: `tmp/probes/work130-culling/`. Preparation manifest SHA-256: `713f762fb5735057fe4f7af181f560be03a1998190d096d567367bc3229d9398`.

| File | Reviewed SHA-256 |
| --- | --- |
| `plan.md` | `61618941ee4757f992f68feb431e30e8ef6f3f89c88cdffc242f5142256a0611` |
| `fixtures.ts` | `977879c56c77b4d9b8b84be2a2ad1eab40235786d18f46c79394ee564bac8633` |
| `candidate.ts` | `05618dc8a071790eccdef51b9af20a31f06c9f89ed8f00ed107f87737413ff14` |
| `runtimeProof.ts` | `20d2a7b0a2f0866eee60041f3c1d041335b78f85557985db663db21e67332f95` |
| `lifecycle.test.ts` | `2669e407ca18834027fd19d5ac3cc5a915aac1cd4537c84c683c9a323b918d2b` |
| `vitest.config.ts` | `e95487c0887cde52b0192dd49984d84195d7ddee3cd22b566622c4db6efa3d9b` |

This report remains bound to those prepared bytes. No execution result is supplied.

## Reviewers and coverage

Independent read-only reviewer `final_acceptance_review`, under the fleet Astra/xhigh assignment. I read all six files, their manifest, the existing AoE delta instrument and ingestion path, actual presenter allocation/bounds behavior, Three’s sorter, and public runtime failure, restoration, capture and disposal paths.

The installed voxel package is a junction to revision `5d6d4c911c6d05b62a5a81ad62f05993cf44e9de`; the shipping pin is `08398b573ad54bcb5c764ad0c2ef3cedc3cce33f`. I inspected their relevant source differences. The presenter, conservative-bounds and failed-draw restore module are unchanged between those revisions; other runtime/disposal changes exist. Any executed result remains bound to the manifest’s installed dist bytes, not automatically every dependency revision.

No external Claude export, test, simulation, build, browser, profile, source edit or Git mutation occurred.

## Reports

**The proof has a sound comparison core, but needs three instrument corrections before its result can establish the declared lifecycle coverage.**

Both arms use actual `ThreeRenderRuntime`, borrowed scenes and the existing `acceptAoeVoxelSnapshot` path (`runtimeProof.ts:110–124`). The baseline is unfiltered B. Capacity, boxes, spheres, retained matrices/colors, relative object-ID order and replacement cadence are observed from actual presenter meshes (`:69–104,163–170`). The omission oracle uses the presented geometry box and camera frustum, rather than calling the candidate’s visibility decision.

The sorting comparator is Three’s actual exported implementation. Its list construction is narrower than WebGLRenderer’s full traversal: it handles these fixture meshes with group order fixed to zero (`:51`), an orthographic camera and no grouped materials. That is a useful bounded check, not a complete rendering oracle.

The first-full and count-change controls toggle the candidate’s relevant guards and require an actual `CAPACITY:` failure, followed by a healthy rerun over unchanged inputs (`lifecycle.test.ts:30–40`). Their intended sensitivity is plausible from source but remains unexecuted.

**CP1 — Lifecycle steps can pass without establishing their intended transition.** `runtimeProof.ts:153–161` compares both arms’ `metrics.state`, epochs and revisions, but does not require the loss event to produce `lost`, restoration to produce `restoring` then `running`, or the expected per-arm draw/commit deltas. The legacy metric explicitly maps failed and restoring states to `lost` (`ThreeRenderRuntime.ts:1095–1097`). A common failure of the stimulus can therefore escape this comparison. Likewise, `sawPinnedFailure` records whether either arm threw, not whether both produced the required injected failure.

Use public `runtimeStatus()` and explicit per-step expectations. Require zero completed draws and commits while lost, the expected restoration/device-generation changes, the intended presented revision after normal and restoration frames, and the exact injected failure from each arm. Keep the independent picture comparisons.

**CP2 — Camera-only fixtures do not reproduce stable source batch revisions.** `fixtures.ts:39,59` rebuilds every source batch with the new outer snapshot revision. Actual B retains unchanged lane revisions (`aoeVoxelLaneBatches.ts:197–205,228–245`). Thus the prepared camera-only case cannot establish that camera-driven membership changes survive that real cache boundary.

Keep outer snapshot revisions advancing, but retain unchanged source batch revisions/content across compaction, pan, zoom and paused frames. Check that the visible retained set actually changes at the selected camera positions. The candidate’s fresh transformed revisions should make those changes reach the real presenter. A control omitting that revision change should fail the intended presentation assertion.

**CP3 — Correct the terminal failed-draw condition before observing results.** The original plan treats any restored-graph capacity difference after a thrown draw as a route-stopping future-order counterexample, then attempts `recover-next-frame` (`fixtures.ts:101–103`). Source inspection does not support that continuation for this standalone runtime.

`runtimeHostFrameRestore.ts:86–113` restores the previous graph and then marks the runtime failed. Further frame, ingestion, view changes and legacy capture reject failed state through `assertAccepting()` (`ThreeRenderRuntime.ts:1100–1103`). Loss events ignore failed runtimes, restoration accepts only lost runtimes (`:181–208`), and manifest capture returns unavailable for failed state (`revisionCaptureCoordinator.ts:145–154,258–265`). There is no public reset/revive method. AoE’s bridge reset replaces its adapter only, while bridge rollback explicitly assumes the runtime remains usable (`AoeVoxelWorldRenderer.ts:340–370`).

The borrowed graph remains inspectable, but manually rendering it outside the configured standalone protocol is not an AoE continuation. Therefore, a capacity difference confined to that terminal graph does not by itself establish a future committed-frame ordering defect. This is a justified **pre-execution correction**, not a response to a failed experiment.

Record terminal graph differences diagnostically. Assert both runtimes become terminally failed without another commit, then test genuine disposal and runtime reconstruction. Use the same source epoch/count so stale compactor acknowledgement cannot hide behind an epoch change. Require a true-full first committed presentation, followed by compaction with all capacity, bounds, ordering and replacement checks intact. Prove omission of the reconstruction reset fails the first-draw capacity check.

This correction does not relax usable-runtime restoration, resync, camera, bridge-rollback or committed-frame comparisons. Embedded host abort/recovery is a different public protocol and is not approved by this standalone argument.

## Findings and disposition

| ID | Disposition |
| --- | --- |
| CP1 | Must fix lifecycle nonvacuity: explicit states, transitions, per-arm throws and committed-draw expectations. |
| CP2 | Must fix camera-only fixture realism: stable source batch revisions with independently changing presentation membership. |
| CP3 | Accept the pre-observation terminal-state contract correction; replace impossible recovery with terminality and genuine reconstruction proof. |
| Capacity/bounds/order comparison core | Suitable within its synthetic no-GL bounds; execution and sensitivity remain pending. |
| Counterexamples on a usable or newly reconstructed runtime | Remain route-stopping findings. Do not auto-heal, weaken or discard them. |
| Product candidate and performance acceptance | Not established. No-GL success cannot prove pixels, gameplay work or FPS. |

## Verification

I independently verified the manifest digest and every listed input: six proof files, ten source/package inputs and 160 voxel dist JavaScript files, with zero mismatches. Tracked and staged diffs were empty. `run-receipt.json` did not exist.

The prepared suite selects one proof file, one thread, no npm pretest/build, no retries and bail on the first failed test. Its final receipt explicitly does not replace a complete passing Vitest result. Execution must retain direct exit status, full output and before/after input manifests.

No process requiring persistent cleanup was launched. The worktree and ignored preparation files remain for the integration owner.

## Round outcome

Request the three bounded proof revisions before scoring execution. The culling route is neither accepted nor rejected by this unexecuted review.

Preserve the original terminal-rollback assumption and its source-grounded correction in the record. Keep the software ratio limit of 1.25, GPU floor of 55 FPS, unchanged pixels and complete simulation work unchanged. The stronger software criterion remains **UNMET**.
