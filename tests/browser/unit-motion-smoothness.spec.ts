import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import {
  analyseHops,
  analyseMotion,
  describeHops,
  describeMotion,
  type MotionSample,
} from './helpers/motionAnalysis';

// The gate for the CLASS of defect the owner reported on 2026-09-01 watching
// the game live: "units seem to move and briefly stop mid-movement between
// cells." The sim hands a villager one 0.25-tile fine step only when its
// carry bank crosses 100 hundredths (ticks 4, 7, 10, 13, ...), and the
// renderer used to lerp only between the previous tick and the current one,
// so on screen a walking villager moved for 100 ms and stood for ~200 ms,
// over and over — a 3.3 Hz pulse.
//
// This spec measures what the presentation layer actually PUTS ON SCREEN,
// frame by frame, on the real boot map (`aoe2-prototype`, fog on, real base):
// it stages one villager at the near end of the straight open-grass corridor
// nearest the base, orders it eight tiles down that corridor, drives 60 Hz
// frames through the same bridge/presentation path the live loop uses, and
// reads the drawn root after every frame. Two assertions, both about the
// picture and neither about the sim: mid-walk (first and last 300 ms
// excluded) no more than 2% of frames may show a root that did not move at
// all, and the largest per-frame step must be under twice the smallest.
//
// Red check on the v0.3.177 build, before the fix (2026-09-02, this machine):
//   driven 60 Hz — 661 frames, window 552: still 372 = 67.4%; per-frame step
//   min/max 0.0417/0.0417 tiles (ratio 1.00; every moving frame was one sixth
//   of a fine step, at 2.50 tiles/s, then nothing until the next step landed);
//   sim 8.00 tiles, drawn 8.00 tiles.
//   live rAF — 81 frames in 4 s (window 53): still 23 = 43.4%; step min/max
//   0.0002/0.1665 tiles; speed 0.00-2.50 tiles/s; sim 3.00 tiles.
// The same numbers are recorded in docs/learning/defect-register.md
// (2026-09-02 entry) next to the ones measured after the fix.
//
// Set MOTION_STRIP_DIR to also write a 12-frame strip at 60 ms spacing
// mid-walk (frame-NN.png + frames.json) — the visual evidence pair the
// defect-register entry cites lives under tmp/motion/{before,after}.
//
// A limit of the driven halves: `advanceTicks` syncs the presentation with
// `force = true`, while the live frame loop syncs unforced and skips a frame
// whose tick, interpolation alpha, selection and interaction state are all
// unchanged — a frame the driven path can never produce. The live test is
// the one that exercises that path; the driven tests measure the smoother's
// output under a frame grid the live loop cannot hold headlessly (~20 fps).

const FRAME_MS = 1_000 / 60;
const WALK_FRAMES = 660;
const WALK_TILES = 8;
const EDGE_MS = 300;
/** Mid-walk frames allowed to draw a root that did not move, as a share of
 *  the window; a plain share on the driven halves (windows of 550+ frames),
 *  a floored frame count on the short live window. */
const STILL_SHARE_BAR = 0.02;
const STRIP_FRAMES = 12;
const STRIP_STEP_MS = 60;
const STAGING_TICK_LIMIT = 900;
// Ten seconds of deer flight, sampled at 60 Hz: six or seven fourteen-tick
// hops at the stop-and-go rate a scout sustains (see the deer test).
const DEER_FRAMES = 600;
// Frames judged after each hop lands: the hop's fourteen ticks at six frames
// a tick, less four frames so the verdict never rides on the exact frame the
// glide ends.
const DEER_HOP_SPAN_FRAMES = 14 * 6 - 4;

interface WalkPlan {
  readonly id: number;
  /** Where the villager stands at boot. */
  readonly cellX: number;
  readonly cellY: number;
  /** Near end of the corridor: the staging destination. */
  readonly startX: number;
  readonly startY: number;
  /** Far end, `WALK_TILES` cells straight along the corridor. */
  readonly endX: number;
  readonly endY: number;
}

