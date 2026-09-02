// Playwright globalSetup: refuse to run the suite against a preview server
// that is not serving THIS checkout's dist/. `reuseExistingServer` reuses
// whatever already listens on the port, and with several worktrees running
// gates on one machine that was a sibling's build — the 2026-09-02 red check
// for the idle-bell overlap would have measured the placement-fix worktree's
// bundle on 4173 (defect register, same date). Vite names every emitted asset
// by its content hash, so the set of assets dist/index.html references,
// compared with the set the server sends, proves whose build is on the port.
// (Playwright starts `webServer` before globalSetup — runner/tasks.js.)
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FullConfig } from '@playwright/test';

// Every hashed asset — the JS bundle AND the extracted CSS, which carry
// independent hashes, so a styles-only build (the class of HUD defect this
// guards) is told apart too.
const ASSETS = /assets\/[\w.-]+/g;
const assetsOf = (html: string): string => [...new Set(html.match(ASSETS) ?? [])].sort().join(' ');

export default async function verifyPreviewServesThisBuild(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) {
    throw new Error('The browser suite needs `use.baseURL` in playwright.config.ts to know which preview to verify; none is set.');
  }
  // The checkout is where the config file lives; `config.rootDir` is the
  // tests' directory, not the checkout.
  const checkout = config.configFile ? dirname(config.configFile) : process.cwd();
  const indexPath = join(checkout, 'dist', 'index.html');
  let localHtml: string;
  try {
    localHtml = await readFile(indexPath, 'utf8');
  } catch (error) {
    throw new Error(
      `No built bundle to verify the preview against: ${indexPath} could not be read `
      + `(${(error as Error).message}). Run \`npm run build\` first.`,
    );
  }
  const local = assetsOf(localHtml);
  if (!local) {
    throw new Error(`${indexPath} references no hashed assets, so there is nothing to verify the preview against; run \`npm run build\` first.`);
  }
  let servedHtml: string;
  try {
    servedHtml = await (await fetch(`${baseURL}/`)).text();
  } catch (error) {
    throw new Error(
      `No vite preview answered at ${baseURL} (${(error as Error).message}); `
      + 'the suite starts one itself unless something else holds the port, so free the port or set PREVIEW_PORT to a free one.',
    );
  }
  const served = assetsOf(servedHtml);
  if (served !== local) {
    throw new Error(
      `The preview at ${baseURL} serves [${served || 'no hashed assets'}] but this checkout's dist/ holds [${local}]: `
      + 'another checkout\'s (or a stale) vite preview holds the port, so every test would measure the wrong build. '
      + 'Stop that server, or run with PREVIEW_PORT=<free port>.',
    );
  }
}
