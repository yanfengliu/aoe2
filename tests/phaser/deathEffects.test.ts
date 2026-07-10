import { describe, expect, it } from 'vitest';

import type { ProjectedUnitDeathView } from '../../src/game/simulation/types';
import {
  DEATH_CLEAR_GRACE_MS,
  DEATH_EFFECT_DURATION_MS,
  MAX_ACTIVE_DEATH_EFFECTS,
  createDeathEffectsRenderer,
  deathBodyGeometry,
  deathDustRings,
} from '../../src/phaser/scenes/gameScene/deathEffects';

const CELL_SIZE = 24;

function death(overrides: Partial<ProjectedUnitDeathView> = {}): ProjectedUnitDeathView {
  return {
    id: 7,
    tick: 100,
    x: 6.25,
    y: 5.5,
    owner: 2,
    unitType: 'militia',
    tint: 0xff6644,
    size: 0.5,
    // The render layer receives already-fog-filtered deaths; witnessedBy is
    // irrelevant to drawing but part of the shape.
    witnessedBy: [1],
    ...overrides,
  };
}

function frameWith(deaths: ProjectedUnitDeathView[], tick = 100) {
  return { tick, recentUnitDeaths: deaths };
}

interface DrawCall {
  op: string;
  args: number[];
}

function createGraphicsSpy() {
  const calls: DrawCall[] = [];
  return {
    calls,
    fillStyle(color: number, alpha?: number) {
      calls.push({ op: 'fillStyle', args: [color, alpha ?? 1] });
    },
    lineStyle(width: number, color: number, alpha?: number) {
      calls.push({ op: 'lineStyle', args: [width, color, alpha ?? 1] });
    },
    fillEllipse(x: number, y: number, width: number, height: number) {
      calls.push({ op: 'fillEllipse', args: [x, y, width, height] });
    },
    strokeEllipse(x: number, y: number, width: number, height: number) {
      calls.push({ op: 'strokeEllipse', args: [x, y, width, height] });
    },
  };
}

describe('death effect pure geometry', () => {
  it('collapses the body over progress: height shrinks, alpha fades to 0', () => {
    const start = deathBodyGeometry(0, 0.5, 7);
    const mid = deathBodyGeometry(0.5, 0.5, 7);
    const end = deathBodyGeometry(1, 0.5, 7);
    expect(start.heightScale).toBeGreaterThan(mid.heightScale);
    expect(mid.heightScale).toBeGreaterThan(end.heightScale);
    expect(start.alpha).toBeGreaterThan(mid.alpha);
    expect(end.alpha).toBe(0);
    // The falling body spreads slightly as it collapses.
    expect(end.widthScale).toBeGreaterThanOrEqual(start.widthScale);
  });

  it('tips deterministically by entity id parity (no randomness)', () => {
    const even = deathBodyGeometry(0.5, 0.5, 8);
    const odd = deathBodyGeometry(0.5, 0.5, 9);
    expect(Math.sign(even.tipOffsetSign)).not.toBe(Math.sign(odd.tipOffsetSign));
    // Same inputs, same outputs — pure.
    expect(deathBodyGeometry(0.5, 0.5, 8)).toEqual(even);
  });

  it('dust rings expand and fade, and are gone at the end', () => {
    const early = deathDustRings(0.2);
    const late = deathDustRings(0.8);
    expect(early.length).toBeGreaterThan(0);
    expect(late.length).toBeGreaterThan(0);
    expect(late[0]!.radiusScale).toBeGreaterThan(early[0]!.radiusScale);
    expect(late[0]!.alpha).toBeLessThan(early[0]!.alpha);
    expect(deathDustRings(1)).toHaveLength(0);
  });
});

