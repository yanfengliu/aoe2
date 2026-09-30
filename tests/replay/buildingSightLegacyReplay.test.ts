// A replay recorded before every building saw must still open (review 2 of the
// building-sight change, R2-1). civ-engine's replayer refuses a world whose
// state-key count or component entry counts differ from the snapshot it was
// built from (`factory_snapshot_not_applied`, `session-replayer-guards.ts`),
// and such a recording has no `aoe2.buildingVisibility` slot and finished
// buildings with no vision source. So a replay world adds neither: the slot
// stays absent while the snapshot lacks it, as the attack-feed slot does, and
// the load-time repair runs for a loaded save only.
//
// BOUND: one doctored recording of the raid fixture, opened through the
// engine's own replayer at its start tick, which is where the engine checks the
// world against the snapshot; no bundle recorded by an older build is
// committed, and re-simulating one is not tested.

import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { GameCommands, GameEvents } from '../../src/game/simulation/bridge/pureHelpers';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';

type SnapshotParts = {
  state: Record<string, unknown>;
  components: Record<string, Array<[number, unknown]>>;
};

describe('a replay recorded before every building saw', () => {
  it('opens, and its world keeps the recording’s slots and vision sources', () => {
    const bridge = createSimulationBridge('raid-warning-fixture');
    const recorder = new SessionRecorder({
      world: bridge.world,
      snapshotInterval: null,
      terminalSnapshot: false,
      sourceKind: 'session',
      sourceLabel: 'legacy-building-sight-replay-test',
    });
    recorder.connect();
    for (let tick = 0; tick < 5; tick += 1) bridge.step(100);
    recorder.disconnect();
    const bundle = recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>;

    // What such a recording holds: no building slot, and a finished House
    // with no sight.
    const house = bridge.getEconomyState().buildings.find((building) => building.owner === 1 && building.buildingType === 'house')!;
    const snapshot = bundle.initialSnapshot as unknown as SnapshotParts;
    expect(snapshot.state[TIER_3_SLOTS.buildingVisibility], 'the premise: a new recording has the slot').toBeDefined();
    delete snapshot.state[TIER_3_SLOTS.buildingVisibility];
    snapshot.components.visionSource = snapshot.components.visionSource!.filter(([id]) => id !== house.id);
    const recordedSources = snapshot.components.visionSource.length;

    const replayer = SessionReplayer.fromBundle(bundle, {
      worldFactory: (start) => createReplayWorldOnly(start),
      skipRegistrationCheck: true,
    });
    const world = replayer.openAt(bundle.metadata.startTick);
    expect(world.getState(TIER_3_SLOTS.buildingVisibility)).toBeUndefined();
    expect([...world.query('visionSource')].length).toBe(recordedSources);
  });
});
