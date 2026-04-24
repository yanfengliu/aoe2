import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import type { SelectionState } from '../../src/game/simulation/types';
import {
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge core systems', () => {
  it('starts with player-local visibility and nearby resources', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const state = bridge.getRenderState();
    const economyState = bridge.getEconomyState();

    expect(state.frame).not.toBeNull();
    expect(state.entities.some((entity) => entity.owner === 1 && entity.entityType === 'town-center')).toBe(
      true,
    );
    expect(state.entities.some((entity) => entity.owner === 2 && entity.entityType === 'town-center')).toBe(
      false,
    );
    expect(state.entities.some((entity) => entity.kind === 'resource')).toBe(true);
    expect(
      economyState.resources.some(
        (resource) => resource.resourceType === 'sheep' && resource.baseOwner === 1 && resource.owner === 1,
      ),
    ).toBe(true);
    expect(
      economyState.resources.some(
        (resource) => resource.resourceType === 'sheep' && resource.baseOwner === 2 && resource.owner === 2,
      ),
    ).toBe(true);
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

  it('projects health values for visible units and buildings and updates them during combat', () => {
    const bridge = createSimulationBridge('conquest-victory-fixture');

    const initialMilitia = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.owner === 1 && entity.kind === 'unit' && entity.entityType === 'militia',
      );
    const initialHouse = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.owner === 2 && entity.kind === 'building' && entity.entityType === 'house',
      );

    expect(initialMilitia).toMatchObject({
      currentHp: 40,
      maxHp: 40,
    });
    expect(initialHouse).toMatchObject({
      currentHp: 75,
      maxHp: 75,
    });

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.issueContextCommand(10, 8)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const damagedHouse = bridge
            .getRenderState()
            .entities.find(
              (entity) => entity.owner === 2 && entity.kind === 'building' && entity.entityType === 'house',
            );
          return (damagedHouse?.currentHp ?? 75) < (damagedHouse?.maxHp ?? 75);
        },
        { maxSteps: 220 },
      ),
    ).toBe(true);

    const damagedHouse = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.owner === 2 && entity.kind === 'building' && entity.entityType === 'house',
      );
    expect(damagedHouse?.currentHp).toBeLessThan(damagedHouse?.maxHp ?? 75);
  });

  it('projects player-facing unit selection details for the HUD', () => {
    const bridge = createSimulationBridge('villager-selection-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);

    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'unit',
      selectedEntityType: 'villager',
      health: {
        current: 25,
        max: 25,
      },
      attack: 3,
      armor: 0,
      faction: 'Player',
      civ: 'Britons',
      inventory: 'Empty',
    });
  });

  it('projects player-facing building selection details for the HUD', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    const townCenter = bridge
      .getEconomyState()
      .buildings.find((building) => building.owner === 1 && building.buildingType === 'town-center');
    expect(townCenter).toBeDefined();

    expect(bridge.selectEntityAtCell(townCenter?.x ?? 0, townCenter?.y ?? 0)).toBe(true);

    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'building',
      selectedEntityType: 'town-center',
      health: {
        current: 2400,
        max: 2400,
      },
      attack: 5,
      armor: 0,
      faction: 'Player',
      civ: 'Britons',
      inventory: '0 / 5 garrisoned',
    });
  });

  it('can issue a context command against an exact hostile entity id', () => {
    const bridge = createSimulationBridge('moving-enemy-attack-fixture');
    const enemyScout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 2 && unit.unitType === 'scout');

    expect(enemyScout).toBeDefined();
    expect(selectOwnedUnitDirect(bridge, 1, 'militia')).toBe(true);

    bridge.step(100);

    expect(
      (
        bridge as unknown as {
          issueContextCommandAtEntity: (entityId: number) => boolean;
        }
      ).issueContextCommandAtEntity(enemyScout?.id ?? -1),
    ).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          !bridge
            .getEconomyState()
            .units.some((unit) => unit.id === (enemyScout?.id ?? -1)),
        { maxSteps: 480 },
      ),
    ).toBe(true);
  });

  it('reports visibility metrics through the HUD state', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const hudState = bridge.getHudState();

    expect(hudState.seed).toBe(DEFAULT_SEED);
    expect(hudState.worldSize).toBe('60x36');
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
      winCondition: null,
      scores: null,
      wonderCountdownTicks: null,
      relicCountdownTicks: null,
    });
  }, 15_000);

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
      owner: 1,
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
      faction: 'Player',
      civ: null,
      inventory: '100 / 100 food remaining',
    });
  });

  it('projects health and attack for wild boar resources in the selection HUD', () => {
    const bridge = createSimulationBridge('boar-aggro-fixture');

    expect(bridge.selectEntityAtCell(13, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'resource',
      selectedEntityType: 'boar',
      owner: null,
      health: {
        current: 75,
        max: 75,
      },
      attack: 7,
      armor: 0,
      faction: 'Gaia',
      civ: null,
      inventory: '340 / 340 food remaining',
      resourceAmount: 340,
      resourceMaxAmount: 340,
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
    const bridge = createSimulationBridge('villager-selection-fixture');

    expect(
      (
        bridge as unknown as {
          selectUnitsInBox: (minX: number, minY: number, maxX: number, maxY: number) => boolean;
        }
      ).selectUnitsInBox(5, 10, 7, 11),
    ).toBe(true);

    const selectionState = bridge.getSelectionState() as SelectionState & {
      selectedCount?: number;
      selectedEntityIds?: number[];
    };
    expect(selectionState.selectedCount).toBe(3);
    expect(selectionState.selectedEntityIds).toHaveLength(3);

    expect(bridge.issueMoveCommand(10, 12)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge
            .getEconomyState()
            .units.filter(
              (unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.x >= 9 && unit.y >= 11,
            ).length === 3,
        { maxSteps: 80 },
      ),
    ).toBe(true);
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
  }, 15_000);

  it('rejects house placement on blocked terrain, resources, buildings, and units', () => {
    const bridge = createSimulationBridge('blocking-rules-fixture');

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.beginBuildingPlacement('house')).toBe(true);

    expect(bridge.getPlacementPreview(10, 5)).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: 10,
      cellY: 5,
      isValid: false,
    });
    expect(bridge.getPlacementPreview(12, 5)).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: 12,
      cellY: 5,
      isValid: false,
    });
    expect(bridge.getPlacementPreview(14, 5)).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: 14,
      cellY: 5,
      isValid: false,
    });
    expect(bridge.getPlacementPreview(8, 13)).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: 8,
      cellY: 13,
      isValid: false,
    });
    expect(bridge.getPlacementPreview(7, 13)).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: 7,
      cellY: 13,
      isValid: false,
    });
    expect(bridge.getPlacementPreview(4, 8)).toMatchObject({
      active: true,
      buildingType: 'house',
      cellX: 4,
      cellY: 8,
      isValid: false,
    });
  });
});
