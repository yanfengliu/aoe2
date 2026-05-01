// Phase 1A scaffolding test — dispatcher.drainPendingCommands behavior.
// AI-decision systems (Phase 1B+) push intentions to the queue during
// `world.step()`; the dispatcher drains and submits them BETWEEN ticks.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import {
  createPendingCommandsQueue,
  drainPendingCommands,
} from '../../src/game/simulation/dispatcher';
import type { GameCommands } from '../../src/game/simulation/commands';
import type { GameComponents, GameEvents } from '../../src/game/simulation/bridge/pureHelpers';

function freshWorld() {
  return new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 4,
    gridHeight: 4,
    seed: 'test',
    tps: 60,
  });
}

describe('dispatcher.drainPendingCommands', () => {
  it('returns 0 and does nothing when the queue is empty', () => {
    const world = freshWorld();
    const queue = createPendingCommandsQueue();
    expect(drainPendingCommands(world, queue)).toBe(0);
    expect(queue.length).toBe(0);
  });

  it('submits each pending intention via world.submitWithResult and clears the queue', () => {
    const world = freshWorld();
    // Register a no-op handler + always-accept validator so submission queues
    // succeed (validator runs synchronously inside submitWithResult).
    world.registerValidator('unit.move', () => true);
    world.registerHandler('unit.move', () => {
      // no-op for this test — we only check the dispatcher contract
    });
    world.registerValidator('unit.attack', () => true);
    world.registerHandler('unit.attack', () => {});

    const queue = createPendingCommandsQueue();
    queue.push({ type: 'unit.move', data: { unitId: 1, target: { x: 0, y: 0 } } });
    queue.push({ type: 'unit.attack', data: { unitId: 1, targetEntityId: 2 } });

    const submitted = drainPendingCommands(world, queue);

    expect(submitted).toBe(2);
    expect(queue.length).toBe(0);
  });

  it('drains intentions in submission order', () => {
    const world = freshWorld();
    const seen: number[] = [];
    world.registerValidator('unit.move', () => true);
    world.registerHandler('unit.move', (data) => {
      seen.push(data.unitId);
    });

    const queue = createPendingCommandsQueue();
    queue.push({ type: 'unit.move', data: { unitId: 10, target: { x: 0, y: 0 } } });
    queue.push({ type: 'unit.move', data: { unitId: 20, target: { x: 1, y: 1 } } });
    queue.push({ type: 'unit.move', data: { unitId: 30, target: { x: 2, y: 2 } } });

    drainPendingCommands(world, queue);
    // Handler runs at start of next step; force a step to execute the queue.
    world.step();

    expect(seen).toEqual([10, 20, 30]);
  });
});
