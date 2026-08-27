// Phase 1B unit.attack tests.

import { describe, it, expect, vi } from 'vitest';

import { World } from 'civ-engine';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createBridgeState } from '../../src/game/simulation/bridge/bridgeState';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { unitCommandsCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { createUnitCommandOps } from '../../src/game/simulation/bridge/unitCommandOps';
import { unitAttackValidator } from '../../src/game/simulation/handlers/unit/unitAttackValidator';
import { makeUnitAttackHandler } from '../../src/game/simulation/handlers/unit/unitAttackHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';

function freshWorld() {
  return new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 16,
    gridHeight: 16,
    seed: 'test',
    tps: 60,
  });
}

describe('unitAttackValidator', () => {
  it('rejects non-integer ids', () => {
    const world = freshWorld();
    const result = unitAttackValidator(
      { unitId: 1.5, targetEntityId: 2, targetEntityKind: 'unit' },
      world,
    );
    expect(result).toEqual({ code: 'invalid_id', message: expect.any(String) });
  });

  it('rejects unknown target kind', () => {
    const world = freshWorld();
    const result = unitAttackValidator(
      // @ts-expect-error — testing runtime guard for invalid kind
      { unitId: 1, targetEntityId: 2, targetEntityKind: 'wolf' },
      world,
    );
    expect(result).toEqual({ code: 'invalid_target_kind', message: expect.any(String) });
  });

  it('rejects when attacker is dead', () => {
    const world = freshWorld();
    const result = unitAttackValidator(
      { unitId: 9999, targetEntityId: 1, targetEntityKind: 'unit' },
      world,
    );
    expect(result).toEqual({ code: 'unit_not_found', message: expect.any(String) });
  });

  it('rejects when attacker is alive but not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = unitAttackValidator(
      { unitId: tileId, targetEntityId: 9999, targetEntityKind: 'unit' },
      world,
    );
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });

  it('rejects target_kind_mismatch when targetEntityKind disagrees with the entity shape', () => {
    const world = freshWorld();
    world.registerComponent('unit');
    world.registerComponent('building');
    const attackerId = world.createEntity();
    world.addComponent(attackerId, 'unit', {
      unitType: 'militia',
      owner: 1,
      lethalRange: 1,
      attack: 1,
      attackCooldownTicks: 0,
      buildPoints: 0,
      bountyTickIndex: 0,
      bountyAge: 'dark',
      bountyResolved: false,
      visualVariant: 'idle',
    });
    const buildingId = world.createEntity();
    world.addComponent(buildingId, 'building', {
      buildingType: 'house',
      owner: 2,
      buildPoints: 0,
      isComplete: true,
    });
    // Targeting a building but claiming it's a unit:
    const result = unitAttackValidator(
      { unitId: attackerId, targetEntityId: buildingId, targetEntityKind: 'unit' },
      world,
    );
    expect(result).toEqual({ code: 'target_kind_mismatch', message: expect.any(String) });
  });

  it('rejects when target is dead', () => {
    const world = freshWorld();
    world.registerComponent('unit');
    const unitId = world.createEntity();
    world.addComponent(unitId, 'unit', {
      unitType: 'militia',
      owner: 1,
      lethalRange: 1,
      attack: 1,
      attackCooldownTicks: 0,
      buildPoints: 0,
      bountyTickIndex: 0,
      bountyAge: 'dark',
      bountyResolved: false,
      visualVariant: 'idle',
    });
    const result = unitAttackValidator(
      { unitId, targetEntityId: 9999, targetEntityKind: 'unit' },
      world,
    );
    expect(result).toEqual({ code: 'target_not_found', message: expect.any(String) });
  });

  it('rejects Monks with a stable non-attacking-unit reason', () => {
    const world = freshWorld();
    world.registerComponent('unit');
    const monkId = world.createEntity();
    world.addComponent(monkId, 'unit', {
      unitType: 'monk',
      owner: 1,
      lethalRange: 0,
      attack: 0,
      attackCooldownTicks: 0,
      buildPoints: 0,
      bountyTickIndex: 0,
      bountyAge: 'dark',
      bountyResolved: false,
      visualVariant: 'idle',
    });
    const targetId = world.createEntity();
    world.addComponent(targetId, 'unit', {
      unitType: 'militia',
      owner: 2,
      lethalRange: 1,
      attack: 1,
      attackCooldownTicks: 0,
      buildPoints: 0,
      bountyTickIndex: 0,
      bountyAge: 'dark',
      bountyResolved: false,
      visualVariant: 'idle',
    });

    expect(unitAttackValidator(
      { unitId: monkId, targetEntityId: targetId, targetEntityKind: 'unit' },
      world,
    )).toEqual({
      code: 'unit_cannot_attack',
      message: 'Monks cannot attack.',
    });
  });
});

