// GATE: a read of the presented voxel parts after a forced view sync waits for
// the frame in which the renderer hands over its hit state
// (game.waitForPresentedHitState). Work 139: CI run 40983419097 read no
// parts in voxel-unit-attack-animation.spec.ts, because its wait accepted the
// runtime's watermark, which a forced sync that changes nothing visible moves
// at once, a frame before the hit state follows.
// BOUND: boar-hunt-fixture, paused, at 800x600; one forced-sync source
// (inspectVoxelUnitMotion) and one part. Frames are held by a gate on
// requestAnimationFrame that the page releases on its own timer, so the window
// stays open for as long as the gate says, on any host.
import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const PART = 'villager-tool-head';
const RELEASE_AFTER_MS = 1_000;

interface FrameGate {
  hold(): void;
  release(): void;
  held(): number;
}

/** Queues every frame request while held; the requests made before `hold`
 *  still run once. Installed before the game's own code. */
function installFrameGate(): void {
  const realRequest = window.requestAnimationFrame.bind(window);
  const realCancel = window.cancelAnimationFrame.bind(window);
  const queued = new Map<number, FrameRequestCallback>();
  let holding = false;
  let nextQueuedId = -1;
  window.requestAnimationFrame = (callback) => {
    if (!holding) return realRequest(callback);
    const id = nextQueuedId;
    nextQueuedId -= 1;
    queued.set(id, callback);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (id < 0) queued.delete(id);
    else realCancel(id);
  };
  (window as unknown as { aoe2FrameGate: FrameGate }).aoe2FrameGate = {
    hold: () => { holding = true; },
    release: () => {
      holding = false;
      const callbacks = [...queued.values()];
      queued.clear();
      for (const callback of callbacks) realRequest(callback);
    },
    held: () => queued.size,
  };
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
  await page.evaluate(() => { (window as unknown as { aoe2FrameGate: FrameGate }).aoe2FrameGate.hold(); });
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { aoe2FrameGate: FrameGate }).aoe2FrameGate.held()
  ))).toBeGreaterThan(0);

  // The control: with no frame, two forced syncs move the watermark on and the
  // presented read answers nothing. If this part ever reads back here, the
  // renderer hands its hit state over on presentation and this gate's premise
  // is gone.
  const forced = await page.evaluate(({ id, part }) => {
    const api = window.__AOE2_TEST__!;
    const before = api.getWorldRendererState();
    api.inspectVoxelUnitMotion(id);
    api.inspectVoxelUnitMotion(id);
    const after = api.getWorldRendererState();
    return {
      framesDrawn: after.framesDrawn - before.framesDrawn,
      revisionsPresented: (after.metrics.presentedRevision ?? 0) - (before.metrics.presentedRevision ?? 0),
      watermarkEqual: after.metrics.presentedRevision === after.metrics.acceptedRevision,
      part: api.inspectPresentedVoxelPartMatrix(id, part),
    };
  }, { id: identity, part: PART });
  expect(forced, 'two forced syncs with frames held: watermark moved on, hit state behind').toEqual({
    framesDrawn: 0, revisionsPresented: 2, watermarkEqual: true, part: null,
  });

  // Let frames run again a second from now, on the page's own clock, and read
  // the part only once the wait says the hit state is there.
  await page.evaluate((ms) => {
    window.setTimeout(() => { (window as unknown as { aoe2FrameGate: FrameGate }).aoe2FrameGate.release(); }, ms);
  }, RELEASE_AFTER_MS);
  await game.waitForPresentedHitState(page);
  const read = await readPart(page, identity);
  expect(read.part, 'the part after waitForPresentedHitState').not.toBeNull();
  expect(read.part!.revision).toBe(read.presentedRevision);
});
