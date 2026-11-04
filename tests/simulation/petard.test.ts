import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { UNIT_BUILDING_ATTACKS } from '../../src/game/simulation/buildingAttack';
import {
  detonatesOnAttack,
  unitMaxHp,
} from '../../src/game/simulation/prototypeUnitRules';
import {
  trainingCost,
  trainingTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

// units.csv, Petard: "Demolition infantry unit armed with explosives. Bonuses
// add up — for example against walls and gates: +500 buildings +900 walls =
// +1400 bonus attack." Castle Age, trained at the Castle, 80 food + 20 gold,
// 50 hit points, and spent in one use like the demolition ships it shares a
// mechanic with.

describe('the Petard — data from units.csv', () => {
  it('costs 65 food + 20 gold and takes 25 seconds', () => {
    expect(trainingCost('petard')).toEqual({ food: 65, gold: 20 });
    expect(trainingTimeTicks('petard')).toBe(250); // 25 s x 10 TPS.
  });

  it('is fragile and enormous against buildings', () => {
    expect(unitMaxHp('petard')).toBe(50);
    // DE's attacks against the building classes (work 140): Building 500,
    // Wall & Gate 900 and Castle 100, each meeting its own class's armor.
    expect(UNIT_BUILDING_ATTACKS.petard).toEqual({ building: 500, 'wall-and-gate': 900, castle: 100 });
    // For scale: the siege engine built to break buildings does half of that.
    expect(UNIT_BUILDING_ATTACKS.petard!.building!).toBeGreaterThan(UNIT_BUILDING_ATTACKS.trebuchet!.building!);
  });

  it('detonates, like the demolition ships it shares a mechanic with', () => {
    expect(detonatesOnAttack('petard')).toBe(true);
  });
});

describe('the Petard — reachable and lethal', () => {
  it('is offered at a Castle-Age Castle', () => {
    const bridge = createSimulationBridge('imperial-castle-fixture');
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('petard');
    expect(bridge.queueTrainUnit('petard')).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.owner === 1 && unit.unitType === 'petard',
      ),
      { maxSteps: 1_500 },
    )).toBe(true);
  }, 120_000);

  it('blows a hole in a wall and is spent doing it', () => {
    const bridge = createSimulationBridge('petard-fixture');
    const petard = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'petard',
    )!;
    const wall = bridge.getEconomyState().buildings.find(
      (building) => building.owner === 2 && building.buildingType === 'stone-wall',
    )!;
    expect(wall).toBeDefined();

    expect(bridge.selectEntityAtCell(petard.x, petard.y)).toBe(true);
    expect(bridge.issueContextCommandAtEntity(wall.id)).toBe(true);
    for (let step = 0; step < 900; step += 1) bridge.step(100);

    // DE's per-class damage on a Stone Wall (8/10, Building 16, Wall & Gate
    // 0): 25 - 8, 500 - 16 and 900, so 1401 in all (work 140). Against the
    // 1800 hit points this game gives the wall it is a hole, not a breach;
    // DE's dataset gives the wall 1080, which work 140 records and leaves,
    // hit points being outside it.
    const health = new Map(
      (bridge.world.getState('aoe2.buildingHealthStates') ?? []) as Array<
        [number, { currentHp: number; maxHp: number }]
      >,
    );
    const wallHealth = health.get(wall.id);
    expect(wallHealth).toBeDefined();
    expect(wallHealth!.maxHp - wallHealth!.currentHp).toBe(1401);
    // And so is the petard — a petard that survives its own blast is the
    // demolition-ship defect all over again.
    expect(bridge.getEconomyState().units.filter((unit) => unit.id === petard.id)).toEqual([]);
  }, 60_000);
});
