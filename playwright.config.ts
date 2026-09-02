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

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: ['**/_*.spec.ts'],
  // Runs once the preview is up: aborts the whole run if the server on the
  // port is serving some other checkout's bundle (see the helper).
  globalSetup: './tests/browser/helpers/verifyPreviewServesThisBuild.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'line',
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
    command: `npm.cmd run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
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
