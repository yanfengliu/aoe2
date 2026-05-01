// Phase 1B unit.contextAtEntity tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { unitContextAtEntityValidator } from '../../src/game/simulation/handlers/unit/unitContextAtEntityValidator';
import { makeUnitContextAtEntityHandler } from '../../src/game/simulation/handlers/unit/unitContextAtEntityHandler';
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

describe('unitContextAtEntityValidator', () => {
  it('rejects non-integer ids', () => {
    const world = freshWorld();
    const result = unitContextAtEntityValidator(
      { unitId: 1.5, targetEntityId: 2 },
      world,
    );
    expect(result).toEqual({ code: 'invalid_id', message: expect.any(String) });
  });

  it('rejects when unit is dead', () => {
    const world = freshWorld();
    const result = unitContextAtEntityValidator(
      { unitId: 9999, targetEntityId: 1 },
      world,
    );
    expect(result).toEqual({ code: 'unit_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = unitContextAtEntityValidator(
      { unitId: tileId, targetEntityId: 9999 },
      world,
    );
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });

  it('rejects monks (HUD facade routes them BEFORE submission)', () => {
    const world = freshWorld();
    world.registerComponent('unit');
    const monkId = world.createEntity();
    world.addComponent(monkId, 'unit', {
      unitType: 'monk',
      owner: 1,
      lethalRange: 1,
      attack: 0,
      attackCooldownTicks: 0,
      buildPoints: 0,
      bountyTickIndex: 0,
      bountyAge: 'dark',
      bountyResolved: false,
      visualVariant: 'idle',
    });
    const result = unitContextAtEntityValidator(
      { unitId: monkId, targetEntityId: 9999 },
      world,
    );
    expect(result).toEqual({ code: 'monk_should_route_via_facade', message: expect.any(String) });
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
    const result = unitContextAtEntityValidator(
      { unitId, targetEntityId: 9999 },
      world,
    );
    expect(result).toEqual({ code: 'target_not_found', message: expect.any(String) });
  });
});

describe('unitContextAtEntityHandler', () => {
  it('delegates to routeUnitContextAtEntityCommandDirect', () => {
    const calls: Array<{ unitId: number; targetEntityId: number }> = [];
    const handler = makeUnitContextAtEntityHandler({
      routeUnitContextAtEntityCommandDirect: (unitId, targetEntityId) => {
        calls.push({ unitId, targetEntityId });
        return true;
      },
    });
    handler({ unitId: 7, targetEntityId: 12 }, freshWorld());
    expect(calls).toEqual([{ unitId: 7, targetEntityId: 12 }]);
  });
});
