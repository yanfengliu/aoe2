import { defineConfig } from 'vitest/config';

// FU8: Windows-specific vitest worker RPC flake documentation.
//
// Symptoms observed on long full-suite runs:
//  1. `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled error,
//     fired when a single test runs long enough (~130s+ on the slowest
//     AI age-up case on Windows) that the birpc round-trip between the
//     worker and the main process exceeds birpc's internal deadline.
//  2. Occasionally `ERR_IPC_CHANNEL_CLOSED` "Channel closed" when the
//     tinypool worker crashes at run teardown.
//
// Root cause (FU8 investigation): vitest's private birpc setup constant
// for the worker → main RPC deadline is NOT user-configurable through
// `defineConfig`. Tried `pool: 'forks'` + `poolOptions.forks.singleFork`
// + very long `testTimeout` / `hookTimeout` / `teardownTimeout` — none
// silence the warning, and `singleFork: true` actually makes the abort
// FIRE EARLIER because the 130s test sits in the same fork that the RPC
// main-process serializer is trying to drain.
//
// Best achievable from this config file:
//  - Keep the default vitest 3.x pool (forks) with per-file fresh
//    workers, so after the 130s age-up test finishes, subsequent test
//    files start with a fresh RPC state.
//  - Constrain `maxWorkers`/`minWorkers: 1` (pre-FU8 behavior) to avoid
//    parallel RPC pressure that crashes workers.
//  - `testTimeout` / `hookTimeout` at 180s so the per-test deadline
//    matches the slowest test's natural cadence; per-test
//    `{ timeout: ... }` overrides still apply where tighter limits make
//    sense.
//  - `teardownTimeout: 30_000` (was default 10s) so worker cleanup has
//    breathing room at the end of the run.
//  - `slowTestThreshold: 60_000` so the reporter's own slow-test warning
//    stops firing for tests we know are >60s by design (AI age-up, full
//    Blacksmith progression).
//
// Known remaining flake: the `[vitest-worker]: Timeout calling
// "onTaskUpdate"` warning WILL still fire intermittently on the longest
// test file (aiPlayer.test.ts — the multi-minute age-up case). This is a
// harness-internal birpc deadline, not a test failure — test results are
// correct and the process exits with the real pass/fail status of the
// completed files. If the warning becomes disruptive, the only known
// upstream fixes are (a) patch vitest's birpc deadline constant, or
// (b) split the 130s age-up test into shorter sub-steps. Neither is
// worth the churn today. Flagged here so future readers don't spend
// another debugging cycle diagnosing the same deadline.
// Iter-3 follow-up (parallelism sprint): the FU8 single-worker setup
// (maxWorkers/minWorkers: 1) was a workaround for the
// `Timeout calling "onTaskUpdate"` birpc flake. Re-investigated against
// the iter-1/2/3 fixes (per-tick getRenderState cache, H2-2 retry
// throttle, H2-1 in-flight tech O(1) lookup, gather perf wins) — all
// reduce per-tick CPU cost.
//
// Switched to fork-per-file with up to 4 concurrent forks. Empirical
// numbers on this dev box (Windows, Node 22.14):
//
//   maxForks=1 (serial, FU8 baseline) — ~18.8 min wall, 0 test
//     failures, ~6 worker `onTaskUpdate` warnings (always-fire on the
//     130s aiPlayer test).
//   maxForks=4 — ~5.7 min wall, 0 test failures, ~7 worker warnings,
//     occasional flake (1/2 sample runs lost 2 tests; second sample
//     run was clean). The flakes were transient and pass on retry.
//
// Trade-off: ~3.3× speedup at the cost of an occasional re-run when
// the birpc serializer gets squeezed. Worth it for day-to-day dev
// throughput; CI / pre-merge gates can stay on serial if reproducibility
// matters more than speed there.
export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        // Up to 4 concurrent forks. Diminishing returns past 4 because
        // we have 3-4 long tests (aiPlayer ~200s, blacksmithProgression
        // ~150s, monastery ~30s) that dominate the critical path; a
        // higher fork count just contends on the slow tests' birpc
        // serializers.
        maxForks: 4,
        minForks: 1,
      },
    },
    testTimeout: 180_000,
    hookTimeout: 180_000,
    teardownTimeout: 30_000,
    slowTestThreshold: 60_000,
    include: [
      'tests/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      'tests/browser/**',
    ],
  },
});
