# Review 2: first prepared cleanup

## Target

Main 79c11dab981208f03dbbd7cb21debdcfd2d5cdda plus the prepared 56-path cleanup and Windows root-alias repair. The exact patch has SHA256 07aaa1323ef880a29fc0ab7541b82360a5770f8a48448fe386f2bae76becca1a. Its file-digest manifest, patch and three new-file copies are byte-verified and retained under ignored tmp/worktree-cleanup-20260929/review-targets/105_round2. Later repairs are a new target and do not replace this report.

## Reviewers and coverage

Independent /root/integrated_review and /root/repo_app_review, both Astra/xhigh, read-only. The general reviewer verified all 56 target digests and inspected the complete patch, source consumers, canonical documents, historical-text preservation and recovery ledgers. The app reviewer verified its 19 scoped file digests and inspected the actual app/view/presentation ownership paths as well as recording, replay and their new tests. Neither reviewer ran tests, gates, browsers, servers or CLI transports. External Claude review remains unavailable after automatic approval review rejected the private source submission; independent Codex reviews were used without bypassing that decision.

## Reports

The general reviewer supports the bounded simulation and tooling cleanup. Active commands, persistence shapes, Careening effects, building sight and traffic fixtures remain intact. The exact-case pointer gate keeps its ten roots, four floors, negative controls and retained-owner boundary. Deleted isometric tests exclusively covered deleted unused helpers; the orphan capture spec was excluded from normal Playwright discovery and has a maintained replacement. Archived defect entries preserve the original text apart from section separators, the renamed devlog preserves its existing prefix, and all thirteen relocated raw logs match their recorded digests. Historical imports are untouched. The lockfile changes only its two version fields. The canary report correctly distinguishes an applicable mutant from sensitivity that its failing baseline cannot establish.

The app reviewer supports APP-C1 through APP-C6. Simulation display time is still forwarded after the unused wall-time argument is removed. Direct replay replacement remains compatible with the inspected audio, timeline, markers, hotkeys and HUD callbacks. The new public recovery contract describes the intended behavior, but the following implementation gaps prevent acceptance.

GEN-1 (P2): spec-final.md's current free-technology paragraph still promises retired Aztec Loom and Malian gold-mining upgrades, omits current bonuses, and describes the Ethiopian bonus too broadly. civilizations.csv and the v0.3.144/v0.3.146 changelog establish the current list. The test header's twelve-civilization count is also stale. Correct the paragraph and header from those existing inputs; no game-rule change is required.

APP-F4 (P2): createApp publishes its incoming bridge before view.setBridge succeeds, both in the replay replacement callback and the live-load callback. The actual view then changes its bridge, controls, camera, selection and presentation before rendering admission. A later renderer error leaves the app/view pointing at the disposed incoming bridge while ReplayController retains the outgoing bridge. The new controller tests use a replacement double that throws before assignment, so they cannot detect this boundary. Reproduce a rejected presentation through the actual app/view path, retain outgoing presentation and controls as well as replay state, and prove successful ownership transfer and failed incoming disposal.

APP-F5 (P2): lazy prior-session operations can begin IndexedDBMirror.open outside RecordingService's lifecycle queue while recording is stopped. Concurrent stop sees no installed database and closes nothing; a delayed open callback subsequently installs a connection after stop resolves. Reproduce delayed opening followed by stop and completion. The read must settle, stop must release the resulting connection and timer, and restart must remain usable.

## Findings and disposition

Owner accepts GEN-1, APP-F4 and APP-F5 for the serialized writer. All three remain open at this target. APP-F4 must also cover failures after runtime acceptance, ground-resource mutation and failed swaps while playing; a controller-only double or another bridge reset is insufficient. The fixed checks, disqualifiers and bounded mechanism comparison live in the plan. No sibling-engine write, dependency change, historical-doc deletion or renderer rewrite is authorized by these findings.

Earlier APP-F1 through APP-F3 have focused evidence in this prepared implementation, but acceptance of their full ownership class is deferred until the new boundary cases and final integrated review pass. SIM-1/2, APP-C1 through APP-C6 and the accepted tooling deletions need no repeated survey unless their implementation changes.

## Verification

Reviewers checked exact bytes, references and ownership control flow. Their findings are source-grounded; they did not claim independent runtime execution. Root retains focused-test reports, the invalid canary baseline and prior red/green controls as bounded evidence. The combined primary-checkout gate and fresh hosted Windows confirmation have not run for this target.

## Round outcome

Request changes for GEN-1, APP-F4 and APP-F5. Preserve this round, repair the actual boundaries, then obtain focused independent review of a newly frozen target. No full-verification or completion claim applies to this revision.
