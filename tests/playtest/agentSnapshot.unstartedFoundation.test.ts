// The playtest agent's view keeps another player's unstarted foundation off its
// enemy list, as the game hides one from the owner's enemies (work 121,
// `src/game/simulation/bridge/unstartedFoundations.ts`). The list treats every
// other player as an enemy, allies included.
//
// BOUND: the snapshot's building rows only; the game-side rule is gated in
// `tests/simulation/hiddenUnstartedFoundation*.test.ts`.

import { describe, expect, it } from 'vitest';

import { buildAgentSnapshot } from '../../src/game/playtest/agentSnapshot';
import type { EconomyState } from '../../src/game/simulation/types';
import { SCREEN, makeEconomy, makeSelection } from './agentSnapshotTestKit';

function snapshotWithEnemyBarracks(progress: { isComplete: boolean; buildProgressTicks: number }, omniscient = false) {
  return buildAgentSnapshot({
    ownerId: 2,
    tick: 0,
    tps: 10,
    economy: makeEconomy({
      buildings: [{
        id: 300,
        owner: 1,
        buildingType: 'barracks',
        x: 4,
        y: 4,
        footprintWidth: 3,
        footprintHeight: 3,
        totalBuildTicks: 500,
        populationProvided: 0,
        queue: [],
        ...progress,
      }] as unknown as EconomyState['buildings'],
    }),
    selection: makeSelection(),
    screenMapping: SCREEN,
    visibility: () => true,
    omniscient,
  });
}

describe('agent snapshot: another player\'s unstarted foundation', () => {
  it('is not listed while nobody has built on it, though its cells are seen', () => {
    expect(snapshotWithEnemyBarracks({ isComplete: false, buildProgressTicks: 0 }).enemies).toEqual([]);
  });

  it('is listed once building starts, and when complete', () => {
    expect(snapshotWithEnemyBarracks({ isComplete: false, buildProgressTicks: 1 }).enemies.map((e) => e.entityId))
      .toEqual([300]);
    expect(snapshotWithEnemyBarracks({ isComplete: true, buildProgressTicks: 500 }).enemies.map((e) => e.entityId))
      .toEqual([300]);
  });

  it('is listed in the opt-in omniscient view, which shows everything', () => {
    expect(snapshotWithEnemyBarracks({ isComplete: false, buildProgressTicks: 0 }, true).enemies.map((e) => e.entityId))
      .toEqual([300]);
  });
});

describe('agent snapshot: per-player building counts', () => {
  it('leave out another player\'s unstarted foundation, count a started one, and count the viewer\'s own', () => {
    const counts = (owner: number, progress: { isComplete: boolean; buildProgressTicks: number }) =>
      snapshotWithEnemyBarracks(progress).perPlayer.find((player) => player.ownerId === owner)?.buildingCountByType ?? {};
    expect(counts(1, { isComplete: false, buildProgressTicks: 0 })).toEqual({});
    expect(counts(1, { isComplete: false, buildProgressTicks: 1 })).toEqual({ barracks: 1 });

    const ownFoundation = buildAgentSnapshot({
      ownerId: 1,
      tick: 0,
      tps: 10,
      economy: makeEconomy({
        buildings: [{
          id: 301, owner: 1, buildingType: 'house', x: 2, y: 2, footprintWidth: 2, footprintHeight: 2,
          isComplete: false, buildProgressTicks: 0, totalBuildTicks: 250, populationProvided: 0, queue: [],
        }] as unknown as EconomyState['buildings'],
      }),
      selection: makeSelection(),
      screenMapping: SCREEN,
      visibility: () => true,
    });
    expect(ownFoundation.perPlayer.find((player) => player.ownerId === 1)?.buildingCountByType).toEqual({ house: 1 });
  });
});
