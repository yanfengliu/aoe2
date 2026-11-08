# Review 0: implementation

## Target

Frozen tree8ed3c8f6e2ebf642e6f4a90c5baeedb1b3c3b67c against base41740d58ef3fb0a5ffa4346dc95666684287382c.

## Reviewers and coverage

Independent in-session gpt-6-astra/xhigh. Read-only exact candidate, supply-chain boundary, CI, preserved mock runtime and reporter/receipt compatibility. External CLI source export was rejected earlier in the parent task and was not retried; no external CLI report is claimed.

## Reports

### gpt-6-astra / xhigh

One material finding in frozen staged tree `8ed3c8f6e2ebf642e6f4a90c5baeedb1b3c3b67c` against base `41740d58ef3fb0a5ffa4346dc95666684287382c`. Read-only Git comparisons confirmed the index and working files matched that tree.

**A1 [P2] — The engine-check CLI can silently skip verification through a junction.** `scripts/check-engine.mjs:50` compares the supplied script path with `import.meta.url`. Through a junction or symlink, Node resolves the module URL to its real location while the supplied path retains the alias, so the condition is false and the command exits successfully without checking the installation. Differently cased Windows paths have the same risk.

This repeats the failure class documented in unchanged `scripts/run-directly.mjs:4`. It also matches the existing forbidden-guard census at `tests/scripts/runDirectly.test.ts:60`, so the frozen candidate should fail that test. Use `runDirectly(import.meta.url)` and extend the existing helper census and junction probes with an engine-check failure case. The new installation tests import and call `checkEngineInstall()` directly, so they cannot detect this CLI no-op.

Otherwise verified:

- Manifest, root lock dependency, installed lock entry, and pin agree on the retained2.9.0 URL and SHA-512 integrity. The guard checks physical installation, package resolution, compiled entry containment, and both runtime versions.
- All three consuming CI jobs install before explicitly checking the engine. Pinned voxel setup, retries, matrices, shards, and budgets remain intact.
- The five mock-file diffs change types only and preserve executable assertions. The retained emitted-token proof agrees with the inspected changes.
- Vitest retains the threads pool and50% worker cap. The installed Vitest4 declarations and implementation retain the reporter APIs and underlying task field used by `tests/helpers/vitestTestTimeReporter.ts:56`. Receipt validation still requires complete passing reports; its checks were not weakened.
- Internal-helper tripwires, browser checks, and provenance mechanisms remain present.

Bounds: no mutations, tests, gates, installations, network requests, or external reviewer CLI were run. Reporter compatibility was inspected statically; the root-owned full verify run and receipt remain required. Audits, hosted Node20/22 runs, corpus completion, and downloaded-archive provenance were not independently reproduced. The guard deliberately relies on clean npm installation for byte integrity and does not rehash installed files.

## Findings and disposition

A1 accepted. The existing full-suite census independently failed on the same new script. Repair uses the established helper and adds an actual CLI junction probe; round1 verifies the correction.

## Verification

Before the repair, the full unit stage completed with5501 passing tests,1 failure and3 skips across695 files; the one failure was the existing direct-invocation census. Later verify stages and receipt writing were not reached. Both audit gates passed (7 moderate development findings, zero production findings). The first added probe expected a missing package.json message but the concurrent file reads reported the missing pin; corrected the expectation to cover the three required configuration files, then reran a valid RED:2 failures/7 passes including the empty junction output. After the helper correction,22 focused tests passed, and the actual installed CLI reported2.9.0.

## Round outcome

Material repair required; do not treat the initial full verify as passing. Independent focused rereview follows in round1.
