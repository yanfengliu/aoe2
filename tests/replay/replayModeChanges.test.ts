// The replay controller announces a switch of world, and nothing else
// (defect register 2026-09-24, "Coming back from a replay").
//
// The audio mount resets the attack warning on every mode change (spec §14.5,
// the attack warning, point (4)), so this contract is what keeps moving within
// a recording from announcing the replayed raid again: a step, a scrub, a
// marker jump and a fog-owner switch each build a new bridge over the same
// recording and must emit no mode change. Entering and leaving emit one each,
// and only once the bridge cell holds the new world, because the reset reads
// that world's match outcome and countdown. Found missing by the independent
// review of the fix: a mode change added to `setFogOwner`, say to refresh a
// label, would have re-armed the warning on every fog switch with every other
// gate green.
//
// BOUNDS: a stub replay bridge over one recorded fixture. That the mount
// resets on these changes is `tests/ui/gameAudioMount.test.ts`, and that the
// real page does is `tests/browser/attack-warning-replay-exit.spec.ts`.

import type { Marker } from 'civ-engine';
import { describe, expect, it, vi } from 'vitest';

import { createReplayController } from '../../src/game/replay/ReplayController';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { recordCommandReplayFixture } from './replayCommandHelpers';

function stubBridge(world: GameWorld): SimulationBridge {
  return {
    world,
    step: vi.fn(),
    setPaused: vi.fn(),
    getSelectedEntityRefs: vi.fn(() => []),
    select: vi.fn(),
    // enterReplay reads the fog-owner candidates from the economy.
    getEconomyState: vi.fn(() => ({ playerResources: { 1: {}, 2: {} } })),
  } as unknown as SimulationBridge;
}

function setUp() {
  const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
  const marker: Marker = { id: 'raid', tick: bundle.metadata.startTick + 5, kind: 'annotation', provenance: 'game' };
  const recording = { ...bundle, markers: [...bundle.markers, marker] };
  let current: SimulationBridge = liveBridge;
  const controller = createReplayController({
    bridgeCell: { current: () => current, replace: (next) => { current = next; } },
    isLivePaused: () => false,
    makeReplayBridge: stubBridge,
  });
  const heard: Array<{ mode: string; cellHoldsLive: boolean }> = [];
  controller.onModeChange((mode) => heard.push({ mode, cellHoldsLive: current === liveBridge }));
  return { controller, recording, heard, current: () => current };
}

describe('the replay controller mode changes', () => {
  it('announce entering and leaving, each with the new world in the bridge cell, and nothing in between', () => {
    const { controller, recording, heard, current } = setUp();
    controller.enterReplay(recording, recording.metadata.startTick);
    expect(heard).toEqual([{ mode: 'replay', cellHoldsLive: false }]);

    const bridges = new Set([current()]);
    const moves: Array<[string, () => void]> = [
      ['step forward', () => controller.stepForward()],
      ['step forward', () => controller.stepForward()],
      ['step back', () => controller.stepBackward()],
      ['scrub', () => controller.scrubTo(recording.metadata.endTick)],
      ['drag scrub', () => {
        controller.scrubTo(recording.metadata.startTick + 2, { coalesce: true });
        controller.commitPendingScrub();
      }],
      ['marker jump', () => controller.jumpToMarker('raid')],
      ['fog-owner switch', () => controller.setFogOwner(2)],
      ['fog-owner cycle', () => controller.cycleFogOwner()],
    ];
    for (const [name, move] of moves) {
      move();
      // Instrument check: every move built a new bridge, which is what a
      // reset keyed on the bridge's identity would have fired on.
      expect(bridges.has(current()), `the ${name} built no new bridge`).toBe(false);
      bridges.add(current());
      expect(heard, `the ${name} announced a mode change`).toHaveLength(1);
    }

    controller.exitReplay();
    expect(heard).toEqual([
      { mode: 'replay', cellHoldsLive: false },
      { mode: 'live', cellHoldsLive: true },
    ]);
  });

  it('announce leaving and then entering when a second recording opens over the first', () => {
    const { controller, recording, heard } = setUp();
    controller.enterReplay(recording, recording.metadata.startTick);
    controller.enterReplay(recording, recording.metadata.startTick + 3);
    expect(heard).toEqual([
      { mode: 'replay', cellHoldsLive: false },
      { mode: 'live', cellHoldsLive: true },
      { mode: 'replay', cellHoldsLive: false },
    ]);
  });
});
