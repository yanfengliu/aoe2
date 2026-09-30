# Review 4: notification ordering

## Target

Main 79c11dab981208f03dbbd7cb21debdcfd2d5cdda plus the 72-path APP-F6 repair. Patch SHA256 fc82c1bbf3108112a151e3d6c70aa36b79cab1a65df6476c2a7b39c740bca2cb. The exact uncommitted target and eleven new-file copies are retained under ignored tmp/worktree-cleanup-20260929/review-targets/105_round4. Later document-format and index preparation fixes do not replace this reviewed target.

## Reviewers and coverage

Independent /root/cleanup_final_app_review, Astra/xhigh, read-only focused re-review. Verified every target state and unchanged dependency hashes, then inspected both private openReplayAt callers, successful/failing playback notifications, real-controller TimelinePanel tests and valid red controls. Only four declared worker paths and two root records differ from review 3. Earlier accepted ordinary ownership and non-app scopes carry forward within their documented limits. No reviewer tests, gates, CLI, browser/server sessions or writes.

## Reports

APP-F6 resolved: immediate scrub emits once after the committed tick, paused state, canceled frame and reset clock are visible. Failed replacement throws before those changes or notification. Coalesced scrub retains separate preview and commit notifications. Four controller controls check callback-time state, failure frame/interpolation retention, successful retry and resumed timing. Six real-panel controls cover step buttons, marker/hotspot pins and Home/End, with text, accessible label, tick and end-of-range disablement; range controls cover the coalesced path. Existing assertions and timeouts remain. The draft red log's teardown error is excluded; APP-F6-red-valid.log supplies ten intended failures and nineteen passing controls, while the affected run passes 69/69.

## Findings and disposition

No new material source finding in the focused re-review. The following full-gate failures still prevent final acceptance.

G4-A: checkoutLineEndings cannot parse absent working files still present in the index. Root staged only the reviewed devlog rename and excluded capture deletion so the gate reads the intended final population. No parser, assertion or floor changed.

G4-B: root's review 3 used different section headings and omitted the required Reports section. Root corrected the headings to the existing six-section review contract without changing the substantive report. The complete workDocsIntegration and checkoutLineEndings checks now pass all nine cases.

G4-C: replayModeChanges' successful second-recording case still requires the former replay-to-live-to-replay publication. The accepted atomic replacement directly commits the new replay once, while a failed candidate retains the outgoing replay. Root delegates an explicit contract adaptation that strengthens callback-world identity, exactly-once replacement/disposal and failed-candidate silence; the within-recording silence assertions remain. This is pending at this round and must receive valid old-protocol red evidence and focused independent acceptance.

## Verification

The primary full gate exited 1: 4263 unit checks passed, three failed and three skipped, across 557 files. Content validation passed; the chained typecheck, browser, lint and build stages did not run. Its wrapper reported zero owned leftovers. This full-gate failure is preserved as verify-red-protocol-and-records evidence, distinct from review 3's intentional abort. No full gate is green at this target.

Root's affected preparation recheck passed 9/9 after the heading/index fixes. The reviewer did not run these checks. DOM evidence and dependency-source reasoning retain the earlier pixel/device-recovery limits; hosted Windows confirmation remains pending.

## Round outcome

Accept APP-F6 with no open focused source finding. Finish G4-C's explicit contract adaptation, recheck the complete affected replay surface and final record/index preparation, then review a new exact target and run the complete combined gate before commit/push.
