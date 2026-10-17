// A Wonder or Relic countdown through a recording (work 132).
//
// The length of a countdown that opens is worked out from the world (how many
// players are seated), never from the bridge that built it, so a recording
// re-simulated by a replay world opens the same countdown at the same length
// as the live match did. The Relic fixture opens its countdown on its first
// tick, INSIDE the recording, so the replay has to open it itself; the Wonder
// fixture opens its at seeding, so its countdown arrives in the snapshot and
// the replay has to count it down.
//
// BOUND: recordings made by this build. A recording made before this version
// holds countdowns of 2,000 ticks in its snapshots and plays them out on
// that clock (a stored deadline is kept), but a countdown that OPENS during
// such a recording opens at the new length, so the match it replays can end
// differently from the one that was played (the changelog says so).

import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  relicCountdownsCodec,
  wonderCountdownsCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { GameCommands, GameEvents, GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { TPS } from '../../src/game/simulation/prototypeScenario';

type Bundle = SessionBundle<GameEvents, GameCommands>;

function recordRun(seed: string, ticks: number) {
  const bridge = createSimulationBridge(seed, { renderProjection: 'on-read' });
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval: 500,
    terminalSnapshot: true,
    sourceKind: 'session',
    sourceLabel: 'victory-countdown-replay-test',
  });
  recorder.connect();
  // A recording with no command in it cannot be replayed forward ("no command
  // payloads"), so the owner queues a Villager: a command that touches nothing
  // the countdown reads.
  const townCenter = bridge.getEconomyState().buildings.find(
    (building) => building.owner === 1 && building.buildingType === 'town-center',
  )!;
  expect(bridge.world.submitWithResult('queue.train', { buildingId: townCenter.id, unitType: 'villager' }).accepted).toBe(true);
  expect(bridge.step((ticks * 1000) / TPS)).toEqual({ ticks, refusedBecause: null });
  recorder.disconnect();
  return { bridge, bundle: recorder.toBundle() as unknown as Bundle };
}

function replayerOf(bundle: Bundle) {
  return SessionReplayer.fromBundle(bundle, {
    worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
    skipRegistrationCheck: true,
  });
}

function entriesOf(world: GameWorld, kind: 'wonder' | 'relic') {
  const accessor = new BridgeStateAccessor(() => world);
  return [...accessor.get(kind === 'wonder' ? wonderCountdownsCodec : relicCountdownsCodec).entries()];
}

describe('a victory countdown through a recording', () => {
  it('replays a Wonder countdown carried in the snapshot at the length it was counting down', () => {
    const { bridge, bundle } = recordRun('wonder-default-clock-6p-fixture', 1_700);
    const replayer = replayerOf(bundle);
    const check = replayer.selfCheck();
    expect(check, JSON.stringify(check.stateDivergences.map((diff) => diff.firstDifferingPath))).toMatchObject({ ok: true, skippedSegments: [] });
    expect(check.checkedSegments).toBeGreaterThan(0);
    const end = replayer.openAt(bundle.metadata.endTick);
    const live = entriesOf(bridge.world, 'wonder');
    expect(live).toHaveLength(1);
    expect(live[0]![1]).toMatchObject({ totalTicks: 15_000, remainingTicks: 15_000 - 1_700 });
    expect(entriesOf(end, 'wonder')).toEqual(live);
  }, 60_000);

  it('opens a Relic countdown inside the recording at the length the live match gave it', () => {
    const { bridge, bundle } = recordRun('relic-default-clock-8p-fixture', 1_200);
    const replayer = replayerOf(bundle);
    const check = replayer.selfCheck();
    expect(check, JSON.stringify(check.stateDivergences.map((diff) => diff.firstDifferingPath))).toMatchObject({ ok: true, skippedSegments: [] });
    // A check that checked nothing reads as a pass.
    expect(check.checkedSegments).toBeGreaterThan(0);
    const end = replayer.openAt(bundle.metadata.endTick);
    const live = entriesOf(bridge.world, 'relic');
    expect(live).toHaveLength(1);
    expect(live[0]![1]).toMatchObject({ totalTicks: 17_500, remainingTicks: 17_500 - 1_200 });
    expect(entriesOf(end, 'relic')).toEqual(live);
  }, 60_000);
});
