// Phase 1B trebuchet.pack + trebuchet.unpack tests.
// Phase 2D: validators consume `accessor: BridgeStateAccessor` instead of a
// raw `Map<number, TrebuchetPackState>` — tests construct a real accessor
// over a fresh World and seed pack states via `accessor.mutate`.

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
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { trebuchetPackStatesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';

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

function makeUnit(
  world: World<GameEvents, GameCommands, GameComponents>,
  unitType: string,
  owner = 1,
) {
  const id = world.createEntity();
  world.addComponent(id, 'unit', { unitType, owner });
  return id;
}

function freshAccessorWithPackStates(
  world: World<GameEvents, GameCommands, GameComponents>,
  entries: Array<[number, TrebuchetPackState]>,
): BridgeStateAccessor {
  const accessor = new BridgeStateAccessor(() => world);
  if (entries.length > 0) {
    accessor.mutate(trebuchetPackStatesCodec, (m) => {
      for (const [id, state] of entries) {
        m.set(id, state);
      }
    });
  }
  return accessor;
}

describe('trebuchetPackValidator', () => {
  function makeValidator(
    world: World<GameEvents, GameCommands, GameComponents>,
    entries: Array<[number, TrebuchetPackState]>,
  ) {
    return makeTrebuchetPackValidator({
      accessor: freshAccessorWithPackStates(world, entries),
    });
  }

  it('rejects non-integer unitId', () => {
    const world = freshWorld();
    const result = makeValidator(world, [])({ unitId: 1.5 }, world);
    expect(result).toEqual({ code: 'invalid_unit_id', message: expect.any(String) });
  });

  it('rejects when unit is dead', () => {
    const world = freshWorld();
    const result = makeValidator(world, [])({ unitId: 9999 }, world);
    expect(result).toEqual({ code: 'unit_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = makeValidator(world, [])({ unitId: tileId }, world);
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });

  it('rejects when unit is not a trebuchet', () => {
    const world = freshWorld();
    const archerId = makeUnit(world, 'archer');
    const result = makeValidator(world, [])({ unitId: archerId }, world);
    expect(result).toEqual({ code: 'not_a_trebuchet', message: expect.any(String) });
  });

  it('rejects when no pack state exists', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const result = makeValidator(world, [])({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'no_pack_state', message: expect.any(String) });
  });

  it('rejects when already packed', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const result = makeValidator(world, [
      [trebId, { packed: true, transitionTicksRemaining: 0 }],
    ])({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'already_packed', message: expect.any(String) });
  });

  it('rejects when in transition', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const result = makeValidator(world, [
      [trebId, { packed: false, transitionTicksRemaining: 25 }],
    ])({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'in_transition', message: expect.any(String) });
  });

  it('accepts a valid pack request (unpacked + idle)', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const result = makeValidator(world, [
      [trebId, { packed: false, transitionTicksRemaining: 0 }],
    ])({ unitId: trebId }, world);
    expect(result).toBe(true);
  });
});

describe('trebuchetUnpackValidator', () => {
  function makeValidator(
    world: World<GameEvents, GameCommands, GameComponents>,
    entries: Array<[number, TrebuchetPackState]>,
  ) {
    return makeTrebuchetUnpackValidator({
      accessor: freshAccessorWithPackStates(world, entries),
    });
  }

  it('rejects non-integer unitId', () => {
    const world = freshWorld();
    const result = makeValidator(world, [])({ unitId: 1.5 }, world);
    expect(result).toEqual({ code: 'invalid_unit_id', message: expect.any(String) });
  });

  it('rejects when unit is dead', () => {
    const world = freshWorld();
    const result = makeValidator(world, [])({ unitId: 9999 }, world);
    expect(result).toEqual({ code: 'unit_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = makeValidator(world, [])({ unitId: tileId }, world);
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });

  it('rejects when unit is not a trebuchet', () => {
    const world = freshWorld();
    const archerId = makeUnit(world, 'archer');
    const result = makeValidator(world, [])({ unitId: archerId }, world);
    expect(result).toEqual({ code: 'not_a_trebuchet', message: expect.any(String) });
  });

  it('rejects when no pack state exists', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const result = makeValidator(world, [])({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'no_pack_state', message: expect.any(String) });
  });

  it('rejects when already unpacked', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const result = makeValidator(world, [
      [trebId, { packed: false, transitionTicksRemaining: 0 }],
    ])({ unitId: trebId }, world);
    expect(result).toEqual({ code: 'already_unpacked', message: expect.any(String) });
  });

  it('accepts a valid unpack request (packed + idle)', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    const result = makeValidator(world, [
      [trebId, { packed: true, transitionTicksRemaining: 0 }],
    ])({ unitId: trebId }, world);
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
    // Mid-unpack: packed flag still true (flips at ticks=0).
    const accessor = freshAccessorWithPackStates(world, [
      [trebId, { packed: true, transitionTicksRemaining: 25 }],
    ]);
    const result = makeTrebuchetPackValidator({ accessor })(
      { unitId: trebId },
      world,
    );
    expect(result).toEqual({ code: 'in_transition', message: expect.any(String) });
  });

  it('unpack validator reports in_transition during a mid-pack transition', () => {
    const world = freshWorld();
    const trebId = makeUnit(world, 'trebuchet');
    // Mid-pack: packed flag still false.
    const accessor = freshAccessorWithPackStates(world, [
      [trebId, { packed: false, transitionTicksRemaining: 25 }],
    ]);
    const result = makeTrebuchetUnpackValidator({ accessor })(
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
