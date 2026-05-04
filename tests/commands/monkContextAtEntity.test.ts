// Phase 1B monk.contextAtEntity tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { monkContextAtEntityValidator } from '../../src/game/simulation/handlers/monk/monkContextAtEntityValidator';
import { makeMonkContextAtEntityHandler } from '../../src/game/simulation/handlers/monk/monkContextAtEntityHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';

function freshWorld() {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 16,
    gridHeight: 16,
    seed: 'test',
    tps: 60,
  });
  world.registerComponent('unit');
  return world;
}

function makeUnit(world: World<GameEvents, GameCommands, GameComponents>, unitType: string, owner = 1) {
  const id = world.createEntity();
  world.addComponent(id, 'unit', {
    unitType,
    owner,
    lethalRange: 1,
    attack: 0,
    attackCooldownTicks: 0,
    buildPoints: 0,
    bountyTickIndex: 0,
    bountyAge: 'dark',
    bountyResolved: false,
    visualVariant: 'idle',
  });
  return id;
}

describe('monkContextAtEntityValidator', () => {
  it('rejects non-integer ids', () => {
    const world = freshWorld();
    const result = monkContextAtEntityValidator(
      { unitId: 1.5, targetEntityId: 2 },
      world,
    );
    expect(result).toEqual({ code: 'invalid_id', message: expect.any(String) });
  });

  it('rejects when unit is dead', () => {
    const world = freshWorld();
    const result = monkContextAtEntityValidator(
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
    const result = monkContextAtEntityValidator(
      { unitId: tileId, targetEntityId: 9999 },
      world,
    );
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });

  it('rejects when unit is not a monk', () => {
    const world = freshWorld();
    const villagerId = makeUnit(world, 'villager');
    const result = monkContextAtEntityValidator(
      { unitId: villagerId, targetEntityId: 9999 },
      world,
    );
    expect(result).toEqual({ code: 'not_a_monk', message: expect.any(String) });
  });

  it('rejects when target is dead', () => {
    const world = freshWorld();
    const monkId = makeUnit(world, 'monk');
    const result = monkContextAtEntityValidator(
      { unitId: monkId, targetEntityId: 9999 },
      world,
    );
    expect(result).toEqual({ code: 'target_not_found', message: expect.any(String) });
  });

  it('rejects stale AI intentions when the monk owner changed', () => {
    const world = freshWorld();
    const monkId = makeUnit(world, 'monk', 1);
    const targetId = makeUnit(world, 'archer', 2);
    const result = monkContextAtEntityValidator(
      { unitId: monkId, targetEntityId: targetId, expectedOwner: 2 },
      world,
    );
    expect(result).toEqual({ code: 'owner_changed', message: expect.any(String) });
  });

  it('rejects malformed AI intended task kinds', () => {
    const world = freshWorld();
    const monkId = makeUnit(world, 'monk');
    const targetId = makeUnit(world, 'archer', 2);
    const result = monkContextAtEntityValidator(
      {
        unitId: monkId,
        targetEntityId: targetId,
        intendedTaskKind: 'dance' as GameCommands['monk.contextAtEntity']['intendedTaskKind'],
      },
      world,
    );
    expect(result).toEqual({ code: 'invalid_task_kind', message: expect.any(String) });
  });

  it('accepts when monk + target both alive', () => {
    const world = freshWorld();
    const monkId = makeUnit(world, 'monk');
    const targetId = makeUnit(world, 'archer', 2);
    const result = monkContextAtEntityValidator(
      { unitId: monkId, targetEntityId: targetId },
      world,
    );
    expect(result).toBe(true);
  });
});

describe('monkContextAtEntityHandler', () => {
  it('delegates to routeMonkContextAtEntityCommandDirect', () => {
    const calls: Array<{
      unitId: number;
      targetEntityId: number;
      options: Pick<
        GameCommands['monk.contextAtEntity'],
        'expectedOwner' | 'intendedTaskKind'
      > | undefined;
    }> = [];
    const handler = makeMonkContextAtEntityHandler({
      routeMonkContextAtEntityCommandDirect: (unitId, targetEntityId, options) => {
        calls.push({ unitId, targetEntityId, options });
        return true;
      },
    });
    handler(
      {
        unitId: 7,
        targetEntityId: 12,
        expectedOwner: 2,
        intendedTaskKind: 'pickup',
      },
      freshWorld(),
    );
    expect(calls).toEqual([
      {
        unitId: 7,
        targetEntityId: 12,
        options: { expectedOwner: 2, intendedTaskKind: 'pickup' },
      },
    ]);
  });
});
