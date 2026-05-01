// Phase 1B trebuchet.pack + trebuchet.unpack tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { makeTrebuchetPackValidator } from '../../src/game/simulation/handlers/trebuchet/trebuchetPackValidator';
import { makeTrebuchetUnpackValidator } from '../../src/game/simulation/handlers/trebuchet/trebuchetUnpackValidator';
import { makeTrebuchetPackHandler } from '../../src/game/simulation/handlers/trebuchet/trebuchetPackHandler';
import { makeTrebuchetUnpackHandler } from '../../src/game/simulation/handlers/trebuchet/trebuchetUnpackHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { TrebuchetPackState } from '../../src/game/simulation/bridge/sharedTypes';

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
  world.addComponent(id, 'unit', { unitType, owner });
  return id;
}

describe('trebuchetPackValidator', () => {
  function makeValidator(packStates: Map<number, TrebuchetPackState>) {
    return makeTrebuchetPackValidator({ trebuchetPackStates: packStates });
  }

  it('rejects non-integer unitId', () => {
    const result = makeValidator(new Map())({ unitId: 1.5 }, freshWorld());
    expect(result).toEqual({ code: 'invalid_unit_id', message: expect.any(String) });
  });

  it('rejects when unit is dead', () => {
    const result = makeValidator(new Map())({ unitId: 9999 }, freshWorld());
    expect(result).toEqual({ code: 'unit_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = makeValidator(new Map())({ unitId: tileId }, world);
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });

  it('rejects when unit is not a trebuchet', () => {
    const world = freshWorld();
    const archerId = makeUnit(world, 'archer');
    const result = makeValidator(new Map())({ unitId: archerId }, world);
    expect(result).toEqual({ code: 'not_a_trebuchet', message: expect.any(String) });
  });

  it('rejects when no pack state exists', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const result = makeValidator(new Map())({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'no_pack_state', message: expect.any(String) });
  });

  it('rejects when already packed', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const packStates = new Map<number, TrebuchetPackState>([
      [trebId, { packed: true, transitionTicksRemaining: 0 }],
    ]);
    const result = makeValidator(packStates)({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'already_packed', message: expect.any(String) });
  });

  it('rejects when in transition', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const packStates = new Map<number, TrebuchetPackState>([
      [trebId, { packed: false, transitionTicksRemaining: 25 }],
    ]);
    const result = makeValidator(packStates)({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'in_transition', message: expect.any(String) });
  });

  it('accepts a valid pack request (unpacked + idle)', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const packStates = new Map<number, TrebuchetPackState>([
      [trebId, { packed: false, transitionTicksRemaining: 0 }],
    ]);
    const result = makeValidator(packStates)({ unitId: trebId }, world);
    expect(result).toBe(true);
  });
});

describe('trebuchetUnpackValidator', () => {
  function makeValidator(packStates: Map<number, TrebuchetPackState>) {
    return makeTrebuchetUnpackValidator({ trebuchetPackStates: packStates });
  }

  it('rejects non-integer unitId', () => {
    const result = makeValidator(new Map())({ unitId: 1.5 }, freshWorld());
    expect(result).toEqual({ code: 'invalid_unit_id', message: expect.any(String) });
  });

  it('rejects when unit is dead', () => {
    const result = makeValidator(new Map())({ unitId: 9999 }, freshWorld());
    expect(result).toEqual({ code: 'unit_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = makeValidator(new Map())({ unitId: tileId }, world);
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });

  it('rejects when unit is not a trebuchet', () => {
    const world = freshWorld();
    const archerId = makeUnit(world, 'archer');
    const result = makeValidator(new Map())({ unitId: archerId }, world);
    expect(result).toEqual({ code: 'not_a_trebuchet', message: expect.any(String) });
  });

  it('rejects when no pack state exists', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const result = makeValidator(new Map())({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'no_pack_state', message: expect.any(String) });
  });

  it('rejects when already unpacked', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const packStates = new Map<number, TrebuchetPackState>([
      [trebId, { packed: false, transitionTicksRemaining: 0 }],
    ]);
    const result = makeValidator(packStates)({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'already_unpacked', message: expect.any(String) });
  });

  it('accepts a valid unpack request (packed + idle)', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const packStates = new Map<number, TrebuchetPackState>([
      [trebId, { packed: true, transitionTicksRemaining: 0 }],
    ]);
    const result = makeValidator(packStates)({ unitId: trebId }, world);
    expect(result).toBe(true);
  });
});

// impl-15 review F1: cross-direction mid-transition reports in_transition.
// Pre-fix the pack-validator on a mid-unpack state (`packed: true, ticks > 0`)
// returned `already_packed` and the unpack-validator on a mid-pack state
// returned `already_unpacked`. The fix swaps the precedence so transition
// state always wins — these two tests lock the contract.
describe('trebuchet validators — cross-direction transition precedence', () => {
  it('pack validator reports in_transition during a mid-unpack transition', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const packStates = new Map<number, TrebuchetPackState>([
      // Mid-unpack: packed flag still true (flips at ticks=0).
      [trebId, { packed: true, transitionTicksRemaining: 25 }],
    ]);
    const result = makeTrebuchetPackValidator({ trebuchetPackStates: packStates })(
      { unitId: trebId },
      world,
    );
    expect(result).toEqual({ code: 'in_transition', message: expect.any(String) });
  });

  it('unpack validator reports in_transition during a mid-pack transition', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const packStates = new Map<number, TrebuchetPackState>([
      // Mid-pack: packed flag still false.
      [trebId, { packed: false, transitionTicksRemaining: 25 }],
    ]);
    const result = makeTrebuchetUnpackValidator({ trebuchetPackStates: packStates })(
      { unitId: trebId },
      world,
    );
    expect(result).toEqual({ code: 'in_transition', message: expect.any(String) });
  });
});

describe('trebuchetPackHandler', () => {
  it('delegates to beginTrebuchetPackDirect', () => {
    const calls: number[] = [];
    const handler = makeTrebuchetPackHandler({
      beginTrebuchetPackDirect: (id) => calls.push(id),
    });
    handler({ unitId: 5 }, freshWorld());
    expect(calls).toEqual([5]);
  });
});

describe('trebuchetUnpackHandler', () => {
  it('delegates to beginTrebuchetUnpackDirect', () => {
    const calls: number[] = [];
    const handler = makeTrebuchetUnpackHandler({
      beginTrebuchetUnpackDirect: (id) => calls.push(id),
    });
    handler({ unitId: 7 }, freshWorld());
    expect(calls).toEqual([7]);
  });
});
