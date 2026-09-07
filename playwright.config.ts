import { defineConfig, devices } from '@playwright/test';

// The suite drives a `vite preview` of THIS checkout's `dist/`. The port is
// configurable because `reuseExistingServer` makes whichever server already
// listens on it the system under test: with several worktrees running gates on
// one machine, a sibling's preview squatting on 4173 gets measured instead of
// this build (2026-09-02 — a sibling worktree's preview held 4173 while this
// one ran its red check). A lone checkout keeps the default (no workflow runs
// this suite; it is a local gate); a worktree beside others runs
// `PREVIEW_PORT=<free port> npm run test:browser`.
const previewPort = Number(process.env.PREVIEW_PORT ?? 4173);
if (!Number.isInteger(previewPort) || previewPort <= 0 || previewPort > 65535) {
  throw new Error(
    'PREVIEW_PORT must be a TCP port number from 1 to 65535 for the vite preview '
    + `the browser suite drives; got "${process.env.PREVIEW_PORT}".`,
  );
}
const previewUrl = `http://127.0.0.1:${previewPort}`;

// `npm.cmd` was hardcoded into the webServer command below on 2026-04-11 by
// 002b7280, the commit that created this file (`git log -S "npm.cmd" --
// playwright.config.ts` returns that commit and this change, nothing between),
// when the only machine that ran this suite was Windows and the extensionless
// `npm` shim is not something the spawn resolves there. No workflow ran this
// suite until 2026-09-06, so nothing ever asked what that name means
// elsewhere: there is no `npm.cmd` on a Linux runner, `sh` would answer
// `npm.cmd: not found`, the preview would never come up, and every spec would
// fail on the 120s webServer timeout with nothing in the output naming npm.
// Found by reading, not by a red run — the CI job that would have shown it is
// landing in the same change. On win32 this still evaluates to the identical
// string (verified), so the local gate is unchanged.
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: ['**/_*.spec.ts'],
  // Runs once the preview is up: aborts the whole run if the server on the
  // port is serving some other checkout's bundle (see the helper).
  globalSetup: './tests/browser/helpers/verifyPreviewServesThisBuild.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  // `line` as before, plus a report of how close the five slowest specs ran to
  // their OWN timeouts. It REPORTS and does not fail: it was written to be the
  // gate for the duration entry in `docs/learning/lessons.md`, and the
  // measurement refused the gate — per-test duration here swings up to 2x
  // between two runs of the same bundle, in both directions. So `npm run
  // test:browser` gains four lines of output and no new way to go red; the
  // numbers, and the env var that turns it into a gate, are in the reporter.
  reporter: [['line'], ['./tests/browser/helpers/durationBudgetReporter.ts']],
  use: {
    baseURL: previewUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: true,
    viewport: {
      width: 800,
      height: 600,
    },
    launchOptions: {
      args: ['--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: `${npmBin} run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
    url: previewUrl,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        ...devices['Desktop Chrome'],
        viewport: {
          width: 800,
          height: 600,
        },
      },
    },
  ],
});
