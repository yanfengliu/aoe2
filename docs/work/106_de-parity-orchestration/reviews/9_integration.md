# Review 9: provisional occupation CI-cost integration acceptance

## Target

Initial reviewed tree `407af4aa36b5a86f2bb853ab051f098e6a0ff2a5`, now recoverable in unmerged candidate commit `846652ab659bc82b1f5d588a1cef8c74470a55bb`, parent/main `c4024020a09c99f74728f2a880a86fbcbaef8e48`. Workspace: `C:/Users/38909/Documents/github/aoe2-worktrees/parity-integration-0930`. All 33 initial integration inputs can be recovered with `git show 846652ab:<path>`; no duplicate old-input snapshots are added. This current publication and the two later P3 text fixes are a separate documentation supplement.

## Reviewers and coverage

Independent `/root/occupation_source_acceptance` reviewed the exact initial 33 Git blobs against index/worktree with zero mismatches. It reused the accepted four-source/control verdict by exact hash, independently checked the metadata-only engine-lock delta, canonical ownership/status, registry allocations, report retention and JSON representation. It ran no test, validator, profile, install, build, browser, server or child agent. The initial report preceded the actual gate result and explicitly reserves final acceptance for a focused supplement review.

## Reports

The complete 10,880-byte original authored report is preserved exactly in [independent-integration-original.md](../snapshots/09_occupation-integration-acceptance/independent-integration-original.md), SHA-256 `4253d28ca9b026ffb4c858e579cdc3a33fe9b624cfecf05c9c42c251e95671c8`. Its 15,264-byte LF [inspected-inputs.json.txt](../snapshots/09_occupation-integration-acceptance/inspected-inputs.json.txt), SHA-256 `e25858dc241fc295c673c38455aab9b0b182a7704f44ffc797a3069469535d08`, retains exact authored source-binding data; only the filename suffix changes. Both are below 256 KiB. Raw full-gate logs remain ignored.

Original report paths describe the initial integrated tree, not this later status supplement. Earlier reports, wrappers and snapshots remain byte-exact, including the then-pending gate wording. Current report navigation lives here; the reviewed 33 inputs are immutable candidate blobs. [Review 8](8_implementation.md) remains source-only acceptance rather than integrated/hosted acceptance.

## Findings and disposition

Initial verdict: accepted frozen source/evidence, no blocking code finding, with two P3 current-document corrections. INT-R1 now says the other 21 original feedback rows remain pending, preserving separate E16/E22 dispositions. INT-R2 now calls the exact rejected-helper snapshot a 73-line input; its original report/wrapper and historical lines45–69 citation remain unchanged. Root's `tmp/parity-106/ci-repair-1001-verify1/review-doc-fixes.json` proves only those two literal replacements. Both current fixes are preserved in this publication; focused final acceptance remains pending.

Scope remains test-only plus linked-engine lock version metadata2.4.2→2.5.0. No game version, model, gameplay, format/schema, product source or new dependency changes. Original600/native120/separate700 bounds and negative-control/DID NOT RUN histories remain explicit. Work108 consumer implementation remains paused, with its original acceptance criteria unchecked.

## Verification

Root's direct full `npm run verify` is ACTUAL exit0 on the exact reviewed tree407af4a/candidate846652ab: 876.201 seconds, Node24.12.0, engine runtime/package/linked lock2.5.0. Content validation, unit tests, typecheck, pre-browser build, browser, lint and final build all passed. Unit564 files passed/one skipped,4,340 tests passed/three existing skips; browser236 passed/two existing annotated skips in10.1 minutes. Retained unit skips are selectionActivity.other, mapSizeLadder and claudeCodeProvider integration. This publication reports root execution and verifies its artifacts; the reviewer did not execute or yet accept that result.

Exact ignored gate-result SHA-256 `8d7134b323e599edfdf7b9f0b425fcbed0b55e46a221b70508673e590dc9a77c`, stdout `c610a3b51cf58de017456b8e0749b9dfbad505a417267ecca4a48e8fb3ea50b1`, stderr `302164062e989dbb334d9431f008017b678b8f13799f0212007bcdbc5636d926` are independently matched by this docs lane. Result rootPID47400, assignment-before-release, membership query, job close and cleanup proof all succeed, with zero leftovers; root reports gate lock released and exclusive port4282 bind proved. No visual product change requires new visual evidence here.

This docs lane runs only the existing standalone authored-doc validator and scoped source/protected-hash checks. It runs no runtime gate, tests, build, audit, browser or commit. The full-gate pass applies to tree407; these subsequent documentation changes and the two fixes await focused acceptance.

## Round outcome

Provisional integration source/document verdict and root-observed local full-gate success are recorded; final acceptance of this supplement and the two P3 fixes is pending. Candidate846 remains unmerged/unpushed; main remainsc402. Original hosted CI36815167314 remains RED and corpus36815167289 SUCCESS. New hosted CI/corpus and all seven engine-fetch jobs have not established closure. Root owns final focused review, main merge/push and hosted acceptance. Work108 stays paused until the shipping blocker is accepted; M7, CL-4 and full DE parity remain OPEN.
