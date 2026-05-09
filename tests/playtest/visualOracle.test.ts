import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { runVisualOracle } from '../../src/game/playtest/visualOracle';

// Helpers for synthetic PNGs. Build a 16×16 image with optional pixel
// modifications, encode as PNG bytes.
function makePng(
  width: number,
  height: number,
  fill: [number, number, number, number] = [255, 255, 255, 255],
  modifications: Array<{ x: number; y: number; rgba: [number, number, number, number] }> = [],
): Uint8Array {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      png.data[idx] = fill[0];
      png.data[idx + 1] = fill[1];
      png.data[idx + 2] = fill[2];
      png.data[idx + 3] = fill[3];
    }
  }
  for (const m of modifications) {
    const idx = (m.y * width + m.x) * 4;
    png.data[idx] = m.rgba[0];
    png.data[idx + 1] = m.rgba[1];
    png.data[idx + 2] = m.rgba[2];
    png.data[idx + 3] = m.rgba[3];
  }
  return new Uint8Array(PNG.sync.write(png));
}

const SIZE = 16;

describe('runVisualOracle', () => {
  it('returns no violations when baseline and run match exactly', () => {
    const png = makePng(SIZE, SIZE);
    const result = runVisualOracle({
      baselines: [{ tick: 1000, pngBytes: png }],
      runScreenshots: [{ tick: 1000, pngBytes: png }],
    });
    expect(result.violations).toHaveLength(0);
    expect(result.deltas[0]!.diffFraction).toBe(0);
  });

  it('fires medium when 1% of pixels differ', () => {
    const baseline = makePng(SIZE, SIZE);
    // 16×16 = 256 pixels. Modify 3 pixels (~1.2%) — above medium 0.5% threshold.
    const run = makePng(SIZE, SIZE, [255, 255, 255, 255], [
      { x: 0, y: 0, rgba: [255, 0, 0, 255] },
      { x: 1, y: 0, rgba: [255, 0, 0, 255] },
      { x: 2, y: 0, rgba: [255, 0, 0, 255] },
    ]);
    const result = runVisualOracle({
      baselines: [{ tick: 1000, pngBytes: baseline }],
      runScreenshots: [{ tick: 1000, pngBytes: run }],
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.severity).toBe('medium');
    expect(result.violations[0]!.tick).toBe(1000);
  });

  it('fires high when 6% of pixels differ', () => {
    const baseline = makePng(SIZE, SIZE);
    // Modify 16 pixels = 6.25% — above high 5% threshold.
    const mods = Array.from({ length: 16 }, (_, i) => ({
      x: i,
      y: 0,
      rgba: [255, 0, 0, 255] as [number, number, number, number],
    }));
    const run = makePng(SIZE, SIZE, [255, 255, 255, 255], mods);
    const result = runVisualOracle({
      baselines: [{ tick: 1000, pngBytes: baseline }],
      runScreenshots: [{ tick: 1000, pngBytes: run }],
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.severity).toBe('high');
  });

  it('reports missing baseline ticks (no matching run-screenshot)', () => {
    const png = makePng(SIZE, SIZE);
    const result = runVisualOracle({
      baselines: [
        { tick: 1000, pngBytes: png },
        { tick: 2000, pngBytes: png },
      ],
      runScreenshots: [{ tick: 1000, pngBytes: png }],
    });
    expect(result.missingTicks).toEqual([2000]);
    expect(result.violations).toHaveLength(0);
  });

  it('fires HIGH when dimensions mismatch', () => {
    const baseline = makePng(16, 16);
    const run = makePng(8, 8);
    const result = runVisualOracle({
      baselines: [{ tick: 1000, pngBytes: baseline }],
      runScreenshots: [{ tick: 1000, pngBytes: run }],
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.severity).toBe('high');
    expect(result.violations[0]!.message).toContain('dimension mismatch');
  });

  it('respects ignoreRects — diff inside the rect is excluded', () => {
    const baseline = makePng(SIZE, SIZE);
    // Modify 16 pixels but ALL inside an ignored rect (covers x:0-3, y:0-3 = 16 pixels).
    const mods = Array.from({ length: 16 }, (_, i) => ({
      x: i % 4,
      y: Math.floor(i / 4),
      rgba: [255, 0, 0, 255] as [number, number, number, number],
    }));
    const run = makePng(SIZE, SIZE, [255, 255, 255, 255], mods);
    const result = runVisualOracle({
      baselines: [{ tick: 1000, pngBytes: baseline }],
      runScreenshots: [{ tick: 1000, pngBytes: run }],
      config: {
        baselineDiffFractionMedium: 0.005,
        baselineDiffFractionHigh: 0.05,
        ignoreRects: [{ x: 0, y: 0, width: 4, height: 4 }],
      },
    });
    expect(result.violations).toHaveLength(0); // all diff was inside ignored region
    expect(result.deltas[0]!.diffPixels).toBe(0);
  });

  it('emits a delta entry per matched baseline regardless of violation', () => {
    const png = makePng(SIZE, SIZE);
    const result = runVisualOracle({
      baselines: [
        { tick: 100, pngBytes: png },
        { tick: 200, pngBytes: png },
        { tick: 300, pngBytes: png },
      ],
      runScreenshots: [
        { tick: 100, pngBytes: png },
        { tick: 200, pngBytes: png },
        { tick: 300, pngBytes: png },
      ],
    });
    expect(result.deltas).toHaveLength(3);
    expect(result.deltas.map((d) => d.tick)).toEqual([100, 200, 300]);
  });

  it('overlapping ignoreRects do not double-subtract (impl-345 M4)', () => {
    const baseline = makePng(SIZE, SIZE);
    // Modify 9 pixels in a 3×3 block (x:0-2, y:0-2). Two overlapping
    // ignore rects each cover the whole block — the union covers it
    // exactly once. Naive impl would subtract 18 (>actual diff), under-
    // reporting; the union-aware impl subtracts 9 and gets 0 diff.
    const mods = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        mods.push({ x, y, rgba: [255, 0, 0, 255] as [number, number, number, number] });
      }
    }
    const run = makePng(SIZE, SIZE, [255, 255, 255, 255], mods);
    const result = runVisualOracle({
      baselines: [{ tick: 1, pngBytes: baseline }],
      runScreenshots: [{ tick: 1, pngBytes: run }],
      config: {
        baselineDiffFractionMedium: 0.005,
        baselineDiffFractionHigh: 0.05,
        ignoreRects: [
          { x: 0, y: 0, width: 3, height: 3 },
          { x: 0, y: 0, width: 3, height: 3 }, // duplicate / overlap
        ],
      },
    });
    expect(result.violations).toHaveLength(0);
    expect(result.deltas[0]!.diffPixels).toBe(0); // not negative
  });

  it('does NOT count unchanged pixels inside ignoreRects (impl-345 M4 diffMask)', () => {
    // Without diffMask: true, pixelmatch paints unchanged pixels as
    // grayscale (non-zero RGB). Pre-fix, countDiffInRect would have
    // counted those as diffs and over-subtracted, masking real
    // regressions outside the rect.
    //
    // Setup: 1 real diff at (10, 0) outside the ignored rect, plus
    // 16 unchanged pixels inside the ignored rect (0,0,4,4). Pre-fix:
    // ignoredDiffPixels would over-count the unchanged region and
    // adjustedDiff could go to 0. Post-fix: only diff-mask alpha>0
    // pixels count, so the 1-pixel diff outside the rect survives.
    const baseline = makePng(SIZE, SIZE);
    const run = makePng(SIZE, SIZE, [255, 255, 255, 255], [
      { x: 10, y: 0, rgba: [255, 0, 0, 255] }, // 1 real diff outside rect
    ]);
    const result = runVisualOracle({
      baselines: [{ tick: 1, pngBytes: baseline }],
      runScreenshots: [{ tick: 1, pngBytes: run }],
      config: {
        baselineDiffFractionMedium: 0.001, // tight threshold (0.1%)
        baselineDiffFractionHigh: 0.05,
        ignoreRects: [{ x: 0, y: 0, width: 4, height: 4 }],
      },
    });
    // 1 diff pixel out of 256 = 0.39% — above 0.1% medium threshold.
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]!.severity).toBe('medium');
  });

  it('respects custom thresholds (per-row config)', () => {
    const baseline = makePng(SIZE, SIZE);
    const run = makePng(SIZE, SIZE, [255, 255, 255, 255], [
      { x: 0, y: 0, rgba: [255, 0, 0, 255] }, // 1 pixel = 0.39%
    ]);
    // Default threshold (0.5% medium) → no violation. Tighter
    // threshold (0.1% medium) → violation.
    const defaultRun = runVisualOracle({
      baselines: [{ tick: 1, pngBytes: baseline }],
      runScreenshots: [{ tick: 1, pngBytes: run }],
    });
    expect(defaultRun.violations).toHaveLength(0);
    const tightRun = runVisualOracle({
      baselines: [{ tick: 1, pngBytes: baseline }],
      runScreenshots: [{ tick: 1, pngBytes: run }],
      config: { baselineDiffFractionMedium: 0.001, baselineDiffFractionHigh: 0.05 },
    });
    expect(tightRun.violations).toHaveLength(1);
  });
});
