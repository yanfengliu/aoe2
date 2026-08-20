import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'screenshot';
// SEED selects the scenario to capture. Defaults to the real default view
// (`aoe2-prototype`, fog on) — the honest target for anything visible at
// boot. Point it at a showcase fixture when the change only affects entities
// the default map doesn't contain (e.g. one building per role).
const seed = process.env.SEED ?? 'aoe2-prototype';
// FOCUS="x,y" centers the camera on a world cell before the shot, so a capture
// can frame something that is not near the map's default view. Omit it and the
// camera stays exactly where the game opens — which is the honest framing for
// anything a player sees at boot.
const focus = process.env.FOCUS ?? '';
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
  if (focus) {
    const [focusX, focusY] = focus.split(',').map(Number);
    if (!Number.isFinite(focusX) || !Number.isFinite(focusY)) {
      throw new Error(`FOCUS must be "x,y" world cells; got "${focus}"`);
    }
    await page.evaluate(
      ([x, y]) => { window.__AOE2_TEST__?.centerCameraOnWorldPosition(x, y); },
      [focusX, focusY],
    );
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`saved ${outputPath}`);
} finally {
  await browser.close();
}
