// @vitest-environment jsdom
//
// GATE — a simulation step that refuses to advance names the condition that
// refused it, and the browser test seam relays that name plus the tick count
// it actually got.
//
// The defect this retires: `bridge.step()` returned early with NO signal in
// three cases — manually paused, halted, and a match that already resolved —
// so `window.__AOE2_TEST__.advanceTicks(3000)` against a menu-paused game
// returned zero ticks and threw nothing. Two sessions then reasoned from a
// hazard written down from that silence, and the hazard was wrong in both of
// its published forms. Confirmed live at v0.3.213 before this gate landed:
// menu-paused, `advanceTicks(3000, 100)` delivered 0 ticks, threw nothing, and
// left `matchState.outcome === 'running'` with `engineHalted === null` — the
// two fields a caller would consult, both saying nothing is wrong.
//
// BOUND — what this gate covers, and only this:
//   * The FOUR refusal reasons on the real objects: `paused`, `halted` and
//     `match-over` on a real `createSimulationBridge`, and `replay` on a real
//     `makeReplayBridge`. It asserts they are four DISTINCT values, because a
//     signal that cannot tell them apart is the defect in a new costume.
//   * One control per direction: a running, unpaused bridge reports no
//     refusal, so the gate cannot pass by refusing everything.
//   * The seam end to end: the REAL `installBrowserTestApi` driving the REAL
//     bridge, so the number `advanceTicks` reports comes from the world's own
//     per-step report and not from a tick counter it read separately.
//   * Seed `aoe2-prototype`, tick horizons in the tens. Match resolution is
//     forced with `gameLength` (the score timer, spec §4.3), NOT played out —
//     so this proves nothing about how a real match ends.
//
// Proven red at bcdc88c3 with the source reverted: 12 of the 13 cases failed,
// the source half on "step() returned no report" and the seam half on
// "expected undefined to be +0". The 13th — "keeps every field the existing
// callers already read" — passes on BOTH trees ON PURPOSE: it is the
// backwards-compatibility control for widening `advanceTicks`'s return value,
// so it is not part of the red and carries none of the gate's coverage.
//
// It does NOT prove:
//   * Anything about the LIVE frame loop. `AoeVoxelGameView.frame` calls
//     `bridge.step()` on every animation frame and DISCARDS the report, which
//     is correct — a halted or paused match refuses 60 times a second and must
//     stay silent. Nothing here runs that loop, measures its cost, or checks
//     that discarding the value stays correct.
//   * That the console warning below is bounded in a long run. It dedupes per
//     API installation, which is asserted here over two calls, not over a
//     campaign.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionReplayer, WorldTickFailureError } from 'civ-engine';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type {
  SimulationBridge,
  StepRefusal,
  StepReport,
} from '../../src/game/simulation/createSimulationBridge';
import {
  installBrowserTestApi,
  type BrowserTestBridge,
} from '../../src/app/bootstrap/browserTestApi';
import { makeReplayBridge } from '../../src/game/simulation/replay/makeReplayBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { recordCommandReplayFixture } from '../replay/replayCommandHelpers';
import type { AoeVoxelGameView } from '../../src/app/AoeVoxelGameView';

const SEED = 'aoe2-prototype';
/** `step(100)` is exactly one tick at TPS 10, so ticks and steps line up. */
const ONE_TICK_MS = 100;

/** Reads one step's report, failing with a quotable message on the unfixed
 *  tree, where `step()` returns nothing at all. */
function stepReport(bridge: SimulationBridge, deltaMs: number): StepReport {
  const report = bridge.step(deltaMs) as StepReport | undefined;
  if (report === undefined || typeof report.ticks !== 'number') {
    throw new Error(
      'step() returned no report: a step that refuses to advance must say so, '
      + 'and a step that advances must say how far.',
    );
  }
  return report;
}

/** The two view methods `advanceTicks` and its snapshot actually call. */
function fakeView(): AoeVoxelGameView {
  return {
    syncFromBridge: () => undefined,
    getCameraState: () => null,
  } as unknown as AoeVoxelGameView;
}

function installSeam(bridge: SimulationBridge): NonNullable<Window['__AOE2_TEST__']> {
  installBrowserTestApi(
    window,
    () => bridge as unknown as BrowserTestBridge,
    fakeView(),
    {
      replay: {
        getReplayMode: () => 'live' as const,
        getReplayCurrentTick: () => 0,
        openReplayLoadDialog: () => undefined,
        seedPriorSession: async () => undefined,
      },
      getRecording: () => ({} as never),
    },
  );
  return window.__AOE2_TEST__!;
}

/** Steps until the match stops running, or gives up — a `gameLength` match
 *  resolves within a handful of ticks, so the cap is a guard, not a horizon. */
function stepUntilResolved(bridge: SimulationBridge, maxSteps = 40): void {
  for (let index = 0; index < maxSteps; index += 1) {
    if (bridge.getMatchState().outcome !== 'running') return;
    bridge.step(ONE_TICK_MS);
  }
  throw new Error('the fixture match never resolved; the rest of this test measures nothing');
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  delete window.__AOE2_TEST__;
});

