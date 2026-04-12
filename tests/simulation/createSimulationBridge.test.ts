import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import type { SelectionState } from '../../src/game/simulation/types';

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
    expect(hudState.matchState).toEqual({
      outcome: 'running',
      summary: '',
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

  it('counts newly trained military units toward population', () => {
    const bridge = createSimulationBridge('feudal-spearman-fixture');

    expect(bridge.getHudState().population).toEqual({
      current: 0,
      cap: 5,
    });

    expect(bridge.selectEntityAtCell(11, 8)).toBe(true);
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

    expect(bridge.selectEntityAtCell(10, 10)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'resource',
      selectedEntityType: 'sheep',
      owner: null,
      x: 10,
      y: 10,
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

    expect(bridge.selectEntityAtCell(10, 10)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'unit',
      selectedEntityType: 'militia',
      tileEntityIndex: 1,
      tileEntityCount: 3,
    });

    expect(bridge.selectEntityAtCell(10, 10)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'building',
      selectedEntityType: 'house',
      tileEntityIndex: 2,
      tileEntityCount: 3,
    });

    expect(bridge.selectEntityAtCell(10, 10)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'resource',
      selectedEntityType: 'sheep',
      tileEntityIndex: 3,
      tileEntityCount: 3,
      resourceAmount: 100,
    });

    expect(bridge.selectEntityAtCell(10, 10)).toBe(true);
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

    expect(bridge.selectUnitsInBox(7, 9, 10, 10)).toBe(true);

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
    expect(bridge.beginBuildingPlacement('mining-camp')).toBe(true);
    expect(bridge.confirmBuildingPlacement(11, 7)).toBe(true);
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

    for (let index = 0; index < 67; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().playerResources.gold).toBeGreaterThan(100);
  });

  it('builds a Barracks and trains a Militia from it', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.beginBuildingPlacement('barracks')).toBe(true);
    expect(bridge.confirmBuildingPlacement(10, 5)).toBe(true);
    expect(bridge.getHudState().playerResources.wood).toBe(25);

    for (let index = 0; index < 500; index += 1) {
      bridge.step(100);
    }

    expect(bridge.selectEntityAtCell(10, 5)).toBe(true);
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
    expect(bridge.beginBuildingPlacement('barracks')).toBe(true);
    expect(bridge.confirmBuildingPlacement(10, 5)).toBe(true);

    for (let index = 0; index < 500; index += 1) {
      bridge.step(100);
    }

    expect(bridge.selectEntityAtCell(10, 5)).toBe(true);
    expect(bridge.queueTrainUnit('militia')).toBe(true);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    const militia = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'militia');
    const enemyScout = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 2 && unit.unitType === 'scout' && unit.x === 13 && unit.y === 5);

    expect(militia).toBeDefined();
    expect(enemyScout).toBeDefined();

    expect(bridge.selectEntityAtCell(militia?.x ?? 0, militia?.y ?? 0)).toBe(true);
    expect(bridge.issueContextCommand(enemyScout?.x ?? 0, enemyScout?.y ?? 0)).toBe(true);

    for (let index = 0; index < 220; index += 1) {
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
  });

  it('lets a selected Militia attack and destroy a visible enemy house', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.beginBuildingPlacement('barracks')).toBe(true);
    expect(bridge.confirmBuildingPlacement(10, 5)).toBe(true);

    for (let index = 0; index < 500; index += 1) {
      bridge.step(100);
    }

    expect(bridge.selectEntityAtCell(10, 5)).toBe(true);
    expect(bridge.queueTrainUnit('militia')).toBe(true);

    for (let index = 0; index < 260; index += 1) {
      bridge.step(100);
    }

    const militia = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'militia');
    const enemyHouse = bridge
      .getEconomyState()
      .buildings.find(
        (building) =>
          building.owner === 2
          && building.buildingType === 'house'
          && building.x === 12
          && building.y === 3,
      );

    expect(militia).toBeDefined();
    expect(enemyHouse).toBeDefined();

    expect(bridge.selectEntityAtCell(militia?.x ?? 0, militia?.y ?? 0)).toBe(true);
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

  it('does not offer Feudal Age research until two qualifying Dark Age buildings are complete', () => {
    const bridge = createSimulationBridge('feudal-missing-prereq-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      researchOptions: [],
    });
    expect(bridge.queueResearch('feudal-age')).toBe(false);
  });

  it('can research Feudal Age, build an Archery Range, and train an Archer', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      researchOptions: ['feudal-age'],
    });
    expect(bridge.queueResearch('feudal-age')).toBe(true);
    expect(bridge.getHudState().playerResources.food).toBe(200);

    for (let index = 0; index < 1320; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().currentAge).toBe('feudal-age');

    expect(bridge.selectEntityAtCell(8, 10)).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('archery-range');
    expect(bridge.beginBuildingPlacement('archery-range')).toBe(true);
    expect(bridge.confirmBuildingPlacement(13, 8)).toBe(true);

    for (let index = 0; index < 280; index += 1) {
      bridge.step(100);
    }

    expect(bridge.selectEntityAtCell(14, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'archery-range',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('archer');
    expect(bridge.queueTrainUnit('archer')).toBe(true);

    for (let index = 0; index < 380; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.filter((unit) => unit.owner === 1 && unit.unitType === 'archer'),
    ).toHaveLength(1);
  }, 15_000);

  it('does not offer Castle Age research until two qualifying Feudal buildings are complete', () => {
    const bridge = createSimulationBridge('feudal-stable-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      researchOptions: [],
    });
    expect(bridge.queueResearch('castle-age')).toBe(false);
  });

  it('can research Castle Age and train a Knight', () => {
    const bridge = createSimulationBridge('castle-age-fixture');

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      researchOptions: ['castle-age'],
    });
    expect(bridge.queueResearch('castle-age')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 200,
      gold: 200,
    });

    for (let index = 0; index < 1620; index += 1) {
      bridge.step(100);
    }

    expect(bridge.getHudState().currentAge).toBe('castle-age');

    expect(bridge.selectEntityAtCell(14, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'stable',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('knight');
    expect(bridge.queueTrainUnit('knight')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 140,
      gold: 125,
    });

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

    const playerKnights = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'knight');
    expect(playerKnights).toHaveLength(1);
    expect(playerKnights[0]).toMatchObject({
      attackDamage: 10,
      attackRange: 1,
    });
  }, 15_000);

  it('can build an additional Town Center in Castle Age and use it to train a Villager', () => {
    const bridge = createSimulationBridge('castle-town-center-fixture');

    expect(bridge.selectEntityAtCell(8, 10)).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('town-center');
    expect(bridge.beginBuildingPlacement('town-center')).toBe(true);
    expect(bridge.confirmBuildingPlacement(14, 8)).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      wood: 425,
      stone: 250,
    });

    for (let index = 0; index < 320; index += 1) {
      bridge.step(100);
    }

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

    expect(bridge.selectEntityAtCell(14, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'blacksmith',
      researchOptions: ['fletching'],
    });
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

    expect(bridge.selectEntityAtCell(11, 8)).toBe(true);
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

    expect(bridge.selectEntityAtCell(8, 10)).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('stable');
    expect(bridge.beginBuildingPlacement('stable')).toBe(true);
    expect(bridge.confirmBuildingPlacement(17, 8)).toBe(true);
    expect(bridge.getHudState().playerResources.wood).toBe(75);

    for (let index = 0; index < 280; index += 1) {
      bridge.step(100);
    }

    expect(bridge.selectEntityAtCell(18, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'stable',
      trainOptions: ['scout'],
    });
    expect(bridge.queueTrainUnit('scout')).toBe(true);
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
  }, 15_000);

  it('can train a Spearman in Feudal Age and use its anti-scout bonus to kill a visible Scout quickly', () => {
    const bridge = createSimulationBridge('feudal-spearman-fixture');

    expect(bridge.selectEntityAtCell(11, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'barracks',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('spearman');
    expect(bridge.queueTrainUnit('spearman')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 215,
      wood: 125,
    });

    for (let index = 0; index < 240; index += 1) {
      bridge.step(100);
    }

    const spearman = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'spearman');
    expect(spearman).toBeDefined();
    expect(bridge.selectEntityAtCell(spearman?.x ?? 0, spearman?.y ?? 0)).toBe(true);
    expect(bridge.issueContextCommand(14, 10)).toBe(true);

    for (let index = 0; index < 80; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  }, 15_000);

  it('can train a Skirmisher in Feudal Age and use its anti-archer bonus to kill a visible Archer quickly', () => {
    const bridge = createSimulationBridge('feudal-skirmisher-fixture');

    expect(bridge.selectEntityAtCell(11, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'archery-range',
    });
    expect(bridge.getSelectionState().trainOptions).toContain('skirmisher');
    expect(bridge.queueTrainUnit('skirmisher')).toBe(true);
    expect(bridge.getHudState().playerResources).toMatchObject({
      food: 215,
      wood: 225,
    });

    for (let index = 0; index < 240; index += 1) {
      bridge.step(100);
    }

    const skirmisher = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'skirmisher');
    expect(skirmisher).toBeDefined();
    expect(bridge.selectEntityAtCell(skirmisher?.x ?? 0, skirmisher?.y ?? 0)).toBe(true);
    expect(bridge.issueContextCommand(14, 10)).toBe(true);

    for (let index = 0; index < 120; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'archer',
      ),
    ).toBe(false);
  }, 15_000);

  it('can build a Watch Tower in Feudal Age and let it automatically kill a nearby visible Scout', () => {
    const bridge = createSimulationBridge('feudal-watch-tower-fixture');

    expect(bridge.selectEntityAtCell(8, 10)).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('watch-tower');
    expect(bridge.beginBuildingPlacement('watch-tower')).toBe(true);
    expect(bridge.confirmBuildingPlacement(14, 8)).toBe(true);
    expect(bridge.getHudState().playerResources.stone).toBe(75);

    for (let index = 0; index < 360; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'watch-tower'
          && building.isComplete,
      ),
    ).toBe(true);
    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  }, 15_000);

  it('can garrison and ungarrison a villager through the Town Center', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.issueContextCommand(8, 8)).toBe(true);
    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'town-center',
      actionOptions: ['ungarrison'],
    });
    expect(bridge.issueAction('ungarrison')).toBe(true);

    const villagersAfterUngarrison = bridge
      .getEconomyState()
      .units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villagersAfterUngarrison).toHaveLength(3);
    expect(
      villagersAfterUngarrison.some(
        (villager) =>
          villager.x !== 6 && villager.y !== 8 && Math.abs(villager.x - 8) <= 2 && Math.abs(villager.y - 8) <= 2,
      ),
    ).toBe(true);
  });

  it('can garrison and ungarrison a villager through a completed Watch Tower', () => {
    const bridge = createSimulationBridge('feudal-watch-tower-fixture');

    expect(bridge.selectEntityAtCell(8, 10)).toBe(true);
    expect(bridge.beginBuildingPlacement('watch-tower')).toBe(true);
    expect(bridge.confirmBuildingPlacement(14, 8)).toBe(true);

    for (let index = 0; index < 360; index += 1) {
      bridge.step(100);
    }

    const villager = bridge
      .getEconomyState()
      .units.find((unit) => unit.owner === 1 && unit.unitType === 'villager');
    expect(villager).toBeDefined();

    expect(bridge.selectEntityAtCell(villager?.x ?? 0, villager?.y ?? 0)).toBe(true);
    expect(bridge.issueContextCommand(14, 8)).toBe(true);
    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(0);

    expect(bridge.selectEntityAtCell(14, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'watch-tower',
      actionOptions: ['ungarrison'],
    });
    expect(bridge.issueAction('ungarrison')).toBe(true);

    expect(
      bridge.getEconomyState().units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(1);
  }, 15_000);

  it('lets a garrisoned Town Center automatically kill a nearby enemy scout', () => {
    const bridge = createSimulationBridge('town-center-defense-fixture');

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.issueContextCommand(8, 8)).toBe(true);

    for (let index = 0; index < 80; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  });

  it('can build a Market in Feudal Age and exchange resources through market actions', () => {
    const bridge = createSimulationBridge('feudal-market-fixture');

    expect(bridge.selectEntityAtCell(8, 10)).toBe(true);
    expect(bridge.getSelectionState().buildOptions).toContain('market');
    expect(bridge.beginBuildingPlacement('market')).toBe(true);
    expect(bridge.confirmBuildingPlacement(17, 8)).toBe(true);
    expect(bridge.getHudState().playerResources.wood).toBe(275);

    for (let index = 0; index < 280; index += 1) {
      bridge.step(100);
    }

    expect(bridge.selectEntityAtCell(18, 8)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedEntityType: 'market',
      marketOptions: [
        'buy-food',
        'sell-food',
        'buy-wood',
        'sell-wood',
        'buy-stone',
        'sell-stone',
      ],
    });

    const resourcesAfterBuild = bridge.getHudState().playerResources;
    expect(bridge.issueMarketAction('sell-wood')).toBe(true);

    const resourcesAfterFirstSale = bridge.getHudState().playerResources;
    expect(resourcesAfterFirstSale.wood).toBe(resourcesAfterBuild.wood - 100);
    expect(resourcesAfterFirstSale.gold).toBeGreaterThan(resourcesAfterBuild.gold);

    expect(bridge.issueMarketAction('sell-wood')).toBe(true);

    const resourcesAfterSecondSale = bridge.getHudState().playerResources;
    expect(resourcesAfterSecondSale.wood).toBe(resourcesAfterFirstSale.wood - 100);
    expect(resourcesAfterSecondSale.gold - resourcesAfterFirstSale.gold).toBeLessThan(
      resourcesAfterFirstSale.gold - resourcesAfterBuild.gold,
    );

    expect(bridge.issueMarketAction('buy-food')).toBe(true);

    const resourcesAfterFirstBuy = bridge.getHudState().playerResources;
    expect(resourcesAfterFirstBuy.food).toBe(resourcesAfterSecondSale.food + 100);
    expect(resourcesAfterSecondSale.gold - resourcesAfterFirstBuy.gold).toBeGreaterThan(0);

    expect(bridge.issueMarketAction('buy-food')).toBe(true);

    const resourcesAfterSecondBuy = bridge.getHudState().playerResources;
    expect(resourcesAfterSecondBuy.food).toBe(resourcesAfterFirstBuy.food + 100);
    expect(resourcesAfterFirstBuy.gold - resourcesAfterSecondBuy.gold).toBeGreaterThan(
      resourcesAfterSecondSale.gold - resourcesAfterFirstBuy.gold,
    );
  }, 15_000);

  it('can set a rally point on a selected Archery Range so newly trained units move to it automatically', () => {
    const bridge = createSimulationBridge('feudal-skirmisher-fixture');

    expect(bridge.selectEntityAtCell(11, 8)).toBe(true);
    expect(bridge.issueContextCommand(15, 10)).toBe(true);
    expect(bridge.queueTrainUnit('skirmisher')).toBe(true);

    for (let index = 0; index < 300; index += 1) {
      bridge.step(100);
    }

    expect(
      bridge.getEconomyState().units.some(
        (unit) =>
          unit.owner === 1
          && unit.unitType === 'skirmisher'
          && unit.x === 15
          && unit.y === 10,
      ),
    ).toBe(true);
  }, 15_000);
});
