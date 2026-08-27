import { describe, expect, it } from 'vitest';

import {
  areAllied,
  isEnemyOwner,
  parseTeamAssignment,
  sharedVisionOwners,
  teamOf,
} from '../../src/game/simulation/alliances';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import { parseTeamsParam } from '../../src/app/bootstrap/teamsParam';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// §2.2 puts "optional AI allies" in scope, and there was no notion of a team
// anywhere in the simulation — every owner that was not you was an enemy.

describe('teams', () => {
  it('makes an owner its own team when nothing says otherwise', () => {
    const none = new Map<number, number>();
    expect(teamOf(none, 1)).toBe(1);
    expect(teamOf(none, 3)).toBe(3);
    // Which means the default is a free-for-all: nobody is allied with anybody.
    expect(areAllied(none, 1, 2)).toBe(false);
    expect(areAllied(none, 2, 3)).toBe(false);
  });

  it('allies an owner with itself, always', () => {
    expect(areAllied(new Map(), 2, 2)).toBe(true);
    expect(areAllied(new Map([[2, 7]]), 2, 2)).toBe(true);
  });

  it('reads a shared team as an alliance', () => {
    const teams = new Map([[1, 1], [2, 1], [3, 2]]);
    expect(areAllied(teams, 1, 2)).toBe(true);
    expect(areAllied(teams, 2, 1)).toBe(true);
    expect(areAllied(teams, 1, 3)).toBe(false);
    expect(isEnemyOwner(teams, 1, 3)).toBe(true);
    expect(isEnemyOwner(teams, 1, 2)).toBe(false);
  });

  it('treats an owner with no entry as its own team even beside teamed ones', () => {
    const teams = new Map([[1, 1], [2, 1]]);
    expect(areAllied(teams, 1, 3)).toBe(false);
    expect(areAllied(teams, 3, 3)).toBe(true);
  });
});

describe('parseTeamAssignment', () => {
  it('reads one number per player, in owner order', () => {
    expect([...parseTeamAssignment('1,1,2', 3)]).toEqual([[1, 1], [2, 1], [3, 2]]);
    expect([...parseTeamAssignment('1,2,2,1', 4)]).toEqual([[1, 1], [2, 2], [3, 2], [4, 1]]);
  });

  it('ignores anything it cannot use, leaving a free-for-all', () => {
    for (const [raw, count] of [
      ['', 3],
      ['1,1', 3], // Too few for the player count.
      ['1,1,2,2', 3], // Too many.
      ['1,x,2', 3],
      ['0,1,2', 3], // Team numbers start at one.
      ['1,1,1', 3], // Everybody on one team is a match nobody can win.
    ] as const) {
      expect([...parseTeamAssignment(raw, count)], raw).toEqual([]);
    }
  });

  it('tolerates spacing, because a URL is typed by a person', () => {
    expect([...parseTeamAssignment(' 1 , 1 , 2 ', 3)]).toEqual([[1, 1], [2, 1], [3, 2]]);
  });
});

// The rule has to hold in a running match, not only in the predicate: an AI
// with an ally must march on the enemy and never on the ally.
describe('an allied AI marches on the enemy and not on its ally', () => {
  function closestApproaches(maxSteps: number) {
    const bridge = createSimulationBridge('allied-three-player-fixture', {
      forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    });
    const townCenters = new Map(
      bridge.getEconomyState().buildings
        .filter((building) => building.buildingType === 'town-center')
        .map((building) => [building.owner, building]),
    );
    expect(townCenters.size).toBe(3);

    // Closest any owner-2 unit came to owner 1 (its ALLY) and to owner 3.
    let toAlly = Number.POSITIVE_INFINITY;
    let toEnemy = Number.POSITIVE_INFINITY;
    for (let step = 0; step < maxSteps; step += 1) {
      bridge.step(100);
      if (step % 10 !== 0) continue;
      const army = bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 2 && unit.unitType !== 'villager',
      );
      for (const unit of army) {
        const ally = townCenters.get(1)!;
        const enemy = townCenters.get(3)!;
        toAlly = Math.min(toAlly, Math.abs(unit.x - ally.x) + Math.abs(unit.y - ally.y));
        toEnemy = Math.min(toEnemy, Math.abs(unit.x - enemy.x) + Math.abs(unit.y - enemy.y));
      }
    }
    return { toAlly, toEnemy };
  }

  it('closes on the enemy base and stays away from the ally’s', () => {
    const { toAlly, toEnemy } = closestApproaches(1_200);
    expect(toEnemy).toBeLessThanOrEqual(12);
    // Owner 2 starts 36 cells from its ally and should never head that way.
    expect(toAlly).toBeGreaterThan(20);
  }, 120_000);
});

