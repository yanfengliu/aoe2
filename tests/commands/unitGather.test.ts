// Phase 1B unit.gather tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { unitGatherValidator } from '../../src/game/simulation/handlers/unit/unitGatherValidator';
import { makeUnitGatherHandler } from '../../src/game/simulation/handlers/unit/unitGatherHandler';
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

describe('unitGatherValidator', () => {
  it('rejects non-integer ids', () => {
    const world = freshWorld();
    const result = unitGatherValidator(
      { unitId: 1.5, resourceId: 2 },
      world,
    );
    expect(result).toEqual({ code: 'invalid_id', message: expect.any(String) });
  });

  it('rejects when unit is dead', () => {
    const world = freshWorld();
    const result = unitGatherValidator(
      { unitId: 9999, resourceId: 1 },
      world,
    );
    expect(result).toEqual({ code: 'unit_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = unitGatherValidator(
      { unitId: tileId, resourceId: 9999 },
      world,
    );
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });

  it('rejects when unit lacks gatherer component', () => {
    const world = freshWorld();
    world.registerComponent('unit');
    const unitId = world.createEntity();
    world.addComponent(unitId, 'unit', {
      unitType: 'militia',  // militia has no gatherer
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
    const result = unitGatherValidator(
      { unitId, resourceId: 9999 },
      world,
    );
    expect(result).toEqual({ code: 'not_a_gatherer', message: expect.any(String) });
  });

  it('rejects when alive resourceId points to a non-resource entity', () => {
    const world = freshWorld();
    world.registerComponent('unit');
    world.registerComponent('gatherer');
    world.registerComponent('terrain');
    const unitId = world.createEntity();
    world.addComponent(unitId, 'unit', {
      unitType: 'villager',
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
    world.addComponent(unitId, 'gatherer', {
      task: 'idle',
      desiredResource: null,
      targetResourceId: null,
      dropOffBuildingId: null,
      gatherProgressTicks: 0,
      carry: { kind: null, amount: 0 },
      hasExplicitGatherOrder: false,
    });
    // Alive entity but tagged terrain, not resource.
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = unitGatherValidator(
      { unitId, resourceId: tileId },
      world,
    );
    expect(result).toEqual({ code: 'not_a_resource', message: expect.any(String) });
  });

  it('rejects when resource is dead', () => {
    const world = freshWorld();
    world.registerComponent('unit');
    world.registerComponent('gatherer');
    const unitId = world.createEntity();
    world.addComponent(unitId, 'unit', {
      unitType: 'villager',
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
    world.addComponent(unitId, 'gatherer', {
      task: 'idle',
      desiredResource: null,
      targetResourceId: null,
      dropOffBuildingId: null,
      gatherProgressTicks: 0,
      carry: { kind: null, amount: 0 },
      hasExplicitGatherOrder: false,
    });
    const result = unitGatherValidator(
      { unitId, resourceId: 9999 },
      world,
    );
    expect(result).toEqual({ code: 'resource_not_found', message: expect.any(String) });
  });
});

describe('unitGatherHandler', () => {
  it('delegates to setUnitGatherCommandDirect with the data payload', () => {
    const calls: Array<{ unitId: number; resourceId: number }> = [];
    const handler = makeUnitGatherHandler({
      setUnitGatherCommandDirect: (unitId, resourceId) => {
        calls.push({ unitId, resourceId });
        return true;
      },
    });
    handler({ unitId: 7, resourceId: 12 }, freshWorld());
    expect(calls).toEqual([{ unitId: 7, resourceId: 12 }]);
  });
});
