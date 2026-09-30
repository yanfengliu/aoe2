// Shared tick accounting for the maintained self-play measurement tools.
// A failed engine tick can consume its tick number; the StepReport and the
// world counter must both confirm success before it enters a denominator.
export function assertTickCount(value, label, allowZero = true) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new Error(`${label} must be a ${allowZero ? 'non-negative' : 'positive'} safe integer; got ${value}`);
  }
}

export function advanceMeasuredTicks(bridge, requestedTicks, label = 'measurement') {
  assertTickCount(requestedTicks, `${label} requested ticks`);
  const startTick = bridge.world.tick;
  let ticks = 0;
  while (ticks < requestedTicks && bridge.getMatchState().outcome === 'running') {
    const before = bridge.world.tick;
    const report = bridge.step(100);
    const delta = bridge.world.tick - before;
    if (report.refusedBecause !== null && report.refusedBecause !== 'match-over') {
      throw new Error(`${label} stopped: step refused because ${report.refusedBecause} after ${ticks} successful ticks `
        + `(world ${before}..${bridge.world.tick}); use a running, unpaused live world with successful steps.`);
    }
    if (report.refusedBecause === 'match-over' && report.ticks === 0 && delta === 0) break;
    if (report.ticks !== 1 || delta !== 1) {
      throw new Error(`${label} did not advance exactly one successful tick: StepReport ticks=${report.ticks}, `
        + `world delta=${delta}, refusal=${report.refusedBecause}; use a bridge whose 100ms step completes one tick.`);
    }
    ticks += report.ticks;
    if (report.refusedBecause === 'match-over') break;
  }
  return { startTick, endTick: bridge.world.tick, ticks, label };
}

export function profileTickLabel(range) {
  return `ticks ${range.startTick}..${range.endTick}`;
}

export function profileWorldSeed(bridge) {
  return bridge.saveGame().seed;
}

export function requireSampleTicks(range) {
  if (range.ticks === 0) {
    throw new Error(`${range.label} did not run any successful ticks at world tick ${range.startTick}; `
      + 'request a positive sample from a match that is still running.');
  }
  return range;
}
