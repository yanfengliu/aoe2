// Phase 1B building.action tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { makeBuildingActionValidator } from '../../src/game/simulation/handlers/building/buildingActionValidator';
import { makeBuildingActionHandler } from '../../src/game/simulation/handlers/building/buildingActionHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { BuildingType } from '../../src/game/simulation/types';
import type { BuildingActionType } from '../../src/game/simulation/commands';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { constructionStatesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { ConstructionState } from '../../src/game/simulation/bridge/sharedTypes';

function freshWorld() {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 16,
    gridHeight: 16,
    seed: 'test',
    tps: 60,
  });
  world.registerComponent('building');
  return world;
}

function makeBuilding(world: World<GameEvents, GameCommands, GameComponents>, buildingType: BuildingType, owner = 1) {
  const id = world.createEntity();
  world.addComponent(id, 'building', { buildingType, owner });
  return id;
}

function freshAccessor(
  world: World<GameEvents, GameCommands, GameComponents>,
  constructionStates?: Map<number, { isComplete: boolean }>,
): BridgeStateAccessor {
  const accessor = new BridgeStateAccessor(() => world);
  if (constructionStates && constructionStates.size > 0) {
    accessor.mutate(constructionStatesCodec, (m) => {
      for (const [id, partial] of constructionStates) {
        // ConstructionState carries more fields, but the validator only
        // consults `.isComplete`; widen with a structural cast.
        m.set(id, partial as ConstructionState);
      }
    });
  }
  return accessor;
}

function makeValidator(
  world: World<GameEvents, GameCommands, GameComponents>,
  overrides: {
    constructionStates?: Map<number, { isComplete: boolean }>;
  } = {},
) {
  return makeBuildingActionValidator({
    accessor: freshAccessor(world, overrides.constructionStates),
  });
}

describe('buildingActionValidator', () => {
  it('rejects non-integer buildingId', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator(
      { buildingId: 1.5, actionType: 'ungarrison' },
      world,
    );
    expect(result).toEqual({ code: 'invalid_building_id', message: expect.any(String) });
  });

  it('rejects unknown action type', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator(
      { buildingId: 1, actionType: 'never-supported-action' as BuildingActionType },
      world,
    );
    expect(result).toEqual({ code: 'unknown_action', message: expect.any(String) });
  });

  it('rejects when building is dead', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator(
      { buildingId: 9999, actionType: 'ungarrison' },
      world,
    );
    expect(result).toEqual({ code: 'building_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a building', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const validator = makeValidator(world);
    const result = validator(
      { buildingId: tileId, actionType: 'ungarrison' },
      world,
    );
    expect(result).toEqual({ code: 'not_a_building', message: expect.any(String) });
  });

  it('rejects when building is under construction', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, {
      constructionStates: new Map([[tcId, { isComplete: false }]]),
    });
    const result = validator(
      { buildingId: tcId, actionType: 'ungarrison' },
      world,
    );
    expect(result).toEqual({ code: 'under_construction', message: expect.any(String) });
  });

  it('accepts a fully valid request', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world);
    const result = validator(
      { buildingId: tcId, actionType: 'ungarrison' },
      world,
    );
    expect(result).toBe(true);
  });
});

describe('buildingActionHandler', () => {
  it('delegates ungarrison to ungarrisonBuildingDirect', () => {
    const calls: number[] = [];
    const handler = makeBuildingActionHandler({
      ringTownBellDirect: () => true,
      backToWorkDirect: () => true,
      ungarrisonBuildingDirect: (buildingId) => {
        calls.push(buildingId);
        return true;
      },
    });
    handler({ buildingId: 7, actionType: 'ungarrison' }, freshWorld());
    expect(calls).toEqual([7]);
  });
});
