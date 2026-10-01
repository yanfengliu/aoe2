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
- [ ] Root final integrated gate, main/push and new hosted acceptance complete.
- [ ] Inspect the first new hosted artifact for summary/every generated REPORT.md and absence of excluded payloads.

## Implementation steps

- [x] Allocate ID 110 with the common fleet allocator and create the private worktree through the maintained controller.
- [x] Write the contract test first and observe a native failure on the original workflow.
- [x] Add the report path and rerun the identical short test successfully.
- [ ] Root integrates after final combined verification and retires the worktree.

## Outcome

Source review accepted; prepared in root integration on published06efe6c0, uncommitted. Command: node node_modules/vitest/vitest.mjs run tests/scripts/corpusArtifacts.test.ts --maxWorkers=1 --minWorkers=1. Original workflow: exit 1, 1 failed test, missing arabia REPORT.md, 255 ms. Fixed workflow: exit 0, 1 passed test, 217 ms. Test and fixture paths stayed unchanged between runs. A prior sandbox invocation failed before collecting tests because esbuild could not read ancestor directories; both native proof runs used supported escalation. Bound: static workflow selection over representative filenames, not GitHub artifact delivery, report contents, oracle correctness or recovery of historical lost findings. No browser, server, simulation, corpus, World or full gate was run by this worker. Root must verify hosted delivery on the first new run.

**Current integration and bound.** Root copied the two unchanged executable inputs reviewed from0d290ab5 into resource-chip-capture-1001 beside work111's two screenshot-test paths. The full independent source report remains root-retained at primary ignored tmp/corpus-evidence-review-1001/review.md, SHA256a615ab9525f7278fae2256e1b0ece10586cc9c2f83c8dabfdca14e75de95c5bf; the complete authored report is now retained in [review 0](reviews/0_implementation.md), with its exact original plan and target manifest under snapshots/. Its reviewer executed no runtime/compiler/linter/hosted upload and has no independent model-identity attestation. Positive minimatch representatives do not prove uploader traversal/archive root, report contents or actual delivery. Expected multi-path archive layout is corpus/<date>/SUMMARY.md plus playtests/<run>-report/REPORT.md; verify the actual first new artifact. Old43 medium details remain unrecovered. The independent integrated source and bounded capture-evidence review passed and is retained in [work111 review 0](../111_resource-chip-capture/reviews/0_integration.md). Root combined gate/main/push/new hosted delivery remain pending.

**First integrated gate — 2026-10-01.** Root's native full verify exited1 after225.035s:4,377 unit tests passed,1 failed and3 skipped (566 passed files,1 failed,1 skipped). The sole failure was the defect-register12-closed cap after recording the shipped LF repair; its diagnostic selected the closed Siege Onager block for a verbatim rollover and left two older entries PINNED. Later && stages did not run. All2,966 frozen input rows were unchanged; Job cleanupProof=true with0 leftovers. First-gate evidence remains under ignored full-verify/attempt-01/. The bounded rollover and report publication are prepared, not yet accepted by affected indexed checks or focused re-review. A fresh full gate, main/push, affected hosted CI and first summary-plus-report artifact delivery remain pending.
