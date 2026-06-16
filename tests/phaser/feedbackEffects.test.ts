import { describe, expect, it } from 'vitest';

import {
  createHitFlashTracker,
  drawHitFlash,
  feedHitFlashTracker,
  selectionPulse,
  shouldFlashHit,
  FLASH_CLEAR_GRACE_MS,
  HIT_FLASH_DURATION_MS,
  SELECTION_PULSE_PERIOD_MS,
} from '../../src/phaser/scenes/gameScene/feedbackEffects';

describe('selectionPulse', () => {
  it('keeps alpha within a visible lit band and never exceeds 1', () => {
    for (let t = 0; t <= SELECTION_PULSE_PERIOD_MS * 2; t += 37) {
      const pulse = selectionPulse(t);
      expect(pulse.alpha).toBeGreaterThan(0.4); // never near-invisible
      expect(pulse.alpha).toBeLessThanOrEqual(1);
      expect(Number.isNaN(pulse.alpha)).toBe(false);
    }
  });

  it('bounds the radius offset to a small non-negative value', () => {
    for (let t = 0; t <= SELECTION_PULSE_PERIOD_MS * 2; t += 37) {
      const pulse = selectionPulse(t);
      expect(pulse.radiusOffsetPx).toBeGreaterThanOrEqual(0);
      expect(pulse.radiusOffsetPx).toBeLessThanOrEqual(3);
    }
  });

  it('bounds the line width to a sane stroke band', () => {
    for (let t = 0; t <= SELECTION_PULSE_PERIOD_MS * 2; t += 37) {
      const pulse = selectionPulse(t);
      expect(pulse.lineWidth).toBeGreaterThanOrEqual(1.5);
      expect(pulse.lineWidth).toBeLessThanOrEqual(3.5);
    }
  });

  it('oscillates over a period (differs at a half period, repeats at a full period)', () => {
    const at0 = selectionPulse(0);
    const atHalf = selectionPulse(SELECTION_PULSE_PERIOD_MS / 2);
    const atFull = selectionPulse(SELECTION_PULSE_PERIOD_MS);
    // half a period apart the alpha must differ meaningfully (it is animated)
    expect(Math.abs(at0.alpha - atHalf.alpha)).toBeGreaterThan(0.1);
    // a full period later it returns to (approximately) the same phase
    expect(Math.abs(at0.alpha - atFull.alpha)).toBeLessThan(1e-6);
  });

  it('is deterministic for a given time', () => {
    expect(selectionPulse(1234)).toEqual(selectionPulse(1234));
  });
});

describe('shouldFlashHit', () => {
  it('flashes only when hp strictly dropped between two finite samples', () => {
    expect(shouldFlashHit(40, 25)).toBe(true);
    expect(shouldFlashHit(40, 40)).toBe(false); // no change
    expect(shouldFlashHit(25, 40)).toBe(false); // heal
  });

  it('does not flash when either sample is null/undefined', () => {
    expect(shouldFlashHit(null, 25)).toBe(false);
    expect(shouldFlashHit(40, null)).toBe(false);
    expect(shouldFlashHit(undefined, 25)).toBe(false);
    expect(shouldFlashHit(40, undefined)).toBe(false);
    expect(shouldFlashHit(null, null)).toBe(false);
  });

  it('does not flash on non-finite samples (Infinity / NaN)', () => {
    expect(shouldFlashHit(Infinity, 25)).toBe(false);
    expect(shouldFlashHit(40, -Infinity)).toBe(false);
    expect(shouldFlashHit(Number.NaN, 25)).toBe(false);
    expect(shouldFlashHit(40, Number.NaN)).toBe(false);
  });
});

