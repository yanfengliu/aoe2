import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import {
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';


describe('createSimulationBridge core systems — visibility/health/selection', () => {
  it('starts with player-local visibility and nearby resources', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);
    const state = bridge.getRenderState();
    const economyState = bridge.getEconomyState();

    expect(state.frame).not.toBeNull();
    expect(bridge.getHudState().visibleEntities).toBe(state.entities.length);
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
      rawSupply: 5,
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

});
