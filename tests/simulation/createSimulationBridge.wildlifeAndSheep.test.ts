import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

describe('createSimulationBridge core systems', () => {
  it('claims neutral sheep for the player once a nearby unit moves into vision range', () => {
    const bridge = createSimulationBridge('sheep-ownership-fixture');

    expect(
      bridge
        .getEconomyState()
        .resources.find((resource) => resource.resourceType === 'sheep'),
    ).toMatchObject({
      owner: null,
      baseOwner: null,
      x: 10,
      y: 8,
    });

    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.issueMoveCommand(7, 8)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge
            .getEconomyState()
            .resources.find((resource) => resource.resourceType === 'sheep')
            ?.owner === 1,
        { maxSteps: 40 },
      ),
    ).toBe(true);

    const sheep = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'sheep');
    expect(sheep?.owner).toBe(1);

    expect(bridge.selectEntityAtCell(sheep?.x ?? 0, sheep?.y ?? 0)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedKind: 'resource',
      selectedEntityType: 'sheep',
      owner: 1,
    });
  });

  it('updates sheep ownership in the same tick that a scout enters claim range', () => {
    const bridge = createSimulationBridge('sheep-ownership-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'scout')).toBe(true);
    expect(bridge.issueMoveCommand(7, 8)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const scout = bridge
            .getEconomyState()
            .units.find((unit) => unit.owner === 1 && unit.unitType === 'scout');
          return scout?.x === 6 && scout.y === 8;
        },
        { maxSteps: 60 },
      ),
    ).toBe(true);

    const sheep = bridge
      .getEconomyState()
      .resources.find((resource) => resource.resourceType === 'sheep');
    expect(sheep?.owner).toBe(1);
  });

  it('makes hostile wolves auto-aggro nearby human units and damage them', () => {
    const bridge = createSimulationBridge('wolf-aggro-fixture');

    const initialVillager = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager',
      );

    expect(initialVillager).toMatchObject({
      currentHp: 25,
      maxHp: 25,
    });

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const villager = bridge
            .getRenderState()
            .entities.find(
              (entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager',
            );
          return (villager?.currentHp ?? 25) < 25;
        },
        { maxSteps: 120 },
      ),
    ).toBe(true);

    const damagedVillager = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager',
      );
    expect(damagedVillager?.currentHp).toBeLessThan(25);
  });

  it('keeps boars neutral until provoked, then lets them retaliate against the attacker', () => {
    const bridge = createSimulationBridge('boar-aggro-fixture');

    for (let index = 0; index < 80; index += 1) {
      bridge.step(100);
    }

    const idleVillager = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager',
      );
    expect(idleVillager?.currentHp).toBe(25);

    expect(bridge.selectEntityAtCell(10, 8)).toBe(true);
    expect(bridge.issueContextCommand(13, 8)).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const villager = bridge
            .getRenderState()
            .entities.find(
              (entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager',
            );
          return (villager?.currentHp ?? 25) < 25;
        },
        { maxSteps: 160 },
      ),
    ).toBe(true);

    const damagedVillager = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager',
      );
    expect(damagedVillager?.currentHp).toBeLessThan(25);

    const damagedBoar = bridge
      .getRenderState()
      .entities.find(
        (entity) => entity.kind === 'resource' && entity.entityType === 'boar',
      );
    expect(damagedBoar?.currentHp).toBeLessThan(75);
  });

  it('lets a selected villager group attack the same boar concurrently', () => {
    const bridge = createSimulationBridge('boar-hunt-fixture');
    const boar = bridge
      .getRenderState()
      .entities.find((entity) => entity.kind === 'resource' && entity.entityType === 'boar');
    expect(boar).toBeDefined();

    expect(bridge.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
    expect(bridge.getSelectionState().selectedCount).toBe(6);
    expect(bridge.issueContextCommandAtEntity(boar!.id)).toBe(true);

    // One step drains all six submitted context commands and runs combat.
    // The two villagers already orthogonally adjacent to the boar both hit
    // during that same tick; the other four retain attack commands while
    // approaching instead of displacing one another's target.
    bridge.step(100);
    const attackPaths = bridge
      .getDebugSnapshot()
      .unitPaths.filter(
        (path) => path.commandType === 'attack' && path.toX === 13 && path.toY === 8,
      );
    expect(attackPaths).toHaveLength(6);

    const damagedBoar = bridge
      .getRenderState()
      .entities.find((entity) => entity.id === boar!.id);
    expect(damagedBoar?.currentHp).toBe(69);
  });
});
