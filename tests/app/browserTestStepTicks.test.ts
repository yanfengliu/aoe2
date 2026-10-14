// @vitest-environment jsdom
//
// `stepTicks` steps the world the way `advanceTicks` does and does none of
// its drawing work: no forced view sync, no snapshot.
//
// Why it exists (work 123, 2026-10-13). `advanceTicks` forces the view to
// sync and builds a whole-world snapshot after every call, about 8 ms in the
// page on a SwiftShader canvas. A spec that checks a condition every tick pays
// that every tick: the barracks-rush spec stepped 1,369 ticks one at a time,
// 13.2 s in the page, of which the simulation itself was 1.9 s
// (tmp/probes/pw/barracks-cost.probe.ts). On CI it ran at 57-58% of its 30 s
// limit, close to the two-thirds line `scripts/test-time-headroom.mjs` draws.
//
// What is checked, on the REAL `installBrowserTestApi` over a REAL bridge:
// (1) It advances what was asked and reports the same tally `advanceTicks`
//     does, read off the world's own per-step reports.
// (2) It draws nothing: the view is not synced, and the result carries the
//     tally and nothing else, so a caller cannot read a stale snapshot off it.
// (3) A refusal is reported, and warned about once per reason, shared with
//     `advanceTicks`; the pause the API applied itself is lifted and put back.
// (4) It plays the same match: one tick at a time through `stepTicks` and
//     through `advanceTicks`, the two worlds have the same civ-engine
//     `stateDigest` every 10 ticks. The forced sync and the snapshot only
//     READ the world (tests/simulation/renderProjectionOnRead.test.ts proves
//     the render projection never writes to it), so skipping them must not
//     change the match.
//
// BOUND. A fake view, so (4) proves the step loops agree, not that the real
// view's sync leaves the world alone; the barracks spec's break tick, equal
// under both loops in the browser, is that half (work 123 plan). One seed,
// 120 ticks.

import { stateDigest } from 'civ-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AoeVoxelGameView } from '../../src/app/AoeVoxelGameView';
import { installBrowserTestApi, type BrowserTestBridge } from '../../src/app/bootstrap/browserTestApi';
import { createSimulationBridge, type SimulationBridge } from '../../src/game/simulation/createSimulationBridge';

const SEED = 'aoe2-prototype';
/** `step(100)` is exactly one tick at TPS 10, so ticks and steps line up. */
const ONE_TICK_MS = 100;

function install(bridge: SimulationBridge, syncFromBridge = vi.fn()) {
  const view = { syncFromBridge, getCameraState: () => null } as unknown as AoeVoxelGameView;
  // A second install replaces the first and keeps it as `previous`; each test
  // deletes the global afterwards, so every test starts from none.
  installBrowserTestApi(window, () => bridge as unknown as BrowserTestBridge, view, {
    replay: {
      getReplayMode: () => 'live' as const,
      getReplayCurrentTick: () => 0,
      openReplayLoadDialog: () => undefined,
      seedPriorSession: async () => undefined,
    },
    getRecording: () => ({} as never),
  });
  return { api: window.__AOE2_TEST__!, syncFromBridge };
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

describe('stepTicks steps the world and draws nothing', () => {
  it('advances the whole request and reports the tally advanceTicks reports', () => {
    const bridge = createSimulationBridge(SEED);
    const { api } = install(bridge);
    const tickBefore = bridge.world.tick;

    const result = api.stepTicks(30, ONE_TICK_MS);

    expect(result).toEqual({ stepsRequested: 30, stepsRun: 30, ticksAdvanced: 30, refusedBecause: null });
    expect(bridge.world.tick - tickBefore).toBe(30);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('syncs no view and returns no snapshot, unlike advanceTicks', () => {
    const bridge = createSimulationBridge(SEED);
    const { api, syncFromBridge } = install(bridge);

    const stepped = api.stepTicks(5, ONE_TICK_MS);
    expect(syncFromBridge, 'stepTicks drew the view').not.toHaveBeenCalled();
    expect(Object.keys(stepped).sort()).toEqual(['refusedBecause', 'stepsRequested', 'stepsRun', 'ticksAdvanced']);

    // The control: advanceTicks does both, so the spy is wired to the view the
    // API really calls.
    const advanced = api.advanceTicks(5, ONE_TICK_MS);
    expect(syncFromBridge).toHaveBeenCalled();
    expect(advanced.economyState).toBeDefined();
  });

  it('says "paused" for a menu-paused world, once per reason across both methods', () => {
    const bridge = createSimulationBridge(SEED);
    const { api } = install(bridge);
    bridge.setPaused(true);

    const result = api.stepTicks(3000, ONE_TICK_MS);

    expect(result).toEqual({ stepsRequested: 3000, stepsRun: 0, ticksAdvanced: 0, refusedBecause: 'paused' });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('stepTicks(3000, 100)');
    expect(String(warnSpy.mock.calls[0][0])).toContain('"paused"');
    api.advanceTicks(10, ONE_TICK_MS);
    api.stepTicks(10, ONE_TICK_MS);
    expect(warnSpy, 'one line per reason, not per call or per method').toHaveBeenCalledTimes(1);
  });

  it('lifts the pause the API applied itself, and puts it back', () => {
    const bridge = createSimulationBridge(SEED);
    const { api } = install(bridge);
    api.setPaused(true);

    expect(api.stepTicks(10, ONE_TICK_MS).ticksAdvanced).toBe(10);
    // Still paused afterwards: the bridge's own step refuses.
    expect(bridge.step(ONE_TICK_MS).refusedBecause).toBe('paused');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('plays the same match as advanceTicks, tick by tick', () => {
    const viaAdvance = createSimulationBridge(SEED);
    const viaStep = createSimulationBridge(SEED);
    const advance = install(viaAdvance).api;
    delete window.__AOE2_TEST__;
    const step = install(viaStep).api;
    const differing: number[] = [];
    for (let tick = 1; tick <= 120; tick += 1) {
      advance.advanceTicks(1, ONE_TICK_MS);
      step.stepTicks(1, ONE_TICK_MS);
      if (tick % 10 === 0 && stateDigest(viaStep.world.serialize()) !== stateDigest(viaAdvance.world.serialize())) {
        differing.push(tick);
      }
    }
    expect(viaStep.world.tick).toBe(viaAdvance.world.tick);
    expect(viaStep.world.tick, 'the worlds did not move, so nothing was compared').toBeGreaterThanOrEqual(120);
    expect(differing, 'the two methods played different matches at these ticks').toEqual([]);
  }, 60_000);
});
