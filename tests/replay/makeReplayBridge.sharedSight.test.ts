// GATE (register 2026-09-24, "an ally's base is lit but empty"): a replay shows
// the recorded perspective what it saw live — its own vision plus its allies'.
// The replay bridge had shared vision hard-coded to none, so a replay of a team
// game drew the ally's base neither lit nor populated.
//
// Bound: one short recording of `aoe2-prototype` with three players and teams
// 1,1,2, opened at its end tick from the default perspective (owner 1). The
// ally's Town Centre also reaches the render state through fog memory, which
// the recording carries, so it holds the lit cells but not the render filter;
// the ally's UNITS are what hold the replay's render filter.

import { SessionRecorder, SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import type { GameCommands, GameEvents } from '../../src/game/simulation/bridge/pureHelpers';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { makeReplayBridge } from '../../src/game/simulation/replay/makeReplayBridge';
import { getReplayWorldContext } from '../../src/game/simulation/replay/replayWorldContext';

function recordAlliedMatch(): SessionBundle<GameEvents, GameCommands> {
  const bridge = createSimulationBridge('aoe2-prototype', {
    playerCount: 3,
    teamsByOwner: new Map([[1, 1], [2, 1], [3, 2]]),
  });
  const recorder = new SessionRecorder({
    world: bridge.world,
    snapshotInterval: null,
    terminalSnapshot: false,
    sourceKind: 'session',
    sourceLabel: 'shared-sight-replay-test',
  });
  recorder.connect();
  for (let step = 0; step < 20; step += 1) bridge.step(100);
  recorder.disconnect();
  return recorder.toBundle() as unknown as SessionBundle<GameEvents, GameCommands>;
}

describe('a replay of a team game shows the ally’s base', () => {
  it('draws the ally’s entities its sight sees, and none of the enemy’s', () => {
    const bundle = recordAlliedMatch();
    const world = SessionReplayer.fromBundle(bundle, {
      worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
      skipRegistrationCheck: true,
    }).openAt(bundle.metadata.endTick);
    const visibility = getReplayWorldContext(world)!.visibility;
    const bridge = makeReplayBridge(world);

    expect(bridge.getSharedVisionOwners(1)).toEqual([2]);
    const drawn = new Set(bridge.getRenderState().entities.map((entity) => entity.id));
    const economy = bridge.getEconomyState();
    const allyTownCentre = economy.buildings.find(
      (building) => building.owner === 2 && building.buildingType === 'town-center',
    );
    expect(allyTownCentre).toBeDefined();
    // Non-vacuous: the human's own eyes do not reach the ally's Town Centre.
    expect(visibility.isVisible(1, allyTownCentre!.x, allyTownCentre!.y)).toBe(false);
    expect(drawn.has(allyTownCentre!.id)).toBe(true);
    // ...on ground the replay lights for it, as the live match did.
    const frame = bridge.getRenderState().frame!;
    expect(frame.visibleCells).toContain(allyTownCentre!.y * frame.mapWidth + allyTownCentre!.x);
    const allyUnitsDrawn = economy.units.filter((unit) => unit.owner === 2 && drawn.has(unit.id));
    expect(allyUnitsDrawn.length).toBeGreaterThan(0);

    const enemyDrawn = [...economy.units, ...economy.buildings]
      .filter((entity) => entity.owner === 3 && drawn.has(entity.id));
    expect(enemyDrawn).toEqual([]);
  }, 120_000);
});