/** Finds the straight run of `WALK_TILES + 1` open grass cells (no hill,
 *  water, forest, building, resource or standing unit) nearest to an owner-1
 *  villager standing alone in its cell, over the whole boot map — the sim
 *  knows the map where the player's fog has not lifted. The villager walks to
 *  the near end first, so the measured walk is one straight open-ground leg. */
async function planOpenGroundWalk(page: Page): Promise<WalkPlan> {
  const plan = await page.evaluate((walkTiles) => {
    const api = window.__AOE2_TEST__!;
    const state = api.getRenderState();
    const size = api.getMapSize();
    const key = (x: number, y: number) => y * size.width + x;
    const open = new Set<number>();
    const unitsPerCell = new Map<number, number>();
    for (const entity of state.entities) {
      if (entity.kind === 'tile' && entity.entityType === 'grass') open.add(key(entity.x, entity.y));
    }
    for (const entity of state.entities) {
      if (entity.kind === 'tile') continue;
      if (entity.kind === 'unit') {
        const cell = key(Math.floor(entity.x), Math.floor(entity.y));
        unitsPerCell.set(cell, (unitsPerCell.get(cell) ?? 0) + 1);
        open.delete(cell);
        continue;
      }
      for (let dy = 0; dy < entity.footprintHeight; dy += 1) {
        for (let dx = 0; dx < entity.footprintWidth; dx += 1) {
          open.delete(key(Math.floor(entity.x) + dx, Math.floor(entity.y) + dy));
        }
      }
    }
    const villagers = state.entities
      .filter((entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager')
      .map((entity) => ({ id: entity.id, cellX: Math.floor(entity.x), cellY: Math.floor(entity.y) }))
      .filter((villager) => unitsPerCell.get(key(villager.cellX, villager.cellY)) === 1);
    let best: {
      id: number; cellX: number; cellY: number;
      startX: number; startY: number; endX: number; endY: number; distance: number;
    } | null = null;
    const consider = (startX: number, startY: number, endX: number, endY: number) => {
      for (const villager of villagers) {
        const distance = Math.abs(startX - villager.cellX) + Math.abs(startY - villager.cellY);
        if (!best || distance < best.distance) {
          best = { ...villager, startX, startY, endX, endY, distance };
        }
      }
    };
    const runs = (dx: number, dy: number) => {
      for (let y = 0; y < size.height; y += 1) {
        for (let x = 0; x < size.width; x += 1) {
          let length = 0;
          while (
            x + length * dx < size.width
            && y + length * dy < size.height
            && open.has(key(x + length * dx, y + length * dy))
          ) length += 1;
          if (length > walkTiles) {
            consider(x, y, x + walkTiles * dx, y + walkTiles * dy);
            consider(x + walkTiles * dx, y + walkTiles * dy, x, y);
          }
        }
      }
    };
    runs(1, 0);
    runs(0, 1);
    return best;
  }, WALK_TILES);
  if (!plan) {
    throw new Error(
      `The boot map has no straight run of ${String(WALK_TILES + 1)} open grass cells for an `
      + 'owner-1 villager standing alone in its cell to walk; the smoothness gate needs a real '
      + 'open-ground walk to measure.',
    );
  }
  return plan;
}

/** Walks the villager to the corridor's near end and waits until the sim has
 *  it there, so the measured leg starts from rest on open ground. */
async function stageAtCorridor(page: Page, plan: WalkPlan): Promise<void> {
  const outcome = await page.evaluate(({ id, cellX, cellY, startX, startY, tickLimit }) => {
    const api = window.__AOE2_TEST__!;
    if (!api.selectEntityAtCell(cellX, cellY)) return 'select failed';
    const ids = api.getSelectionState().selectedEntityIds;
    if (ids.length !== 1 || ids[0] !== id) return `selected ${ids.join(',')} instead of ${String(id)}`;
    if (!api.issueMoveCommand(startX, startY)) return 'staging move rejected';
    // One tick per sync, as the live loop does. `advanceTicks(10, 100)` would
    // coalesce ten ticks into one presentation sync, and the drawn root's
    // history would then hold sync times rather than step times — its tail
    // creeping into the measured walk as a slow segment that no live frame
    // (bounded at 250 ms of sim time) can produce.
    for (let elapsed = 0; elapsed < tickLimit; elapsed += 1) {
      api.advanceTicks(1, 100);
      const sim = api.getRenderState().entities.find((entity) => entity.id === id);
      if (!sim) return 'villager left the render state while staging';
      if (Math.floor(sim.x) === startX && Math.floor(sim.y) === startY) {
        // Let the last fine steps land and the drawn root settle on them.
        for (let settle = 0; settle < 15; settle += 1) api.advanceTicks(1, 100);
        return 'ok';
      }
    }
    return `did not reach (${String(startX)},${String(startY)}) within ${String(tickLimit)} ticks`;
  }, { ...plan, tickLimit: STAGING_TICK_LIMIT });
  if (outcome !== 'ok') {
    throw new Error(`Could not stage villager ${String(plan.id)} at the corridor: ${outcome}.`);
  }
}

async function orderCorridorWalk(page: Page, plan: WalkPlan): Promise<void> {
  const outcome = await page.evaluate(({ id, startX, startY, endX, endY }) => {
    const api = window.__AOE2_TEST__!;
    if (!api.selectEntityAtCell(startX, startY)) return 'select failed';
    const ids = api.getSelectionState().selectedEntityIds;
    if (ids.length !== 1 || ids[0] !== id) return `selected ${ids.join(',')} instead of ${String(id)}`;
    if (!api.issueMoveCommand(endX, endY)) return 'move rejected';
    return 'ok';
  }, plan);
  if (outcome !== 'ok') {
    throw new Error(`Could not order villager ${String(plan.id)} down the corridor: ${outcome}.`);
  }
}

async function writeStrip(page: Page, plan: WalkPlan, directory: string): Promise<void> {
  const frames = await page.evaluate(({ id, startX, startY, frameCount, stepMs }) => {
    const api = window.__AOE2_TEST__!;
    const find = () => {
      const shown = api.getDisplayedEntities().find((entity) => entity.id === id);
      const sim = api.getRenderState().entities.find((entity) => entity.id === id);
      if (!shown || !sim) throw new Error(`Villager ${String(id)} left the render state before the strip.`);
      return { shown, sim };
    };
    // Walk back down the same corridor; the strip starts 1.5 s in, mid-walk.
    // Staged in frame-sized steps: a single 1.5 s bridge step would coalesce
    // fifteen ticks into one presentation sync, which no live frame ever does
    // (the frame loop bounds a frame at 250 ms of sim time), and the strip
    // would show the drawn root catching up rather than walking.
    if (!api.issueMoveCommand(startX, startY)) throw new Error('Return walk rejected.');
    for (let warm = 0; warm < 25; warm += 1) api.advanceTicks(1, stepMs);
    const start = find().shown;
    api.centerCameraOnWorldPosition(start.x, start.y);
    api.setCameraZoom(2.4);
    const captured: Array<{
      tick: number; x: number; y: number; simX: number; simY: number;
      screen: { x: number; y: number }; dataUrl: string;
    }> = [];
    for (let index = 0; index < frameCount; index += 1) {
      api.advanceTicks(1, stepMs);
      const { shown, sim } = find();
      captured.push({
        tick: api.getHudState().tick,
        x: shown.x,
        y: shown.y,
        simX: sim.x,
        simY: sim.y,
        screen: api.worldToScreen(shown.x, shown.y),
        dataUrl: api.captureWorldFrame().dataUrl,
      });
    }
    return captured;
  }, { ...plan, frameCount: STRIP_FRAMES, stepMs: STRIP_STEP_MS });
  mkdirSync(directory, { recursive: true });
  frames.forEach((frame, index) => {
    const base64 = frame.dataUrl.slice(frame.dataUrl.indexOf(',') + 1);
    writeFileSync(join(directory, `frame-${String(index).padStart(2, '0')}.png`), Buffer.from(base64, 'base64'));
  });
  writeFileSync(
    join(directory, 'frames.json'),
    JSON.stringify(frames.map(({ dataUrl: _dataUrl, ...rest }) => rest), null, 2),
  );
}

test.describe('unit motion smoothness', () => {
  test('a walking villager is drawn advancing every frame at a near-constant rate', async ({
    page,
  }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const plan = await planOpenGroundWalk(page);
    await stageAtCorridor(page, plan);
    await orderCorridorWalk(page, plan);

    const samples = await page.evaluate(({ id, frames, frameMs }) => {
      const api = window.__AOE2_TEST__!;
      const read = (index: number) => {
        const shown = api.getDisplayedEntities().find((entity) => entity.id === id);
        const sim = api.getRenderState().entities.find((entity) => entity.id === id);
        if (!shown || !sim) throw new Error(`Villager ${String(id)} left the render state mid-walk.`);
        return { timeMs: index * frameMs, x: shown.x, y: shown.y, simX: sim.x, simY: sim.y };
      };
      const out = [read(0)];
      for (let index = 1; index <= frames; index += 1) {
        api.advanceTicks(1, frameMs);
        out.push(read(index));
      }
      return out;
    }, { id: plan.id, frames: WALK_FRAMES, frameMs: FRAME_MS });

    const report = analyseMotion(samples, EDGE_MS);
    test.info().annotations.push({ type: 'motion', description: describeMotion(report) });
    console.log(`[motion] driven 60 Hz: ${describeMotion(report)}`);

    // Evidence before verdict: the strip and the raw series are wanted most
    // when the assertions below fail, so they are written before those run.
    const stripDir = process.env.MOTION_STRIP_DIR;
    if (stripDir) {
      mkdirSync(stripDir, { recursive: true });
      writeFileSync(join(stripDir, 'driven-samples.json'), JSON.stringify(samples));
      await writeStrip(page, plan, stripDir);
    }

    // Instrument checks first: the villager really walked, and the window is
    // long enough for a percentage to mean something.
    expect(report.simTiles).toBeGreaterThanOrEqual(4);
    expect(report.windowFrames).toBeGreaterThan(200);
    // The claims about the picture. Before the fix the still share was the
    // failing number; the step ratio was 1.00 because every moving frame was
    // one sixth of a fine step — it guards the cure against trading a stop
    // for a burst-and-crawl. The bar of 2 is for the villager's own 3-tick/
    // 4-tick alternation (4/3); a unit earning 50-99 hundredths a tick (light
    // cavalry at 188%) alternates 1- and 2-tick intervals and would sit at
    // exactly 2.0, so this walk must stay a villager's.
    expect(report.stillShare).toBeLessThanOrEqual(STILL_SHARE_BAR);
    expect(report.stepRatio).toBeLessThan(2);
  });

  test('a live, unpaused walk is drawn advancing on every animation frame', async ({ page }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const plan = await planOpenGroundWalk(page);
    await stageAtCorridor(page, plan);
    await orderCorridorWalk(page, plan);

    const samples = await page.evaluate(({ id, durationMs }) => new Promise<MotionSample[]>(
      (resolve, reject) => {
        const api = window.__AOE2_TEST__!;
        const out: MotionSample[] = [];
        let startMs: number | undefined;
        const onFrame = (nowMs: number) => {
          try {
            const shown = api.getDisplayedEntities().find((entity) => entity.id === id);
            const sim = api.getRenderState().entities.find((entity) => entity.id === id);
            if (!shown || !sim) throw new Error(`Villager ${String(id)} left the render state mid-walk.`);
            startMs ??= nowMs;
            out.push({ timeMs: nowMs, x: shown.x, y: shown.y, simX: sim.x, simY: sim.y });
            if (nowMs - startMs < durationMs) {
              window.requestAnimationFrame(onFrame);
            } else {
              api.setPaused(true);
              resolve(out);
            }
          } catch (error) {
            api.setPaused(true);
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        };
        api.setPaused(false);
        window.requestAnimationFrame(onFrame);
      },
    ), { id: plan.id, durationMs: 4_000 });

    const report = analyseMotion(samples, EDGE_MS);
    test.info().annotations.push({ type: 'motion', description: describeMotion(report) });
    console.log(`[motion] live rAF: ${describeMotion(report)}`);
    const stripDir = process.env.MOTION_STRIP_DIR;
    if (stripDir) {
      mkdirSync(stripDir, { recursive: true });
      writeFileSync(join(stripDir, 'live-samples.json'), JSON.stringify(samples));
    }

    // A machine too slow to render thirty mid-walk frames in four seconds
    // cannot measure this; say so rather than pass on an empty window.
    expect(report.windowFrames).toBeGreaterThanOrEqual(30);
    expect(report.simTiles).toBeGreaterThanOrEqual(1.5);
    // The 2% bar as a frame COUNT, floored at one: the headless renderer
    // manages ~20 fps, so a four-second window holds only 50-60 frames and a
    // share would let a single frame decide the verdict (one still frame in
    // 49 is 2.04%). Measured after the fix: 0 still frames in windows of
    // 51-75.
    const stillFramesAllowed = Math.max(1, Math.floor(STILL_SHARE_BAR * report.windowFrames));
    expect(report.stillFrames).toBeLessThanOrEqual(stillFramesAllowed);
  });

  test('a sync that coalesces several ticks snaps the drawn root to the sim root, and the walk resumes from there', async ({
    page,
  }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const plan = await planOpenGroundWalk(page);
    await stageAtCorridor(page, plan);
    await orderCorridorWalk(page, plan);

    const probe = await page.evaluate(({ id }) => {
      const api = window.__AOE2_TEST__!;
      const read = () => {
        const shown = api.getDisplayedEntities().find((entity) => entity.id === id);
        const sim = api.getRenderState().entities.find((entity) => entity.id === id);
        if (!shown || !sim) throw new Error(`Villager ${String(id)} left the render state mid-walk.`);
        return { gap: Math.hypot(shown.x - sim.x, shown.y - sim.y), simX: sim.x, simY: sim.y };
      };
      // Tick by tick, as the live loop presents: after the first steps the
      // drawn root trails the sim root by up to a cadence of travel.
      let trailing = 0;
      for (let tick = 0; tick < 12; tick += 1) {
        api.advanceTicks(1, 100);
        trailing = Math.max(trailing, read().gap);
      }
      // One sync covering five ticks — twice what a live frame can coalesce
      // at normal speed, what one can at double speed — snaps.
      const before = read();
      api.advanceTicks(5, 100);
      const snapped = read();
      // And tick-by-tick syncs glide again from the snapped root: within one
      // villager cadence (four ticks) a fine step lands and the drawn root
      // trails it.
      let resumedGap = 0;
      for (let tick = 0; tick < 4; tick += 1) {
        api.advanceTicks(1, 100);
        resumedGap = Math.max(resumedGap, read().gap);
      }
      return { trailing, before, snapped, resumedGap };
    }, { id: plan.id });

    expect(probe.trailing).toBeGreaterThan(0);
    expect(Math.hypot(probe.snapped.simX - probe.before.simX, probe.snapped.simY - probe.before.simY))
      .toBeGreaterThan(0);
    expect(probe.snapped.gap).toBe(0);
    expect(probe.resumedGap).toBeGreaterThan(0);
  });

  // The other mover on the boot map's most-watched screen: a deer. The sim
  // moves a fleeing deer one whole cell every fourteenth tick (units.csv
  // 0.737 tiles/s), the worst instance of the owner's symptom — drawn still
  // for thirteen ticks, then across a tile in one. `deer-flight-fixture`
  // seats a scout five tiles from a deer on open grass with twelve tiles of
  // sight (a villager's four loses the deer within a tick of its first
  // diagonal hop — measured 2026-09-02, live for five ticks in fourteen); the
  // scout is sent after the deer every ten ticks. A scout paths on the
  // four-connected grid at 1.2 tiles/s while a diagonal hop gains two tiles
  // of Manhattan distance every 1.4 s, so the deer periodically escapes the
  // five-tile flee trigger and STANDS until the scout closes again — real
  // sim behaviour, not a drawing defect — which is why the verdict is taken
  // over the fourteen ticks after each hop (`analyseHops`), not over the
  // whole series: was each hop drawn as a crossing, or as a jump?
  test('a fleeing deer is drawn running, not hopping a cell at a time', async ({ page }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'deer-flight-fixture');

    const samples = await page.evaluate(({ frames, frameMs }) => {
      const api = window.__AOE2_TEST__!;
      const entities = api.getRenderState().entities;
      const deer = entities.find((entity) => (
        entity.kind === 'resource' && entity.entityType === 'deer' && !entity.isMemory
      ));
      const scout = entities.find((entity) => (
        entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'scout'
      ));
      if (!deer || !scout) throw new Error('deer-flight-fixture must boot a deer and an owner-1 scout.');
      if (!api.selectEntityAtCell(Math.floor(scout.x), Math.floor(scout.y))) {
        throw new Error('Could not select the luring scout.');
      }
      const chase = () => {
        const target = api.getRenderState().entities.find((entity) => (
          entity.id === deer.id && !entity.isMemory
        ));
        if (!target) throw new Error('The deer left the render state mid-chase.');
        if (!api.issueMoveCommand(Math.floor(target.x), Math.floor(target.y))) {
          throw new Error('The chase order was rejected.');
        }
      };
      const read = (index: number) => {
        const sim = api.getRenderState().entities.find((entity) => (
          entity.id === deer.id && !entity.isMemory
        ));
        const shown = api.getDisplayedEntities().find((entity) => entity.id === deer.id);
        if (!sim || !shown) {
          throw new Error(
            `The deer left the render state ${String(index)} frames into the chase; the fixture's `
            + 'scout has twelve tiles of sight so the whole flight should stay on screen.',
          );
        }
        return { timeMs: index * frameMs, x: shown.x, y: shown.y, simX: sim.x, simY: sim.y };
      };
      chase();
      const out = [read(0)];
      for (let index = 1; index <= frames; index += 1) {
        api.advanceTicks(1, frameMs);
        if (index % 60 === 0) chase();
        out.push(read(index));
      }
      return out;
    }, { frames: DEER_FRAMES, frameMs: FRAME_MS });

    const report = analyseHops(samples, DEER_HOP_SPAN_FRAMES);
    test.info().annotations.push({ type: 'motion', description: describeHops(report) });
    console.log(`[motion] deer flight, driven 60 Hz: ${describeHops(report)}`);
    console.log(`[motion] deer flight, whole series: ${describeMotion(analyseMotion(samples, EDGE_MS))}`);
    const stripDir = process.env.MOTION_STRIP_DIR;
    if (stripDir) {
      mkdirSync(stripDir, { recursive: true });
      writeFileSync(join(stripDir, 'deer-samples.json'), JSON.stringify(samples));
    }

    // The deer really fled — several hops, three or more cells — and every
    // hop was drawn as a crossing: within the fourteen ticks after a hop
    // lands, at most 2% of frames may draw the root where the previous
    // frame had it. A straight hop and a diagonal one differ by root two,
    // well under the step-ratio bar.
    expect(report.hops).toBeGreaterThanOrEqual(4);
    expect(report.simTiles).toBeGreaterThanOrEqual(3);
    expect(report.flightFrames).toBeGreaterThan(200);
    expect(report.stillShare).toBeLessThanOrEqual(STILL_SHARE_BAR);
    expect(report.stepRatio).toBeLessThan(2);
  });
});
