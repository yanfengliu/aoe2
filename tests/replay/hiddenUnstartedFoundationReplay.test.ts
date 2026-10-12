// The replay viewer hides an enemy's unstarted foundation from the perspective
// it shows, as the live match does (work 121; spec §12.2 "An unstarted
// foundation is hidden from the owner's enemies"). The replay bridge builds its
// own render state, so it is wired on its own and checked on its own.
//
// BOUND: one recorded session on `hidden-foundation-fixture`, opened at its
// last tick from both owners' perspectives; the drawn list only.

import { describe, expect, it } from 'vitest';

import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { makeReplayBridge } from '../../src/game/simulation/replay/makeReplayBridge';
import type { GameCommands, GameEvents } from '../../src/game/simulation/bridge/pureHelpers';
import {
  HIDDEN_FOUNDATION_AWAY,
  HIDDEN_FOUNDATION_SITE,
} from '../../src/game/simulation/fixtures/hiddenFoundation';
import { idsOf, placeFoundationAs, stepTicks } from '../simulation/hiddenUnstartedFoundation.helpers';

function recordFoundationSession(): { bundle: SessionBundle<GameEvents, GameCommands>; foundationId: number } {
  const bridge = createSimulationBridge('hidden-foundation-fixture');
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval: null,
    terminalSnapshot: false,
    sourceKind: 'session',
    sourceLabel: 'work-121-hidden-foundation-replay',
  });
  recorder.connect();
  // The soldiers stand still; nothing of theirs may touch the site.
  const builder = idsOf(bridge, 2, 'villager')[0]!;
  const foundationId = placeFoundationAs(bridge, builder, 'barracks', HIDDEN_FOUNDATION_SITE, HIDDEN_FOUNDATION_AWAY);
  stepTicks(bridge, 30);
  recorder.disconnect();
  return { bundle: recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>, foundationId };
}

function openAtEnd(bundle: SessionBundle<GameEvents, GameCommands>) {
  const replayer = SessionReplayer.fromBundle(bundle, {
    worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
    skipRegistrationCheck: true,
  });
  return replayer.openAt(bundle.metadata.endTick);
}

describe('the replay viewer and an enemy\'s unstarted foundation', () => {
  it('draws it for its owner and not for the enemy whose soldiers stand beside it', () => {
    const { bundle, foundationId } = recordFoundationSession();

    const asHuman = makeReplayBridge(openAtEnd(bundle));
    const asOwner = makeReplayBridge(openAtEnd(bundle), { fogOwner: 2 });
    // Premise: the replayed foundation is still unstarted.
    const replayed = asHuman.getEconomyState().buildings.find((building) => building.id === foundationId);
    expect(replayed?.buildProgressTicks).toBe(0);

    expect(asHuman.getRenderState().entities.some((entity) => entity.id === foundationId)).toBe(false);
    expect(asOwner.getRenderState().entities.some((entity) => entity.id === foundationId)).toBe(true);
  }, 60_000);
});
