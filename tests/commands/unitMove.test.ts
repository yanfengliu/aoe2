// Phase 1B unit.move tests (DESIGN v17 §6.4 per-command commit checklist).

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import {
  createPendingCommandsQueue,
  drainPendingCommands,
} from '../../src/game/simulation/dispatcher';
import { unitMoveValidator } from '../../src/game/simulation/handlers/unit/unitMoveValidator';
import { makeUnitMoveHandler } from '../../src/game/simulation/handlers/unit/unitMoveHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

function freshWorld() {
  return new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 16,
    gridHeight: 16,
    seed: 'test',
    tps: 60,
  });
}

describe('unitMoveValidator', () => {
  it('rejects when target coordinates are NaN', () => {
    const world = freshWorld();
    const result = unitMoveValidator(
      { unitId: 1, target: { x: NaN, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'invalid_target', message: expect.any(String) });
  });

  it('rejects when target coordinates are non-integer', () => {
    const world = freshWorld();
    const result = unitMoveValidator(
      { unitId: 1, target: { x: 5.5, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'invalid_target', message: expect.any(String) });
  });

  it('rejects when unitId is non-integer', () => {
    const world = freshWorld();
    const result = unitMoveValidator(
      { unitId: 1.5, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'invalid_unit_id', message: expect.any(String) });
  });

  it('rejects with code unit_not_found when entity is dead', () => {
    const world = freshWorld();
    const result = unitMoveValidator(
      { unitId: 9999, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'unit_not_found', message: expect.any(String) });
  });

  it('rejects with code not_a_unit when entity is alive but not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = unitMoveValidator(
      { unitId: tileId, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });
});

describe('unitMoveHandler', () => {
  it('delegates to setUnitMoveCommandDirect with the data payload', () => {
    const calls: Array<{ unitId: number; target: { x: number; y: number } }> = [];
    const handler = makeUnitMoveHandler({
      setUnitMoveCommandDirect: (unitId, target) => {
        calls.push({ unitId, target });
        return true;
      },
    });
    handler({ unitId: 7, target: { x: 5, y: 3 } }, freshWorld());
    expect(calls).toEqual([{ unitId: 7, target: { x: 5, y: 3 } }]);
  });
});

describe('unit.move bridge facade + handler integration', () => {
  it('issueUnitMoveCommand routes through submitWithResult and the handler mutates state at next step', () => {
    const bridge = createSimulationBridge('unit-move-facade');
    // Pick a human-owned unit. Default scenario seeds villagers + scout for HUMAN_PLAYER_ID.
    const ownedUnitIds = bridge.world.query('unit', 'position');
    let unitId: number | null = null;
    for (const id of ownedUnitIds) {
      const unit = bridge.world.getComponent<{ owner: number }>(id, 'unit');
      if (unit?.owner === HUMAN_PLAYER_ID) {
        unitId = id;
        break;
      }
    }
    expect(unitId).not.toBeNull();

    bridge.selectUnitsByIds([unitId!]);
    // Move to a far cell so the unit is still en-route after one tick.
    const accepted = bridge.issueMoveCommand(0, 0);
    expect(accepted).toBe(true);

    // Pre-step: handler hasn't run yet, so the move command isn't visible
    // to the selection-activity reader.
    expect(bridge.getSelectionState().activity).toEqual({ verb: 'idle', target: null });

    // Step JUST enough for processCommands to drain the queue once. The
    // handler mutates state at start of step; selection activity now reports
    // 'moving'. (Stepping further would let the unit arrive and flip to idle.)
    bridge.step(100);

    expect(bridge.getSelectionState().activity).toEqual({ verb: 'moving', target: null });
  });

  it('issueUnitMoveCommand rejects when unitId targets a dead entity', () => {
    const bridge = createSimulationBridge('unit-move-rejection');
    const accepted = bridge.world.submitWithResult('unit.move', {
      unitId: 99999,
      target: { x: 1, y: 1 },
    });
    expect(accepted.accepted).toBe(false);
    expect(accepted.code).toBe('unit_not_found');
  });
});

describe('AI intention pattern (DESIGN v17 §6.5) — push then drain', () => {
  it('intentions pushed to pendingCommands during a step are submitted via dispatcher between ticks', () => {
    const world = freshWorld();
    const handlerSeen: number[] = [];
    world.registerValidator('unit.move', () => true);
    world.registerHandler('unit.move', (data) => {
      handlerSeen.push(data.unitId);
    });

    const queue = createPendingCommandsQueue();
    // Simulate AI-system-during-execute pushing intentions:
    queue.push({ type: 'unit.move', data: { unitId: 1, target: { x: 0, y: 0 } } });
    queue.push({ type: 'unit.move', data: { unitId: 2, target: { x: 1, y: 1 } } });

    // Dispatcher runs BETWEEN ticks (after world.step()):
    const submitted = drainPendingCommands(world, queue);
    expect(submitted).toBe(2);
    expect(queue.length).toBe(0);

    // Handlers run at start of next step's processCommands:
    world.step();
    expect(handlerSeen).toEqual([1, 2]);
  });
});
