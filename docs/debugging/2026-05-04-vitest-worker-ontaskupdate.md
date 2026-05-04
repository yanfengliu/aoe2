# Debugging session - Vitest worker `onTaskUpdate` timeout

## Symptom

`npm.cmd test` runs all Vitest files and reports `99 passed`, `727 passed`, `1 skipped`, then exits non-zero with seven unhandled errors: `[vitest-worker]: Timeout calling "onTaskUpdate"`.

## Expected vs actual

- Expected: `npm.cmd test` exits 0 once all tests pass.
- Actual: assertions pass, but Vitest records worker RPC timeout errors after long simulation tests and exits 1.

## Reproduction

- 2026-05-04 13:21 - `npm.cmd test` reproduced the failure in 292.59s. File assertions all passed; seven `onTaskUpdate` RPC errors caused the non-zero exit.

## Hypotheses

- [x] Long-running simulation files block worker event loops long enough that Vitest's parent/worker `onTaskUpdate` RPC times out under the default fork pool.
- [x] Parallel execution pressure from long CPU-bound simulation suites causes report-channel starvation; lowering worker concurrency should make the full gate deterministic. Tested `--maxWorkers=4`; ruled out as insufficient.
- [x] The failure is introduced by the current `unitCommandOps` split. Ruled out: targeted command/file-size/typecheck/lint gates pass, and the full suite reports all assertions passing before runner-level errors.
- [x] The default `forks` pool transport is the failing path; `threads` avoids the RPC timeout but needs a 30s default plus explicit caps for slower full-suite production progression tests.

## Investigation log

- 2026-05-04 13:21 - Current code split targeted gates pass; full `npm.cmd test` still reports all test files passing before the worker RPC errors, matching pre-existing memory/context for this checkout rather than a new assertion failure.
- 2026-05-04 13:27 - `npm.cmd test -- --maxWorkers=4` reproduced the same seven post-pass `onTaskUpdate` errors, ruling out raw worker count as the only cause.
- 2026-05-04 13:32 - `npm.cmd test -- --reporter=dot` reproduced the same seven post-pass `onTaskUpdate` errors, ruling out default reporter verbosity/output volume.
- 2026-05-04 13:37 - `npm.cmd test -- --pool=threads` avoided the `onTaskUpdate` errors but slowed two `createSimulationBridge.production.test.ts` cases past their explicit 15s timeouts. This points at the fork pool transport as the runner problem.
- 2026-05-04 13:42 - `npm.cmd test -- tests/simulation/createSimulationBridge.production.test.ts --pool=threads --testTimeout=30000` passed. The same file also passed under `--pool=forks`, confirming the tests are not logically failing and need a runner-level timeout override only under the safer pool.
- 2026-05-04 13:45 - Full `npm.cmd test` with `--pool=threads --testTimeout=30000` avoided the fork-pool RPC errors but still failed two production progression cases because Vitest's per-test `it(..., timeout)` argument overrides the runner timeout. Those cases took 19.3s and 16.8s under full-suite contention.

## Root cause

Vitest's default forks pool is unreliable for this repo's CPU-heavy full simulation suite on this Windows/Codex execution path. All assertions pass, but fork-pool worker-to-parent `onTaskUpdate` RPC calls can time out after 60s and make the process exit non-zero. Switching to the threads pool removes that transport failure, but full-suite contention makes `tests/simulation/createSimulationBridge.production.test.ts` exceed its explicit 15s per-test caps.

## Fix

Moved the stabilized Vitest runner defaults into `vitest.config.ts`: `pool: 'threads'` and `testTimeout: 30_000`. Raised `createSimulationBridge.production.test.ts`'s shared production-progression timeout to 30s. This keeps every Vitest entry point on the same runner contract, avoids the unreliable fork-pool worker transport, and gives the known CPU-heavy production progression tests enough room under the safer pool.

## Verification

- `npm.cmd test -- tests/simulation/createSimulationBridge.production.test.ts`: pass.
- `npm.cmd test`: pass, 99 files passed, 727 tests passed, 1 skipped, no worker RPC timeout errors.
- `npm.cmd run typecheck`: pass.
- `npm.cmd run lint`: pass.
- `npm.cmd run build`: pass.

## Follow-ups

Pending.
