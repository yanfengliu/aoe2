import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge combat and outcomes', () => {
  it('lets a selected Militia attack and kill a visible enemy scout', () => {
    const bridge = createSimulationBridge('militia-combat-fixture');

    const militia = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'militia');
    expect(militia).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);

    const enemyScout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 2 && unit.unitType === 'scout');
    expect(enemyScout).toBeDefined();

    expect(bridge.issueContextCommand(enemyScout?.x ?? 0, enemyScout?.y ?? 0)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => !bridge.getEconomyState().units.some((unit) => unit.id === (enemyScout?.id ?? -1)),
        { maxSteps: 480 },
      ),
    ).toBe(true);

    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.id === (enemyScout?.id ?? -1),
      ),
    ).toBe(false);
  }, 30_000);

  it('lets a selected Militia attack and destroy a visible enemy house', () => {
    const bridge = createSimulationBridge('conquest-victory-fixture');
    const enemyHouse = bridge
      .getEconomyState()
      .buildings.find(
        (building) =>
          building.owner === 2
          && building.buildingType === 'house'
          && building.x === 10
          && building.y === 8,
      );
    expect(enemyHouse).toBeDefined();
    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.issueContextCommand(enemyHouse?.x ?? 10, enemyHouse?.y ?? 8)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          !bridge.getEconomyState().buildings.some(
            (building) =>
              building.owner === 2
              && building.buildingType === 'house'
              && building.x === (enemyHouse?.x ?? 10)
              && building.y === (enemyHouse?.y ?? 8),
          ),
        { maxSteps: 260 },
      ),
    ).toBe(true);
    const postCombatState = bridge.getEconomyState();
    expect(
      postCombatState.buildings.some(
        (building) =>
          building.owner === 2
          && building.buildingType === 'house'
          && building.x === (enemyHouse?.x ?? 10)
          && building.y === (enemyHouse?.y ?? 8),
      ),
    ).toBe(false);
  }, 30_000);

  it('lets the AI build a Barracks and kill a human villager', () => {
    const bridge = createSimulationBridge('ai-rush-fixture');

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const economyState = bridge.getEconomyState();
          const aiBarracksComplete = economyState.buildings.some(
            (building) =>
              building.owner === 2
              && building.buildingType === 'barracks'
              && building.isComplete,
          );
          const villagerLossOccurred =
            economyState.units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager').length < 3;
          return aiBarracksComplete && villagerLossOccurred;
        },
        { maxSteps: 2_000 },
      ),
    ).toBe(true);

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
  }, 30_000);

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
