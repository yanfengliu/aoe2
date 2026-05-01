// Phase 1B unit.context tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { unitContextValidator } from '../../src/game/simulation/handlers/unit/unitContextValidator';
import { makeUnitContextHandler } from '../../src/game/simulation/handlers/unit/unitContextHandler';
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

describe('unitContextValidator', () => {
  it('rejects non-integer unitId', () => {
    const world = freshWorld();
    const result = unitContextValidator(
      { unitId: 1.5, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'invalid_unit_id', message: expect.any(String) });
  });

  it('rejects non-integer target', () => {
    const world = freshWorld();
    const result = unitContextValidator(
      { unitId: 1, target: { x: 0.5, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'invalid_target', message: expect.any(String) });
  });

  it('rejects when unit is dead', () => {
    const world = freshWorld();
    const result = unitContextValidator(
      { unitId: 9999, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'unit_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = unitContextValidator(
      { unitId: tileId, target: { x: 0, y: 0 } },
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
    const result = unitContextValidator(
      { unitId: monkId, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'monk_should_route_via_facade', message: expect.any(String) });
  });
});

describe('unitContextHandler', () => {
  it('delegates to routeUnitContextCommandDirect with the data payload', () => {
    const calls: Array<{ unitId: number; target: { x: number; y: number } }> = [];
    const handler = makeUnitContextHandler({
      routeUnitContextCommandDirect: (unitId, target) => {
        calls.push({ unitId, target });
        return true;
      },
    });
    handler({ unitId: 7, target: { x: 5, y: 3 } }, freshWorld());
    expect(calls).toEqual([{ unitId: 7, target: { x: 5, y: 3 } }]);
  });
});
