// Staging and sampling for the unit-motion-smoothness gate: how a walk is set
// up on the real boot map and how a drawn trajectory is read frame by frame.
// Split out of `unit-motion-smoothness.spec.ts` at the 500-LOC cap, by ROLE —
// this file decides WHAT is driven and at what pace, the spec decides what is
// ASSERTED about the result.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { type Page } from '@playwright/test';

import { type MotionSample } from './motionAnalysis';

/** Tiles of straight open ground the measured walk covers. */
export const WALK_TILES = 8;
/** Ticks the staging walk may take to reach the corridor's near end. */
const STAGING_TICK_LIMIT = 900;

export const STRIP_FRAMES = 12;
const STRIP_STEP_MS = 60;
export interface WalkPlan {
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
export async function planOpenGroundWalk(page: Page): Promise<WalkPlan> {
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
export async function stageAtCorridor(page: Page, plan: WalkPlan): Promise<void> {
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

export async function orderCorridorWalk(page: Page, plan: WalkPlan): Promise<void> {
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

export async function writeStrip(page: Page, plan: WalkPlan, directory: string): Promise<void> {
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

/** Drives `frames` frames of `frameMs` each through the same bridge and
 *  presentation path the live loop uses, reading the DRAWN root after every
 *  one. One `advanceTicks(1, frameMs)` per frame, never a multi-tick advance:
 *  the point is the frame PACE, and a coalesced advance would be a different
 *  question. */
export async function drivenWalkSamples(
  page: Page,
  plan: WalkPlan,
  frameMs: number,
  frames: number,
): Promise<MotionSample[]> {
  return page.evaluate(({ id, frameCount, stepMs }) => {
    const api = window.__AOE2_TEST__!;
    // `getRenderState()` flushes out-of-band render changes, so it is read
    // FIRST: the other order can pair a drawn root with a sim root one flush
    // newer, which now feeds a maxLag assertion rather than only a log.
    const read = (index: number) => {
      const sim = api.getRenderState().entities.find((entity) => entity.id === id);
      const shown = api.getDisplayedEntities().find((entity) => entity.id === id);
      if (!shown || !sim) throw new Error(`Villager ${String(id)} left the render state mid-walk.`);
      return { timeMs: index * stepMs, x: shown.x, y: shown.y, simX: sim.x, simY: sim.y };
    };
    const out = [read(0)];
    for (let index = 1; index <= frameCount; index += 1) {
      api.advanceTicks(1, stepMs);
      out.push(read(index));
    }
    return out;
  }, { id: plan.id, frameCount: frames, stepMs: frameMs });
}

/** Twelve consecutive FRAMES of the deer chase at a chosen pace, written as
 *  PNGs plus the drawn/sim series — the visual evidence a motion fix needs,
 *  because a single still cannot show whether a picture moved. Set
 *  MOTION_STRIP_DIR to produce it. At `SLOW_FRAME_MS` the defect this gate was
 *  written for draws the deer on the SAME pixel for eight or nine frames and
 *  then a whole cell away on the tenth; the cure moves it a tenth of a cell
 *  every frame. */
export async function writeDeerStrip(page: Page, frameMs: number, directory: string): Promise<void> {
  const frames = await page.evaluate(({ stepMs, frameCount }) => {
    const api = window.__AOE2_TEST__!;
    const deer = api.getRenderState().entities.find((entity) => (
      entity.kind === 'resource' && entity.entityType === 'deer' && !entity.isMemory
    ));
    if (!deer) throw new Error('The deer left the render state before the strip.');
    const shownDeer = api.getDisplayedEntities().find((entity) => entity.id === deer.id)!;
    api.centerCameraOnWorldPosition(shownDeer.x, shownDeer.y);
    api.setCameraZoom(2.4);
    const captured: Array<{
      tick: number; x: number; y: number; simX: number; simY: number; dataUrl: string;
    }> = [];
    for (let index = 0; index < frameCount; index += 1) {
      api.advanceTicks(1, stepMs);
      const sim = api.getRenderState().entities.find((entity) => entity.id === deer.id && !entity.isMemory);
      const shown = api.getDisplayedEntities().find((entity) => entity.id === deer.id);
      if (!sim || !shown) throw new Error(`The deer left the render state ${String(index)} frames into the strip.`);
      captured.push({
        tick: api.getHudState().tick,
        x: shown.x,
        y: shown.y,
        simX: sim.x,
        simY: sim.y,
        dataUrl: api.captureWorldFrame().dataUrl,
      });
    }
    return captured;
  }, { stepMs: frameMs, frameCount: STRIP_FRAMES });
  mkdirSync(directory, { recursive: true });
  frames.forEach((frame, index) => {
    const base64 = frame.dataUrl.slice(frame.dataUrl.indexOf(',') + 1);
    writeFileSync(join(directory, `deer-slow-${String(index).padStart(2, '0')}.png`), Buffer.from(base64, 'base64'));
  });
  writeFileSync(
    join(directory, 'deer-slow-frames.json'),
    JSON.stringify(frames.map(({ dataUrl: _dataUrl, ...rest }) => rest), null, 2),
  );
}

/** The deer half's sampler, at a chosen frame pace: a scout is sent after the
 *  deer once a second of sim time and the DRAWN deer root is read every
 *  frame. */
export async function drivenDeerSamples(
  page: Page,
  frameMs: number,
  frames: number,
): Promise<MotionSample[]> {
  return page.evaluate(({ frameCount, stepMs }) => {
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
    // Sim state first — it flushes out-of-band render changes; see the walk
    // sampler above.
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
      return { timeMs: index * stepMs, x: shown.x, y: shown.y, simX: sim.x, simY: sim.y };
    };
    const reorderEvery = Math.max(1, Math.round(1_000 / stepMs));
    chase();
    const out = [read(0)];
    for (let index = 1; index <= frameCount; index += 1) {
      api.advanceTicks(1, stepMs);
      if (index % reorderEvery === 0) chase();
      out.push(read(index));
    }
    return out;
  }, { frameCount: frames, stepMs: frameMs });
}
