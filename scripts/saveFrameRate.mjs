// What frame rate does a loaded save draw, and what does a frame cost the main thread while it does?
//
//   node scripts/saveFrameRate.mjs --save <save.json> --focus 26,40 --label <name> --out tmp/fps.jsonl
//
// WHY. Works 130, 133 and 150 each rebuilt this as a scratch probe, and each was retired with its worktree. The
// gates beside it count work per frame (tests/browser/de-ground-frame-cost.spec.ts, hud-frame-dom-writes.spec.ts,
// presentation-keeps-still-world.spec.ts, tests/rendering/presentationFrameWork.test.ts), because a frame rate
// cannot be a CI gate on a shared runner. This is the measure those counts stand in for: the real page, a real late
// match, the frames a player would see.
//
// HOW. A save is loaded through the HUD's own Load (captureLoadSave.mjs) into a production build served by a vite
// preview, the camera is asked to centre on --focus, the match runs at --speed for 1.5 seconds unmeasured and then
// for --seconds, and the page is asked what it drew (the rasteriser is read from the world canvas, as
// captureRasteriser.mjs explains). Every animation-frame callback of the page is wrapped before the game boots, so
// a row holds two measures of the same frames:
//   - the frame rate, from the frames' own timestamps: what the player sees, rounded by the display to whole
//     refreshes (a frame of 17 ms of work is drawn at 30 a second on a 60 Hz display);
//   - a frame's cost, the time spent inside its animation-frame callbacks: what the main thread paid, which a change
//     moves before the frame rate crosses a refresh.
// Beside them: the simulation's ticks per second (it must hold the speed's rate, or the frames were not paying for
// the same match), the runtime's counters per drawn frame, what the frame held, where the camera stood, and how
// many of the machine's CPUs were busy during the window. --profile also records the main thread's CPU profile
// over the window and prints its split by phase (framePhases.mjs, cpuProfileFold.mjs); build with
// `npm run build -- --sourcemap` so the phases can name minified code. --gpu-sync waits for the GPU after every
// callback (a one-pixel readPixels, as de-ground-frame-cost.spec.ts does) and reports that wait.
//
// BOUND. One view of one save for a few seconds, on this machine, under whatever else it is running: report
// `busyCpus` with every number and alternate the builds being compared. Headless Chromium draws at 60 Hz, so 60 is
// the ceiling. A --profile or --gpu-sync row is slower than the game: take frame rates from rows without them. Sound
// stays off: the game starts muted and nothing here unmutes it.
import { chromium } from 'playwright';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, resolve } from 'node:path';

import { captureRasteriserLaunch, refuseFrameFromOtherRasteriser } from './captureRasteriser.mjs';
import { loadSaveThroughHud, stageSaveForLoad } from './captureLoadSave.mjs';
import { foldProfileOfBuild, formatPhaseTable } from './frameProfileTable.mjs';
import { busyCpus, cameraStanding, cpuTimes, foldFrames, parseSaveFrameRateArgs, runtimeWorkPerFrame } from './frameRateStats.mjs';
import { assertPreviewServes } from './previewBuild.mjs';

const WARM_UP_MS = 1500;
// Asked of V8; on Windows the sampler's timer gives about 550 microseconds (measured 2026-11-11), which the table's
// sample count shows.
const PROFILE_SAMPLING_MICROSECONDS = 200;

