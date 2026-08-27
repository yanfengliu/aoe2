// Building-scoped civilization/team bonuses (spec §9.2):
//  - Ethiopians (team_bonus): "Towers and Outposts +3 LOS"
//  - Teutons (civ): "Town Centers have +1 attack and +5 line of sight",
//    "Towers can garrison 2x units", "Monks have 2x healing range"
// The vision bonus must ride BOTH creation branches (explicit fixture vision
// AND the default table) because the real map's starting Town Center passes an
// explicit radius — a default-branch-only seam would never reach the one TC
// that matters.

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import {
  civBuildingBaseAttackBonus,
  civGarrisonCapacityBonus,
  civMonkHealRangeMultiplier,
  teamBuildingVisionBonus,
} from '../../src/game/simulation/civBuildingBonuses';

type Bridge = ReturnType<typeof createSimulationBridge>;

function visionRadiusOf(bridge: Bridge, id: number): number | undefined {
  return bridge.world.getComponent<{ radius: number }>(id, 'visionSource')?.radius;
}

function findBuilding(bridge: Bridge, owner: number, buildingType: string) {
  return bridge
    .getEconomyState()
    .buildings.find((b) => b.owner === owner && b.buildingType === buildingType);
}

function findUnit(bridge: Bridge, owner: number, unitType: string) {
  return bridge
    .getEconomyState()
    .units.find((u) => u.owner === owner && u.unitType === unitType);
}

describe('building bonus tables (pure)', () => {
  const noTeams = new Map<number, number>();
  const solo = new Map([[1, 'Ethiopians']]);

  it('Ethiopians grant towers and outposts +3 LOS, to allies too', () => {
    expect(teamBuildingVisionBonus(noTeams, solo, 1, 'outpost')).toBe(3);
    expect(teamBuildingVisionBonus(noTeams, solo, 1, 'watch-tower')).toBe(3);
    expect(teamBuildingVisionBonus(noTeams, solo, 1, 'bombard-tower')).toBe(3);
    // Towers and Outposts only — not the Town Center, not the Castle.
    expect(teamBuildingVisionBonus(noTeams, solo, 1, 'town-center')).toBe(0);
    expect(teamBuildingVisionBonus(noTeams, solo, 1, 'castle')).toBe(0);
    // An ally of the Ethiopians enjoys it; an enemy does not.
    const teams = new Map([[1, 1], [2, 1], [3, 2]]);
    const civs = new Map([[1, 'Ethiopians'], [2, 'Britons'], [3, 'Britons']]);
    expect(teamBuildingVisionBonus(teams, civs, 2, 'outpost')).toBe(3);
    expect(teamBuildingVisionBonus(teams, civs, 3, 'outpost')).toBe(0);
  });

  it('the old Teuton TC attack/LOS is DE-dead (sourced v0.3.144)', () => {
    const civs = new Map([[1, 'Teutons']]);
    expect(teamBuildingVisionBonus(noTeams, civs, 1, 'town-center')).toBe(0);
    expect(civBuildingBaseAttackBonus('Teutons', 'town-center')).toBe(0);
    expect(civBuildingBaseAttackBonus(undefined, 'town-center')).toBe(0);
  });

  it('Teuton garrison is a FLAT add (DE: TC +10, towers +5); monks heal twice as far', () => {
    expect(civGarrisonCapacityBonus('Teutons', 'watch-tower')).toBe(5);
    expect(civGarrisonCapacityBonus('Teutons', 'bombard-tower')).toBe(5);
    expect(civGarrisonCapacityBonus('Teutons', 'town-center')).toBe(10);
    expect(civGarrisonCapacityBonus('Britons', 'watch-tower')).toBe(0);
    expect(civMonkHealRangeMultiplier('Teutons')).toBe(2);
    expect(civMonkHealRangeMultiplier('Britons')).toBe(1);
    expect(civMonkHealRangeMultiplier(undefined)).toBe(1);
  });
});

describe('Ethiopian tower/outpost sight in the world', () => {
  it('a seeded default-vision Outpost reads 9, composes with the age sweep, and the TC stays 7', () => {
    const bridge = createSimulationBridge('outpost-vision-fixture', {
      civilizationsByOwner: new Map([[1, 'Ethiopians']]),
    });
    const outpost = findBuilding(bridge, 1, 'outpost');
    const townCenter = findBuilding(bridge, 1, 'town-center');
    expect(outpost).toBeDefined();
    expect(townCenter).toBeDefined();
    expect(visionRadiusOf(bridge, outpost!.id)).toBe(9); // 6 base + 3
    expect(visionRadiusOf(bridge, townCenter!.id)).toBe(7); // not a tower

    // The "+2 per age" outpost sweep is a delta — it composes on top.
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    expect(bridge.queueResearch('feudal-age')).toBe(true);
    expect(
      stepBridgeUntil(bridge, () => visionRadiusOf(bridge, outpost!.id) === 11, {
        maxSteps: 2600,
      }),
    ).toBe(true);
  });

  it('an Outpost CONSTRUCTED by an Ethiopian villager finishes at 9', () => {
    const bridge = createSimulationBridge('outpost-vision-fixture', {
      civilizationsByOwner: new Map([[1, 'Ethiopians']]),
    });
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.beginBuildingPlacement('outpost')).toBe(true);
    expect(bridge.confirmBuildingPlacement(18, 14)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const built = bridge
            .getEconomyState()
            .buildings.find(
              (b) => b.owner === 1 && b.buildingType === 'outpost' && b.x === 18 && b.isComplete,
            );
          return built !== undefined && visionRadiusOf(bridge, built.id) === 9;
        },
        { maxSteps: 1200 },
      ),
    ).toBe(true);
  });
});

