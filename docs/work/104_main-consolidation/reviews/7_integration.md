# Review 7: Windows temporary-root aliases

## Target

Main 79c11dab981208f03dbbd7cb21debdcfd2d5cdda plus the exact two-file repair. SHA256: tests/architecture/helpers/workDocsPointers.ts 4bec060e84527ffc08313706810d290bdb01f65c255be250155ceedd6bfa16f4; tests/architecture/workDocsTraversal.test.ts 26cdc0ed61738683cb19e041c7a322c117af514733b6b1ec77516226e10dbc14. The binary diff against that base has SHA256 665e4844ae7d2ff2b8ba21ef1a554340108776fe49077423a86160e6a3c35a9a. These bytes are uncommitted at this review; root retains the working patch until its committed target is recoverable.

## Reviewers and coverage

Independent /root/integrated_review, Astra/xhigh, read-only. Inspected both complete files, their exact delta and the existing canonical-root caller in workDocsIntegration.test.ts. No gate, browser, server or CLI transport ran in this review.

## Reports

The helper now canonicalizes an existing root once, matching its existing destination canonicalization. It does not lowercase or otherwise normalize descendant names. Missing targets, wrong descendant case, traversal mismatches and destinations resolving outside the root still fail. All ten roots, text extensions, exclusions, four independent floors and the explicit retained-owner boundary remain intact.

The two new controls prove a real junction/symlink has a different lexical root and the same canonical target. Both policy modes require a clean valid result and equal pointer populations before independently rejecting wrong filename case, wrong directory case and a missing destination. Cleanup checks owned link identity, removes aliases nonrecursively and then removes owned fixture roots. Ordinary assertion failures reach afterEach; no normal-path resource leak was found.

## Findings and disposition

F7: hosted Windows CI 36678434022 falsely rejected valid temporary-tree destinations in two traversal controls. The unresolved fixture root was compared with canonical destinations. Owner accepts the bounded root repair and equivalent alias regression controls. The failed log does not reveal the actual hosted root spelling; attribution to a particular Windows short-name alias remains inferred until remote verification. No actionable finding in the reviewed delta.

## Verification

Worker reproduced two new alias failures with the original helper while all 29 original controls passed. The repaired run passed all 31 traversal controls and the repository live-pointer check; three unrelated integration cases were intentionally filtered. ESLint and git diff --check passed. The reviewer inspected these reports but did not independently execute them. Worker found no remaining owned aliases or test processes and left unrelated processes untouched.

An earlier complete integration companion run also detected thirteen old untracked raw stderr logs under the retired April review directories in the primary checkout. Root moved all thirteen, totaling 2110237 bytes, to ignored recovery storage and verified every file digest; no authored review or historical import changed. The complete companion check must be repeated against this corrected primary population.

## Round outcome

Accept the exact repair with no open review finding. Consolidation's product tree, branch ancestry, main-only state and worktree retirement are preserved. Root will verify this repair together with assignment 105's prepared cleanup in one coherent final gate, push the resulting main revision and follow fresh remote gates. The failed hosted run is retained; it is not replaced by a same-revision rerun.

## Later primary-population check

2026-09-30: the first companion recheck after moving the thirteen logs still failed because seven empty raw directories remained. Root removed only those seven verified empty directories nonrecursively, within the retired April objective; no authored file or reparse target was deleted. The complete workDocsIntegration companion then passed all four cases on the primary checkout. This corrects the pending companion result above, while the combined full gate and fresh hosted Windows verification remain pending.
