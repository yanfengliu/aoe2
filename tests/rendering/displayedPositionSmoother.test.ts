import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  SNAP_DISTANCE_TILES,
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

  it('snaps a jump past the snap distance within the same frame', () => {
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 12);
    const teleported = entity({ x: 0.75 + 5 });
    const [shown] = smoother.apply([teleported], 12, 0.5);
    expect(shown!.x).toBe(teleported.x);
    expect(shown).toBe(teleported);
    // A jump just inside the snap distance still glides.
    const nudged = entity({ x: teleported.x + SNAP_DISTANCE_TILES - 0.01 });
    const [gliding] = smoother.apply([nudged], 13, 0.5);
    expect(gliding!.x).toBeGreaterThan(teleported.x);
    expect(gliding!.x).toBeLessThan(nudged.x);
  });

  it('glides a deer\'s diagonal flee hop (1.41 tiles) and snaps a move over 1.5 tiles: both sides of the line', () => {
    const deer = (x: number, y: number) => entity({
      id: 21, kind: 'resource', layer: 'resource', entityType: 'deer', x, y, currentHp: null, maxHp: null,
    });
    const smoother = createDisplayedPositionSmoother();
    for (let tick = 0; tick < 14; tick += 1) smoother.apply([deer(10, 10)], tick, 0);
    // The longest step the sim ever takes in one tick: one cell on both axes.
    const hopped = deer(11, 11);
    expect(Math.hypot(1, 1)).toBeLessThan(SNAP_DISTANCE_TILES);
    const [midHop] = smoother.apply([hopped], 14, 0.5);
    expect(midHop!.x).toBeGreaterThan(10);
    expect(midHop!.x).toBeLessThan(11);
    expect(midHop!.y).toBeGreaterThan(10);
    expect(midHop!.y).toBeLessThan(11);
    // Anything longer is not a step the sim makes; it is drawn where it landed.
    const relocated = deer(11 + 1.5, 11 + 0.01);
    expect(Math.hypot(1.5, 0.01)).toBeGreaterThan(SNAP_DISTANCE_TILES);
    const [afterSnap] = smoother.apply([relocated], 15, 0.5);
    expect(afterSnap).toBe(relocated);
  });

  it('snaps when the presentation skipped a tick, then resumes from the snapped root', () => {
    // The live loop coalesces up to 2.5 ticks a frame (5 at double speed) and
    // the test API's advanceTicks(N) any number: the steps inside the gap were
    // never observed, so nothing is invented for them.
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 10);
    const [gliding] = smoother.apply([entity({ x: 0.75 })], 10, 0.5);
    expect(gliding!.x).toBeLessThan(0.75);
    const jumped = entity({ x: 1.5 });
    const [snapped] = smoother.apply([jumped], 13, 0.5);
    expect(snapped).toBe(jumped);
    const [resumed] = smoother.apply([entity({ x: 1.75 })], 14, 0.5);
    expect(resumed!.x).toBeGreaterThan(1.5);
    expect(resumed!.x).toBeLessThan(1.75);
  });

  it('starts a fresh track when the unit type changes under the same id (a line upgrade)', () => {
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 10);
    const upgraded = entity({ entityType: 'man-at-arms', x: 0.75 });
    const [shown] = smoother.apply([upgraded], 10, 0.5);
    expect(shown).toBe(upgraded);
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

  it('snaps on a rewind (replay scrub) and on a reset (bridge swap) instead of gliding across unrelated state', () => {
    const smoother = createDisplayedPositionSmoother();
    drive(smoother, stepwise([3, 6, 9]), 12);
    const rewound = entity({ x: 0.25 });
    const [afterRewind] = smoother.apply([rewound], 4, 0.2);
    expect(afterRewind).toBe(rewound);

    drive(smoother, stepwise([6, 9, 12]), 10, 4);
    smoother.reset();
    const swapped = entity({ x: 0 });
    const [afterReset] = smoother.apply([swapped], 0, 0);
    expect(afterReset).toBe(swapped);
  });

  it('does not slide a unit from a position it held while out of sight', () => {
    // Seen at tick 0-2, absent at tick 3 (fogged, garrisoned, or a hidden
    // frame skipped it), back at tick 4 one tile over: that is a fresh
    // sighting, drawn where the sim says, exactly as the render store's
    // prior-visible-frame rule always demanded.
    const smoother = createDisplayedPositionSmoother();
    for (let tick = 0; tick < 3; tick += 1) smoother.apply([entity({ x: 0 })], tick, 0.5);
    smoother.apply([], 3, 0.5);
    const returned = entity({ x: 1 });
    const [shown] = smoother.apply([returned], 4, 0.5);
    expect(shown).toBe(returned);
  });

  it('does not treat a recycled id as the destroyed unit it replaced', () => {
    const smoother = createDisplayedPositionSmoother();
    for (let tick = 0; tick < 3; tick += 1) smoother.apply([entity({ generation: 1, x: 0 })], tick, 0.5);
    const recycled = entity({ generation: 2, x: 1 });
    const [shown] = smoother.apply([recycled], 3, 0.5);
    expect(shown).toBe(recycled);
  });

  it('seeds a fresh cancellation-tick checkpoint from the attack source, like the tick lerp did', () => {
    const smoother = createDisplayedPositionSmoother();
    const cancelled = entity({
      x: 0.25,
      attackAnimation: {
        tick: 4,
        cancelTick: 5,
        sourceX: 0,
        sourceY: 5,
        targetX: 1,
        targetY: 5,
      },
    });
    const [atZero] = smoother.apply([cancelled], 5, 0);
    expect(atZero!.x).toBe(0);
    const [midway] = smoother.apply([cancelled], 5, 0.5);
    expect(midway!.x).toBeGreaterThan(0);
    expect(midway!.x).toBeLessThan(0.25);
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
