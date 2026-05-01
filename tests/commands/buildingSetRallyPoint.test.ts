// Phase 1B building.setRallyPoint tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { makeBuildingSetRallyPointValidator } from '../../src/game/simulation/handlers/building/buildingSetRallyPointValidator';
import { makeBuildingSetRallyPointHandler } from '../../src/game/simulation/handlers/building/buildingSetRallyPointHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { BuildingType } from '../../src/game/simulation/types';

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

function makeValidator(overrides: {
  constructionStates?: Map<number, { isComplete: boolean }>;
  mapWidth?: number;
  mapHeight?: number;
} = {}) {
  return makeBuildingSetRallyPointValidator({
    constructionStates: overrides.constructionStates ?? new Map(),
    mapWidth: overrides.mapWidth ?? 16,
    mapHeight: overrides.mapHeight ?? 16,
  });
}

describe('buildingSetRallyPointValidator', () => {
  it('rejects non-integer buildingId', () => {
    const validator = makeValidator();
    const result = validator(
      { buildingId: 1.5, target: { x: 0, y: 0 } },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'invalid_building_id', message: expect.any(String) });
  });

  it('rejects non-integer target', () => {
    const validator = makeValidator();
    const result = validator(
      { buildingId: 1, target: { x: 0.5, y: 0 } },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'invalid_target', message: expect.any(String) });
  });

  it('rejects out-of-bounds target', () => {
    const validator = makeValidator();
    const result = validator(
      { buildingId: 1, target: { x: 99, y: 0 } },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'out_of_bounds', message: expect.any(String) });
  });

  it('rejects when building is dead', () => {
    const validator = makeValidator();
    const result = validator(
      { buildingId: 9999, target: { x: 0, y: 0 } },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'building_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a building', () => {
    const validator = makeValidator();
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const result = validator(
      { buildingId: tileId, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'not_a_building', message: expect.any(String) });
  });

  it('rejects when building is under construction', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator({
      constructionStates: new Map([[tcId, { isComplete: false }]]),
    });
    const result = validator(
      { buildingId: tcId, target: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'under_construction', message: expect.any(String) });
  });

  it('accepts a fully valid request', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator();
    const result = validator(
      { buildingId: tcId, target: { x: 5, y: 5 } },
      world,
    );
    expect(result).toBe(true);
  });
});

describe('buildingSetRallyPointHandler', () => {
  it('mutates the rallyPoints map with the target position', () => {
    const rallyPoints = new Map<number, { x: number; y: number }>();
    const handler = makeBuildingSetRallyPointHandler({ rallyPoints });
    handler({ buildingId: 7, target: { x: 3, y: 4 } }, freshWorld());
    expect(rallyPoints.get(7)).toEqual({ x: 3, y: 4 });
  });
});