describe('a refused simulation step names what refused it', () => {
  it('reports no refusal, and the ticks it ran, while the match is running', () => {
    const bridge = createSimulationBridge(SEED);
    const report = stepReport(bridge, ONE_TICK_MS);
    expect(report.refusedBecause).toBeNull();
    expect(report.ticks).toBe(1);
    // The control for a partial: a delta too short to fill a tick runs none,
    // and that is NOT a refusal — zero ticks alone never means "it declined".
    const shortStep = stepReport(bridge, 10);
    expect(shortStep.ticks).toBe(0);
    expect(shortStep.refusedBecause).toBeNull();
  });

  it('says "paused" when the player is holding the game still', () => {
    const bridge = createSimulationBridge(SEED);
    bridge.setPaused(true);
    const tickBefore = bridge.world.tick;
    const report = stepReport(bridge, ONE_TICK_MS);
    expect(report.refusedBecause).toBe('paused');
    expect(report.ticks).toBe(0);
    expect(bridge.world.tick).toBe(tickBefore);
    // And it is not sticky: the reason goes away with the condition.
    bridge.setPaused(false);
    expect(stepReport(bridge, ONE_TICK_MS).refusedBecause).toBeNull();
  });

  it('says "halted" after a tick throws, and keeps saying it', () => {
    const bridge = createSimulationBridge(SEED);
    const worldStep = vi.spyOn(bridge.world, 'step').mockImplementation(() => {
      throw new WorldTickFailureError({
        schemaVersion: 1,
        tick: 1,
        phase: 'systems',
        code: 'system_threw',
        message: 'system blew up',
        subsystem: 'system:test',
        commandType: null,
        submissionSequence: null,
        systemName: 'test',
        details: null,
        error: { name: 'Error', message: 'boom', stack: null },
      } as never);
    });

    const failed = stepReport(bridge, ONE_TICK_MS);
    expect(failed.refusedBecause).toBe('halted');
    expect(failed.ticks).toBe(0);

    // Terminal: the world is never stepped again even once the throw stops.
    worldStep.mockRestore();
    expect(stepReport(bridge, ONE_TICK_MS).refusedBecause).toBe('halted');
  });

  it('reports the ticks that ran BEFORE a mid-call halt, and the halt', () => {
    const bridge = createSimulationBridge(SEED);
    let ticksTaken = 0;
    vi.spyOn(bridge.world, 'step').mockImplementation(function (this: unknown) {
      ticksTaken += 1;
      if (ticksTaken > 2) {
        throw new WorldTickFailureError({
          schemaVersion: 1,
          tick: 3,
          phase: 'systems',
          code: 'system_threw',
          message: 'system blew up',
          subsystem: 'system:test',
          commandType: null,
          submissionSequence: null,
          systemName: 'test',
          details: null,
          error: { name: 'Error', message: 'boom', stack: null },
        } as never);
      }
    });

    // Five ticks' worth of time, a failure on the third: both halves reported.
    const report = stepReport(bridge, ONE_TICK_MS * 5);
    expect(report.ticks).toBe(2);
    expect(report.refusedBecause).toBe('halted');
  });

  it('says "match-over" once the match has already resolved', () => {
    const bridge = createSimulationBridge(SEED, { gameLength: 5 });
    stepUntilResolved(bridge);
    expect(bridge.getMatchState().outcome).not.toBe('running');
    const report = stepReport(bridge, ONE_TICK_MS);
    expect(report.refusedBecause).toBe('match-over');
    expect(report.ticks).toBe(0);
    // A finished match is not a fault: nothing here is a halt.
    expect(bridge.getHudState().engineHalted).toBeNull();
  });

  it('says "replay" on a replay bridge, which frames never advance', () => {
    const { bundle } = recordCommandReplayFixture();
    const replayer = SessionReplayer.fromBundle(bundle, {
      worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
      skipRegistrationCheck: true,
    });
    const bridge = makeReplayBridge(replayer.openAt(bundle.metadata.endTick));
    const report = stepReport(bridge, ONE_TICK_MS);
    expect(report.refusedBecause).toBe('replay');
    expect(report.ticks).toBe(0);
  });

  it('gives each condition its OWN name, so a caller can tell them apart', () => {
    const reasons = new Set<StepRefusal | null>();

    const paused = createSimulationBridge(SEED);
    paused.setPaused(true);
    reasons.add(stepReport(paused, ONE_TICK_MS).refusedBecause);

    const halted = createSimulationBridge(SEED);
    vi.spyOn(halted.world, 'step').mockImplementation(() => {
      throw new WorldTickFailureError({
        schemaVersion: 1,
        tick: 1,
        phase: 'systems',
        code: 'system_threw',
        message: 'system blew up',
        subsystem: 'system:test',
        commandType: null,
        submissionSequence: null,
        systemName: 'test',
        details: null,
        error: { name: 'Error', message: 'boom', stack: null },
      } as never);
    });
    reasons.add(stepReport(halted, ONE_TICK_MS).refusedBecause);

    const over = createSimulationBridge(SEED, { gameLength: 5 });
    stepUntilResolved(over);
    reasons.add(stepReport(over, ONE_TICK_MS).refusedBecause);

    // Three conditions, three names — the whole point. Before this gate all
    // three were the same answer: nothing.
    expect(reasons.size).toBe(3);
    expect([...reasons].sort()).toEqual(['halted', 'match-over', 'paused']);
  });
});

