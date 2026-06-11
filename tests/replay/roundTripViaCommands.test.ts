import { describe, expect, it } from 'vitest';
import { SessionReplayer } from 'civ-engine';

import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { fromEngineWorld, toEngineWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { getReplayWorldContext } from '../../src/game/simulation/replay/replayWorldContext';
import {
  recordCommandReplayFixture,
  recordCommandReplayFixtureAtPendingBoundary,
  recordCommandReplayFixtureWithPendingSnapshot,
} from './replayCommandHelpers';

describe('Phase 3A.5 - round-trip replay via recorded commands', () => {
  it('rebuilds the final world by replaying human and AI command payloads from the initial snapshot', () => {
    const { bridge, bundle } = recordCommandReplayFixture();

    expect(bundle.snapshots).toHaveLength(0);
    expect(bundle.commands.some((command) => command.type === 'unit.move')).toBe(true);
    expect(bundle.commands.some((command) => command.type !== 'unit.move')).toBe(true);

    const replayer = SessionReplayer.fromBundle(
      bundle,
      { worldFactory: (snapshot) => toEngineWorld(createReplayWorldOnly(snapshot)) },
    );
    const replayWorld = fromEngineWorld(replayer.openAt(bundle.metadata.endTick));

    expect(getReplayWorldContext(replayWorld)).not.toBeNull();
    expect(replayWorld.serialize()).toEqual(bridge.world.serialize());
  });

  it('rebuilds an AI-decision boundary tick whose live state still has pending commands', () => {
    const { bridge, bundle } = recordCommandReplayFixtureAtPendingBoundary();

    expect(bundle.snapshots).toHaveLength(0);
    expect(bundle.commands.some((command) => command.type === 'unit.move')).toBe(true);
    expect(bridge.world.getState(TIER_3_SLOTS.pendingCommands)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: expect.any(String) })]),
    );

    const replayer = SessionReplayer.fromBundle(
      bundle,
      { worldFactory: (snapshot) => toEngineWorld(createReplayWorldOnly(snapshot)) },
    );
    const replayWorld = fromEngineWorld(replayer.openAt(bundle.metadata.endTick));

    expect(replayWorld.serialize()).toEqual(bridge.world.serialize());
  });

  it('clears a hydrated pending-command snapshot when replay advances from that snapshot', () => {
    const { bridge, bundle, pendingSnapshotTick } =
      recordCommandReplayFixtureWithPendingSnapshot();

    expect(pendingSnapshotTick).toBeDefined();
    expect(
      bundle.snapshots.some((snapshot) => snapshot.tick === pendingSnapshotTick),
    ).toBe(true);

    const replayer = SessionReplayer.fromBundle(
      bundle,
      { worldFactory: (snapshot) => toEngineWorld(createReplayWorldOnly(snapshot)) },
    );
    const replayWorld = fromEngineWorld(replayer.openAt(bundle.metadata.endTick));

    expect(replayWorld.serialize()).toEqual(bridge.world.serialize());
  });
});
