// Shots in the air through a replay (spec §10.4; defect register, "A stone
// aimed at a deleted House hit the foundation that took its id", 2026-10-11).
//
// A recording made now holds each in-flight shot's shooter and target
// generation in its snapshots, and replays the stone that leaves the
// foundation which took its target's id unharmed. A recording made before
// shots carried generations still opens and plays: the shots in its snapshots
// have none, and each resolves by bare id, as it did when it was recorded.
//
// BOUND: recordings made by this build, the old one standing in with every
// generation stripped from the one snapshot it holds, so its replay
// re-simulates the whole flight; no bundle recorded by an older build is
// committed (as in buildingSightLegacyReplay.test.ts). Re-simulating a
// recording an older build made gives each shot loosed during the replay both
// generations, which that recording's snapshots lack, so its self-check
// reports a divergence wherever a snapshot holds such a shot, as §10.4 says;
// the old recording here is opened and played, not self-checked.

import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { projectilesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { GameCommands, GameEvents } from '../../src/game/simulation/bridge/pureHelpers';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import {
  buildingHp,
  landShot,
  replaceHouse,
  shotsInAir,
  STONE_SEED,
  stoneAtHouse,
} from '../simulation/stoneAtDeletedHouse.helpers';

type Bundle = SessionBundle<GameEvents, GameCommands>;
type SnapshotShots = { state: Record<string, { inFlight: Array<Record<string, unknown>> }> };

/** Records the scene from the moment the stone is in the air to after it
 *  lands. Returns the bundle and the foundation's hit points at the end. */
function recordScene(snapshotInterval: number | null) {
  const bridge = createSimulationBridge(STONE_SEED);
  const step = () => bridge.step(100);
  const { house, shot } = stoneAtHouse(bridge);
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval,
    terminalSnapshot: snapshotInterval !== null,
    sourceKind: 'session',
    sourceLabel: 'projectile-generation-replay-test',
  });
  recorder.connect();
  const foundation = replaceHouse(bridge.world, step, house, shot);
  landShot(bridge.world, step, shot);
  step();
  recorder.disconnect();
  return {
    bundle: recorder.toBundle() as unknown as Bundle,
    shot,
    foundation,
    liveFoundationHp: buildingHp(bridge.world, foundation)!,
  };
}

function replayerOf(bundle: Bundle) {
  return SessionReplayer.fromBundle(bundle, { worldFactory: (start) => createReplayWorldOnly(start), skipRegistrationCheck: true });
}

describe('a recording with a shot in the air', () => {
  it('holds the shot\'s generations in its snapshots and replays the stone sparing the foundation', () => {
    const { bundle, shot, foundation, liveFoundationHp } = recordScene(2);
    const recorded = (bundle.initialSnapshot as unknown as SnapshotShots).state[projectilesCodec.slot]!.inFlight
      .find((s) => s.id === shot.id)!;
    expect(recorded.attackerGeneration).toBe(shot.attackerGeneration);
    expect(recorded.targetGeneration).toBe(shot.targetGeneration);

    const replayer = replayerOf(bundle);
    const check = replayer.selfCheck();
    expect(check, JSON.stringify(check.stateDivergences.map((diff) => diff.firstDifferingPath))).toMatchObject({ ok: true, skippedSegments: [] });
    expect(check.checkedSegments).toBeGreaterThan(0);
    const end = replayer.openAt(bundle.metadata.endTick);
    expect(buildingHp(end, foundation)).toBe(liveFoundationHp);
  }, 30_000);
});

describe('a recording made before shots carried generations', () => {
  it('opens with its shot in the air as recorded, and plays it to its landing by bare id', () => {
    const { bundle, shot, foundation, liveFoundationHp } = recordScene(null);
    expect(bundle.snapshots, 'the premise: the only snapshot is the one the stone is in the air in').toEqual([]);
    for (const old of (bundle.initialSnapshot as unknown as SnapshotShots).state[projectilesCodec.slot]!.inFlight) {
      delete old.attackerGeneration;
      delete old.targetGeneration;
    }

    const replayer = replayerOf(bundle);
    const start = replayer.openAt(bundle.metadata.startTick);
    const opened = shotsInAir(start).find((s) => s.id === shot.id);
    expect(opened, 'the old shot did not open with the recording').toBeDefined();
    expect(Object.keys(opened!).filter((key) => key.endsWith('Generation')), 'the replay gave the old shot a generation').toEqual([]);

    // Re-simulated from that snapshot through the deletion, the new foundation
    // and the landing. BOUND: the old stone names the foundation by bare id, so
    // it lands on it, where the live stone, which carried generations, did not.
    const end = replayer.openAt(bundle.metadata.endTick);
    expect(shotsInAir(end).some((s) => s.id === shot.id), 'the old stone never landed in the replay').toBe(false);
    expect(buildingHp(end, foundation)!, 'the old stone no longer resolves by bare id: update the bound in spec §10.4')
      .toBeLessThan(liveFoundationHp);
  }, 30_000);
});
