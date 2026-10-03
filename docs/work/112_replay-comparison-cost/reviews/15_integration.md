# Review 15: integration

## Target

Game hosted CI36985134043 at fad2b74eec40cf1ea6ed3ef9bed167040f1d7476 compared with CI36936991772 at4c6c9e168b8aad29c5a584692f366a2e73906611. This round inspects actual hosted failure evidence; it approves no runtime comparison or product fix.

## Reviewers and coverage

/root/ci_latest_failures independently read job metadata, nonempty REST logs and bounded unchanged tracked inputs. Root supplied current engine and corpus observations, explicitly separated in the report. No runtime, CI rerun, source/prompt export or historical engine-byte identity was established.

## Reports

### /root/ci_latest_failures

# Latest game CI failures — read-only investigation

Authored 2026-10-02 for the root integration owner. This is a bounded read-only investigation of game CI [36985134043](https://github.com/yanfengliu/aoe2/actions/runs/36985134043), attempt 1, run number 522, at `fad2b74eec40cf1ea6ed3ef9bed167040f1d7476`, compared with [36936991772](https://github.com/yanfengliu/aoe2/actions/runs/36936991772) at `4c6c9e168b8aad29c5a584692f366a2e73906611`. No runtime tests, reruns, code changes, Git mutations, source/prompt exports, engine edits, or cleanup were performed. The root owns route 7 and its pending full Node 20/24 pair; this investigation does not extend that budget or the M7 repair hold.

## Verdict

The latest run is FAILURE. Windows repeats the same 700-tick lifecycle test timeout seen on the prior run. Browser shard 4 adds a 30-second timeout in the 1920px resource-chip layout case. Linux and browser shards 1–3 succeed. Neither failed log reports a semantic assertion failure. This establishes two hosted timeout failures, not their underlying cause and not a proven engine or product regression.

The game revision delta is documentation only: `git diff --stat 4c6c9e1 fad2b74e` reports 16 documentation files, 1,482 insertions and 4 deletions. A scoped diff of package manifests, Vitest/Playwright configuration, the two resource replay tests, the resource browser spec, duration reporter and voxel pin is empty. That narrows the interpretation but does not freeze the mutable engine release asset, host load or other external inputs.

## Native latest status and timings

| Job | Native status | Start → completion UTC | Evidence |
| --- | --- | --- | --- |
| Linux unit/type/lint/build `110768322664` | completed / success | 08:37:57 → 08:52:10 | `latest-jobs-rest.json` |
| Browser shard 1 `110768322989` | completed / success | 08:37:57 → 08:47:49 | `latest-jobs-rest.json` |
| Browser shard 2 `110768322932` | completed / success | 08:37:58 → 08:52:24 | `latest-jobs-rest.json` |
| Browser shard 3 `110768323020` | completed / success | 08:37:56 → 08:47:42 | `latest-jobs-rest.json` |
| Browser shard 4 `110768322927` | completed / failure | 08:37:58 → 08:54:46 | `latest-jobs-rest.json`, `latest-browser4.log` |
| Windows unit/type/lint/build `110768322991` | completed / failure | 08:37:56 → 09:10:34 | `latest-jobs-rest.json`, `latest-windows.log` |

Windows fails step 14, **Vitest unit suite**, with native process exit 1 (`latest-windows.log:1131`). Typecheck, lint, content and build passed; the following headroom check was skipped. The sole failing case is `tests/replay/resourceWorkerOccupationLifecycle.test.ts:20:1`, **keeps full modern and legacy state identical through real wood gathering, full carry and deposit**. The native Vitest line reports **32,505 ms for the case**, **32,507 ms for its one-test file**, and **Test timed out in 30000ms** (`:729–732`, `:1106–1109`). The suite reports **4,376 passed / 1 failed / 4 skipped**, **566 files passed / 1 failed / 1 skipped**, and **1,832.46 seconds** wall duration (`:1120–1123`). Its aggregate test time is 3,187.31 seconds; this is not wall time.

The separate eight-case `tests/replay/resourceWorkerOccupation.test.ts` file passes at **32,526 ms** (`latest-windows.log:488`). A file total above 30 seconds is not a per-case timeout. Its bound remains the separate 600-tick comparison population; the lifecycle source still requires 700 real ticks per world, full non-cosmetic native equality at every tick, and gather/full-carry/deposit observations. Neither population nor the native-120 instrument bound was changed by this investigation.

Browser shard 4 fails step 13, **Browser suite**, with native process exit 1 (`latest-browser4.log:629`). It runs Chromium, **59 tests using one worker**, shard 4 of 4 (`:515`). The sole failing case is `tests/browser/resource-workers.spec.ts:113:3`, **large resource readouts stay inside fixed chips at 1920px**; Playwright reports **Test timeout of 30000ms exceeded** (`:545–550`). Summary: **57 passed / 1 failed / 1 skipped**, **15.2 minutes** (`:617–620`). No retry or flaky verdict appears in the log. The failed case's exact native elapsed milliseconds are not printed. The 38.929-second interval between its progress line and failure-detail line is a log envelope and must not be called its native case duration. The duration reporter expressly measures only passed tests.

The closest passing browser cases include resource-chip readouts at 1280px **23.7s**, at 800px **18.3s**, and selection-panel height at 1920×1080 **28.3s**, each against its own 30-second timeout (`latest-browser4.log:622–628`). These are observations, not a stable scaling model.

## Prior run comparison

Prior Windows job `110619454097` also fails only the lifecycle case, at **32,738 ms case / 32,740 ms file / 30,000 ms timeout** (`prior-windows.log:727–730`). It reports the same **4,376 passed / 1 failed / 4 skipped** population and native process exit 1, with **1,857.54s** wall duration (`:1112–1130`). The separate eight-case 600-tick comparison file passes at **33,527 ms** (`:486`). Latest lifecycle time is 233ms lower; latest eight-case file time is 1,001ms lower. Those single-run deltas do not prove performance improvement.

Prior browser shard 4 job `110619454323` succeeds: **58 passed / 1 skipped**, **13.6 minutes** (`prior-browser4.log:598–599`). The 1920px resource-chip case is the report's slowest passing case at **32.6s**, printed as **109% of its own 30s timeout** (`:601–604`). Playwright's native status is PASS even though this reported elapsed duration exceeds the timeout; it must remain PASS in the record. The reporter uses `TestResult.duration`, and the prior progress-line interval also includes transition overhead. The pair demonstrates pass/timeout sensitivity under the observed hosted conditions, but does not prove a particular flaky mechanism or isolate the time spent in setup, screenshot capture, hover or assertion work.

Prior Linux and all four browser shards succeed (`prior-jobs-rest.json`). The prior corpus-green conclusion is supplied by the root assignment; this worker did not independently refetch its corpus run and does not upgrade that supplied conclusion into fresh verification.

## Runner and dependency identity bounds

Both Windows jobs report runner **2.337.0**, provisioner **20260901.588**, **Windows Server 2025 10.0.26100 Datacenter**, image **windows-2025-vs2026 20260925.250.1**, Node **20.20.2**, npm **10.8.2**. Latest runs in Azure **eastus2**, prior in **westus3**, on different worker IDs. Both browser shard 4 jobs report runner **2.337.0**, the same provisioner, **Ubuntu 24.04.5 LTS**, image **ubuntu-24.04 20260927.320.1**, Node **20.20.2**, npm **10.8.2**, and restored Playwright cache key **playwright-Linux-1.59.1**. Latest browser region is **westus2**, prior **eastus2**. Matching image versions do not prove equal machine load. The log does not expose a Chromium executable digest.

The voxel pin is unchanged at **`08398b573ad54bcb5c764ad0c2ef3cedc3cce33f`**. The logs fetch source from the archive URL parameterized by that pin. Both runs fetch the engine through **`https://github.com/yanfengliu/civ-engine/releases/download/engine-dist/civ-engine.tgz`**. They do not print the engine commit, package version, archive digest or release-asset ID. Therefore exact historical engine identity is UNKNOWN from these logs. The same mutable URL does not establish the same bytes.

Separately, the root reports current accepted engine 2.6.1 CI **37088530675** at **`4829784`**, release asset **606946549**, updated **2026-10-03T02:05:59Z**, archive SHA-256 **`c81205daa28852a3dbec2cddac7f43f90f778c105057f2dcfd4ae2c36b4c922c`**, with four actual JS bytes matching its native proof. This asset postdates the game's 2026-10-02T08:37Z CI and is not assigned retroactively to that run. The root also directly observed local primary engine and game `node_modules/civ-engine/dist/version.js` still reporting **2.5.0** while the tracked package reports **2.6.1**, with no shared dist mutation. This is a separate local engine-adoption/source-runtime drift bound, not evidence of either CI failure's cause. These current-engine observations are root-owned and were not repeated by this worker.

## Retained browser evidence and smallest next step

The failed browser job uploads artifact **`playwright-failures-36985134043-1-shard-4`**, ID **11218100848**, size **1,552,148 bytes**, SHA-256 **`5190e453ee0fabf5e3e12ae13e9cd99ed46cf6b38165dc54e341b507297989e2`**, expiry **2026-10-09T08:54:42Z** (`latest-artifacts.json`, `latest-browser4.log:651–655`). It contains the reported `test-results/resource-workers-large-res-03339-nside-fixed-chips-at-1920px-chromium/trace.zip` and `error-context.md` paths. The archive was not downloaded or inspected here, preserving this assignment's no-export boundary. [Retained artifact](https://github.com/yanfengliu/aoe2/actions/runs/36985134043/artifacts/11218100848).

The smallest useful browser follow-up is a separately assigned read-only inspection of that one retained trace to identify the interrupted operation and its action timings. Budget: one 1.55MB CI artifact, no runtime tests or GUI, no provider source/prompt export. This is cheaper and more discriminating than rerunning the full shard. If runtime reproduction is subsequently authorized, use one headless 1920px resource-chip case on pinned game/engine/browser inputs at the unchanged native 30s timeout; budget it explicitly as a focused reproduction before authorizing any candidate fix. The present evidence supports no specific implementation fix. The source's three amounts, four hover checks per amount and four clipped screenshots are workload candidates to measure, not a proved cause and not permission to weaken coverage or raise the timeout.

For Windows, retain this exact repeated failure as input to the root-owned route 7 decision. No extra runtime attempt is justified by this investigation alone. Required budget remains the separately granted full Node 20/24 pair through the real default test entry point, with 600/700/native-120 and timeout contracts unchanged. This worker neither ran nor bypassed it. M7 repair remains held; a browser repair requires a separate approved bounded assignment after the trace result.

## Acquisition validity and evidence digests

Session-start `npm run ci:status` exited 1 with `UNKNOWN — could not resolve the commit to report on`. Sandbox Git reports dubious ownership (repo SID suffix 1001, process suffix 1004); subsequent read-only Git commands used invocation-local `-c safe.directory=...` and did not alter configuration. Default network access failed; explicitly allowed read-only `gh` calls used escalation. `gh run view --job --log` returned native 0 but wrote zero-byte files, so it did not supply evidence. Direct read-only `gh api repos/yanfengliu/aoe2/actions/jobs/<id>/logs` calls returned native 0 and produced the nonempty logs below; those replaced the empty outputs. Native REST `/jobs` timestamps are authoritative here: the earlier `gh run view --json jobs` rendering incorrectly repeated 08:47:42 for every latest job's completion time.

All files below are retained only under the ignored primary directory `C:/Users/38909/Documents/github/aoe2/tmp/ci-latest-failures-1002/`. No worktree was created for these CI log and bounded tracked-file reads. No browser, GUI, server or runtime process was launched. No task-owned cleanup was performed, as assigned. The report is intended for full-body promotion by the root's records owner.

| File | Bytes when recorded | SHA-256 |
| --- | ---: | --- |
| `latest-windows.log` | 143495 | `d84acb6f31f48fc4b38ee3ba28b75f1667a3064fad3744749bdb0ec75c50be67` |
| `latest-browser4.log` | 63845 | `68da76106abcb91f3fd771059d57da6c3b20f5358af651794e1480370a7ea176` |
| `prior-windows.log` | 143389 | `e9f0dbc30b0578f610afeb0bb4505d442ef669899b27fdea28a7bffdd67f2ed5` |
| `prior-browser4.log` | 60891 | `412c268e7d8701b7a8fd6631bfc2867eb74e4fbc349e46202059133122386621` |
| `prior-run.json` | not separately measured | `b24a63527d1c8ddcacafeae1ef5eb31fee79f87a66824ed61d7424ca06ed2c3b` |
| `latest-run-rest.json` | not separately measured | `f0ec33c772ce091f2ab1eb5dea02d0fa1de45945bee63a2ec0e32b7246c9967d` |
| `latest-jobs-rest.json` | not separately measured | `7a72d32c81f45828eb7b289ace4fef6dbcb9d5071cda702bde2b779fb6356594` |
| `prior-jobs-rest.json` | not separately measured | `475dbf89bfac8410596f8258b972b3b59a63ad627e72258a7b97c77585a79bce` |
| `latest-artifacts.json` | not separately measured | `be30a5c3319f6ce77d45eb10d67ac00dc4911ea8f21c7345961cf6e7fb6f5833` |

Authored body preserved in full: SHA256b6563cadb2ea87f8d54a27b3acd55b65a78aef765898e2f9f9075a025d354dd1,12726bytes. Original historical and acquisition bounds remain unchanged.

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| CI-15-A | Windows repeats the700 lifecycle timeout; browser1920 times out separately. | Accepted native failures; no semantic assertion or underlying cause proved. | Keep existing route7 budget and M7 hold; one offline browser trace inspection is the proposed bounded next step. |
| CI-15-B | Historical engine artifact bytes are unknown; current local runtime remains2.5.0 despite shipped2.6.1. | Accepted separate provenance/adoption bounds, not a CI cause. | Root-owned engine-dist adoption and honest dependency binding before runtime comparison. |

## Verification

Nonempty readonly REST logs and current-state source comparisons, with exact native counts/timings and digests in the complete report. Native0/empty gh log outputs are rejected as evidence. No new test, gate, runtime repair, browser trace download or timeout change occurred in this round.

## Round outcome

Evidence accepted; Windows and browser timeouts remain open. No controlled full-pair extension, provider export, M7 repair or full-parity closure is granted.