/** Wraps every animation-frame callback so a window can ask what each frame's callbacks cost. */
function installFrameProbe(gpuSync) {
  const probe = { on: false, calls: [] };
  window.__saveFrameRateProbe = probe;
  const request = window.requestAnimationFrame.bind(window);
  const pixel = new Uint8Array(4);
  // A CPU profile's call tree does not say where one frame's callbacks end and the next frame's begin, so alternate
  // frames run through two functions of different names (framePhases.mjs's FRAME_SLOT_NAMES), which it does show.
  function saveFrameRateEvenFrame(callback, time) { callback(time); }
  function saveFrameRateOddFrame(callback, time) { callback(time); }
  let frameTime = -1;
  let evenFrame = false;
  window.requestAnimationFrame = (callback) => request((time) => {
    if (!probe.on) {
      callback(time);
      return;
    }
    if (time !== frameTime) {
      frameTime = time;
      evenFrame = !evenFrame;
    }
    const gl = gpuSync ? document.querySelector('.voxel-world-canvas')?.getContext('webgl2') : null;
    // Before the callback, so the wait after it is for what this callback drew and nothing older.
    gl?.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    const start = performance.now();
    try {
      if (evenFrame) saveFrameRateEvenFrame(callback, time);
      else saveFrameRateOddFrame(callback, time);
    } finally {
      const ran = performance.now();
      gl?.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      probe.calls.push([time, ran - start, gl ? performance.now() - ran : 0]);
    }
  });
}

async function loadThroughPaste(page, saveText, savedTick) {
  await page.click('[data-hud="menu-button"]');
  await page.click('[data-hud="load-button"]');
  await page.check('[data-hud="load-source-paste"]');
  await page.evaluate((text) => {
    const area = document.querySelector('[data-hud="load-paste-textarea"]');
    area.value = text;
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }, saveText);
  await page.click('[data-hud="load-confirm"]');
  await page.waitForFunction((tick) => {
    const panel = document.querySelector('[data-hud="load-panel"]');
    return (!panel || panel.hidden) && window.__AOE2_TEST__.getHudState().tick >= tick;
  }, savedTick, { timeout: 180_000 });
  await page.evaluate(() => {
    const resume = document.querySelector('[data-hud="menu-resume"]');
    if (resume && resume.offsetParent !== null) resume.click();
    window.__AOE2_TEST__.setPaused(true);
  });
  await page.waitForFunction(() => document.querySelectorAll('[data-hud="toast"]').length === 0, null, { timeout: 15_000 });
}

/** What the loaded match holds, read while it is paused. */
function readWorld() {
  const api = window.__AOE2_TEST__;
  const entities = api.getRenderState().entities;
  const count = (test) => entities.filter(test).length;
  return {
    worldSize: api.getHudState().worldSize,
    projectedEntities: entities.length,
    tiles: count((entity) => entity.kind === 'tile'),
    units: count((entity) => entity.kind === 'unit' && !entity.isMemory),
    buildings: count((entity) => entity.kind === 'building' && !entity.isMemory),
    resources: count((entity) => entity.kind === 'resource' && !entity.isMemory),
    remembered: count((entity) => entity.isMemory === true),
  };
}

function readWindowEdge() {
  const api = window.__AOE2_TEST__;
  const state = api.getWorldRendererState();
  return { metrics: state.metrics, framesDrawn: state.framesDrawn, tick: api.getHudState().tick, at: performance.now() };
}

