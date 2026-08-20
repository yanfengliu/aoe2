// Capture the M4 unique-unit row from the unit showcase.
//
// The showcase puts one of every UnitType on the map; the seventeen Castle
// unique units share a row at y=34 and the two naval ones sit in the pool at
// y=29. This walks the camera along that row so each unit is looked at rather
// than inferred from a passing test.
//
// LABEL names the output; SHOT selects which stop to capture (0-based), or
// omit it to write every stop.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'unique-units';
const seed = process.env.SEED ?? 'unit-showcase-fixture';

// The land row runs x=2..50 at y=34, six units per frame at this zoom.
// CX/CY override the walk with a single stop, for looking closely at one unit.
const STOPS = process.env.CX
  ? [{ name: process.env.STOP_NAME ?? 'closeup', x: Number(process.env.CX), y: Number(process.env.CY ?? 34) }]
  : [
  { name: 'land-1', x: 8, y: 34 },
  { name: 'land-2', x: 26, y: 34 },
  { name: 'land-3', x: 44, y: 34 },
  { name: 'naval', x: 20, y: 28 },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => { console.error('PAGE ERROR', error.message); });
  await page.goto(`http://127.0.0.1:4173/?seed=${seed}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, {
    timeout: 60_000,
  });
  await page.waitForTimeout(1200);

  const only = process.env.SHOT === undefined ? null : Number(process.env.SHOT);
  for (const [index, stop] of STOPS.entries()) {
    if (only !== null && only !== index) continue;
    await page.evaluate(([x, y]) => {
      window.__AOE2_TEST__?.centerCameraOnWorldPosition(x, y);
    }, [stop.x, stop.y]);
    await page.waitForTimeout(900);
    const outputPath = `tmp/units/${label}-${stop.name}.png`;
    await mkdir(dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`saved ${outputPath}`);
  }
} finally {
  await browser.close();
}
