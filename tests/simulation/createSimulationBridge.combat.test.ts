import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge combat and outcomes', () => {
  it('builds a Barracks and trains a Militia from it', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    placeBuildingNearTownCenter(bridge, 'barracks');
    expect(bridge.getHudState().playerResources.wood).toBe(25);

    for (let index = 0; index < 500; index += 1) {
      bridge.step(100);
    }

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'barracks',
      trainOptions: ['militia'],
    });
    const resourcesBeforeTraining = bridge.getHudState().playerResources;
    expect(bridge.queueTrainUnit('militia')).toBe(true);
    expect(bridge.getHudState().playerResources.food).toBe(resourcesBeforeTraining.food - 60);
    expect(bridge.getHudState().playerResources.gold).toBe(resourcesBeforeTraining.gold - 20);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.filter((unit) => unit.owner === 1 && unit.unitType === 'militia'),
    ).toHaveLength(1);
  });

  it('lets a selected Militia attack and kill a visible enemy scout', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    placeBuildingNearTownCenter(bridge, 'barracks');

    for (let index = 0; index < 500; index += 1) {
      bridge.step(100);
    }

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueTrainUnit('militia')).toBe(true);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    const militia = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'militia');
    expect(militia).toBeDefined();
    expect(bridge.selectEntityAtCell(militia?.x ?? 0, militia?.y ?? 0)).toBe(true);
    expect(bridge.issueMoveCommand(12, 5)).toBe(true);

    for (let index = 0; index < 24; index += 1) {
      bridge.step(100);
    }

    const enemyScout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 2 && unit.unitType === 'scout');
    expect(enemyScout).toBeDefined();

    expect(bridge.selectEntityAtCell(12, 5)).toBe(true);
    expect(bridge.issueContextCommand(enemyScout?.x ?? 0, enemyScout?.y ?? 0)).toBe(true);

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) =>
          unit.owner === 2
          && unit.unitType === 'scout'
          && unit.x === (enemyScout?.x ?? 13)
          && unit.y === (enemyScout?.y ?? 5),
      ),
    ).toBe(false);
  }, 10_000);

  it('lets a selected Militia attack and destroy a visible enemy house', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    placeBuildingNearTownCenter(bridge, 'barracks');

    for (let index = 0; index < 500; index += 1) {
      bridge.step(100);
    }

    expect(selectOwnedBuildingDirect(bridge, 1, 'barracks')).toBe(true);
    expect(bridge.queueTrainUnit('militia')).toBe(true);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    const militia = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'militia');
    expect(militia).toBeDefined();
    expect(bridge.selectEntityAtCell(militia?.x ?? 0, militia?.y ?? 0)).toBe(true);
    expect(bridge.issueMoveCommand(12, 5)).toBe(true);

    for (let index = 0; index < 24; index += 1) {
      bridge.step(100);
    }

    const enemyHouse = bridge
      .getEconomyState()
      .buildings.find(
        (building) =>
          building.owner === 2
          && building.buildingType === 'house'
          && building.x === 12
          && building.y === 3,
      );
    expect(enemyHouse).toBeDefined();

    expect(bridge.selectEntityAtCell(12, 5)).toBe(true);
    expect(bridge.issueContextCommand(12, 3)).toBe(true);

    for (let index = 0; index < 420; index += 1) {
      bridge.step(100);
    }

    const postCombatState = bridge.getEconomyState();
    expect(
      postCombatState.buildings.some(
        (building) =>
          building.owner === 2
          && building.buildingType === 'house'
          && building.x === (enemyHouse?.x ?? 12)
          && building.y === (enemyHouse?.y ?? 3),
      ),
    ).toBe(false);
  }, 10_000);

  it('lets the AI build a Barracks and kill a human villager', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    for (let index = 0; index < 1_200; index += 1) {
      bridge.step(100);
    }

    const economyState = bridge.getEconomyState();
    expect(
      economyState.buildings.some(
        (building) =>
          building.owner === 2
          && building.buildingType === 'barracks'
          && building.isComplete,
      ),
    ).toBe(true);
    expect(
      economyState.units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager').length,
    ).toBeLessThan(3);
  }, 10_000);

  it('declares victory when the player destroys the last enemy structure in the conquest fixture', () => {
    const bridge = createSimulationBridge('conquest-victory-fixture');

    expect(bridge.getHudState().matchState.outcome).toBe('running');
    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.issueContextCommand(10, 8)).toBe(true);

    for (let index = 0; index < 220; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().matchState.outcome).toBe('victory');
  });

  it('declares defeat when the last human structure falls in the defeat fixture', () => {
    const bridge = createSimulationBridge('conquest-defeat-fixture');

    expect(bridge.getHudState().matchState.outcome).toBe('running');

    for (let index = 0; index < 220; index += 1) {
      bridge.step(100);
    }

    const hudState = bridge.getHudState();
    expect(hudState.matchState.outcome).toBe('defeat');

    const frozenTick = hudState.tick;
    bridge.step(100);
    expect(bridge.getHudState().tick).toBe(frozenTick);
  });
});
