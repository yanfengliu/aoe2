import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge production progression', () => {
  it('can build an additional Town Center in Castle Age and use it to train a Villager', () => {
    const bridge = createSimulationBridge('castle-town-center-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('town-center');
    expect(bridge.beginBuildingPlacement('town-center')).toBe(true);
    expect(bridge.confirmBuildingPlacement(14, 8)).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      wood: 425,
      stone: 250,
    });

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge.getEconomyState().buildings.some(
            (building) =>
              building.owner === 1
              && building.buildingType === 'town-center'
              && building.x === 14
              && building.y === 8
              && building.isComplete,
          ),
        { maxSteps: 420 },
      ),
    ).toBe(true);

    expect(
      bridge.getEconomyState().buildings.filter(
        (building) => building.owner === 1 && building.buildingType === 'town-center',
      ),
    ).toHaveLength(2);

    expect(bridge.issueMoveCommand(16, 10)).toBe(true);
    for (let index = 0; index < 40; index += 1) {
      bridge.step(100);
    }

    expect(bridge.selectEntityAtCell(14, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
    });
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    // Phase 1B queue.train: spend lands at start of next step's processCommands.
    bridge.step(100);
    expect(bridge.getHudState().playerResources.food).toBe(150);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);
  }, 15_000);

  it('can research Fletching and apply it to existing and newly trained Archers', () => {
    const bridge = createSimulationBridge('feudal-blacksmith-fixture');

    const startingArcher = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'archer');
    expect(startingArcher).toMatchObject({
      attackDamage: 4,
      attackRange: 4,
    });

    expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
    // FU1 broadened the Feudal Blacksmith menu to include Forging / Scale
    // Mail Armor / Scale Barding Armor / Padded Archer Armor. This test
    // only asserts that `fletching` is present among the options; the
    // full menu is covered by the dedicated blacksmith-progression tests.
    const researchOptions = bridge.getSelectionState().researchOptions;
    expect(bridge.getSelectionState().selectedEntityType).toBe('blacksmith');
    expect(researchOptions).toContain('fletching');
    expect(bridge.queueResearch('fletching')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 150,
      gold: 200,
    });

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    const upgradedArcher = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'archer');
    expect(upgradedArcher).toMatchObject({
      attackDamage: 5,
      attackRange: 5,
    });

    expect(selectOwnedBuildingDirect(bridge, 1, 'archery-range')).toBe(true);
    expect(bridge.queueTrainUnit('archer')).toBe(true);

    for (let index = 0; index < 380; index += 1) {
      bridge.step(100);
    }

    const playerArchers = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'archer');
    expect(playerArchers).toHaveLength(2);
    expect(
      playerArchers.every((unit) => unit.attackDamage === 5 && unit.attackRange === 5),
    ).toBe(true);
  }, 15_000);

  it('can build a Stable in Feudal Age and train a Scout Cavalry from it', () => {
    const bridge = createSimulationBridge('feudal-stable-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('stable');
    placeBuildingNearTownCenter(bridge, 'stable', 1, [{ x: 17, y: 8 }]);
    expect(bridge.getHudState().playerResources.wood).toBe(75);

    for (let index = 0; index < 280; index += 1) {
      bridge.step(100);
    }

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'stable',
      trainOptions: ['scout'],
    });
    expect(bridge.queueTrainUnit('scout')).toBe(true);
    // Phase 1B queue.train: spend lands at start of next step's processCommands.
    bridge.step(100);
    expect(bridge.getHudState().playerResources.food).toBe(170);

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    const playerScouts = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'scout');
    expect(playerScouts).toHaveLength(1);
    expect(playerScouts[0]).toMatchObject({
      attackDamage: 3,
      attackRange: 1,
    });

    const scout = playerScouts[0];
    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.issueMoveCommand(21, 12)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const movedScout = bridge
            .getEconomyState()
            .units.find((unit) => unit.id === scout.id);
          return (
            movedScout !== undefined
            && Math.abs(movedScout.x - 21) + Math.abs(movedScout.y - 12) <= 1
          );
        },
        { maxSteps: 240 },
      ),
    ).toBe(true);
  }, 15_000);

  it('blocks Stable production when no safe spawn tile is available', () => {
    const bridge = createSimulationBridge('blocked-stable-spawn-fixture');

    expect(selectOwnedBuildingDirect(bridge, 1, 'stable')).toBe(true);
    expect(bridge.queueTrainUnit('scout')).toBe(true);

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 1 && unit.unitType === 'scout',
      ),
    ).toBe(false);
    expect(bridge.getSelectionState().queue).toHaveLength(1);
    expect(bridge.getSelectionState().queue[0]).toMatchObject({
      kind: 'unit',
      unitType: 'scout',
      isBlocked: true,
      remainingTicks: 0,
    });
  }, 15_000);
});
