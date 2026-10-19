# Review 52: implementation

## Target

2026-10-18. Actual implementation of the one selected hosted Windows observation from [review 51](51_design.md), not a product change. The exact command was `gh api --method POST --include repos/yanfengliu/voxel/actions/jobs/117779578976/rerun`. Run `36863735290` retains original source `5d6d4c911c6d05b62a5a81ad62f05993cf44e9de`; new Windows job `117863550009` is attempt 3. Root's copied selection receipt SHA256 is `b6176198546a76c6b069981bc98197e66f91b93a7d09e64e4009f5575e21d002`, selecting reviewed proposal `a87ad2145c7e4a57db21187c12169565670a13111cc2c07aabd12b0e9a2e609c` and report 51 `5ac568399eafe8266e88c8ab4bb2a871ad60d9feb02e38c71c7ab2e0c615194a`.

Exact owned evidence is `tmp/work135-node24-latest-job-result/` in `C:/Users/38909/Documents/github/aoe2-worktrees/work135-m21-search-a-1018`. Machine result SHA256 is `a7d666c1ed7abb9297fc9c6e4ac6a7b3a2aad051ca047716763e29269ea062fe`; evidence manifest `ab1f0817247721373de07d9e1256817fdb23cad16d621ad7d20b401d87c819a7` covers 456 files/31,429,066 bytes through that result. The earlier attempt-1 request refusal and its external manifest `f2a64b4fd30c98526a6de13f971ef83cc6f99c0b4e287694e771025d5e359ccd` remain unchanged history.

## Reviewers and coverage

`/root/correction2_integration_review` was the separately assigned engine-observation owner. Root inspected actual review 51/proposal/latest-job metadata and selected one request; root separately inspected and adjudicated the preflight instrument correction below. I refreshed guards, sent exactly that one request, observed authoritative REST metadata through terminal, read the complete fresh job log and annotations, distinguished carried results/artifacts, and froze the actual result. This is observation and documentary coverage; no independent engine-product approval, source repair or art review was performed. Pinned Opus quota remains unavailable with no retry, substitution or review credit. No subagent or local browser/server/test ran.

## Reports

### Result and actual populations

RED: the selected request succeeded, a genuinely new Windows job ran, and both original cases failed on the old source. Request acceptance was HTTP 201/gh exit 0 at 2026-10-19T02:39:27.932Z–02:39:28.497Z. Raw response is 1,421 bytes, SHA256 `ceb846a8f3a085d7fdabf9cf8fb65321e3c915e7eb0970349ff99f5dd253b277`. Exactly one POST occurred; no additional request, fallback or repair followed.

REST establishes exactly one post-request start: Windows job117863550009 at 02:39:32Z, runner1000006032. Its old source assertion passed before install/browser. It completed CANCELLED at 02:54:58Z; observed job wall time including cleanup was 926 seconds. The annotation explicitly states the original maximum of 15m0s was exceeded. Browser-step wall time was 854 seconds, 02:40:36Z–02:54:50Z. Run attempt 3 concludes FAILURE. Its Ubuntu row117863551093 carries October 18 start/end times; it is not a new Linux execution.

| Original case | Budget | Reported test duration | Actual outcome |
|---|---:|---:|---|
| Three ordered gust frames | 188,200 ms | 210.3 s | Timeout; locator.screenshot was waiting for fonts at weather227/241. |
| Fixed cameras/root cutaway/resize/capture/teardown | 331,800 ms | 618.3 s | Timeout; screenshot target/context/browser closed at spec348/373. The log also records a truncated ZIP error. |

The raw log says Running 2 tests using 1 worker, shows both entered titles and ends with 2 failed. Thus the selected population is two entered/two failed/zero passed, retries 0. Durations above are the unchanged reporter's test durations, not CPU time or isolated test-body measurements. Source budgets, assertions and deadline were not widened. Fresh raw log is 41,374 bytes, SHA256 `3ee1f5b99caca18aaa12adcdf642bcc3c96271d7063ab0becafe3bb4782d4df3`.

### Runtime and missing output bounds

Actual setup logs record Node v24.21.0/npm11.19.0 on Windows Server2025 10.0.26100 Datacenter, image windows-2025-vs2026 version20261007.264.1. Setup found Node24.21.0 in hostedtoolcache and restored the npm cache key `node-cache-Windows-x64-npm-1d9cc516f4601d95020cbfd221e6757ea908b6590732c4a72faafe59a086b4cb`, 45,719,762 bytes. The maintained browser installation downloaded Chrome for Testing and Headless Shell147.0.7727.15, Playwright revision1217. Those installation version/paths are observed; the actual launched executable, CDP version/arguments and font rows are unavailable in retained fresh output. Installed selectors do not prove those missing runtime identities.

The wind observer was reached: the fresh log names its wind-start-hero JSON attachment before the screenshot timeout. The pinned source attaches only after writing a completed report, but no fresh JSON bytes were uploaded, so its actual eleven rows, font families and hashes cannot be independently inspected. Calling that observer DID NOT RUN would overstate absence. The fixed-camera failure is in the first-flush capture loop before mature-HUD observation. The mature population was not reached on that recorded path. The independent two-population verifier was SKIPPED/DID NOT RUN. Independently inspected fresh populations are 0 of 2; no font-causation conclusion follows.

