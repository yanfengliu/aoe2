import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEATH_FEED_TICKS, visibleUnitDeaths } from '../../src/game/simulation/bridge/visibility';
import type { ProjectedUnitDeathView } from '../../src/game/simulation/types';
import { selectOwnedUnitDirect,
  stepUntilGarrisoned,
} from './createSimulationBridge.helpers';

// v0.1.129 death feedback: unit deaths surface on the projected frame as a
// fog-filtered, ticks-bounded feed (ProjectedFrameView.recentUnitDeaths) so the
// render layer can play a death animation without diffing entity presence —
// present→absent is ambiguous (fog exit and garrison also remove units from
// the view). The sim emits at the destroyUnitEntity chokepoint; the feed is
// TRANSIENT render info (never persisted — a save/load simply drops in-flight
// animations; replays re-emit because destroyUnitEntity re-runs).

type Bridge = ReturnType<typeof createSimulationBridge>;

function findUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === unitType);
}

describe('unit death feed — pure at-death witness/age filter', () => {
  const record = (overrides: Partial<ProjectedUnitDeathView> = {}): ProjectedUnitDeathView => ({
    id: 7,
    tick: 100,
    x: 6.25,
    y: 5.5,
    owner: 2,
    unitType: 'militia',
    tint: 0xff6644,
    size: 0.5,
    witnessedBy: [1],
    ...overrides,
  });

  it('surfaces a death only to players who witnessed it (in witnessedBy)', () => {
    const deaths = [record({ id: 1, witnessedBy: [1, 2] }), record({ id: 2, witnessedBy: [2] })];
    expect(visibleUnitDeaths(deaths, 105, 1).map((d) => d.id)).toEqual([1]);
    expect(visibleUnitDeaths(deaths, 105, 2).map((d) => d.id)).toEqual([1, 2]);
  });

  it('does NOT surface a death to a non-witness even at the death cell (no fog leak on later reveal)', () => {
    // Player 1 did not witness this enemy-vs-enemy death (witnessedBy=[2]);
    // uncovering the cell later must not surface it — the filter has no
    // current-visibility term, only the at-death witness set.
    const fogged = [record({ id: 9, owner: 2, witnessedBy: [2] })];
    expect(visibleUnitDeaths(fogged, 101, 1)).toHaveLength(0);
  });

  it('drops deaths older than DEATH_FEED_TICKS even for a witness', () => {
    const deaths = [
      record({ id: 1, tick: 100, witnessedBy: [1] }),
      record({ id: 2, tick: 100 - DEATH_FEED_TICKS - 1, witnessedBy: [1] }),
    ];
    expect(visibleUnitDeaths(deaths, 100 + DEATH_FEED_TICKS, 1).map((d) => d.id)).toEqual([1]);
  });
});

describe('unit death feed — live bridge (heresy kill fixture)', () => {
  it('a unit dying near the human surfaces in frame.recentUnitDeaths, then ages out', () => {
    const bridge = createSimulationBridge('monk-convert-heresy-fixture');
    const militia = findUnit(bridge, 2, 'militia');
    expect(militia).toBeDefined();
    const militiaId = militia!.id;

    // Baseline: no deaths recorded on a fresh world.
    expect(bridge.getRenderState().frame?.recentUnitDeaths ?? []).toHaveLength(0);

    // Owner-1 monk converts the Heresy-owning militia → it DIES (destroyUnitEntity).
    expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(militiaId)).toBe(true);

    let deathRecord: ProjectedUnitDeathView | undefined;
    for (let i = 0; i < 200 && !deathRecord; i += 1) {
      bridge.step(100);
      deathRecord = (bridge.getRenderState().frame?.recentUnitDeaths ?? [])
        .find((death) => death.id === militiaId);
    }
    expect(deathRecord, 'death never surfaced on the frame').toBeDefined();
    expect(deathRecord!.owner).toBe(2);
    expect(deathRecord!.unitType).toBe('militia');
    expect(Number.isFinite(deathRecord!.tint)).toBe(true);
    expect(deathRecord!.size).toBeGreaterThan(0);
    // The human (player 1) witnessed the kill (its monk was adjacent), so it
    // is in witnessedBy — that is why the frame surfaced it.
    expect(deathRecord!.witnessedBy).toContain(1);
    // The record lands within a cell of where the militia stood (fine coords).
    expect(Math.abs(deathRecord!.x - militia!.x)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(deathRecord!.y - militia!.y)).toBeLessThanOrEqual(1.5);
    // The dead unit is gone from the entity view while its death record lives.
    expect(findUnit(bridge, 2, 'militia')).toBeUndefined();

    // The feed is bounded: the record ages out after DEATH_FEED_TICKS.
    for (let i = 0; i < DEATH_FEED_TICKS + 2; i += 1) bridge.step(100);
    expect(
      (bridge.getRenderState().frame?.recentUnitDeaths ?? [])
        .find((death) => death.id === militiaId),
    ).toBeUndefined();
  }, 60_000);

  it('garrisoning a unit does NOT record a death (present→absent ambiguity handled)', () => {
    // A unit leaving the entity view by GARRISONING is not a death; the feed
    // must not misfire on it (the core reason it is an explicit feed and not
    // present→absent diffing). castle-garrison-fixture: all-human villagers +
    // a Castle. Garrison one and confirm the death feed stays empty even
    // though the villager vanishes from the units list.
    const bridge = createSimulationBridge('castle-garrison-fixture');
    const castle = bridge.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'castle',
    );
    expect(castle).toBeDefined();
    const villager = findUnit(bridge, 1, 'villager');
    expect(villager).toBeDefined();
    const villagerId = villager!.id;

    expect(bridge.selectEntityAtCell(villager!.x, villager!.y)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(castle!.id, { garrison: true })).toBe(true);
    // v0.3.42: garrisoning is an order — the villager walks in first.
    expect(stepUntilGarrisoned(bridge, villagerId)).toBe(true);

    // Garrisoned: gone from the live units list…
    expect(bridge.getEconomyState().units.find((u) => u.id === villagerId)).toBeUndefined();
    // …but NOT recorded as a death.
    expect(
      (bridge.getRenderState().frame?.recentUnitDeaths ?? [])
        .find((death) => death.id === villagerId),
    ).toBeUndefined();
  }, 30_000);
});