describe('the ?teams= URL parameter', () => {
  it('reads a side per player', () => {
    expect([...parseTeamsParam('http://localhost/?teams=1,1,2', 3)])
      .toEqual([[1, 1], [2, 1], [3, 2]]);
  });

  it('falls back to a free-for-all for anything unusable', () => {
    for (const [url, count] of [
      ['http://localhost/', 3],
      ['http://localhost/?teams=', 3],
      ['http://localhost/?teams=1,1', 3],
      ['http://localhost/?teams=1,1,1', 3],
    ] as const) {
      expect([...parseTeamsParam(url, count)], url).toEqual([]);
    }
  });
});

describe('teams reach a real match through the bridge', () => {
  it('records them, and leaves a free-for-all storing nothing', () => {
    const allied = createSimulationBridge('aoe2-prototype', {
      playerCount: 3,
      teamsByOwner: new Map([[1, 1], [2, 1], [3, 2]]),
    });
    const stored = new Map(
      (allied.world.getState('aoe2.playerTeams') ?? []) as Array<[number, number]>,
    );
    expect([...stored]).toEqual([[1, 1], [2, 1], [3, 2]]);

    const freeForAll = createSimulationBridge('aoe2-prototype', { playerCount: 3 });
    const none = (freeForAll.world.getState('aoe2.playerTeams') ?? []) as Array<[number, number]>;
    // Nothing stored at all: every owner reads as its own side, which is what
    // keeps an existing save and an existing match unchanged.
    expect(none).toEqual([]);
  }, 60_000);
});

// Cartography (Market, Feudal — technologies.csv "See ally line of sight").
describe('sharedVisionOwners', () => {
  const owners = [1, 2, 3];

  it('is empty without the technology, however many allies there are', () => {
    const teams = new Map([[1, 1], [2, 1], [3, 2]]);
    expect(sharedVisionOwners(teams, 1, false, owners)).toEqual([]);
  });

  it('is empty with the technology and no allies', () => {
    expect(sharedVisionOwners(new Map(), 1, true, owners)).toEqual([]);
  });

  it('is the allies, and never the owner itself or an enemy', () => {
    const teams = new Map([[1, 1], [2, 1], [3, 2]]);
    expect(sharedVisionOwners(teams, 1, true, owners)).toEqual([2]);
    expect(sharedVisionOwners(teams, 2, true, owners)).toEqual([1]);
    expect(sharedVisionOwners(teams, 3, true, owners)).toEqual([]);
  });
});

describe('Allied shared vision in a real match (v0.3.140: Cartography removed, sharing is the default)', () => {
  it('shows the ally’s map from the very first frame, no research needed', () => {
    // Solo baseline: the same seat with no allies sees only its own base.
    const solo = createSimulationBridge('allied-three-player-fixture', {
      teamsByOwner: new Map([[1, 1], [2, 2], [3, 3]]),
    });
    const alone = solo.getHudState().visibleCells;

    // Allied with owner 2 (base thirty-odd cells away): DE shares team sight
    // from the start of the match, so strictly more map is lit at boot.
    const allied = createSimulationBridge('allied-three-player-fixture', {
      teamsByOwner: new Map([[1, 1], [2, 1], [3, 2]]),
    });
    const together = allied.getHudState().visibleCells;
    expect(together).toBeGreaterThan(alone);
  }, 60_000);
});

describe('The Market card after Cartography’s removal (v0.3.140)', () => {
  it('never offers cartography, and still offers Coinage from the Feudal Age', () => {
    // This fixture has the Barracks a Market needs, and no Market — so the
    // test builds one, which is also how a player gets there.
    const bridge = createSimulationBridge('new-tech-reach-fixture');
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('market');
    placeBuildingNearTownCenter(bridge, 'market');
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().buildings.some(
        (building) => building.owner === 1
          && building.buildingType === 'market'
          && building.isComplete,
      ),
      { maxSteps: 2_000 },
    )).toBe(true);

    expect(selectOwnedBuildingDirect(bridge, 1, 'market')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).not.toContain('cartography');
    expect(options).toContain('coinage');
  }, 120_000);
});
