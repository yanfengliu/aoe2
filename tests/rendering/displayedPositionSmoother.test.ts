import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  createDisplayedPositionSmoother,
  type DisplayedPositionSmoother,
} from '../../src/rendering/displayedPositionSmoother';
import { displayDelayTicksFor, unitStepCadenceTicks } from '../../src/rendering/unitStepCadence';

// The owner's report (2026-09-01, watching live): "units seem to move and
// briefly stop mid-movement between cells." The sim grants a villager one
// 0.25-tile fine step only when its carry bank crosses 100 hundredths — ticks
// 4, 7, 10, 13, ... — and the renderer lerped only between the previous tick
// and the current one, so the drawn root moved for 100 ms and stood for ~200.
// These tests pin the render-side cure: a displayed root that replays the
// sim's sampled trajectory delayed by the unit's own step cadence, so it is
// always inside a segment that has a known far end.

const FRAMES_PER_TICK = 10;

function entity(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 0,
    y: 5,
    tint: 0xffffff,
    size: 0.72,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
    ...overrides,
  };
}

/** Sim x for a villager whose fine steps land at the ticks in `stepTicks`. */
function stepwise(stepTicks: readonly number[]): (tick: number) => number {
  return (tick) => 0.25 * stepTicks.filter((stepTick) => stepTick <= tick).length;
}

interface Frame { tick: number; alpha: number; simX: number; shownX: number; same: boolean }

/** Drives the smoother at 10 render frames per sim tick and records what it showed. */
function drive(
  smoother: DisplayedPositionSmoother,
  simXAt: (tick: number) => number,
  ticks: number,
  firstTick = 0,
): Frame[] {
  const frames: Frame[] = [];
  for (let tick = firstTick; tick < firstTick + ticks; tick += 1) {
    for (let frame = 0; frame < FRAMES_PER_TICK; frame += 1) {
      const alpha = frame / FRAMES_PER_TICK;
      const sim = entity({ x: simXAt(tick) });
      const [shown] = smoother.apply([sim], tick, alpha);
      frames.push({ tick, alpha, simX: sim.x, shownX: shown!.x, same: shown === sim });
    }
  }
  return frames;
}

function displacements(frames: readonly Frame[]): number[] {
  return frames.slice(1).map((frame, index) => frame.shownX - frames[index]!.shownX);
}