async function main() {
  const options = parseSaveFrameRateArgs(process.argv.slice(2), process.env);
  const tree = resolve(options.tree);
  const build = await assertPreviewServes(tree, options.port);
  const launch = captureRasteriserLaunch(options.rasteriser, process.platform);
  const browser = await chromium.launch({ headless: true, args: launch.args });
  try {
    const context = await browser.newContext({ viewport: { width: options.width, height: options.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const timer = window.setInterval(() => {
        if (!window.__AOE2_TEST__) return;
        window.__AOE2_TEST__.setPaused(true);
        window.clearInterval(timer);
      }, 0);
    });
    await page.addInitScript(installFrameProbe, options.gpuSync);
    // A save over about 5.1 million characters does not fit the browser save (plan 150), so --paste loads it
    // through the Load panel's paste source instead.
    const saveText = options.paste ? readFileSync(options.save, 'utf8') : null;
    const savedTick = options.paste ? JSON.parse(saveText).worldSnapshot?.tick : await stageSaveForLoad(page, options.save);
    if (!Number.isInteger(savedTick)) throw new Error(`--save "${options.save}" is not a save: it has no worldSnapshot.tick.`);
    await page.goto(`http://127.0.0.1:${String(options.port)}/?seed=aoe2-prototype&speed=${options.speed}`);
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, null, { timeout: 120_000 });
    const drawnBy = await page.evaluate(() => {
      const canvas = document.querySelector('.voxel-world-canvas');
      const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : undefined;
    });
    refuseFrameFromOtherRasteriser(launch.rasteriser, drawnBy);

    const loadStarted = Date.now();
    if (options.paste) await loadThroughPaste(page, saveText, savedTick);
    else await loadSaveThroughHud(page, savedTick);
    const loadMs = Date.now() - loadStarted;
    if (options.focus) {
      await page.evaluate(([x, y]) => window.__AOE2_TEST__.centerCameraOnWorldPosition(x, y), [options.focus.x, options.focus.y]);
    }
    const world = await page.evaluate(readWorld);
    const speed = await page.evaluate(() => window.__AOE2_TEST__.getSimulationSpeed());

    await page.evaluate((warmUpMs) => {
      window.__AOE2_TEST__.setPaused(false);
      return new Promise((done) => { setTimeout(done, warmUpMs); });
    }, WARM_UP_MS);
    const cdp = options.profile ? await context.newCDPSession(page) : null;
    if (cdp) {
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.setSamplingInterval', { interval: PROFILE_SAMPLING_MICROSECONDS });
      await cdp.send('Profiler.start');
    }
    const loadBefore = cpuTimes(cpus());
    const before = await page.evaluate(readWindowEdge);
    const calls = await page.evaluate((windowMs) => new Promise((done) => {
      const probe = window.__saveFrameRateProbe;
      probe.calls = [];
      probe.on = true;
      setTimeout(() => {
        probe.on = false;
        done(probe.calls);
      }, windowMs);
    }), options.seconds * 1000);
    const after = await page.evaluate(readWindowEdge);
    const load = busyCpus(loadBefore, cpuTimes(cpus()));
    const profile = cdp ? (await cdp.send('Profiler.stop')).profile : null;
    const end = await page.evaluate(() => {
      const api = window.__AOE2_TEST__;
      api.setPaused(true);
      return { camera: api.getCameraState(), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null };
    });

    const frames = foldFrames(calls);
    const framesDrawn = after.framesDrawn - before.framesDrawn;
    const wallSeconds = (after.at - before.at) / 1000;
    const row = {
      label: options.label,
      save: options.save,
      build,
      rasteriser: launch.rasteriser,
      renderer: drawnBy,
      size: `${String(options.width)}x${String(options.height)}`,
      speed,
      savedTick,
      loadMs,
      ...world,
      ...frames,
      framesDrawn,
      wallSeconds: Math.round(wallSeconds * 100) / 100,
      ticksPerSecond: Math.round(((after.tick - before.tick) / wallSeconds) * 10) / 10,
      tick: after.tick,
      snapshotsPerFrame: Math.round((((after.metrics.acceptedRevision ?? 0) - (before.metrics.acceptedRevision ?? 0)) / Math.max(1, framesDrawn)) * 100) / 100,
      runtime: runtimeWorkPerFrame(before.metrics, after.metrics, framesDrawn),
      focus: options.focus,
      camera: cameraStanding(end.camera, options.focus),
      heapMB: end.heapMB,
      busyCpus: load.busy,
      cpus: load.of,
      mode: options.gpuSync ? 'gpu-sync' : options.profile ? 'profile' : 'plain',
      at: new Date().toISOString(),
    };
    if (profile) {
      mkdirSync(dirname(resolve(options.profile)), { recursive: true });
      writeFileSync(options.profile, JSON.stringify(profile));
      writeFileSync(`${options.profile}.row.json`, JSON.stringify(row));
      row.profile = options.profile;
    }
    if (options.out) {
      mkdirSync(dirname(resolve(options.out)), { recursive: true });
      appendFileSync(options.out, `${JSON.stringify(row)}\n`);
    }
    console.log(JSON.stringify(row));
    if (profile) console.log(formatPhaseTable(foldProfileOfBuild(profile, tree), row));
  } finally {
    await browser.close();
  }
}

// A command only: nothing imports this file (its arithmetic is frameRateStats.mjs, which the tests import), so it
// has no guard against being imported.
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
