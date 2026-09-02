import { defineConfig, devices } from '@playwright/test';

// PLAYWRIGHT_PORT moves the preview server off 4173 for one run. Several
// agents share this machine, each in its own worktree with its own dist/; with
// `reuseExistingServer` a suite started while another worktree's preview holds
// 4173 would silently test THAT build. A port of one's own is what makes the
// gate honest here, and the default keeps CI and single-session runs unchanged.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  throw new Error(
    `PLAYWRIGHT_PORT must be a TCP port number; got "${process.env.PLAYWRIGHT_PORT ?? ''}".`,
  );
}
const baseURL = `http://127.0.0.1:${String(port)}`;

export default defineConfig({
  testDir: './tests/browser',
  testIgnore: ['**/_*.spec.ts'],
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: {
    baseURL,
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
    command: `npm.cmd run preview -- --host 127.0.0.1 --port ${String(port)} --strictPort`,
    url: baseURL,
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
