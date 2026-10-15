// LOAD="<path to a save JSON>" for captureMapScreenshot.mjs: the capture is of a saved match, loaded through the
// HUD's own Load (game menu, Load game, the browser save, Load), so a sweep can look at a late state the opening
// never shows: remembered trees under fog, a grown base, units in it (work 130 needed one to prove that its
// presentation changed no pixel late in a match). The save is written into this origin's browser save slot before
// the page boots, the way the Load panel's "browser save" source finds it.
//
// A before/after pair must show the same moment, and a load hands the page a simulation that is not paused: the
// game menu resumes play when it closes, and on a slow rasteriser one frame can carry two ticks before anything can
// pause it. So the page's animation frames are held from just before the Load click until the loaded match is
// paused again with the menu closed: nothing steps it, it is paused at exactly the saved tick, and its next frame
// interpolates from the tick itself. Everything in between polls on timers, not frames.
import { readFile } from 'node:fs/promises';

/** Puts the save in the browser save slot before the first navigation; returns the tick the save was taken at. */
export async function stageSaveForLoad(page, path) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`LOAD names "${path}", which could not be read (${error.message}); give the path to a save JSON.`);
  }
  const savedTick = JSON.parse(text).worldSnapshot?.tick;
  if (!Number.isInteger(savedTick)) {
    throw new Error(`LOAD "${path}" is not a save: it has no worldSnapshot.tick. Save one from the game menu or the bridge.`);
  }
  await page.addInitScript((saveText) => { window.localStorage.setItem('aoe2-save-v1', saveText); }, text);
  return savedTick;
}

/** Loads the staged save through the HUD and leaves the match paused at exactly the saved tick. */
export async function loadSaveThroughHud(page, savedTick) {
  await page.click('[data-hud="menu-button"]');
  await page.click('[data-hud="load-button"]');
  // Hold every animation frame requested from here on; the ones already queued run once and re-queue into the hold.
  await page.evaluate(() => new Promise((resolve) => {
    const original = window.requestAnimationFrame;
    const held = [];
    window.__captureFrameHold = { original, held };
    window.requestAnimationFrame = (callback) => { held.push(callback); return -1; };
    window.setTimeout(resolve, 250);
  }));
  const loaded = await page.evaluate(async (tick) => {
    const api = window.__AOE2_TEST__;
    document.querySelector('[data-hud="load-confirm"]').click();
    api.setPaused(true);
    const panel = document.querySelector('[data-hud="load-panel"]');
    const deadline = Date.now() + 60_000;
    while ((panel && !panel.hidden) || api.getHudState().tick !== tick) {
      if (Date.now() > deadline) return `the load did not finish (tick ${api.getHudState().tick}, saved ${tick})`;
      await new Promise((resolve) => { window.setTimeout(resolve, 20); });
    }
    const resume = document.querySelector('[data-hud="menu-resume"]');
    if (resume && resume.offsetParent !== null) resume.click();
    api.setPaused(true);
    const { original, held } = window.__captureFrameHold;
    window.requestAnimationFrame = original;
    for (const callback of held.splice(0)) original(callback);
    return api.getHudState().tick;
  }, savedTick);
  if (loaded !== savedTick) throw new Error(`LOAD: ${String(loaded)}; capture refused.`);
  // The "Game loaded." toast fades on a timer, so a frame shot while it shows would differ run to run.
  await page.waitForFunction(() => document.querySelectorAll('[data-hud="toast"]').length === 0, null, { timeout: 10_000 });
  console.log(`loaded the save at tick ${savedTick}`);
}
