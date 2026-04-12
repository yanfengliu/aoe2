import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import type { SelectionState } from '../../src/game/simulation/types';
import {
  placeBuildingNearTownCenter,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge core systems', () => {
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

  it('uses authoritative starting building footprints in economy and render state', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    const economyTownCenter = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'town-center');
    const renderTownCenter = bridge
      .getRenderState()
      .entities.find((entity) => entity.owner === 1 && entity.entityType === 'town-center');

    expect(economyTownCenter).toMatchObject({
      footprintWidth: 4,
      footprintHeight: 4,
    });
    expect(renderTownCenter).toMatchObject({
      footprintWidth: 4,
      footprintHeight: 4,
    });
  });

  it('keeps human starting units idle and stationary until commanded', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const initialFrame = bridge.getRenderState().frame;
    const initialHudState = bridge.getHudState();
    const initialEconomyState = bridge.getEconomyState();
    expect(initialFrame).not.toBeNull();
    const initialHumanScout = initialEconomyState.units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'scout',
    );
    expect(initialHumanScout).toBeDefined();

    for (let index = 0; index < 120; index += 1) {
      bridge.step(100);
    }

    const nextHudState = bridge.getHudState();
    const nextState = bridge.getRenderState();
    const nextEconomyState = bridge.getEconomyState();
    const nextFrame = nextState.frame;
    expect(nextFrame).not.toBeNull();
    expect(nextState.tick).toBe(120);
    expect(nextHudState.playerResources).toEqual(initialHudState.playerResources);
    expect(nextFrame!.exploredCells.length).toBe(
      initialFrame!.exploredCells.length,
    );
    const humanVillagers = nextEconomyState.villagers.filter((villager) => villager.owner === 1);
    expect(humanVillagers.length).toBeGreaterThan(0);
    expect(humanVillagers.every((villager) => villager.task === 'idle')).toBe(true);
    expect(
      nextEconomyState.units.find((unit) => unit.owner === 1 && unit.unitType === 'scout'),
    ).toMatchObject({
      x: initialHumanScout?.x,
      y: initialHumanScout?.y,
    });
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
    expect(hudState.matchState).toEqual({
      outcome: 'running',
      summary: '',
    });
  });

  it('runs a deterministic AI villager gather and drop-off loop while human stockpiles stay unchanged', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const initialHudState = bridge.getHudState();
    const initialEconomyState = bridge.getEconomyState();

    for (let index = 0; index < 120; index += 1) {
      bridge.step(100);
    }

    const nextHudState = bridge.getHudState();
    const nextEconomyState = bridge.getEconomyState();

    expect(nextHudState.playerResources).toEqual(initialHudState.playerResources);
    expect(nextEconomyState.playerResources[2]).toMatchObject({
      food: expect.any(Number),
      wood: expect.any(Number),
      gold: 100,
      stone: 200,
    });
    expect(nextEconomyState.playerResources[2].food).toBeGreaterThan(initialEconomyState.playerResources[2].food);
    expect(
      nextEconomyState.resources.some(
        (resource) =>
          resource.baseOwner === 2
          && (resource.resourceType === 'sheep' || resource.resourceType === 'tree')
          && resource.amount < resource.maxAmount,
      ),
    ).toBe(true);
    expect(nextEconomyState.resources).toHaveLength(initialEconomyState.resources.length);
    expect(
      nextEconomyState.villagers
        .filter((villager) => villager.owner === 2)
        .every((villager) => villager.task !== 'idle'),
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

  it('counts newly trained military units toward population', () => {
    const bridge = createSimulationBridge('feudal-spearman-fixture');

    expect(bridge.getHudState().population).toEqual({
      current: 0,
      cap: 5,
    });

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
    });

    const barracks = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'barracks');
    expect(barracks).toBeDefined();

    expect(bridge.selectEntityAtCell(barracks?.x ?? 0, barracks?.y ?? 0)).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('spearman');
    expect(bridge.queueTrainUnit('spearman')).toBe(true);

    for (let index = 0; index < 230; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'spearman',
      ),
    ).toHaveLength(1);
    expect(bridge.getHudState().population).toEqual({
      current: 1,
      cap: 5,
    });
  });

  it('selects visible resource entities and exposes their remaining amount', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const sheep = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'sheep' && resource.baseOwner === 1);
    expect(sheep).toBeDefined();

    expect(bridge.selectEntityAtCell(sheep?.x ?? 0, sheep?.y ?? 0)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'resource',
      selectedEntityType: 'sheep',
      owner: null,
      x: sheep?.x,
      y: sheep?.y,
      actionOptions: [],
      buildOptions: [],
      marketOptions: [],
      trainOptions: [],
      researchOptions: [],
      queue: [],
      tileEntityIndex: 1,
      tileEntityCount: 1,
      resourceAmount: 100,
      resourceMaxAmount: 100,
    });
  });

  it('cycles through every selectable entity stacked on the same tile', () => {
    const bridge = createSimulationBridge('tile-selection-cycle-fixture');
    const stackCell = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
    expect(stackCell).toBeDefined();

    expect(bridge.selectEntityAtCell(stackCell?.x ?? 0, stackCell?.y ?? 0)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'unit',
      selectedEntityType: 'militia',
      tileEntityIndex: 1,
      tileEntityCount: 3,
    });

    expect(bridge.selectEntityAtCell(stackCell?.x ?? 0, stackCell?.y ?? 0)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'building',
      selectedEntityType: 'house',
      tileEntityIndex: 2,
      tileEntityCount: 3,
    });

    expect(bridge.selectEntityAtCell(stackCell?.x ?? 0, stackCell?.y ?? 0)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'resource',
      selectedEntityType: 'sheep',
      tileEntityIndex: 3,
      tileEntityCount: 3,
      resourceAmount: 100,
    });

    expect(bridge.selectEntityAtCell(stackCell?.x ?? 0, stackCell?.y ?? 0)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'unit',
      selectedEntityType: 'militia',
      tileEntityIndex: 1,
      tileEntityCount: 3,
    });
  });

  it('can box-select multiple villagers and issue one move command to the whole group', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(
      (
        bridge as unknown as {
          selectUnitsInBox: (minX: number, minY: number, maxX: number, maxY: number) => boolean;
        }
      ).selectUnitsInBox(5, 7, 7, 9),
    ).toBe(true);

    const selectionState = bridge.getSelectionState() as SelectionState & {
      selectedCount?: number;
      selectedEntityIds?: number[];
    };
    expect(selectionState.selectedCount).toBe(3);
    expect(selectionState.selectedEntityIds).toHaveLength(3);

    expect(bridge.issueMoveCommand(10, 12)).toBe(true);

    for (let index = 0; index < 40; index += 1) {
      bridge.step(100);
    }

    const movedVillagers = bridge
      .getEconomyState()
      .units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.x >= 9 && unit.y >= 11,
      );
    expect(movedVillagers).toHaveLength(3);
  });

  it('can select all owned on-screen units of the same type without pulling in other unit types', () => {
    const bridge = createSimulationBridge('double-click-selection-fixture');

    expect(
      (
        bridge as unknown as {
          selectOwnedUnitsByTypeInRect: (
            unitType: 'villager' | 'scout',
            minX: number,
            minY: number,
            maxX: number,
            maxY: number,
          ) => boolean;
        }
      ).selectOwnedUnitsByTypeInRect('villager', 0, 0, 23, 17),
    ).toBe(true);

    const selectionState = bridge.getSelectionState();
    expect(selectionState.selectedCount).toBe(3);
    expect(selectionState.selectedEntityIds).toHaveLength(3);
    expect(selectionState.selectedEntityType).toBe('villager');
    expect(selectionState.buildOptions).toContain('house');
  });

  it('selects every friendly movable unit in the drag box while ignoring buildings', () => {
    const bridge = createSimulationBridge('mixed-selection-fixture');
    const friendlyUnits = bridge
      .getEconomyState()
      .units.filter(
        (unit) => unit.owner === 1 && ['villager', 'militia', 'scout'].includes(unit.unitType),
      );
    const minX = Math.min(...friendlyUnits.map((unit) => unit.x));
    const maxX = Math.max(...friendlyUnits.map((unit) => unit.x));
    const minY = Math.min(...friendlyUnits.map((unit) => unit.y));
    const maxY = Math.max(...friendlyUnits.map((unit) => unit.y));

    expect(bridge.selectUnitsInBox(minX, minY, maxX, maxY)).toBe(true);

    const selectionState = bridge.getSelectionState();
    expect(selectionState.selectedCount).toBe(3);
    expect(selectionState.selectedEntityIds).toHaveLength(3);
    expect(selectionState.selectedEntityType).toBeNull();
    expect(selectionState.buildOptions).toEqual([]);

    expect(bridge.issueMoveCommand(14, 12)).toBe(true);

    for (let index = 0; index < 40; index += 1) {
      bridge.step(100);
    }

    const movedUnits = bridge
      .getEconomyState()
      .units.filter(
        (unit) =>
          unit.owner === 1
          && ['villager', 'militia', 'scout'].includes(unit.unitType)
          && unit.x >= 13
          && unit.y >= 11,
      );
    expect(movedUnits).toHaveLength(3);
  });

  it('lets a selected villager place and complete a House that raises population cap', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'villager',
      buildOptions: ['house', 'mill', 'lumber-camp', 'mining-camp', 'barracks'],
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

  it('projects construction and completion building visuals into render state for newly placed buildings', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(10, 5)).toBe(true);

    bridge.step(100);

    const constructingHouse = bridge
      .getRenderState()
      .entities.find(
        (entity) =>
          entity.owner === 1
          && entity.entityType === 'house'
          && entity.x === 10
          && entity.y === 5,
      );
    expect(constructingHouse).toMatchObject({
      footprintWidth: 2,
      footprintHeight: 2,
      visualVariant: 'construction',
    });

    for (let index = 0; index < 400; index += 1) {
      bridge.step(100);
    }

    const completedHouse = bridge
      .getRenderState()
      .entities.find(
        (entity) =>
          entity.owner === 1
          && entity.entityType === 'house'
          && entity.x === 10
          && entity.y === 5,
      );
    expect(completedHouse).toMatchObject({
      footprintWidth: 2,
      footprintHeight: 2,
      visualVariant: 'complete',
    });
  });

  it('rejects invalid building placement and keeps placement mode active', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(8, 8)).toBe(false);
    expect(bridge.getSelectionState().placementMode).toBe('house');
    expect(
      bridge.getEconomyState().buildings.some(
        (building) => building.owner === 1 && building.buildingType === 'house',
      ),
    ).toBe(false);
  });

  it('redirects a selected villager to gather gold through an explicit context order', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.issueContextCommand(13, 7)).toBe(true);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().playerResources.gold).toBeGreaterThan(100);
  });

  it('uses a completed Mining Camp as the villager gold drop-off point', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    placeBuildingNearTownCenter(bridge, 'mining-camp', 1, [
      { x: 15, y: 7 },
      { x: 15, y: 8 },
      { x: 15, y: 6 },
    ]);
    expect(bridge.getHudState().playerResources.wood).toBe(100);

    for (let index = 0; index < 400; index += 1) {
      bridge.step(100);
    }

    const miningCamp = bridge
      .getEconomyState()
      .buildings.find(
        (building) => building.owner === 1 && building.buildingType === 'mining-camp',
      );
    expect(miningCamp?.isComplete).toBe(true);

    expect(bridge.issueContextCommand(13, 7)).toBe(true);

    for (let index = 0; index < 120; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().playerResources.gold).toBeGreaterThan(100);
  });
});
