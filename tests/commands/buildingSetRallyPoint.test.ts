// Phase 1B building.setRallyPoint tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { makeBuildingSetRallyPointValidator } from '../../src/game/simulation/handlers/building/buildingSetRallyPointValidator';
import { makeBuildingSetRallyPointHandler } from '../../src/game/simulation/handlers/building/buildingSetRallyPointHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { BuildingType } from '../../src/game/simulation/types';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  constructionStatesCodec,
  rallyPointsCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
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
    mapWidth?: number;
    mapHeight?: number;
  } = {},
) {
  return makeBuildingSetRallyPointValidator({
    accessor: freshAccessor(world, overrides.constructionStates),
    mapWidth: overrides.mapWidth ?? 16,
    mapHeight: overrides.mapHeight ?? 16,
  });
}

describe('buildingSetRallyPointValidator', () => {
  it('rejects non-integer buildingId', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ buildingId: 1.5, target: { x: 0, y: 0 } }, world);
    expect(result).toEqual({ code: 'invalid_building_id', message: expect.any(String) });
  });

  it('rejects non-integer target', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ buildingId: 1, target: { x: 0.5, y: 0 } }, world);
    expect(result).toEqual({ code: 'invalid_target', message: expect.any(String) });
  });

  it('rejects out-of-bounds target', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world);
    const result = validator({ buildingId: tcId, target: { x: 99, y: 0 } }, world);
    expect(result).toEqual({ code: 'out_of_bounds', message: expect.any(String) });
  });

  it('rejects when building is dead', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ buildingId: 9999, target: { x: 0, y: 0 } }, world);
    expect(result).toEqual({ code: 'building_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a building', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const validator = makeValidator(world);
    const result = validator({ buildingId: tileId, target: { x: 0, y: 0 } }, world);
    expect(result).toEqual({ code: 'not_a_building', message: expect.any(String) });
  });

  it('rejects when building is under construction', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, {
      constructionStates: new Map([[tcId, { isComplete: false }]]),
    });
    const result = validator({ buildingId: tcId, target: { x: 0, y: 0 } }, world);
    expect(result).toEqual({ code: 'under_construction', message: expect.any(String) });
  });

  it('accepts a fully valid request', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world);
    const result = validator({ buildingId: tcId, target: { x: 5, y: 5 } }, world);
    expect(result).toBe(true);
  });
});

describe('buildingSetRallyPointHandler', () => {
  it('mutates the rallyPoints map (in world.state.aoe2.rallyPoints) with the target position', () => {
    const world = freshWorld() as GameWorld;
    const accessor = new BridgeStateAccessor(() => world);
    const handler = makeBuildingSetRallyPointHandler({ accessor });
    handler({ buildingId: 7, target: { x: 3, y: 4 } }, world);
    expect(accessor.get(rallyPointsCodec).get(7)).toEqual({ x: 3, y: 4 });
  });
});
