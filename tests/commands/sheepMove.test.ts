// Phase 1B sheep.move tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { sheepMoveValidator } from '../../src/game/simulation/handlers/sheep/sheepMoveValidator';
import { makeSheepMoveHandler } from '../../src/game/simulation/handlers/sheep/sheepMoveHandler';
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

describe('sheepMoveValidator', () => {
  it('rejects non-integer sheepId', () => {
    const result = sheepMoveValidator(
      { sheepId: 1.5, target: { x: 0, y: 0 } },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'invalid_sheep_id', message: expect.any(String) });
  });

  it('rejects non-integer target', () => {
    const result = sheepMoveValidator(
      { sheepId: 1, target: { x: 0.5, y: 0 } },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'invalid_target', message: expect.any(String) });
  });

  it('rejects when sheep is dead', () => {
    const result = sheepMoveValidator(
      { sheepId: 9999, target: { x: 0, y: 0 } },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'sheep_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a resource', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = sheepMoveValidator(
      { sheepId: tileId, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'not_a_resource', message: expect.any(String) });
  });

  it('rejects when resource is not a sheep', () => {
    const world = freshWorld();
    world.registerComponent('resource');
    const treeId = world.createEntity();
    world.addComponent(treeId, 'resource', {
      resourceType: 'tree',
      owner: null,
      amount: 200,
    });
    const result = sheepMoveValidator(
      { sheepId: treeId, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'not_a_sheep', message: expect.any(String) });
  });
});

describe('sheepMoveHandler', () => {
  it('delegates to setSheepMoveCommandDirect', () => {
    const calls: Array<{ sheepId: number; target: { x: number; y: number } }> = [];
    const handler = makeSheepMoveHandler({
      setSheepMoveCommandDirect: (sheepId, target) => {
        calls.push({ sheepId, target });
        return true;
      },
    });
    handler({ sheepId: 5, target: { x: 3, y: 4 } }, freshWorld());
    expect(calls).toEqual([{ sheepId: 5, target: { x: 3, y: 4 } }]);
  });
});
