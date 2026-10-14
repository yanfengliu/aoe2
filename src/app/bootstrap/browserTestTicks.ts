import type { StepRefusal } from '../../game/simulation/simulationBridgeTypes';
import type { StepRunTally } from '../../game/simulation/bridge/stepReport';
import type { AoeVoxelGameView } from '../AoeVoxelGameView';
import type { BrowserTestAdvanceResult, BrowserTestBridge, BrowserTestSnapshot } from './browserTestApi';

/** The test API's tick stepping and its whole-world snapshot. */
export interface BrowserTestTicks {
  getSnapshot(): BrowserTestSnapshot;
  setPaused(paused: boolean): void;
  advanceTicks(count: number, deltaMs?: number): BrowserTestAdvanceResult;
  stepTicks(count: number, deltaMs?: number): StepRunTally;
}

function snapshotOf(bridge: BrowserTestBridge, view: AoeVoxelGameView): BrowserTestSnapshot {
  view.syncFromBridge(true);
  return {
    hudState: bridge.getHudState(),
    renderState: bridge.getRenderState(),
    economyState: bridge.getEconomyState(),
    selectionState: bridge.getSelectionState(),
    cameraState: view.getCameraState(),
  };
}

export function makeBrowserTestTicks(
  getBridge: () => BrowserTestBridge,
  view: AoeVoxelGameView,
): BrowserTestTicks {
  let pausedThroughTestApi = false;
  const warnedRefusals = new Set<StepRefusal>(); // said out loud already

  function step(
    method: 'advanceTicks' | 'stepTicks',
    liveBridge: BrowserTestBridge,
    count: number,
    deltaMs: number,
  ): StepRunTally {
    const safeCount = Math.max(0, Math.floor(count));
    const safeDeltaMs = Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 100;
    // Only the pause THIS api applied is lifted. A pause set through the game
    // menu stays on, every step below refuses, and THAT was the silent zero.
    if (pausedThroughTestApi) liveBridge.setPaused(false);
    let ticksAdvanced = 0;
    let stepsRun = 0;
    let refusedBecause: StepRefusal | null = null;
    try {
      for (let index = 0; index < safeCount; index += 1) {
        const report = liveBridge.step(safeDeltaMs);
        ticksAdvanced += report.ticks;
        // Every reason outlives this loop, so the rest of `count` would burn.
        if (report.refusedBecause !== null) {
          refusedBecause = report.refusedBecause;
          break;
        }
        stepsRun += 1;
      }
    } finally {
      if (pausedThroughTestApi) liveBridge.setPaused(true);
    }
    // For a caller that ignores the return value. Once per reason, not per
    // call, or a poll loop around a finished match prints thousands of lines;
    // `warn` not `error`, because a finished match is not a fault.
    if (refusedBecause !== null && !warnedRefusals.has(refusedBecause)) {
      warnedRefusals.add(refusedBecause);
      console.warn(
        `[aoe2 test api] ${method}(${String(safeCount)}, ${String(safeDeltaMs)}) advanced `
        + `${String(ticksAdvanced)} tick(s) then stopped: the simulation refused to step `
        + `because "${refusedBecause}". Read refusedBecause/ticksAdvanced off the result.`,
      );
    }
    return { stepsRequested: safeCount, stepsRun, ticksAdvanced, refusedBecause };
  }

  return {
    getSnapshot: () => snapshotOf(getBridge(), view),
    setPaused: (paused: boolean) => {
      pausedThroughTestApi = paused;
      getBridge().setPaused(paused);
    },
    advanceTicks: (count: number, deltaMs = 100) => {
      const liveBridge = getBridge();
      const tally = step('advanceTicks', liveBridge, count, deltaMs);
      view.syncFromBridge(true);
      return { ...snapshotOf(liveBridge, view), ...tally };
    },
    // No forced view sync and no snapshot: the frame loop syncs the view on
    // its next frame, and a caller reads the one state it needs (work 123).
    stepTicks: (count: number, deltaMs = 100) => step('stepTicks', getBridge(), count, deltaMs),
  };
}
