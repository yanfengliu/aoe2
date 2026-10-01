# Retain per-run corpus oracle reports

Status: active
Owner: /root (integration), corpus evidence worker (source)
Created: 2026-10-01
Updated: 2026-10-01

## Problem and outcome

Hosted corpus run 36881959435 retained only its SUMMARY.md, leaving the 43 medium finding instances without per-run report evidence. Future uploads retain the existing oracle REPORT.md files alongside the summary. The ended runner's missing reports have not been recovered.

## Scope

Base 0d290ab5f3f74ab080537158c5de86a613fed800; isolated branch corpus-evidence-1001. Change only the playtest workflow artifact paths and one static regression test, plus this work record and allocation. Root owns canonical spec, defect register, devlog, integration and expensive gates. No gameplay, oracle, threshold, model, dependency, version or runner exit changes.

## Approach

Keep output/corpus/ and add output/playtests/*-report/REPORT.md to the existing upload. Independently parse the workflow with js-yaml and match representative paths with the already-installed minimatch. Keep always(), artifact name and upload destination intact. The scope adds only Markdown reports to the pre-existing corpus output selection.

## Acceptance criteria

- [x] Summary and two distinct per-run report paths are selected.
- [x] Representative recording JSON, envelopes, threshold files, finding JSON and raw captures are excluded.
- [x] Upload condition and artifact name are unchanged.
- [x] Independent read-only source review accepts the unchanged workflow/test with no material findings.
- [x] Root final integrated gate/reviews and main/push complete on sourceaaf59f33.
- [x] Hosted corpus delivery accepted on run36912947148/artifact11187123603.
- [ ] Combined CI and worktree cleanup accepted.
- [x] Root inspected the first new hosted artifact:exactly the summary and both configured REPORT.md files, without excluded payload.

## Implementation steps

- [x] Allocate ID 110 with the common fleet allocator and create the private worktree through the maintained controller.
- [x] Write the contract test first and observe a native failure on the original workflow.
- [x] Add the report path and rerun the identical short test successfully.
- [x] Root integrates after final combined verification.
- [ ] Root retires the worktree after hosted acceptance.

## Outcome

**Original worker outcome (before integration).** Source review accepted; prepared in root integration on published06efe6c0, uncommitted. Command: node node_modules/vitest/vitest.mjs run tests/scripts/corpusArtifacts.test.ts --maxWorkers=1 --minWorkers=1. Original workflow: exit 1, 1 failed test, missing arabia REPORT.md, 255 ms. Fixed workflow: exit 0, 1 passed test, 217 ms. Test and fixture paths stayed unchanged between runs. A prior sandbox invocation failed before collecting tests because esbuild could not read ancestor directories; both native proof runs used supported escalation. Bound: static workflow selection over representative filenames, not GitHub artifact delivery, report contents, oracle correctness or recovery of historical lost findings. No browser, server, simulation, corpus, World or full gate was run by this worker. Root must verify hosted delivery on the first new run.

**Current integration and bound.** Root copied the two unchanged executable inputs reviewed from0d290ab5 into resource-chip-capture-1001 beside work111's two screenshot-test paths. The full independent source report remains root-retained at primary ignored tmp/corpus-evidence-review-1001/review.md, SHA256a615ab9525f7278fae2256e1b0ece10586cc9c2f83c8dabfdca14e75de95c5bf; the complete authored report is now retained in [review 0](reviews/0_implementation.md), with its exact original plan and target manifest under snapshots/. Its reviewer executed no runtime/compiler/linter/hosted upload and has no independent model-identity attestation. Positive minimatch representatives do not prove uploader traversal/archive root, report contents or actual delivery. Expected multi-path archive layout is corpus/<date>/SUMMARY.md plus playtests/<run>-report/REPORT.md; verify the actual first new artifact. Old43 medium details remain unrecovered. The independent integrated source and bounded capture-evidence review passed and is retained in [work111 review 0](../111_resource-chip-capture/reviews/0_integration.md). Root combined gate/reviews passed and sourceaaf59f33 is merged/pushed; actual hosted delivery is accepted on corpus36912947148; combined CI and cleanup remain pending.

**First integrated gate — 2026-10-01.** Root's native full verify exited1 after225.035s:4,377 unit tests passed,1 failed and3 skipped (566 passed files,1 failed,1 skipped). The sole failure was the defect-register12-closed cap after recording the shipped LF repair; its diagnostic selected the closed Siege Onager block for a verbatim rollover and left two older entries PINNED. Later && stages did not run. All2,966 frozen input rows were unchanged; Job cleanupProof=true with0 leftovers. First-gate evidence remains under ignored full-verify/attempt-01/. The bounded rollover and report publication are prepared, not yet accepted by affected indexed checks or focused re-review. A fresh full gate, main/push, affected hosted CI and first summary-plus-report artifact delivery remain pending.

**Published/local acceptance (2026-10-01).** Source aaf59f33e74da2b5113697c71b48d57f2bffecf4 is committed, FF merged and pushed to main/origin, with all original reviewed inputs recoverable there. Root full verify2 passed all six stages, native0 in864.765s:4,378 unit tests/567 files passed with3 tests/1 file skipped;236 browser cases passed and2 skipped of238. All2,972 frozen rows (including376 core and320 voxel inputs) remained unchanged. Job cleanup reported0 leftovers, port4291 free and locks absent. Independent full/focused reviews PASS; [work111 review1](../111_resource-chip-capture/reviews/1_integration.md) retains the complete24,248-byte focused report. Post-publication127 indexed documentation checks passed native0 in3.51s. Corpus36912947148 is SUCCESS and its actual summary-plus-both-report artifact delivery is accepted. CI36912947277 is terminal RED solely on the existing600-tick replay comparison timing out30000ms on Windows (4376PASS/1FAIL/4SKIP,1812.00s). Linux passes4377/4SKIP; all four browser shards pass235/3SKIP of238, including resource1920 at21.9s within unchanged30s. Combined acceptance/cleanup stay OPEN; work112 fifth candidate is rejected after whole-case Node20/24 cost regressions of89.5%/104.9%; the five-route budget is exhausted and further repair needs explicit human extension. First gate1 remains historical RED225.035s, sole rollover failure, with later && stages not run. Local acceptance does not establish a hosted-timeout fix, actual artifact delivery, elapsed/CPU/cost improvement, whole-game replay or full DE parity. M7's human-extension hold,26 absent civilizations/17 missing unique-unit identities/technology backlog and21 engine asks remain OPEN.

**Actual hosted delivery accepted — 2026-10-01.** Root downloaded artifact11187123603 from SUCCESS corpus36912947148 at sourceaaf59f33:2,666-byte ZIP, SHA256d255e0fe5948aff27b136c424e1411e60f44ed883a9a5c1b6887672c1e512219. Root read every ZIP member and checked current configured runs:exactly corpus/2026-10-01/SUMMARY.md plus the boot-map-both-owners and default-seed-smoke REPORT.md files, no excluded payloads. Summary and reports agree at0high/43medium/18low; both runs executed20,001 ticks under their20,100 cap. Medium detections name no-pinned-or-oscillating-units and low detections no-perf-regression. Current43 medium instances are visible oracle detections, not confirmed gameplay defects; the older lost43 details remain unrecovered. Primary ignored artifact-acceptance.json (1,749 bytes, SHA256e9bf3c0246d7135c562866476192868ad462dc27bd24d318ae0f222165a6b918) records root's actual inspection, not a new probe by this document worker. Status remains active until combined CI and cleanup acceptance; no bundle/replay/full-parity or speed claim.
