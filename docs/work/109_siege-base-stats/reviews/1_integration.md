# Review 1: integration

## Target

Uncommitted 0.3.243 candidate in siege-content-1001: base/observed HEAD `10c26f52f0810321784603a7b73f3fbf6789dc44`, staged tree `f0043d6c18ae29e052c299c47eaae6684388a354`, 24 paths (nine source/test, fifteen canonical/config). The [exact input record](../snapshots/integration-review1/inputs.json.txt) binds every file. Coordinator-retained [work106](../snapshots/integration-review1/reviewed-work106-plan.md) and [work109](../snapshots/integration-review1/reviewed-work109-plan.md) preimages recover the reviewed plans before later status repairs.

## Reviewers and coverage

One independent internal reviewer, `/root/siege_internal_acceptance`, assigned Astra/xhigh with fork_turns:none, read the exact source, production/upgrade/armor/save/replay routes, receipts and six original-resolution images. Assigned model identity was not independently instrumented. The reviewer ran no tests, browser, server or Git mutation. No external CLI or second-provider review occurred.

## Reports

The complete original [report](../snapshots/integration-review1/report.md), 14,181 bytes, SHA256 `2c0db6bac1660aa0cdb97e59b51970be27e6da2f581a90ae0a4b9af48143fd65`, is preserved unchanged. Normalized compact [inputs](../snapshots/integration-review1/inputs.json.txt), [40-file evidence hashes](../snapshots/integration-review1/evidence-hashes.json.txt) and [closing record](../snapshots/integration-review1/closing.json.txt) retain the same target/provenance data; original physical JSON bytes are recoverable through the delta. The original authored report remains exact LF. The three JSON copies are now normalized CRLF→LF after hosted checkout-line-ending failure; parsed content is unchanged. The [line-ending delta](../snapshots/review-json-line-ending-delta.json.txt) pins original and normalized bytes/hashes and an exact inverse recipe recovering each original. No raw logs, full freeze manifest or control trace are promoted.

## Findings and disposition

| ID | Finding | Disposition and follow-up |
|---|---|---|
| I1/P3 | Six work106 current-status lines contradicted accepted green main 10c26 CI/corpus evidence. | Accepted. Root repaired those lines and work109's current outcome after preserving reviewed preimages. Focused independent re-review is pending. |

No material defect was found in ten runtime values, nine CSV values across eight cells, bounded mechanism tests, visuals or representative controls. Official update 185872 corroborates five Onager/Ram values; data pin 3bb43b14 establishes all ten.

## Verification

Reviewed focused checks: 37/37 passed (23 literal content, 14 World), no skips, native 0. Initial content RED had 19 stale failures/four controls; initial World RED had nine stale failures/five preparation failures. A later five-case off-map preparation failure was corrected. Sensitivity: reverted Onager assertion native 1,22/23; exact restoration native 0,23/23. The separate outer bookkeeping native 1 is retained.

Full maintained unpiped verify passed all six stages, native 0/job 0, 846.721 seconds: 4,377 unit tests passed/three skipped of 4,380; 236 browser tests passed/two skipped of 238, one worker. Skips were two-player opening symmetry, selection overflow, opt-in Claude integration, and two annotation visual baselines. They are not passes. Opening/closing checked 2,945 rows unchanged: 2,245 source files, 376 core dist, 320 voxel dist and four metadata rows. Five voxel prehooks skipped rebuilding. Cleanup confirmed zero owned members/leftovers, removed lock/root process and free port 4282.

Natural/Moebius before/after/diff images at 1280x800 showed 88,832/77,135 changed pixels, 414 minimap pixels each, zero outside the a priori union. One Natural/SwiftShader pointer/DOM flow advanced 4,336 actual ticks, same Ram 2168 through both upgrades with 36 fog witnesses, and fresh Onager/Heavy attack 55/14 with 60 HP. Movement completion was observed within 700 ticks sampled in 50-tick steps; 47 trace actions are not 47 user inputs. Browser/context/server cleanup and free port 4287 were verified.

## Round outcome

Bounded implementation, visual/control evidence and frozen local gate are supported. Compatibility evidence uses reconstructed schema 2 saves and affected same-version replay endpoints; authentic old-save corpora, whole-game historical determinism and full DE parity remain outside this proof. I1 focused re-review, coordinator acceptance, main merge/push and hosted gates remain pending.
