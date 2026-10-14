// A replay quotes the recorded player's prices (spec §14.2, work 125). The
// replay viewer's command card reads the replay world's own selection state,
// so a Malian villager's build card in a replay states the Malian price; and
// the replay bridge's price getter answers for the recorded owner instead of
// the base table it used to answer from.

import { describe, expect, it } from 'vitest';
import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { makeReplayBridge } from '../../src/game/simulation/replay/makeReplayBridge';
import type { GameCommands, GameEvents } from '../../src/game/simulation/bridge/pureHelpers';
import { constructionCost } from '../../src/game/simulation/prototypeEconomyRules';
import { findOwnedUnit } from './replayCommandHelpers';

function recordMalianSession(): SessionBundle<GameEvents, GameCommands> {
  const bridge = createSimulationBridge('ai-rush-fixture', {
    civilizationsByOwner: new Map([[1, 'Malians'], [2, 'Britons']]),
  });
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval: null,
    terminalSnapshot: false,
    sourceKind: 'session',
    sourceLabel: 'work-125-replay-prices',
  });
  recorder.connect();
  for (let tick = 0; tick < 20; tick += 1) bridge.step(100);
  recorder.disconnect();
  return recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>;
}

describe('a replay quotes the recorded player prices', () => {
  it('prices a Malian House at 21 wood, not the table 25, on the replay card and through its getter', () => {
    const bundle = recordMalianSession();
    const replayer = SessionReplayer.fromBundle(bundle, {
      worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
      skipRegistrationCheck: true,
    });
    const replay = makeReplayBridge(replayer.openAt(bundle.metadata.endTick));
    // Malians build everything for 15% less wood: 25 x 0.85 = 21.
    expect(constructionCost('house')).toEqual({ wood: 25 });
    expect(replay.getConstructionCost(1, 'house')).toEqual({ wood: 21 });

    const villager = findOwnedUnit(replay, 1, 'villager');
    expect(replay.selectEntityById(villager.id)).toBe(true);
    const house = replay.getSelectionState().commandCosts.find(
      (entry) => entry.kind === 'build' && entry.id === 'house',
    );
    expect(house?.cost, 'the replay card prices the House').toEqual({ wood: 21 });
  });
});
