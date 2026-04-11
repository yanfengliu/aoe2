import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';

describe('createSimulationBridge', () => {
  it('starts with player-local visibility and nearby resources', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const state = bridge.getRenderState();

    expect(state.frame).not.toBeNull();
    expect(state.entities.some((entity) => entity.owner === 1 && entity.entityType === 'town-center')).toBe(
      true,
    );
    expect(state.entities.some((entity) => entity.owner === 2 && entity.entityType === 'town-center')).toBe(
      false,
    );
    expect(state.entities.some((entity) => entity.kind === 'resource')).toBe(true);
  });

  it('grows explored territory as the scout moves across ticks', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const initialFrame = bridge.getRenderState().frame;
    expect(initialFrame).not.toBeNull();

    for (let index = 0; index < 12; index += 1) {
      bridge.step(100);
    }

    const nextState = bridge.getRenderState();
    const nextFrame = nextState.frame;
    expect(nextFrame).not.toBeNull();
    expect(nextState.tick).toBe(12);
    expect(nextFrame!.exploredCells.length).toBeGreaterThan(
      initialFrame!.exploredCells.length,
    );
  });

  it('reports visibility metrics through the HUD state', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const hudState = bridge.getHudState();

    expect(hudState.seed).toBe(DEFAULT_SEED);
    expect(hudState.worldSize).toBe('36x24');
    expect(hudState.visibleCells).toBeGreaterThan(0);
    expect(hudState.exploredCells).toBeGreaterThanOrEqual(hudState.visibleCells);
    expect(hudState.playerResources).toEqual({
      food: 200,
      wood: 200,
      gold: 100,
      stone: 200,
    });
    expect(hudState.population).toEqual({
      current: 4,
      cap: 5,
    });
  });

  it('runs a deterministic villager gather and drop-off loop', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const initialHudState = bridge.getHudState();
    const initialEconomyState = bridge.getEconomyState();

    for (let index = 0; index < 120; index += 1) {
      bridge.step(100);
    }

    const nextHudState = bridge.getHudState();
    const nextEconomyState = bridge.getEconomyState();

    expect(nextHudState.playerResources.food).toBeGreaterThan(initialHudState.playerResources.food);
    expect(nextHudState.playerResources.wood).toBeGreaterThan(initialHudState.playerResources.wood);
    expect(
      nextEconomyState.resources.some(
        (resource) =>
          resource.baseOwner === 1
          && (resource.resourceType === 'sheep' || resource.resourceType === 'tree')
          && resource.amount < resource.maxAmount,
      ),
    ).toBe(true);
    expect(nextEconomyState.resources).toHaveLength(initialEconomyState.resources.length);
    expect(
      nextEconomyState.villagers.every((villager) => villager.task !== 'idle'),
    ).toBe(true);
  });

  it('queues a villager at the Town Center and increases population when training completes', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      trainOptions: ['villager'],
    });
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    expect(bridge.getHudState().playerResources.food).toBe(150);
    expect(bridge.getSelectionState().queue).toHaveLength(1);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    const economyState = bridge.getEconomyState();
    expect(
      economyState.units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager'),
    ).toHaveLength(4);
    expect(bridge.getHudState().population).toEqual({
      current: 5,
      cap: 5,
    });
    expect(bridge.getSelectionState().queue).toHaveLength(0);
  });

  it('lets a selected villager place and complete a House that raises population cap', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'villager',
      buildOptions: ['house'],
    });
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.getSelectionState().placementMode).toBe('house');
    expect(bridge.confirmBuildingPlacement(10, 5)).toBe(true);
    expect(bridge.getHudState().playerResources.wood).toBe(175);
    expect(bridge.getHudState().population.cap).toBe(5);

    const placedHouse = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
    expect(placedHouse).toMatchObject({
      owner: 1,
      buildingType: 'house',
      x: 10,
      y: 5,
      isComplete: false,
    });

    for (let index = 0; index < 400; index += 1) {
      bridge.step(100);
    }

    const completedHouse = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
    expect(completedHouse?.isComplete).toBe(true);
    expect(bridge.getHudState().population.cap).toBe(10);
  });
});