describe('createHitFlashTracker', () => {
  it('does not flash on the first sample (no prior hp to compare)', () => {
    const tracker = createHitFlashTracker();
    tracker.recordSample(1, 40, 100);
    expect(tracker.intensityAt(1, 0)).toBe(0);
  });

  it('arms a decaying flash when hp drops, then expires after the duration', () => {
    const tracker = createHitFlashTracker();
    tracker.recordSample(1, 40, 0);
    // hp drops at tick 1, recorded at clock time 1000
    tracker.recordSample(1, 25, 1000);
    expect(tracker.intensityAt(1, 1000)).toBeGreaterThan(0.9); // ~full right after
    const mid = tracker.intensityAt(1, 1000 + HIT_FLASH_DURATION_MS / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    // fully decayed once the duration elapses
    expect(tracker.intensityAt(1, 1000 + HIT_FLASH_DURATION_MS + 1)).toBe(0);
  });

  it('does not arm a flash on a heal or no-change sample', () => {
    const tracker = createHitFlashTracker();
    tracker.recordSample(1, 25, 0);
    tracker.recordSample(1, 40, 1000); // heal
    expect(tracker.intensityAt(1, 1000)).toBe(0);
    tracker.recordSample(1, 40, 2000); // no change
    expect(tracker.intensityAt(1, 2000)).toBe(0);
  });

  it('re-arms the flash when hp drops a second time', () => {
    const tracker = createHitFlashTracker();
    tracker.recordSample(1, 40, 0);
    tracker.recordSample(1, 30, 1000);
    // let it fully decay, then drop again
    tracker.recordSample(1, 20, 1000 + HIT_FLASH_DURATION_MS + 100);
    expect(tracker.intensityAt(1, 1000 + HIT_FLASH_DURATION_MS + 100)).toBeGreaterThan(0.9);
  });

  it('reports 0 intensity for an unknown id', () => {
    const tracker = createHitFlashTracker();
    expect(tracker.intensityAt(999, 0)).toBe(0);
  });

  it('forgets ids not in the visible set so the map stays bounded', () => {
    const tracker = createHitFlashTracker();
    tracker.recordSample(1, 40, 0);
    tracker.recordSample(2, 40, 0);
    tracker.recordSample(1, 25, 1000); // arm id 1
    tracker.pruneTo(new Set([2])); // id 1 left the visible set
    expect(tracker.intensityAt(1, 1000)).toBe(0);
    expect(tracker.size()).toBe(1);
  });

  it('reports whether any flash is currently active (for cache-busting)', () => {
    const tracker = createHitFlashTracker();
    tracker.recordSample(1, 40, 0);
    expect(tracker.hasActiveFlash(0)).toBe(false);
    tracker.recordSample(1, 25, 1000);
    expect(tracker.hasActiveFlash(1000)).toBe(true);
    // Stays active through a short clear-grace PAST the visual end (intensity is
    // already 0 there) so the scene runs one more clear-render — otherwise the
    // faint final frame could linger when the render cache freezes at expiry.
    const justExpired = 1000 + HIT_FLASH_DURATION_MS + 1;
    expect(tracker.intensityAt(1, justExpired)).toBe(0); // nothing drawn anymore
    expect(tracker.hasActiveFlash(justExpired)).toBe(true); // but keep rendering
    expect(tracker.hasActiveFlash(1000 + HIT_FLASH_DURATION_MS + FLASH_CLEAR_GRACE_MS + 1)).toBe(false);
  });
});

describe('feedHitFlashTracker', () => {
  it('tracks only unit-kind entities — buildings never arm a flash', () => {
    const tracker = createHitFlashTracker();
    feedHitFlashTracker(
      tracker,
      [
        { id: 1, currentHp: 40, kind: 'unit' },
        { id: 2, currentHp: 2400, kind: 'building' },
      ],
      0,
    );
    feedHitFlashTracker(
      tracker,
      [
        { id: 1, currentHp: 25, kind: 'unit' }, // unit took damage
        { id: 2, currentHp: 1800, kind: 'building' }, // building took damage
      ],
      1000,
    );
    expect(tracker.intensityAt(1, 1000)).toBeGreaterThan(0.9); // unit flashes
    expect(tracker.intensityAt(2, 1000)).toBe(0); // building never tracked
    expect(tracker.size()).toBe(1); // only the unit is tracked
  });
});

// A tiny Phaser.GameObjects.Graphics stand-in recording draw calls + points, so
// we can assert the flash draw set and that everything stays inside radius r.
function createGraphicsSpy() {
  const calls: Array<{ op: string; args: number[] }> = [];
  // Each drawn circle as (center + radius) so a test can verify the circle
  // itself stays within the unit bounding radius (the right check is
  // |center−cx| + radius <= r, NOT the bounding-box corner distance).
  const circles: Array<{ x: number; y: number; r: number }> = [];
  return {
    calls,
    circles,
    graphics: {
      fillStyle: (color: number, alpha?: number) => calls.push({ op: 'fillStyle', args: [color, alpha ?? 1] }),
      lineStyle: (width: number, color: number, alpha?: number) =>
        calls.push({ op: 'lineStyle', args: [width, color, alpha ?? 1] }),
      fillCircle: (x: number, y: number, r: number) => {
        calls.push({ op: 'fillCircle', args: [x, y, r] });
        circles.push({ x, y, r });
      },
      strokeCircle: (x: number, y: number, r: number) => {
        calls.push({ op: 'strokeCircle', args: [x, y, r] });
        circles.push({ x, y, r });
      },
    },
  };
}

describe('drawHitFlash', () => {
  it('draws nothing at zero intensity', () => {
    const spy = createGraphicsSpy();
    drawHitFlash(spy.graphics, 50, 50, 12, 0);
    expect(spy.calls.length).toBe(0);
  });

  it('draws within the unit bounding circle and scales alpha with intensity', () => {
    const cx = 50;
    const cy = 50;
    const r = 12;
    const strong = createGraphicsSpy();
    drawHitFlash(strong.graphics, cx, cy, r, 1);
    expect(strong.calls.length).toBeGreaterThan(0);
    // Every drawn circle stays inside the unit bounding circle of radius r:
    // its center offset plus its own radius does not exceed r.
    for (const circle of strong.circles) {
      const centerOffset = Math.hypot(circle.x - cx, circle.y - cy);
      expect(centerOffset + circle.r).toBeLessThanOrEqual(r + 1e-6);
    }
    const weak = createGraphicsSpy();
    drawHitFlash(weak.graphics, cx, cy, r, 0.25);
    const strongAlpha = Math.max(
      ...strong.calls.filter((c) => c.op === 'fillStyle' || c.op === 'lineStyle').map((c) => c.args.at(-1) ?? 0),
    );
    const weakAlpha = Math.max(
      ...weak.calls.filter((c) => c.op === 'fillStyle' || c.op === 'lineStyle').map((c) => c.args.at(-1) ?? 0),
    );
    expect(strongAlpha).toBeGreaterThan(weakAlpha);
  });

  it('is deterministic for the same inputs', () => {
    const a = createGraphicsSpy();
    const b = createGraphicsSpy();
    drawHitFlash(a.graphics, 10, 20, 8, 0.7);
    drawHitFlash(b.graphics, 10, 20, 8, 0.7);
    expect(a.calls).toEqual(b.calls);
  });
});
