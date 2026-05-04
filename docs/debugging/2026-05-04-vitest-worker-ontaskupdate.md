# Debugging session - Vitest worker `onTaskUpdate` timeout

## Symptom

`npm.cmd test` runs all Vitest files and reports `99 passed`, `727 passed`, `1 skipped`, then exits non-zero with seven unhandled errors: `[vitest-worker]: Timeout calling "onTaskUpdate"`.

Follow-up while landing the AI monk intention split: after the repo moved to the threads pool, `npm.cmd test` ran 99 files / 734 tests and failed two explicit per-test caps under full-suite contention: `createSimulationBridge.utility.test.ts` watch-tower auto-kill timed out at 15s after 15.7s, and `blacksmithProgression.test.ts` Forging timed out at 45s after 47.9s.

## Expected vs actual

- Expected: `npm.cmd test` exits 0 once all tests pass.
- Actual: assertions pass, but Vitest records worker RPC timeout errors after long simulation tests and exits 1. After the pool fix, two long deterministic simulation tests could still exceed their explicit per-test caps only under full-suite contention.

## Reproduction

- 2026-05-04 13:21 - `npm.cmd test` reproduced the failure in 292.59s. File assertions all passed; seven `onTaskUpdate` RPC errors caused the non-zero exit.
- 2026-05-04 15:27 - `npm.cmd test` reproduced the follow-up timeout failure under the threads pool: 97 files passed, 731 tests passed, 1 skipped, two tests timed out on explicit caps.
- 2026-05-04 15:34 - Isolated targeted reruns passed: watch-tower auto-kill took 10.6s against a 15s cap; Forging took 30.1s against a 45s cap. The same tests exceeded caps only under full-suite contention.

## Hypotheses

- [x] Long-running simulation files block worker event loops long enough that Vitest's parent/worker `onTaskUpdate` RPC times out under the default fork pool.
- [x] Parallel execution pressure from long CPU-bound simulation suites causes report-channel starvation; lowering worker concurrency should make the full gate deterministic. Tested `--maxWorkers=4`; ruled out as insufficient.
- [x] The failure is introduced by the current `unitCommandOps` split. Ruled out: targeted command/file-size/typecheck/lint gates pass, and the full suite reports all assertions passing before runner-level errors.
- [x] The default `forks` pool transport is the failing path; `threads` avoids the RPC timeout but needs a 30s default plus explicit caps for slower full-suite production progression tests.
- [x] Additional explicit per-test caps outside the production file can be too tight under the threads full-suite gate even when the same tests pass in isolation.

## Investigation log

- 2026-05-04 13:21 - Current code split targeted gates pass; full `npm.cmd test` still reports all test files passing before the worker RPC errors, matching pre-existing memory/context for this checkout rather than a new assertion failure.
- 2026-05-04 13:27 - `npm.cmd test -- --maxWorkers=4` reproduced the same seven post-pass `onTaskUpdate` errors, ruling out raw worker count as the only cause.
- 2026-05-04 13:32 - `npm.cmd test -- --reporter=dot` reproduced the same seven post-pass `onTaskUpdate` errors, ruling out default reporter verbosity/output volume.
- 2026-05-04 13:37 - `npm.cmd test -- --pool=threads` avoided the `onTaskUpdate` errors but slowed two `createSimulationBridge.production.test.ts` cases past their explicit 15s timeouts. This points at the fork pool transport as the runner problem.
- 2026-05-04 13:42 - `npm.cmd test -- tests/simulation/createSimulationBridge.production.test.ts --pool=threads --testTimeout=30000` passed. The same file also passed under `--pool=forks`, confirming the tests are not logically failing and need a runner-level timeout override only under the safer pool.
- 2026-05-04 13:45 - Full `npm.cmd test` with `--pool=threads --testTimeout=30000` avoided the fork-pool RPC errors but still failed two production progression cases because Vitest's per-test `it(..., timeout)` argument overrides the runner timeout. Those cases took 19.3s and 16.8s under full-suite contention.
- 2026-05-04 15:27 - Full `npm.cmd test` after adding two AI monk regressions avoided fork-pool RPC errors but timed out two more explicit caps. The watch-tower utility case hit 15.7s against a 15s cap; the Forging blacksmith case hit 47.9s against a 45s cap.
- 2026-05-04 15:34 - Targeted reruns for those exact tests passed in isolation, confirming the behavior is deterministic and the failure is contention headroom under the full-suite runner contract.

## Root cause

Vitest's default forks pool is unreliable for this repo's CPU-heavy full simulation suite on this Windows/Codex execution path. All assertions pass, but fork-pool worker-to-parent `onTaskUpdate` RPC calls can time out after 60s and make the process exit non-zero. Switching to the threads pool removes that transport failure, but full-suite contention can make deterministic long simulation tests exceed explicit per-test caps that were calibrated for isolated or forks-pool runs.

## Fix

Moved the stabilized Vitest runner defaults into `vitest.config.ts`: `pool: 'threads'` and `testTimeout: 30_000`. Raised `createSimulationBridge.production.test.ts`'s shared production-progression timeout to 30s. Follow-up raised only the two additional explicit caps proven to exceed their limits under full-suite contention: the watch-tower utility test to 30s and the first blacksmith Forging progression test to 60s. This keeps every Vitest entry point on the same runner contract, avoids the unreliable fork-pool worker transport, and gives known CPU-heavy deterministic tests enough room under the safer pool.

## Verification

- `npm.cmd test -- tests/simulation/createSimulationBridge.production.test.ts`: pass.
- `npm.cmd test -- tests/simulation/createSimulationBridge.utility.test.ts -t "can build a Watch Tower in Feudal Age"`: pass.
- `npm.cmd test -- tests/simulation/blacksmithProgression.test.ts -t "Forging grants"`: pass.
- Earlier runner-fix verification: `npm.cmd test` passed with 99 files, 727 tests passed, 1 skipped, and no worker RPC timeout errors.
- Follow-up verification: `npm.cmd test` passed with 99 files, 733 tests passed, 1 skipped, and no worker RPC timeout errors after the additional timeout-headroom fix.
- `npm.cmd run typecheck`: pass.
- `npm.cmd run lint`: pass.
- `npm.cmd run build`: pass.

## Follow-ups

Pending.