Artifact upload was SKIPPED. The final successful API inventory contains zero fresh Windows artifacts and zero available native Windows image bytes. Logged JSON/trace paths do not supply those bytes; this result claims neither zero screenshots attempted nor a recovered trace. No image was substituted or rendered locally. The sole carried Linux artifact12149104856, created October 18 at20:24:37Z, remains historical provenance: ZIP `bc91d9513c71a9c0b72bcc335af39bd62b2ccb6044fcbb4a57dec90dbd22a2d2`, 17,706,847 bytes. Its 316 image entries, nested traces included, were preserved at native bytes with paths/hashes in `carried-linux-image-inventory.json`, SHA256 `b64e99a2c799e6924815fdc36831da826d43e13e6a0c50165a848adcdc5f8e68`. Root subsequently narrowed remaining work to fresh Windows outputs; no further historical download, broad image review or gallery import occurred. Those historical images establish no new visual milestone or Windows evidence.

### Preserved preflight correction

The first preflight stopped before POST because my new predicate searched case files for computed budget literals. All fourteen committed input pins and fresh remote identity/inventory guards passed, but those literals were absent. Raw failed preflight SHA256 `ce3970501356322cf9bf484c92ffff83d8ac44c136d0d028a7c8afa041a24b22` remains intact. The actual cases call timeoutForMeasuredWorkMs(71_700) and (35_800); unchanged helper45_000+ceil(4*measurement) yields331800/188200. Supplemental helper pin is `a396ac1ce9bfd4ff701fd2a47f8d01477127390c86860c5550dae2ce25a3559c`. This was a defective audit predicate, not a changed product budget.

Root independently read that helper/call sites and selected exactly one instrument-only correction, receipt `bcdb73a488ae4909b52d289591752ebd18da53fa716fdab4cbc1a278ce2551a0`. Old/new scoped predicate files and exact diff are retained: before `5eec42647aeef4e45debeb985af53a2d49a0801339d67d24e341fba6ea6619d9`, after `c81fa8e6d728522c6835ca8b807b1b8979cd5e85c2f9e52d5aee4bee15e4d197`, diff `b328781be8bb5b46e061cf81b6e79224f8a2d3753c9a0c87aa594f2ef61fb5a6`. The before file retrospectively preserves the exact two executed stdin expressions in a pure-function wrapper; no pre-existing complete original script is claimed. Corrected full preflight ran once, refreshed every remote guard and all fourteen old committed inputs, and passed at SHA256 `ea775a32e1f8128fc00f0a49da082721e81a00cd6904b40c1d6c657a55ac33f4`. Only that whole pass consumed the original selected POST. No source, helper, workflow, dependency, test, assertion, ID, timeout or control was repinned.

## Findings and disposition

The selected workload validly reproduces both timeout failures on fresh old-source Windows execution without the palette helper or full-suite prefix. It establishes recurrence within these observed conditions. It does not isolate helper, font, host, runtime or cumulative-suite cause, prove same-host equivalence, or clear full Node24/Linux/headroom/required-review readiness. Old Windows Node22 success remains separately bounded. No product correction is selected and no repair allowance resets. Prior refusal, first preflight failure and all earlier observations remain retained; root owns any next decision.

## Verification

The first actual cancelled-step record is `first-runtime-red.json`, SHA256 `714fb29f87a6b693c8e58dcb7907465a26f85e73432076dd5f3dee6085d1c587`. It was reported immediately while cleanup still ran; remote ownership was retained through terminal. All final run/latest-job/artifact/annotation/log and five active-inventory GETs succeeded. Final inventory counts are0/0/0/0/0 and the selected job is completed, so its observation hold can be released. Final annotations SHA256 is `23e330cfcbecdc720d80f0c76f91eca8378abb0231db502d97c13494f2a9756d`; final artifact inventory is `6af7bc299eda798c99a8cdaef59f05477b72099b56258ae334c2a49770b142ab`.

This assignment ran the selected hosted two-case workload only. Local tests/full verify, full Node24 CI, new Linux execution, source repair, model review and native art acceptance DID NOT RUN. Offline work only read raw logs/metadata, inspected committed source, hashed inputs and extracted existing artifact bytes. Final format/preservation/resource audit accompanies this report; root owns integration checks, evidence custody and managed checkout retirement. No commit/push or checkout cleanup occurred.

## Round outcome

The one selected request is complete with a RED runtime outcome: two original old-source test failures and hosted job-cap cancellation. The exact result and missing-output limits are frozen. No replacement request or repair follows. The remote observation hold is resolved; this grants no art capture or engine readiness. M21 source remains frozen RED at c18dbdbfeffc141cb3c533b9a16d587620f872ada596329c7e4ac7557cac718e, correction2 and all art/Normal-baseline acceptance still open. Existing reports47/49/51, search-A evidence and unrelated dirty voxel AGENTS remain preserved.
