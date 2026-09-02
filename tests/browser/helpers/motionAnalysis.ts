// Frame-by-frame analysis of a DRAWN unit trajectory: the numbers behind the
// unit-motion-smoothness gate. A sample is what the presentation layer put on
// screen for one frame (displayedEntities), paired with the sim position it
// was drawn from, so the report can say both "did the picture stand still"
// and "did the unit really walk" (the instrument check).

export interface MotionSample {
  /** Frame time in ms — a fixed 1000/60 grid for driven frames, the rAF
   *  timestamp for live ones. */
  readonly timeMs: number;
  readonly x: number;
  readonly y: number;
  readonly simX: number;
  readonly simY: number;
}

export interface MotionReport {
  readonly sampledFrames: number;
  /** Frames inside the analysed window: after the first drawn movement plus
   *  the edge margin, before the last drawn movement minus it. */
  readonly windowFrames: number;
  /** Window frames whose drawn root did not move at all. */
  readonly stillFrames: number;
  readonly stillShare: number;
  /** Per-frame drawn displacement extremes over the MOVING window frames. */
  readonly minStep: number;
  readonly maxStep: number;
  readonly stepRatio: number;
  /** Per-frame drawn speed extremes (tiles/s) over the moving window frames,
   *  for live samples whose frame times vary. */
  readonly minSpeed: number;
  readonly maxSpeed: number;
  /** Straight-line tiles the SIM and the DRAWN root covered end to end. */
  readonly simTiles: number;
  readonly shownTiles: number;
}

const STILL_EPSILON = 1e-9;

export function analyseMotion(
  samples: readonly MotionSample[],
  edgeMs = 300,
): MotionReport {
  const steps = samples.slice(1).map((sample, index) => {
    const previous = samples[index]!;
    return {
      timeMs: sample.timeMs,
      dtMs: sample.timeMs - previous.timeMs,
      distance: Math.hypot(sample.x - previous.x, sample.y - previous.y),
    };
  });
  const movingTimes = steps.filter((step) => step.distance > STILL_EPSILON).map((step) => step.timeMs);
  const first = samples[0];
  const last = samples[samples.length - 1];
  const simTiles = first && last ? Math.hypot(last.simX - first.simX, last.simY - first.simY) : 0;
  const shownTiles = first && last ? Math.hypot(last.x - first.x, last.y - first.y) : 0;
  if (movingTimes.length === 0) {
    return {
      sampledFrames: samples.length,
      windowFrames: 0,
      stillFrames: 0,
      stillShare: 0,
      minStep: 0,
      maxStep: 0,
      stepRatio: 0,
      minSpeed: 0,
      maxSpeed: 0,
      simTiles,
      shownTiles,
    };
  }
  const windowStart = movingTimes[0]! + edgeMs;
  const windowEnd = movingTimes[movingTimes.length - 1]! - edgeMs;
  const window = steps.filter((step) => step.timeMs >= windowStart && step.timeMs <= windowEnd);
  const moving = window.filter((step) => step.distance > STILL_EPSILON);
  const stillFrames = window.length - moving.length;
  const distances = moving.map((step) => step.distance);
  const speeds = moving
    .filter((step) => step.dtMs > 0)
    .map((step) => step.distance * 1_000 / step.dtMs);
  const minStep = distances.length ? Math.min(...distances) : 0;
  const maxStep = distances.length ? Math.max(...distances) : 0;
  return {
    sampledFrames: samples.length,
    windowFrames: window.length,
    stillFrames,
    stillShare: window.length ? stillFrames / window.length : 0,
    minStep,
    maxStep,
    stepRatio: minStep > 0 ? maxStep / minStep : 0,
    minSpeed: speeds.length ? Math.min(...speeds) : 0,
    maxSpeed: speeds.length ? Math.max(...speeds) : 0,
    simTiles,
    shownTiles,
  };
}

export interface HopReport {
  readonly sampledFrames: number;
  /** Sim position changes observed in the series. */
  readonly hops: number;
  /** Frames inside a flight span: the `spanFrames` frames after each hop
   *  landed, where a mover on a whole-cell cadence should be drawn crossing
   *  the cell. Spans of consecutive hops overlap into one. */
  readonly flightFrames: number;
  /** Flight frames whose drawn root did not move at all. */
  readonly stillFrames: number;
  readonly stillShare: number;
  /** Per-frame drawn displacement extremes over the MOVING flight frames. */
  readonly minStep: number;
  readonly maxStep: number;
  readonly stepRatio: number;
  /** Straight-line tiles the SIM covered end to end. */
  readonly simTiles: number;
}

/** For a mover the sim advances a whole cell at a time on a tick-modulo
 *  clock (a fleeing deer: one cell every fourteenth tick) and that may also
 *  legitimately stand between hops when its pursuer drops out of range, the
 *  question is not "did it ever stand" but "was each hop drawn as a crossing
 *  or as a jump": only the `spanFrames` after each hop are judged. */
export function analyseHops(samples: readonly MotionSample[], spanFrames: number): HopReport {
  const flight = new Set<number>();
  let hops = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const sample = samples[index]!;
    const previous = samples[index - 1]!;
    if (sample.simX === previous.simX && sample.simY === previous.simY) continue;
    hops += 1;
    for (let step = index + 1; step <= index + spanFrames && step < samples.length; step += 1) {
      flight.add(step);
    }
  }
  const distances = [...flight].map((step) => {
    const sample = samples[step]!;
    const previous = samples[step - 1]!;
    return Math.hypot(sample.x - previous.x, sample.y - previous.y);
  });
  const moving = distances.filter((distance) => distance > STILL_EPSILON);
  const stillFrames = distances.length - moving.length;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const minStep = moving.length ? Math.min(...moving) : 0;
  const maxStep = moving.length ? Math.max(...moving) : 0;
  return {
    sampledFrames: samples.length,
    hops,
    flightFrames: distances.length,
    stillFrames,
    stillShare: distances.length ? stillFrames / distances.length : 0,
    minStep,
    maxStep,
    stepRatio: minStep > 0 ? maxStep / minStep : 0,
    simTiles: first && last ? Math.hypot(last.simX - first.simX, last.simY - first.simY) : 0,
  };
}

export function describeHops(report: HopReport): string {
  return [
    `frames ${String(report.sampledFrames)}, hops ${String(report.hops)} (flight frames ${String(report.flightFrames)})`,
    `still ${String(report.stillFrames)} = ${(report.stillShare * 100).toFixed(1)}%`,
    `step min/max ${report.minStep.toFixed(4)}/${report.maxStep.toFixed(4)} tiles (ratio ${report.stepRatio.toFixed(2)})`,
    `sim ${report.simTiles.toFixed(2)} tiles`,
  ].join('; ');
}

export function describeMotion(report: MotionReport): string {
  return [
    `frames ${String(report.sampledFrames)} (window ${String(report.windowFrames)})`,
    `still ${String(report.stillFrames)} = ${(report.stillShare * 100).toFixed(1)}%`,
    `step min/max ${report.minStep.toFixed(4)}/${report.maxStep.toFixed(4)} tiles (ratio ${report.stepRatio.toFixed(2)})`,
    `speed min/max ${report.minSpeed.toFixed(2)}/${report.maxSpeed.toFixed(2)} tiles/s`,
    `sim ${report.simTiles.toFixed(2)} tiles, drawn ${report.shownTiles.toFixed(2)} tiles`,
  ].join('; ');
}
