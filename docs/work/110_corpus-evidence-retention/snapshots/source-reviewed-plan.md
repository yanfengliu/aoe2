# Retain per-run corpus oracle reports

Status: active
Owner: Corpus evidence integration owner
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
- [ ] Root final gates, independent review and main integration complete.

## Implementation steps

- [x] Allocate ID 110 with the common fleet allocator and create the private worktree through the maintained controller.
- [x] Write the contract test first and observe a native failure on the original workflow.
- [x] Add the report path and rerun the identical short test successfully.
- [ ] Root integrates after final combined verification and retires the worktree.

## Outcome

Ready for independent review, uncommitted. Command: node node_modules/vitest/vitest.mjs run tests/scripts/corpusArtifacts.test.ts --maxWorkers=1 --minWorkers=1. Original workflow: exit 1, 1 failed test, missing arabia REPORT.md, 255 ms. Fixed workflow: exit 0, 1 passed test, 217 ms. Test and fixture paths stayed unchanged between runs. A prior sandbox invocation failed before collecting tests because esbuild could not read ancestor directories; both native proof runs used supported escalation. Bound: static workflow selection over representative filenames, not GitHub artifact delivery, report contents, oracle correctness or recovery of historical lost findings. No browser, server, simulation, corpus, World or full gate was run by this worker. Root must verify hosted delivery on the first new run.
