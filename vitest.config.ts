import { defineConfig } from 'vitest/config';

// Windows Vitest runner note:
//
// Earlier full-suite runs used the forks pool as a speed/flake trade-off, but
// the CPU-heavy simulation suite can still finish all assertions and then exit
// non-zero from `[vitest-worker]: Timeout calling "onTaskUpdate"` worker RPC
// errors. Lower fork concurrency and quieter reporters did not remove the
// failure. The threads pool avoids that transport path on this machine and is
// now the default here so `vitest run`, `npm test`, watch mode, IDE runs, and
// CI-like direct invocations share the same runner contract.
//
// Keep the default per-test timeout at 30s. Known longer simulation cases use
// explicit per-test timeouts; `tests/simulation/createSimulationBridge.production.test.ts`
// also uses a shared 30s cap because it slows down under full-suite contention.
export default defineConfig({
  resolve: {
    // Match the production Vite contract for the linked voxel package: every
    // test import must share the consumer's Three constructors and materials.
    dedupe: ['three'],
  },
  test: {
    pool: 'threads',
    // Cap worker concurrency at half the cores. The heaviest simulation tests
    // are CPU-bound (a full sim world per worker); with the default one-worker-
    // per-core the pool oversubscribes (workers + main thread + GC > cores),
    // inflating per-test wall-clock 3-5x and intermittently tripping the 30-90s
    // timeouts on the heaviest files (imperial/castle/blacksmith/siege/militia/
    // ageUp/aiPlayer) — a false failure that always passed in isolation. Halving
    // concurrency removes the oversubscription so those tests run near their
    // isolated speed and the full-suite gate is reliable. '50%' adapts to the
    // machine (8 cores -> 4 workers; a 2-core CI box -> 1).
    poolOptions: {
      threads: { maxThreads: '50%', minThreads: 1 },
    },
    // The default reporter, plus one that writes each test's duration against its
    // own timeout to tmp/test-times/vitest.json and prints the closest five. CI
    // fails a run past two thirds of any test's limit from that file
    // (scripts/test-time-headroom.mjs); locally it only reports.
    reporters: ['default', './tests/helpers/vitestTestTimeReporter.ts'],
    // A `.only` fails the run rather than narrowing its file, here as on CI, so
    // a focused run cannot report itself as the whole suite to `npm run
    // verify`'s receipt (work 124 M2). To focus while iterating, name the file,
    // pass `-t <name>`, or pass `--allowOnly`.
    allowOnly: false,
    testTimeout: 30_000,
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