describe('displayed position smoother', () => {
  it('turns 0.25-tile steps every 3 ticks into a displayed root that advances EVERY frame', () => {
    const stepTicks = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
    const frames = drive(createDisplayedPositionSmoother(), stepwise(stepTicks), 34);
    const deltas = displacements(frames);
    const firstMoving = deltas.findIndex((delta) => delta > 1e-12);
    // Motion starts the moment the sim's first step lands, not a delay later.
    expect(frames[firstMoving + 1]!.tick).toBe(3);
    // While the sim target keeps advancing (until its last step lands), no
    // frame stands still and the per-frame travel is near-constant.
    const lastAdvancingFrame = frames.findIndex((frame) => frame.tick === 30 && frame.alpha === 0);
    const walking = deltas.slice(firstMoving, lastAdvancingFrame);
    expect(walking.length).toBeGreaterThan(200);
    expect(walking.filter((delta) => delta <= 1e-12)).toHaveLength(0);
    expect(Math.max(...walking) / Math.min(...walking)).toBeLessThan(1.5);
  });

  it('keeps the honest villager cadence (3,3,3,3,3,3,3,4) moving with under a third of speed jitter', () => {
    // The carry banks 32 hundredths a tick: steps at 4,7,10,13,16,19,22,25,29.
    const stepTicks = [4, 7, 10, 13, 16, 19, 22, 25, 29, 32, 35, 38, 41, 44, 47, 50, 54];
    const frames = drive(createDisplayedPositionSmoother(), stepwise(stepTicks), 58);
    const deltas = displacements(frames);
    const firstMoving = deltas.findIndex((delta) => delta > 1e-12);
    const lastAdvancingFrame = frames.findIndex((frame) => frame.tick === 54 && frame.alpha === 0);
    const walking = deltas.slice(firstMoving, lastAdvancingFrame);
    expect(walking.filter((delta) => delta <= 1e-12)).toHaveLength(0);
    // 3-tick and 4-tick segments differ by exactly 4/3 — the residual the
    // sim's integer tick grid leaves, and a fifth of what a full stop was.
    expect(Math.max(...walking) / Math.min(...walking)).toBeLessThanOrEqual(4 / 3 + 1e-9);
  });

  it('never overshoots the sim position and never moves backwards', () => {
    const frames = drive(createDisplayedPositionSmoother(), stepwise([3, 6, 9, 12, 15]), 24);
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index]!;
      expect(frame.shownX).toBeLessThanOrEqual(frame.simX + 1e-12);
      if (index > 0) expect(frame.shownX).toBeGreaterThanOrEqual(frames[index - 1]!.shownX - 1e-12);
    }
  });

  it('keeps gliding when the presentation coalesced ticks, and never overshoots the sim', () => {
    // A DISCONTINUITY IS A JUMP IN SPACE, NOT IN TIME. The live loop coalesces
    // up to 2.5 ticks a frame (5 at double speed) — every frame of it on a
    // machine drawing slower than 10 fps — and the test API's advanceTicks(N)
    // any number. Both bracket the gap with two OBSERVED sim positions, which
    // is the same evidence the smoother interpolates between on any other
    // pair of samples, so the gap glides. Resetting here was the first cut's
    // defect: it threw the history away on exactly the slow machines the
    // smoother exists for.
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 10);
    const [before] = smoother.apply([entity({ x: 0.75 })], 10, 0.5);
    expect(before!.x).toBeLessThan(0.75);
    // Three ticks in one frame, 0.5 tiles of travel — well inside the snap
    // distance, so it is ordinary walking seen at its endpoints.
    const coalesced = entity({ x: 1.25 });
    const [glided] = smoother.apply([coalesced], 13, 0.5);
    expect(glided).not.toBe(coalesced);
    expect(glided!.x).toBeGreaterThan(before!.x);
    expect(glided!.x).toBeLessThan(1.25);
    // And the drawn root keeps advancing on the next ordinary frames rather
    // than restarting from a snap.
    const [next] = smoother.apply([entity({ x: 1.25 })], 14, 0.5);
    expect(next!.x).toBeGreaterThan(glided!.x);
    expect(next!.x).toBeLessThanOrEqual(1.25);
  });

  it('draws a villager walking on EVERY frame when every frame coalesces two ticks', () => {
    // The slow-machine regime, which is where the first cut stood the picture
    // still: a 200 ms frame advances the sim two ticks at a time, so the
    // presentation never sees a single-tick step. Measured on the real bridge
    // before this fix (deer-flight-fixture, 143 ms frames): the deer stood in
    // 92.4% of the frames inside its hops. Here, none.
    const smoother = createDisplayedPositionSmoother();
    const simXAt = stepwise([3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36]);
    const shown: number[] = [];
    for (let tick = 0; tick <= 40; tick += 2) {
      const [drawn] = smoother.apply([entity({ x: simXAt(tick) })], tick, 0);
      shown.push(drawn!.x);
    }
    // Frames 3..17 are mid-walk: the first steps have landed and the walk has
    // not yet ended. Every one of them must advance.
    const midWalk = shown.slice(3, 18);
    const steps = midWalk.slice(1).map((x, index) => x - midWalk[index]!);
    expect(steps.filter((step) => step <= 1e-12)).toHaveLength(0);
    // The cost the coarse grid does impose, named rather than hidden: a
    // presentation that only ever looks on even ticks sees a 3-tick sim
    // cadence as alternating 2- and 4-tick intervals, so the drawn speed
    // ripples 2:1 where a 60 Hz presentation ripples 4:3. A ripple is not the
    // defect — a stop is — and the ripple is bounded by the frame grid that
    // caused it, which is the same grid the viewer is watching through.
    expect(Math.max(...steps) / Math.min(...steps)).toBeLessThanOrEqual(2);
  });

  it('corrects the tick\'s sample when the sim moves the entity again within the same tick', () => {
    // An out-of-band change flushed mid-tick: the second observation replaces
    // the first rather than adding a zero-length segment, and the drawn root
    // heads for the corrected position.
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6]), 8);
    smoother.apply([entity({ x: 0.75 })], 8, 0.2);
    smoother.apply([entity({ x: 1 })], 8, 0.2);
    for (const tick of [9, 10]) smoother.apply([entity({ x: 1 })], tick, 0.5);
    // Render time 7.5 lies three quarters along the (tick 6, 0.5) → (tick 8,
    // 1.0) segment; a doubled sample would have put it on (6, 0.5) → (8,
    // 0.75) instead, at 0.6875.
    const [enRoute] = smoother.apply([entity({ x: 1 })], 11, 0.5);
    expect(enRoute!.x).toBeCloseTo(0.875, 9);
    const [settled] = smoother.apply([entity({ x: 1 })], 12, 0.5);
    expect(settled!.x).toBe(1);
  });

  it('draws a fleeing deer running: whole-cell hops every fourteen ticks become continuous motion', () => {
    const deer = (x: number, y: number) => entity({
      id: 21, kind: 'resource', layer: 'resource', entityType: 'deer', x, y, currentHp: null, maxHp: null,
    });
    const smoother = createDisplayedPositionSmoother();
    const shown: Array<{ x: number; y: number }> = [];
    for (let tick = 0; tick < 84; tick += 1) {
      const hops = Math.floor(tick / 14);
      for (let frame = 0; frame < FRAMES_PER_TICK; frame += 1) {
        const [drawn] = smoother.apply([deer(10 + hops, 10 + hops)], tick, frame / FRAMES_PER_TICK);
        shown.push({ x: drawn!.x, y: drawn!.y });
      }
    }
    const deltas = shown.slice(1).map((point, index) => Math.hypot(point.x - shown[index]!.x, point.y - shown[index]!.y));
    const firstMoving = deltas.findIndex((delta) => delta > 1e-12);
    expect(shown[firstMoving + 1]).toBeDefined();
    // From the first hop until the last hop lands, no frame stands still and
    // every frame covers the same 1/140th of a diagonal hop.
    const running = deltas.slice(firstMoving, 70 * FRAMES_PER_TICK);
    expect(running.filter((delta) => delta <= 1e-12)).toHaveLength(0);
    expect(Math.max(...running) / Math.min(...running)).toBeLessThan(1.01);
    expect(running[0]).toBeCloseTo(Math.SQRT2 / (14 * FRAMES_PER_TICK), 9);
  });

  it('reaches a target that stops, holds it, and hands back the sim entity itself once settled', () => {
    const smoother = createDisplayedPositionSmoother();
    const frames = drive(smoother, stepwise([3, 6, 9, 12]), 30);
    const settled = frames.filter((frame) => frame.tick >= 12 + displayDelayTicksFor(entity()));
    expect(settled.length).toBeGreaterThan(100);
    for (const frame of settled) {
      expect(frame.shownX).toBe(1);
      expect(frame.same).toBe(true);
    }
    // And it was still en route just before that — the stop is reached, not skipped.
    const arriving = frames.find((frame) => frame.tick === 13 && frame.alpha === 0.5)!;
    expect(arriving.shownX).toBeGreaterThan(0.75);
    expect(arriving.shownX).toBeLessThan(1);
  });

  it('is a pure function of render time: a forced re-sync at the same tick and alpha repeats itself', () => {
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 10);
    const sim = entity({ x: 0.75 });
    const first = smoother.apply([sim], 10, 0.4)[0]!.x;
    const second = smoother.apply([sim], 10, 0.4)[0]!.x;
    expect(second).toBe(first);
  });

  it('leaves buildings, memories and stationary units untouched, by reference', () => {
    const smoother = createDisplayedPositionSmoother();
    const building = entity({ id: 1, kind: 'building', layer: 'building', entityType: 'house', x: 3 });
    const memory = entity({ id: 2, isMemory: true, x: 4 });
    const still = entity({ id: 3, x: 6 });
    for (let tick = 0; tick < 6; tick += 1) {
      const movedBuilding = { ...building, x: building.x + tick };
      const movedMemory = { ...memory, x: memory.x + tick };
      const shown = smoother.apply([movedBuilding, movedMemory, still], tick, 0.5);
      expect(shown[0]).toBe(movedBuilding);
      expect(shown[1]).toBe(movedMemory);
      expect(shown[2]).toBe(still);
    }
  });

  it('smooths a live sheep on its own six-tick herd cadence', () => {
    const sheep = (x: number) => entity({
      id: 12,
      kind: 'resource',
      layer: 'resource',
      entityType: 'sheep',
      x,
      currentHp: null,
      maxHp: null,
    });
    const smoother = createDisplayedPositionSmoother();
    const shownXs: number[] = [];
    for (let tick = 0; tick < 30; tick += 1) {
      for (let frame = 0; frame < FRAMES_PER_TICK; frame += 1) {
        const simX = 0.25 * Math.floor(tick / 6);
        shownXs.push(smoother.apply([sheep(simX)], tick, frame / FRAMES_PER_TICK)[0]!.x);
      }
    }
    const deltas = shownXs.slice(1).map((x, index) => x - shownXs[index]!);
    const firstMoving = deltas.findIndex((delta) => delta > 1e-12);
    const walking = deltas.slice(firstMoving, 24 * FRAMES_PER_TICK);
    expect(walking.filter((delta) => delta <= 1e-12)).toHaveLength(0);
  });
});

describe('display delay per entity', () => {
  it('is the longest unobstructed gap between fine steps at the unit\'s base rate', () => {
    expect(unitStepCadenceTicks('villager')).toBe(4); // 32 hundredths/tick
    expect(unitStepCadenceTicks('scout')).toBe(3); // 48
    expect(unitStepCadenceTicks('knight')).toBe(2); // 54
    expect(unitStepCadenceTicks('battering-ram')).toBe(5); // 20
    expect(unitStepCadenceTicks('mangonel')).toBe(5); // 24
  });

  it('gives each moving resource the cadence of its own sim clock', () => {
    expect(displayDelayTicksFor({ kind: 'resource', entityType: 'sheep' })).toBe(6);
    expect(displayDelayTicksFor({ kind: 'resource', entityType: 'deer' })).toBe(14);
    // Charging wildlife moves a whole cell every tick along its range plan.
    expect(displayDelayTicksFor({ kind: 'resource', entityType: 'boar' })).toBe(1);
    expect(displayDelayTicksFor({ kind: 'resource', entityType: 'wolf' })).toBe(1);
    expect(displayDelayTicksFor({ kind: 'unit', entityType: 'villager' })).toBe(4);
  });
});
