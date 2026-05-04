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
  test: {
    pool: 'threads',
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