describe('Teuton Town Center sight and attack in the world', () => {
  it('the starting TC keeps its plain vision as Teutons (the +5 is DE-dead)', () => {
    const bridge = createSimulationBridge('outpost-vision-fixture', {
      civilizationsByOwner: new Map([[1, 'Teutons']]),
    });
    const townCenter = findBuilding(bridge, 1, 'town-center');
    const outpost = findBuilding(bridge, 1, 'outpost');
    expect(visionRadiusOf(bridge, townCenter!.id)).toBe(7);
    expect(visionRadiusOf(bridge, outpost!.id)).toBe(6);
  });

  it('a Teuton TC arrow hits like any other (the +1 attack is DE-dead)', () => {
    // The militia's 1 pierce armor is applied when the arrow LANDS
    // (projectileOps), so the observed hit is 5-1=4 for everyone.
    for (const [civ, expected] of [['Teutons', 31], [undefined, 31]] as const) {
      const bridge = createSimulationBridge('civ-teutons-fixture', {
        ...(civ ? { civilizationsByOwner: new Map([[1, civ]]) } : {}),
      });
      const enemy = findUnit(bridge, 2, 'militia');
      expect(enemy).toBeDefined();
      expect(bridge.getEntityHealth(enemy!.id)?.currentHp).toBe(35);
      expect(
        stepBridgeUntil(
          bridge,
          () => (bridge.getEntityHealth(enemy!.id)?.currentHp ?? 35) < 35,
          { maxSteps: 400 },
        ),
      ).toBe(true);
      // The first arrow that lands carries the whole answer.
      expect(bridge.getEntityHealth(enemy!.id)?.currentHp).toBe(expected);
    }
  });
});

describe('Teuton tower garrison and monk healing range in the world', () => {
  it('seven militia all fit in a Teuton Watch Tower; a generic one stops at five', () => {
    for (const [civ, expected] of [
      ['Teutons', '7 / 10 garrisoned'],
      [undefined, '5 / 5 garrisoned'],
    ] as const) {
      const bridge = createSimulationBridge('civ-teutons-fixture', {
        ...(civ ? { civilizationsByOwner: new Map([[1, civ]]) } : {}),
      });
      const tower = findBuilding(bridge, 1, 'watch-tower');
      expect(tower).toBeDefined();
      const militia = bridge
        .getEconomyState()
        .units.filter((u) => u.owner === 1 && u.unitType === 'militia');
      expect(militia.length).toBe(7);
      for (const soldier of militia) {
        expect(bridge.selectEntityAtCell(soldier.x, soldier.y)).toBe(true);
        expect(bridge.issueContextCommand(tower!.x, tower!.y, true)).toBe(true);
      }
      expect(
        stepBridgeUntil(
          bridge,
          () => {
            if (!bridge.selectEntityAtCell(tower!.x, tower!.y)) return false;
            return bridge.getSelectionState().inventory === expected;
          },
          { maxSteps: 900 },
        ),
      ).toBe(true);
    }
  });

  it('a Teuton monk heals from distance 7 without walking; a generic monk closes in', () => {
    for (const civ of ['Teutons', undefined] as const) {
      const bridge = createSimulationBridge('civ-teutons-fixture', {
        ...(civ ? { civilizationsByOwner: new Map([[1, civ]]) } : {}),
      });
      const monk = findUnit(bridge, 1, 'monk');
      const wounded = findUnit(bridge, 1, 'spearman');
      expect(monk).toBeDefined();
      expect(wounded).toBeDefined();
      const start = { x: monk!.x, y: monk!.y };
      expect(Math.abs(start.x - wounded!.x) + Math.abs(start.y - wounded!.y)).toBe(7);
      expect(selectOwnedUnitDirect(bridge, 1, 'monk')).toBe(true);
      expect(bridge.issueContextCommandAtEntity(wounded!.id)).toBe(true);
      expect(
        stepBridgeUntil(
          bridge,
          () => (bridge.getEntityHealth(wounded!.id)?.currentHp ?? 0) > 10,
          { maxSteps: 600 },
        ),
      ).toBe(true);
      const after = findUnit(bridge, 1, 'monk');
      if (civ === 'Teutons') {
        // 2x healing range (8) covers distance 7 — no step taken.
        expect({ x: after!.x, y: after!.y }).toEqual(start);
      } else {
        // Base range 4: the monk had to walk before the first heal tick.
        expect({ x: after!.x, y: after!.y }).not.toEqual(start);
      }
    }
  });
});
