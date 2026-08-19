// Capture arrows/stones actually in the air.
//
// The default map has no combat, so this drives a ranged-combat fixture: order
// the attack, step until the simulation reports something airborne, and shoot
// the frame then. LABEL names the artifact; SEED picks the fixture.
//
// Paired with `diffMapScreenshots.mjs` like the other capture scripts.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'projectile-flight';
const seed = process.env.SEED ?? 'cavalry-archer-ranged-fixture';
// How many airborne frames to capture in sequence (a flight strip).
const frames = Number(process.env.FRAMES ?? '1');
// Extra ticks to advance between captured frames.
const strideTicks = Number(process.env.STRIDE ?? '2');

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader'],
});

try {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4173/?seed=${seed}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, {
    timeout: 60_000,
  });
  await page.waitForTimeout(800);

  // Order the ranged unit to attack, then run until a shot is in the air.
  const launched = await page.evaluate(() => {
    const api = window.__AOE2_TEST__;
    const economy = api.getEconomyState();
    const shooter = economy.units.find(
      (u) => u.owner === 1 && (u.unitType === 'cavalry-archer' || u.unitType === 'archer'
        || u.unitType === 'mangonel' || u.unitType === 'crossbowman'),
    );
    const target = economy.units.find((u) => u.owner === 2);
    if (!shooter || !target) return { ok: false, reason: 'fixture has no shooter/target pair' };
    if (!api.selectEntityAtCell(shooter.x, shooter.y)) return { ok: false, reason: 'select failed' };
    if (!api.issueContextCommand(target.x, target.y)) return { ok: false, reason: 'attack order rejected' };
    // Frame the fight, and drop the selection panel that would sit over it.
    api.centerCameraOnWorldPosition(
      (shooter.x + target.x) / 2,
      (shooter.y + target.y) / 2,
    );
    for (let tick = 0; tick < 200; tick += 1) {
      api.advanceTicks(1);
      // Wait for a shot that is actually DRAWN — one past its wind-up and
      // inside the player's vision — not merely one queued in the simulation.
      const drawn = api.getRenderState().frame?.projectiles ?? [];
      if (drawn.length > 0) {
        api.clearSelection();
        return {
          ok: true,
          tick,
          shots: drawn.length,
          shooter: `${shooter.unitType} @${shooter.x},${shooter.y}`,
          target: `${target.unitType} @${target.x},${target.y}`,
        };
      }
    }
    return { ok: false, reason: 'no shot became visible within 200 ticks' };
  });

  if (!launched.ok) {
    throw new Error(
      `Could not get a projectile airborne in '${seed}': ${launched.reason}. `
      + 'Check that the fixture pairs an owner-1 ranged unit with an owner-2 target.',
    );
  }
  console.log(`airborne at tick ${launched.tick}: ${launched.shooter} -> ${launched.target} (${launched.shots} shot(s))`);

  for (let frame = 0; frame < frames; frame += 1) {
    const outputPath = frames === 1
      ? `docs/devlog/artifacts/2026-04-23-default-map-${label}.png`
      : `docs/devlog/artifacts/2026-04-23-default-map-${label}-${String(frame + 1)}.png`;
    await mkdir(dirname(outputPath), { recursive: true });
    await page.waitForTimeout(250);
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`saved ${outputPath}`);
    if (frame < frames - 1) {
      await page.evaluate((ticks) => {
        window.__AOE2_TEST__.advanceTicks(ticks);
      }, strideTicks);
    }
  }
} finally {
  await browser.close();
}