describe('death effects renderer', () => {
  it('ingests a frame death once (dedupes by id + tick across repeated frames)', () => {
    const renderer = createDeathEffectsRenderer();
    renderer.ingestFrame(frameWith([death()]), 1000);
    renderer.ingestFrame(frameWith([death()]), 1050);
    expect(renderer.activeCount()).toBe(1);
  });

  it('treats the same id dying at a different tick as a new effect (id reuse)', () => {
    const renderer = createDeathEffectsRenderer();
    renderer.ingestFrame(frameWith([death({ tick: 100 })], 100), 1000);
    renderer.ingestFrame(frameWith([death({ tick: 105 })], 105), 1500);
    expect(renderer.activeCount()).toBe(2);
  });

  it('animates for the effect duration plus a clear grace, then goes quiet', () => {
    const renderer = createDeathEffectsRenderer();
    renderer.ingestFrame(frameWith([death()]), 1000);
    expect(renderer.isAnimating(1000)).toBe(true);
    expect(renderer.isAnimating(1000 + DEATH_EFFECT_DURATION_MS - 1)).toBe(true);
    // Grace keeps the render loop awake for one more clearing pass.
    expect(renderer.isAnimating(1000 + DEATH_EFFECT_DURATION_MS + 1)).toBe(true);
    expect(
      renderer.isAnimating(1000 + DEATH_EFFECT_DURATION_MS + DEATH_CLEAR_GRACE_MS + 1),
    ).toBe(false);
  });

  it('draws body + dust while alive and nothing once expired', () => {
    const renderer = createDeathEffectsRenderer();
    renderer.ingestFrame(frameWith([death()]), 1000);

    const live = createGraphicsSpy();
    renderer.drawAll(live, 1000 + DEATH_EFFECT_DURATION_MS * 0.3, CELL_SIZE);
    expect(live.calls.some((call) => call.op === 'fillEllipse')).toBe(true);
    expect(live.calls.some((call) => call.op === 'strokeEllipse')).toBe(true);

    const expired = createGraphicsSpy();
    renderer.drawAll(expired, 1000 + DEATH_EFFECT_DURATION_MS + DEATH_CLEAR_GRACE_MS + 5, CELL_SIZE);
    expect(expired.calls).toHaveLength(0);
  });

  it('fades the drawn body alpha over the effect life', () => {
    const renderer = createDeathEffectsRenderer();
    renderer.ingestFrame(frameWith([death()]), 1000);

    const early = createGraphicsSpy();
    renderer.drawAll(early, 1000 + DEATH_EFFECT_DURATION_MS * 0.1, CELL_SIZE);
    const late = createGraphicsSpy();
    renderer.drawAll(late, 1000 + DEATH_EFFECT_DURATION_MS * 0.9, CELL_SIZE);

    const bodyAlpha = (spy: ReturnType<typeof createGraphicsSpy>) =>
      spy.calls.find((call) => call.op === 'fillStyle')!.args[1]!;
    expect(bodyAlpha(early)).toBeGreaterThan(bodyAlpha(late));
  });

  it('caps the number of simultaneously tracked effects', () => {
    const renderer = createDeathEffectsRenderer();
    const many = Array.from({ length: MAX_ACTIVE_DEATH_EFFECTS + 20 }, (_, i) =>
      death({ id: 1000 + i }));
    renderer.ingestFrame(frameWith(many), 1000);
    expect(renderer.activeCount()).toBeLessThanOrEqual(MAX_ACTIVE_DEATH_EFFECTS);
  });

  it('reset drops all effects and dedupe memory', () => {
    const renderer = createDeathEffectsRenderer();
    renderer.ingestFrame(frameWith([death()]), 1000);
    renderer.reset();
    expect(renderer.activeCount()).toBe(0);
    expect(renderer.isAnimating(1001)).toBe(false);
    // After reset the same death may be re-ingested (bridge swap replays state).
    renderer.ingestFrame(frameWith([death()]), 2000);
    expect(renderer.activeCount()).toBe(1);
  });

  it('handles a null frame without effects or errors', () => {
    const renderer = createDeathEffectsRenderer();
    renderer.ingestFrame(null, 1000);
    expect(renderer.activeCount()).toBe(0);
    const spy = createGraphicsSpy();
    renderer.drawAll(spy, 1000, CELL_SIZE);
    expect(spy.calls).toHaveLength(0);
  });
});