describe('unit attack semantic boundary', () => {
  it('rejects a submitted Monk attack without damage, command state, or an attack feed event', () => {
    const bridge = createSimulationBridge('monk-convert-heresy-fixture');
    const monk = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'monk',
    );
    const enemy = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'militia',
    );
    expect(monk).toBeDefined();
    expect(enemy).toBeDefined();
    if (!monk || !enemy) return;

    expect(bridge.world.submitWithResult('unit.move', {
      unitId: monk.id,
      target: { x: enemy.x, y: enemy.y },
    }).accepted).toBe(true);
    for (let step = 0; step < 20; step += 1) {
      bridge.step(100);
      const current = bridge.getEconomyState().units.find((unit) => unit.id === monk.id);
      if (current?.x === enemy.x && current.y === enemy.y && current.task === 'idle') break;
    }
    expect(bridge.getEconomyState().units.find((unit) => unit.id === monk.id)).toMatchObject({
      x: enemy.x,
      y: enemy.y,
      task: 'idle',
    });

    const hpBefore = bridge.getEntityHealth(enemy.id);
    const result = bridge.world.submitWithResult('unit.attack', {
      unitId: monk.id,
      targetEntityId: enemy.id,
      targetEntityKind: 'unit',
    });
    expect(result).toMatchObject({
      accepted: false,
      code: 'unit_cannot_attack',
      message: 'Monks cannot attack.',
    });

    bridge.step(100);
    expect(bridge.getEntityHealth(enemy.id)).toEqual(hpBefore);
    expect(bridge.getEconomyState().units.find((unit) => unit.id === monk.id)?.task).toBe('idle');
    expect(
      bridge.getRenderState().entities.find((entity) => entity.id === monk.id)?.attackAnimation,
    ).toBeUndefined();
  });

  it('clears a restored Monk attack before it can deal damage or emit an attack event', () => {
    const bridge = createSimulationBridge('monk-convert-heresy-fixture');
    const monk = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'monk',
    );
    const enemy = bridge.getEconomyState().units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'militia',
    );
    expect(monk).toBeDefined();
    expect(enemy).toBeDefined();
    if (!monk || !enemy) return;

    expect(bridge.world.submitWithResult('unit.move', {
      unitId: monk.id,
      target: { x: enemy.x, y: enemy.y },
    }).accepted).toBe(true);
    for (let step = 0; step < 20; step += 1) {
      bridge.step(100);
      const current = bridge.getEconomyState().units.find((unit) => unit.id === monk.id);
      if (current?.x === enemy.x && current.y === enemy.y && current.task === 'idle') break;
    }

    const enemyRef = bridge.world.getEntityRef(enemy.id);
    expect(enemyRef).not.toBeNull();
    if (!enemyRef) return;
    const hpBefore = bridge.getEntityHealth(enemy.id);
    const savedGame = bridge.saveGame();
    const snapshotState = (savedGame.worldSnapshot as {
      state: Record<string, unknown>;
    }).state;
    snapshotState[unitCommandsCodec.slot] = [[monk.id, {
      type: 'attack',
      target: { x: enemy.x, y: enemy.y },
      targetEntityRef: enemyRef,
      targetEntityKind: 'unit',
    }]];

    const loaded = createSimulationBridge('ignored-outer-seed', { savedGame });
    loaded.step(100);

    expect(loaded.getEntityHealth(enemy.id)).toEqual(hpBefore);
    expect(loaded.getEconomyState().units.find((unit) => unit.id === monk.id)?.task).toBe('idle');
    expect(
      loaded.getRenderState().entities.find((entity) => entity.id === monk.id)?.attackAnimation,
    ).toBeUndefined();
  });

  it('refuses Monks in the direct helper without mutating command state', () => {
    const world = freshWorld();
    world.registerComponent('position');
    world.registerComponent('unit');
    const monkId = world.createEntity();
    world.addComponent(monkId, 'position', { x: 4, y: 4 });
    world.addComponent(monkId, 'unit', {
      unitType: 'monk',
      owner: 1,
      lethalRange: 0,
      attack: 0,
      attackCooldownTicks: 0,
      buildPoints: 0,
      bountyTickIndex: 0,
      bountyAge: 'dark',
      bountyResolved: false,
      visualVariant: 'idle',
    });
    const targetId = world.createEntity();
    world.addComponent(targetId, 'position', { x: 4, y: 4 });
    world.addComponent(targetId, 'unit', {
      unitType: 'militia',
      owner: 2,
      lethalRange: 1,
      attack: 1,
      attackCooldownTicks: 0,
      buildPoints: 0,
      bountyTickIndex: 0,
      bountyAge: 'dark',
      bountyResolved: false,
      visualVariant: 'idle',
    });
    const setUnitCommand = vi.fn();
    const clearGathererOrder = vi.fn();
    const ops = createUnitCommandOps({
      world,
      humanPlayerId: 1,
      getBuildOptions: () => [],
      mapWidth: 16,
      mapHeight: 16,
      state: createBridgeState(),
      accessor: new BridgeStateAccessor(() => world),
      selection: { refs: [], focusCell: null },
      placementMode: { current: null },
      isMatchRunning: () => true,
      isEntityVisibleToHuman: () => true,
      getSelectedEntityIds: () => [],
      getSelectableEntitiesAtCell: () => [],
      findResourceAtCell: () => null,
      findOwnedGarrisonBuildingAtCell: () => null,
      findHostileUnitAtCell: () => null,
      findHostileBuildingAtCell: () => null,
      findHostileWildlifeAtCell: () => null,
      findMonkContextTargetAtCell: () => null,
      issueMonkContextCommandAtEntity: () => false,
      clearMonkTask: vi.fn(),
      setMonkTask: () => false,
      garrisonUnit: () => false,
      // This double is about attack routing; the transport hooks are inert here.
      findOwnedTransportAtCell: () => null,
      boardTransport: () => false,
      unloadTransport: () => false,
      isLandCell: () => true,
      isHarvestableResource: () => false,
      findNearestDropOffBuilding: () => null,
      clearGathererOrder,
      clearUnitCommand: vi.fn(),
      setUnitCommand,
      getEntityRef: (id) => world.getEntityRef(id),
    });

    expect(ops.setUnitAttackCommandDirect(monkId, targetId, 'unit')).toBe(false);
    expect(clearGathererOrder).not.toHaveBeenCalled();
    expect(setUnitCommand).not.toHaveBeenCalled();
  });
});

describe('unitAttackHandler', () => {
  it('delegates to setUnitAttackCommandDirect with the data payload', () => {
    const calls: Array<{
      unitId: number;
      targetEntityId: number;
      targetEntityKind: 'unit' | 'building' | 'resource';
    }> = [];
    const handler = makeUnitAttackHandler({
      setUnitAttackCommandDirect: (unitId, targetEntityId, targetEntityKind) => {
        calls.push({ unitId, targetEntityId, targetEntityKind });
        return true;
      },
      wipeQueuedEntityOrders: () => {},
    });
    handler(
      { unitId: 7, targetEntityId: 5, targetEntityKind: 'building' },
      freshWorld(),
    );
    expect(calls).toEqual([{ unitId: 7, targetEntityId: 5, targetEntityKind: 'building' }]);
  });
});
