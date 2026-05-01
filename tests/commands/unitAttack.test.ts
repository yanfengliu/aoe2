// Phase 1B unit.attack tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
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
    });
    handler(
      { unitId: 7, targetEntityId: 5, targetEntityKind: 'building' },
      freshWorld(),
    );
    expect(calls).toEqual([{ unitId: 7, targetEntityId: 5, targetEntityKind: 'building' }]);
  });
});
