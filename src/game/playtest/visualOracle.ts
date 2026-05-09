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
    const diffPixels = pixelmatch(
      baselinePng.data,
      runPng.data,
      diff.data,
      baselinePng.width,
      baselinePng.height,
      { threshold: 0.1, includeAA: false },
    );
    // Subtract pixels that fall inside any ignoreRect — they aren't
    // counted as diff.
    let ignoredDiffPixels = 0;
    for (const rect of ignoreRects) {
      ignoredDiffPixels += countDiffInRect(diff, rect);
    }
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

function countDiffInRect(
  diff: PNG,
  rect: { x: number; y: number; width: number; height: number },
): number {
  let count = 0;
  const xEnd = Math.min(diff.width, rect.x + rect.width);
  const yEnd = Math.min(diff.height, rect.y + rect.height);
  const xStart = Math.max(0, rect.x);
  const yStart = Math.max(0, rect.y);
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const idx = (y * diff.width + x) * 4;
      // pixelmatch sets non-matching pixels to red/green; treat any
      // non-zero alpha-channel difference as a counted pixel.
      if (
        diff.data[idx]! !== 0
        || diff.data[idx + 1]! !== 0
        || diff.data[idx + 2]! !== 0
      ) {
        count += 1;
      }
    }
  }
  return count;
}
