import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'screenshot';
// SEED selects the scenario to capture. Defaults to the real default view
// (`aoe2-prototype`, fog on) — the honest target for anything visible at
// boot. Point it at a showcase fixture when the change only affects entities
// the default map doesn't contain (e.g. one building per role).
const seed = process.env.SEED ?? 'aoe2-prototype';
const outputPath = `docs/devlog/artifacts/2026-04-23-default-map-${label}.png`;

await mkdir(dirname(outputPath), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader'],
});

try {
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4173/?seed=${seed}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, {
    timeout: 60_000,
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`saved ${outputPath}`);
} finally {
  await browser.close();
}