describe('advanceTicks reports what it actually got, and why it stopped', () => {
  it('advances the whole request against a running, unpaused world', () => {
    const bridge = createSimulationBridge(SEED);
    const api = installSeam(bridge);
    const tickBefore = bridge.world.tick;

    const result = api.advanceTicks(30, ONE_TICK_MS);

    expect(result.ticksAdvanced).toBe(30);
    expect(result.stepsRun).toBe(30);
    expect(result.stepsRequested).toBe(30);
    expect(result.refusedBecause).toBeNull();
    expect(bridge.world.tick - tickBefore).toBe(30);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('THE DEFECT: a menu-paused world reports zero ticks and says "paused"', () => {
    const bridge = createSimulationBridge(SEED);
    const api = installSeam(bridge);
    // Exactly what the game menu does — PauseControl calls bridge.setPaused.
    // The seam did NOT apply this pause, so it does not lift it, and every
    // step below refuses. This is the case that came back as a silent zero.
    bridge.setPaused(true);
    const tickBefore = bridge.world.tick;

    const result = api.advanceTicks(3000, ONE_TICK_MS);

    expect(result.ticksAdvanced).toBe(0);
    expect(result.stepsRun).toBe(0);
    expect(result.stepsRequested).toBe(3000);
    expect(result.refusedBecause).toBe('paused');
    expect(bridge.world.tick).toBe(tickBefore);
    // Neither of the two fields a caller would otherwise consult says a word
    // about it — which is why the refusal has to be reported directly.
    expect(bridge.getMatchState().outcome).toBe('running');
    expect(bridge.getHudState().engineHalted).toBeNull();
    // And it is said out loud once, for a caller that ignores the value.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('paused');
    api.advanceTicks(10, ONE_TICK_MS);
    expect(warnSpy, 'one line per reason, not per call').toHaveBeenCalledTimes(1);
  });

  it('still lifts the pause it applied itself', () => {
    const bridge = createSimulationBridge(SEED);
    const api = installSeam(bridge);
    api.setPaused(true);

    const result = api.advanceTicks(10, ONE_TICK_MS);

    expect(result.ticksAdvanced).toBe(10);
    expect(result.refusedBecause).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('reports a SHORT advance and its reason when the match ends mid-request', () => {
    const bridge = createSimulationBridge(SEED, { gameLength: 5 });
    const api = installSeam(bridge);

    const result = api.advanceTicks(3000, ONE_TICK_MS);

    // The headline: asked for 3000, got fewer, and the caller can read both
    // the number and the reason off the return value.
    expect(result.stepsRequested).toBe(3000);
    expect(result.ticksAdvanced).toBeGreaterThan(0);
    expect(result.ticksAdvanced).toBeLessThan(3000);
    expect(result.refusedBecause).toBe('match-over');
    expect(bridge.getMatchState().outcome).not.toBe('running');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('match-over');
  });

  it('reports "halted" through the seam when a tick throws mid-request', () => {
    const bridge = createSimulationBridge(SEED);
    const api = installSeam(bridge);
    let ticksTaken = 0;
    vi.spyOn(bridge.world, 'step').mockImplementation(() => {
      ticksTaken += 1;
      if (ticksTaken > 3) {
        throw new WorldTickFailureError({
          schemaVersion: 1,
          tick: 4,
          phase: 'systems',
          code: 'system_threw',
          message: 'system blew up',
          subsystem: 'system:test',
          commandType: null,
          submissionSequence: null,
          systemName: 'test',
          details: null,
          error: { name: 'Error', message: 'boom', stack: null },
        } as never);
      }
    });

    const result = api.advanceTicks(500, ONE_TICK_MS);

    expect(result.ticksAdvanced).toBe(3);
    expect(result.refusedBecause).toBe('halted');
    expect(result.stepsRun).toBe(3);
    // The seam's reason and the bridge's own halt record agree.
    expect(bridge.getHudState().engineHalted).not.toBeNull();
  });

  it('keeps every field the existing callers already read', () => {
    const bridge = createSimulationBridge(SEED);
    const api = installSeam(bridge);
    const result = api.advanceTicks(2, ONE_TICK_MS);
    // Widening the return value must not have moved the snapshot out from
    // under the browser specs and capture scripts that read these four.
    expect(result.hudState.tick).toBeGreaterThan(0);
    expect(result.renderState).toBeDefined();
    expect(result.economyState).toBeDefined();
    expect(result.selectionState).toBeDefined();
  });
});
