// Pure-function visual-regression oracle. Compares run-time screenshot
// PNGs against committed baseline PNGs at the same tick milestones,
// firing a violation per frame whose pixel-diff fraction exceeds a
// threshold. Built on `pngjs` (decode) + `pixelmatch` (diff with
// anti-aliasing tolerance).
//
// I/O is callback-shaped so tests can drive against synthetic PNGs
// without touching disk; the runner-side adapter wraps `node:fs`.

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { OracleViolation } from './types';

export interface VisualOracleConfig {
  baselineDiffFractionMedium: number; // default 0.005
  baselineDiffFractionHigh: number; // default 0.05
  // Optional masks (in pixel coordinates) to ignore during diff —
  // typically used to mask the HUD's tick counter (which legitimately
  // changes per tick) so it doesn't dominate every diff.
  ignoreRects?: Array<{ x: number; y: number; width: number; height: number }>;
}

export const VISUAL_ORACLE_DEFAULTS: Required<Omit<VisualOracleConfig, 'ignoreRects'>> = {
  baselineDiffFractionMedium: 0.005,
  baselineDiffFractionHigh: 0.05,
};

export interface BaselineEntry {
  tick: number;
  // Raw PNG bytes for the baseline at this tick. The oracle decodes.
  pngBytes: Uint8Array;
}

export interface RunScreenshotEntry {
  tick: number;
  pngBytes: Uint8Array;
}

export interface RunVisualOracleInput {
  baselines: BaselineEntry[];
  runScreenshots: RunScreenshotEntry[];
  config?: VisualOracleConfig;
}

export interface VisualDelta {
  tick: number;
  diffFraction: number;
  totalPixels: number;
  diffPixels: number;
}

export interface RunVisualOracleResult {
  violations: OracleViolation[];
  /** Per-baseline-tick advisory delta (impl-1 H3 / DESIGN §4 advisory
   *  visual-novelty surfacing for LLM runs). The runner can write
   *  these into the trace summary even when no violation fires. */
  deltas: VisualDelta[];
  /** Baseline ticks that had no matching run-screenshot. Surface in
   *  the trace; not a violation by itself (the run may have stopped
   *  early, or screenshot capture was disabled). */
  missingTicks: number[];
}

export function runVisualOracle(input: RunVisualOracleInput): RunVisualOracleResult {
  const config = { ...VISUAL_ORACLE_DEFAULTS, ...(input.config ?? {}) };
  const ignoreRects = input.config?.ignoreRects ?? [];
  const violations: OracleViolation[] = [];
  const deltas: VisualDelta[] = [];
  const missingTicks: number[] = [];

  const runByTick = new Map<number, RunScreenshotEntry>();
  for (const entry of input.runScreenshots) runByTick.set(entry.tick, entry);

  for (const baseline of input.baselines) {
    const run = runByTick.get(baseline.tick);
    if (!run) {
      missingTicks.push(baseline.tick);
      continue;
    }
    const baselinePng = PNG.sync.read(Buffer.from(baseline.pngBytes));
    const runPng = PNG.sync.read(Buffer.from(run.pngBytes));
    if (
      baselinePng.width !== runPng.width
      || baselinePng.height !== runPng.height
    ) {
      violations.push({
        oracle: 'no-visual-regression',
        severity: 'high',
        tick: baseline.tick,
        message: `tick ${baseline.tick} screenshot dimension mismatch — baseline ${baselinePng.width}×${baselinePng.height}, run ${runPng.width}×${runPng.height}`,
        details: {
          tick: baseline.tick,
          baselineSize: { width: baselinePng.width, height: baselinePng.height },
          runSize: { width: runPng.width, height: runPng.height },
        },
      });
      continue;
    }
    const totalPixels = baselinePng.width * baselinePng.height;
    const diff = new PNG({ width: baselinePng.width, height: baselinePng.height });
    // diffMask: true paints UNCHANGED pixels transparent (alpha=0) and
    // changed pixels opaque red (255,0,0,255). This is what
    // countDiffInRect needs — without diffMask, pixelmatch's default
    // emits unchanged pixels as semi-transparent grayscale, and our
    // "non-zero RGB" detector would count them as diffs (Codex
    // impl-345 M4).
    const diffPixels = pixelmatch(
      baselinePng.data,
      runPng.data,
      diff.data,
      baselinePng.width,
      baselinePng.height,
      { threshold: 0.1, includeAA: false, diffMask: true },
    );
    // Subtract pixels that fall inside any ignoreRect, deduped across
    // overlapping rects (Codex impl-345 M4 second concern).
    const ignoredDiffPixels = countDiffInUnion(diff, ignoreRects);
    const adjustedDiff = Math.max(0, diffPixels - ignoredDiffPixels);
    const diffFraction = adjustedDiff / totalPixels;
    deltas.push({ tick: baseline.tick, diffFraction, totalPixels, diffPixels: adjustedDiff });

    if (diffFraction >= config.baselineDiffFractionHigh) {
      violations.push({
        oracle: 'no-visual-regression',
        severity: 'high',
        tick: baseline.tick,
        message: `tick ${baseline.tick} pixel-diff fraction ${(diffFraction * 100).toFixed(2)}% (threshold ${(config.baselineDiffFractionHigh * 100).toFixed(2)}%)`,
        details: {
          tick: baseline.tick,
          diffFraction,
          totalPixels,
          diffPixels: adjustedDiff,
        },
      });
    } else if (diffFraction >= config.baselineDiffFractionMedium) {
      violations.push({
        oracle: 'no-visual-regression',
        severity: 'medium',
        tick: baseline.tick,
        message: `tick ${baseline.tick} pixel-diff fraction ${(diffFraction * 100).toFixed(2)}% (threshold ${(config.baselineDiffFractionMedium * 100).toFixed(2)}%)`,
        details: {
          tick: baseline.tick,
          diffFraction,
          totalPixels,
          diffPixels: adjustedDiff,
        },
      });
    }
  }
  return { violations, deltas, missingTicks };
}

// Count pixels inside the union of all rects (overlap-deduped) where
// the pixelmatch diff mask is opaque (alpha > 0 = changed pixel under
// `diffMask: true`). Visits each (x, y) at most once across rects so
// overlapping ignoreRects don't double-subtract.
function countDiffInUnion(
  diff: PNG,
  rects: Array<{ x: number; y: number; width: number; height: number }>,
): number {
  if (rects.length === 0) return 0;
  let count = 0;
  // Bitmask over the diff dimensions tracks which pixels have been
  // counted in this pass — cheap when image is small (a 1024×768
  // canvas fits in a 96 KiB Uint8Array, fine for the harness).
  const seen = new Uint8Array(diff.width * diff.height);
  for (const rect of rects) {
    const xStart = Math.max(0, rect.x);
    const yStart = Math.max(0, rect.y);
    const xEnd = Math.min(diff.width, rect.x + rect.width);
    const yEnd = Math.min(diff.height, rect.y + rect.height);
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const seenIdx = y * diff.width + x;
        if (seen[seenIdx] !== 0) continue;
        seen[seenIdx] = 1;
        const pix = seenIdx * 4;
        if (diff.data[pix + 3]! !== 0) count += 1;
      }
    }
  }
  return count;
}
