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
// ZOOM sets the camera zoom before the shot (the camera clamps to 0.7-2.4;
// the game opens at 2.0). The renderer's isometric angle is fixed, so a
// multi-view sweep varies FOCUS, ZOOM and SIZE rather than rotating.
const zoom = process.env.ZOOM ?? '';
// SIZE="WxH" captures at a different viewport, because a HUD that fits at
// 1280x800 can cover the world at 800x600.
const size = process.env.SIZE ?? '800x600';
// TICKS advances the simulation before the shot, so a capture can show what a
// mechanic looks like once it has run — a cut woodline, a finished building —
// rather than only the opening frame.
const ticks = Number(process.env.TICKS ?? 0);
// Captures are task-run EVIDENCE, so they default under the gitignored `tmp/`
// tree rather than into tracked docs; set OUT_DIR to promote one deliberately.
const outputDir = process.env.OUT_DIR ?? 'tmp/captures';
const outputPath = `${outputDir}/${label}.png`;

function parseSize(value) {
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  if (!match) {
    throw new Error(`SIZE must be "WIDTHxHEIGHT" in pixels, e.g. "1280x800"; got "${value}"`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

await mkdir(dirname(outputPath), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader'],
});

try {
  const context = await browser.newContext({
    viewport: parseSize(size),
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
  if (zoom) {
    const zoomValue = Number(zoom);
    if (!Number.isFinite(zoomValue) || zoomValue <= 0) {
      throw new Error(`ZOOM must be a positive number; got "${zoom}"`);
    }
    const applied = await page.evaluate(
      (value) => window.__AOE2_TEST__?.setCameraZoom(value),
      zoomValue,
    );
    if (applied !== zoomValue) {
      console.log(`ZOOM ${zoomValue} clamped to ${applied} by the camera`);
    }
  }
  if (ticks > 0) {
    if (!Number.isInteger(ticks)) {
      throw new Error(`TICKS must be a whole number of simulation ticks; got "${process.env.TICKS}"`);
    }
    // advanceTicks is atomic (unpause -> step N -> repause) inside the page, so
    // it is exact; chunked so a long advance does not exceed the call timeout.
    await page.evaluate((count) => { window.__AOE2_TEST__?.setPaused(true); }, ticks);
    let done = 0;
    while (done < ticks) {
      const chunk = Math.min(500, ticks - done);
      await page.evaluate((count) => { window.__AOE2_TEST__?.advanceTicks(count); }, chunk);
      done += chunk;
    }
    await page.evaluate(() => { window.__AOE2_TEST__?.setPaused(false); });
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`saved ${outputPath}`);
} finally {
  await browser.close();
}
