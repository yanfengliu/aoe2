// GATE: a read of the presented voxel parts after a forced view sync waits for
// the frame in which the renderer hands over its hit state
// (game.waitForPresentedHitState). Work 139: CI run 40983419097 read no parts
// in voxel-unit-attack-animation.spec.ts, because its wait accepted the
// runtime's watermark, which a forced sync that changes nothing visible moves
// at once, a frame before the hit state follows.
// BOUND: boar-hunt-fixture, paused, at 800x600; one forced-sync source
// (inspectVoxelUnitMotion) and one part. Frames are held by a gate on
// requestAnimationFrame, and the test releases them only after it has seen the
// wait poll three times without returning: a handshake, so no host is fast or
// slow enough to let a wait that does not need the frame pass.
import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const PART = 'villager-tool-head';
// The wait reads the renderer's state once to start and once per poll, so this
// many reads means it has polled at least three times with frames held.
const READS_BEFORE_RELEASE = 4;

interface FrameGate {
  hold(): void;
  release(): void;
  held(): number;
}

interface Instrumented {
  aoe2FrameGate: FrameGate;
  aoe2RendererStateReads: number;
}

/** Queues every frame request while held. A request made before `hold` still
 *  runs once. A held request keeps its id across the release, so a later
 *  cancel still cancels it. Installed before the game's own code. */
function installFrameGate(): void {
  const realRequest = window.requestAnimationFrame.bind(window);
  const realCancel = window.cancelAnimationFrame.bind(window);
  const queued = new Map<number, FrameRequestCallback>();
  const released = new Map<number, number>();
  let holding = false;
  let nextHeldId = -1;
  window.requestAnimationFrame = (callback) => {
    if (!holding) return realRequest(callback);
    const id = nextHeldId;
    nextHeldId -= 1;
    queued.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (id >= 0) { realCancel(id); return; }
    queued.delete(id);
    const native = released.get(id);
    if (native !== undefined) { released.delete(id); realCancel(native); }
  };
  (window as unknown as Instrumented).aoe2FrameGate = {
    hold: () => { holding = true; },
    release: () => {
      holding = false;
      for (const [id, callback] of [...queued.entries()]) {
        queued.delete(id);
        released.set(id, realRequest((time) => { released.delete(id); callback(time); }));
      }
    },
    held: () => queued.size,
  };
}

/** Counts the wait's reads of the renderer's state. The test API object is
 *  frozen, so the page's handle to it is replaced by a copy with one method
 *  wrapped; the game itself never reads `window.__AOE2_TEST__`. */
function countRendererStateReads(page: Page): Promise<void> {
  return page.evaluate(() => {
    const real = window.__AOE2_TEST__!;
    const instrumented = window as unknown as Instrumented & { __AOE2_TEST__: typeof real };
    instrumented.aoe2RendererStateReads = 0;
    instrumented.__AOE2_TEST__ = Object.freeze({
      ...real,
      getWorldRendererState: () => {
        instrumented.aoe2RendererStateReads += 1;
        return real.getWorldRendererState();
      },
    });
  });
}

async function readPart(page: Page, identity: string) {
  return page.evaluate(({ id, part }) => ({
    part: window.__AOE2_TEST__!.inspectPresentedVoxelPartMatrix(id, part),
    presentedRevision: window.__AOE2_TEST__!.getWorldRendererState().metrics.presentedRevision,
  }), { id: identity, part: PART });
}

test('a presented-part read after a forced sync waits for the frame that hands the hit state over', async ({ page }) => {
  await page.addInitScript(installFrameGate);
  await game.waitForPausedBootWithSeed(page, 'boar-hunt-fixture');
  const identity = await page.evaluate(() => {
    const villager = window.__AOE2_TEST__!.getRenderState().entities.find((entity) => (
      entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager'
    ));
    if (!villager) throw new Error('The boar-hunt fixture must contain a villager of player 1.');
    return `${String(villager.id)}:${String(villager.generation ?? 0)}`;
  });
  await game.waitForPresentedHitState(page);
  expect((await readPart(page, identity)).part, 'the part is readable before the forced sync').not.toBeNull();

  // Hold the frames. The one the game asked for before the hold still runs,
  // and its request for the next one is the first the gate queues.
  await page.evaluate(() => { (window as unknown as Instrumented).aoe2FrameGate.hold(); });
  await expect.poll(() => page.evaluate(() => (window as unknown as Instrumented).aoe2FrameGate.held()))
    .toBeGreaterThan(0);

  const forced = await page.evaluate((id) => {
    const api = window.__AOE2_TEST__!;
    const before = api.getWorldRendererState();
    api.inspectVoxelUnitMotion(id);
    api.inspectVoxelUnitMotion(id);
    return { framesDrawn: before.framesDrawn, presentedRevision: before.metrics.presentedRevision ?? 0 };
  }, identity);

  // The control, read a round trip later: the window this gate is about is
  // open. The watermark moved on twice and agrees, no frame was drawn, and the
  // presented read answers nothing. If the part ever reads back here, the
  // renderer hands its hit state over on presentation and this gate's premise
  // is gone.
  const window_ = await page.evaluate(({ id, part }) => {
    const api = window.__AOE2_TEST__!;
    const state = api.getWorldRendererState();
    return {
      framesDrawn: state.framesDrawn,
      presentedRevision: state.metrics.presentedRevision ?? 0,
      watermarkEqual: state.metrics.presentedRevision === state.metrics.acceptedRevision,
      part: api.inspectPresentedVoxelPartMatrix(id, part),
    };
  }, { id: identity, part: PART });
  expect(window_, 'two forced syncs with frames held: watermark moved on, hit state behind').toEqual({
    framesDrawn: forced.framesDrawn,
    presentedRevision: forced.presentedRevision + 2,
    watermarkEqual: true,
    part: null,
  });

  // The handshake: the wait must still be waiting after it has polled with
  // frames held, whatever the host's speed. Only then are frames let through.
  await countRendererStateReads(page);
  let settled = false;
  const waiting = game.waitForPresentedHitState(page).finally(() => { settled = true; });
  await expect.poll(async () => settled || await page.evaluate(() => (
    (window as unknown as Instrumented).aoe2RendererStateReads
  )) >= READS_BEFORE_RELEASE).toBe(true);
  expect(settled, 'the wait returned while frames were held, before any frame could hand the hit state over')
    .toBe(false);
  await page.evaluate(() => { (window as unknown as Instrumented).aoe2FrameGate.release(); });
  await waiting;

  const read = await readPart(page, identity);
  expect(read.part, 'the part after waitForPresentedHitState').not.toBeNull();
  expect(read.part!.revision).toBe(read.presentedRevision);
});
