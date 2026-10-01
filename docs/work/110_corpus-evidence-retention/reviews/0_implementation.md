# Review 0: corpus evidence implementation

## Target

The exact original target is the four-path uncommitted corpus-evidence-1001 tree at base 0d290ab5f3f74ab080537158c5de86a613fed800. The [retained input manifest](../snapshots/source-reviewed-inputs.json.txt) preserves its paths and SHA256 values (649 bytes, SHA256 3930fab24a83e568caf699a5ec948ee2e2c65cfdcc892222c0f1183e08a7aee8); the [reviewed plan](../snapshots/source-reviewed-plan.md) preserves the exact 2,722-byte authored input, SHA256 266bfcbc16180ec7065d1017d378221cab83f4e52e183f94cf002939269236e3. The two executable hashes equal the current integration candidate. Their eventual committed binding remains pending; ignored source patches and evidence remain retained until root supplies that binding. The original registry is reconstructible from 0d290ab5f3f74ab080537158c5de86a613fed800:docs/work/registry.json plus this exact appended allocation, with every earlier allocation unchanged: `{"id":110,"theme":"corpus-evidence-retention"}`. Static reconstruction was byte-exact against its reviewed SHA256 88b2d71bc8c7f2d738c9336afafb0633e8f29456b7dabbff58ca54c1ca32d3a4. The reviewed plan is historical; the live plan owns current progress.

## Reviewers and coverage

The independent corpus_evidence_review worker performed the bounded source review below. Astra/xhigh is an assignment fact without runtime identity attestation. No additional review, executable check or hosted check is implied by this publication.

## Reports

The complete original authored report follows unchanged: 8,315 bytes, SHA256 a615ab9525f7278fae2256e1b0ece10586cc9c2f83c8dabfdca14e75de95c5bf. Its original target/closing manifests remain ignored provenance, and the opening target manifest is retained above. Original file citations describe the reviewed historical source; no substantive text or link destination was normalized.

<!-- BEGIN exact authored corpus report -->
# Independent review: corpus evidence retention

Date: 2026-10-01. Reviewer: the independently assigned corpus_evidence_review subagent. Assignment requested the fleet Astra/xhigh pin; this tool session exposes no model identity attestation, so the pin is an assignment fact, not an independently instrumented runtime claim. No other reviewer or subagent was invoked.

## Exact target and verdict

Reviewed the uncommitted four-file change in C:/Users/38909/Documents/github/aoe2-worktrees/corpus-evidence-1001 at base 0d290ab5f3f74ab080537158c5de86a613fed800, package version 0.3.243. The four paths and their opening and closing SHA-256 values are recorded separately in target-manifest.json and closing-manifest.json. The supplied workflow and test hashes matched the bytes read. Git diff and untracked-file enumeration showed only the four assigned paths. The registry difference adds ID 110 with theme corpus-evidence-retention and changes no earlier allocation.

No material findings in the reviewed source. The workflow corrects the omitted-report selection without changing the upload condition, artifact name, permissions, runner, trigger, corpus invocation, oracle policy or thresholds. This is a source-review verdict, not acceptance of the still-pending integrated gate or hosted delivery.

## Review evidence

