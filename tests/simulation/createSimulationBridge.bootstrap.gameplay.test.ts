import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import type { SelectionState } from '../../src/game/simulation/types';
import { stepBridgeUntil } from './createSimulationBridge.helpers';


describe('createSimulationBridge core systems — gameplay/multi-select/placement', () => {
  it('counts newly trained military units toward population', () => {
    const bridge = createSimulationBridge('feudal-spearman-fixture');

    expect(bridge.getHudState().population).toEqual({
      current: 0,
      cap: 5,
      rawSupply: 5,
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
      rawSupply: 5,
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
      faction: 'Neutral',
      civ: null,
      inventory: '340 / 340 food remaining',
      resourceAmount: 340,
      resourceMaxAmount: 340,
    });
  });

  it.each(['berry-bush', 'tree', 'gold-mine', 'stone-mine'] as const)(
    'omits the internal neutral owner from %s selection details',
    (resourceType) => {
      const bridge = createSimulationBridge(DEFAULT_SEED);
      const resource = bridge
        .getEconomyState()
        .resources.find((candidate) => candidate.resourceType === resourceType);
      expect(resource).toBeDefined();

      expect(bridge.selectEntityById(resource?.id ?? -1)).toBe(true);
      expect(bridge.getSelectionState()).toMatchObject({
        selectedKind: 'resource',
        selectedEntityType: resourceType,
        owner: null,
        faction: null,
      });
    },
  );

  it('labels an enemy-claimed herdable by its current faction', () => {
    const bridge = createSimulationBridge('sheep-movement-fixture');
    const enemySheep = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'sheep' && resource.owner === 2);
    expect(enemySheep).toBeDefined();

    expect(bridge.selectEntityById(enemySheep?.id ?? -1)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'resource',
      selectedEntityType: 'sheep',
      owner: 2,
      faction: 'Enemy',
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