The complete workflow was read. Its only executable configuration change is .github/workflows/playtest.yml:64-66: convert the single path into a multiline path input containing the existing output/corpus/ and the added output/playtests/*-report/REPORT.md. The existing if: always() and actions/upload-artifact@v4 remain at lines 60-61. Nothing broadens output/playtests to full recordings or raw evidence trees.

The regression test independently parses the actual workflow with js-yaml and tests named outputs rather than deriving expected paths from the workflow itself. tests/scripts/corpusArtifacts.test.ts:24-28 requires both a summary and two distinct per-run reports. Removing the added report glob necessarily makes both report expectations false while leaving the summary selected. Lines 29-35 reject representative full bundle JSON, envelope JSON, threshold JSON, findings JSON and nested raw capture files. Broadening the upload to output/playtests/ or the whole report directory would select the prohibited representatives and fail this test. The upload count, condition and name assertions at lines 17-21 also preserve the expected existing step.

Source outside the diff was inspected to ground the filenames: scripts/playtest-corpus.mjs:61-63 creates output/corpus/<date>; line 74 creates output/playtests/<date>-<run.name>; lines 108 and 115-116 name threshold, envelope and REPORT.md paths. scripts/run-oracles.mjs:28-29 creates <input>-report and line 51 writes its REPORT.md. Thus the report glob covers the producer's current ordinary single-directory run names, including both configured corpus runs, although the test uses representative arabia/islands names rather than those configuration names.

The current positive patterns are correctly represented for the tested ordinary POSIX relative filenames: the existing corpus directory is represented by its recursive ** descendant pattern, and the added * matches one run directory before the literal REPORT.md basename. The test does not execute the uploader or verify a filesystem traversal. The minimatch helper is not a general reimplementation of GitHub Actions path semantics: ordered negative patterns, hidden files, symlinks, actual file existence, implicit directory traversal and archive-root computation are outside this review's proven selection bound. Those differences do not produce an identified mismatch for the two current positive patterns and eight ordinary representative filenames.

Type and lint compatibility was checked statically against the installed tooling, not by running a compiler or linter. tsconfig.json:13-24 enables strict checking and includes tests with Node types. The assertions give YAML and minimatch explicit types; optional path access is guarded; no unused variables or references before initialization were found. package-lock.json:2832-2835 pins the already-hoisted minimatch 3.1.5, and node_modules/minimatch/minimatch.js:1 exports the callable function used here. Existing ESLint dependencies already bring that version; no package or lockfile change is present. js-yaml is already a declared dev dependency, and tests/scripts/ciTriggers.test.ts uses the same createRequire approach. The installed @typescript-eslint/no-require-imports implementation at node_modules/@typescript-eslint/eslint-plugin/dist/rules/no-require-imports.js:87-90 exempts the local require binding created at test line 9. vitest.config.ts:40-45 includes this new test and excludes only the separate browser tests in this area.

The work plan accurately marks root gates, independent review and integration as pending. It does not claim recovery of the reports from the ended hosted runner. Its native red and green measurements are worker-reported evidence; I did not rerun them or independently inspect their capture files.

## Risks, remaining verification and limits

1. The integration owner must run the required final gate, including typecheck and lint, on the integrated revision. No runtime command, test, build, simulation, browser, CLI reviewer export or remote check was run by this reviewer. The assignment reserved expensive verification for the owner, including the normal session-start CI-status execution. During review the owner reported that the base revision's hosted CI failed checkoutLineEndings on five work-109 JSON snapshots and that this separate correction blocks shipping work 110. I did not inspect that out-of-scope failure; this review neither clears it nor authorizes integration past it.
2. The first new hosted artifact must be inspected for the summary and each generated REPORT.md and for absence of the large excluded recording files. Passing minimatch assertions cannot establish GitHub delivery, report generation, report contents, upload success, or complete retention following an earlier producer failure. The earlier sandbox startup failure was DID NOT RUN, not a test failure, and the worker's native pass does not replace this hosted check.
3. Adding paths from both output/corpus and output/playtests changes the expected upload common ancestor to output. Consequently, the expected archive layout is corpus/<date>/SUMMARY.md plus playtests/<run>-report/REPORT.md rather than the previous summary-only relative root. The existing artifact name remains unchanged. This is a layout consequence to check during hosted inspection, not an identified break in the bounded change. A focused read of scripts/ci-status.mjs found no download-path consumer. The uploader's primary source was not available locally, and network access was excluded by the assignment, so actual action traversal and archive layout remain owner/hosted verification items.
4. The helper depends on the locked, transitive hoisted minimatch API. That is compatible with this frozen installation, but a future dependency update could require revisiting the import. No dependency expansion or presently broken import was identified.
5. Historical run 36881959435's lost per-run reports are not recovered by this change. The two 20001-tick runs and 43 medium instances were assignment context, not rerun or independently reconstructed observations. This review says nothing about their oracle findings or game correctness.

## Resource and write audit

Only this authored report and two hash manifests were written, all under the primary checkout's ignored tmp/corpus-evidence-review-1001 directory. No reviewed file, source file, policy, plan, Git metadata or dependency was edited. The four closing hashes equal the opening hashes. All shell commands were bounded reads, Git inspection, or hashing and completed without persistent sessions; the local uploader-source search reported that node_modules/@actions does not exist. No task-owned browser, server, watcher or persistent process was launched. These review artifacts remain intentionally retained for the owner's permanent work-110 review record and target snapshot; the owner may clean the ignored copies after preserving them.

<!-- END exact authored corpus report -->

## Findings and disposition

No material source finding was reported. The upload selection and existing locked minimatch API have only the source/representative-name coverage stated above. First hosted delivery remains required; old 43 medium finding instances remain unrecovered. The root's subsequent integrated review is retained in [work111 review 0](../../111_resource-chip-capture/reviews/0_integration.md).

## Verification

Publication checks compare the full embedded report bytes to its original digest and retain the exact reviewed plan/manifest. Root's first full integrated verify later exited 1 after 225.035 seconds: the sole failing test was defectRegisterRollover's 13-closed/12-cap check; 566 files and 4,377 tests passed, one file and three tests were skipped, and the later && stages did not run. Its 2,966 frozen input rows were unchanged and Job cleanup reported true with zero leftovers. That failed gate does not supersede this source verdict or satisfy final acceptance. The designated closed block's rollover is prepared; root owns affected indexed checks, focused re-review and a fresh full gate. This documentation worker ran no runtime check.

## Round outcome

Retain the bounded source PASS with its exact authored reasoning. Full integrated verification, main/push, the hosted 1920px case and first actual summary-plus-report artifact acceptance remain pending. No elapsed/CPU/cost speedup, restored historical oracle details or full-game parity is established.
