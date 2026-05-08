// Phase 1B building.placeConfirm tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { makeBuildingPlaceConfirmValidator } from '../../src/game/simulation/handlers/building/buildingPlaceConfirmValidator';
import { makeBuildingPlaceConfirmHandler } from '../../src/game/simulation/handlers/building/buildingPlaceConfirmHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type {
  BuildableBuildingType,
  PlayerResources,
  UnitType,
} from '../../src/game/simulation/types';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { playerResourcesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';

const STARTING_RESOURCES: PlayerResources = {
  food: 1000,
  wood: 1000,
  gold: 1000,
  stone: 1000,
};

function freshWorld() {
  const world = new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 32,
    gridHeight: 32,
    seed: 'test',
    tps: 60,
  });
  world.registerComponent('unit');
  return world;
}

function makeVillager(world: World<GameEvents, GameCommands, GameComponents>, owner = 1) {
  const id = world.createEntity();
  world.addComponent(id, 'unit', { unitType: 'villager', owner });
  return id;
}

function freshAccessor(
  world: World<GameEvents, GameCommands, GameComponents>,
  playerResources?: Map<number, PlayerResources>,
): BridgeStateAccessor {
  const accessor = new BridgeStateAccessor(() => world as unknown as GameWorld);
  accessor.mutate(playerResourcesCodec, (m) => {
    if (playerResources !== undefined) {
      for (const [owner, res] of playerResources) {
        m.set(owner, { ...res });
      }
    } else {
      m.set(1, { ...STARTING_RESOURCES });
    }
  });
  return accessor;
}

function makeValidator(
  world: World<GameEvents, GameCommands, GameComponents>,
  overrides: {
    playerResources?: Map<number, PlayerResources>;
    getBuildOptions?: (owner: number, unitType: UnitType) => readonly BuildableBuildingType[];
    isPlacementBlocked?: (x: number, y: number, w: number, h: number) => boolean;
  } = {},
) {
  return makeBuildingPlaceConfirmValidator({
    accessor: freshAccessor(world, overrides.playerResources),
    getBuildOptions:
      overrides.getBuildOptions ?? (() => ['house'] as readonly BuildableBuildingType[]),
    isPlacementBlocked: overrides.isPlacementBlocked ?? (() => false),
    mapWidth: 32,
    mapHeight: 32,
  });
}

describe('buildingPlaceConfirmValidator', () => {
  it('rejects non-integer builderId', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ builderId: 1.5, buildingType: 'house', position: { x: 0, y: 0 } }, world);
    expect(result).toEqual({ code: 'invalid_builder_id', message: expect.any(String) });
  });

  it('rejects non-integer position', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ builderId: 1, buildingType: 'house', position: { x: 0.5, y: 0 } }, world);
    expect(result).toEqual({ code: 'invalid_position', message: expect.any(String) });
  });

  it('rejects when builder is dead', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ builderId: 9999, buildingType: 'house', position: { x: 0, y: 0 } }, world);
    expect(result).toEqual({ code: 'builder_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a unit', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const validator = makeValidator(world);
    const result = validator({ builderId: tileId, buildingType: 'house', position: { x: 0, y: 0 } }, world);
    expect(result).toEqual({ code: 'not_a_unit', message: expect.any(String) });
  });

  it('rejects when unit is not a villager', () => {
    const world = freshWorld();
    const id = world.createEntity();
    world.addComponent(id, 'unit', { unitType: 'archer', owner: 1 });
    const validator = makeValidator(world);
    const result = validator({ builderId: id, buildingType: 'house', position: { x: 0, y: 0 } }, world);
    expect(result).toEqual({ code: 'not_a_villager', message: expect.any(String) });
  });

  it('rejects when build options does not include the building type', () => {
    const world = freshWorld();
    const villagerId = makeVillager(world);
    const validator = makeValidator(world, {
      getBuildOptions: () => [] as readonly BuildableBuildingType[],
    });
    const result = validator(
      { builderId: villagerId, buildingType: 'house', position: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'cannot_build', message: expect.any(String) });
  });

  it('rejects when placement is blocked', () => {
    const world = freshWorld();
    const villagerId = makeVillager(world);
    const validator = makeValidator(world, { isPlacementBlocked: () => true });
    const result = validator(
      { builderId: villagerId, buildingType: 'house', position: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'placement_blocked', message: expect.any(String) });
  });

  it('rejects when no stockpile exists for the owner', () => {
    const world = freshWorld();
    const villagerId = makeVillager(world);
    const validator = makeValidator(world, { playerResources: new Map() });
    const result = validator(
      { builderId: villagerId, buildingType: 'house', position: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'no_stockpile', message: expect.any(String) });
  });

  it('rejects when owner cannot afford the cost', () => {
    const world = freshWorld();
    const villagerId = makeVillager(world);
    const validator = makeValidator(world, {
      playerResources: new Map([[1, { food: 0, wood: 0, gold: 0, stone: 0 }]]),
    });
    const result = validator(
      { builderId: villagerId, buildingType: 'house', position: { x: 0, y: 0 } },
      world,
    );
    expect(result).toEqual({ code: 'insufficient_resources', message: expect.any(String) });
  });

  it('accepts a fully valid build request', () => {
    const world = freshWorld();
    const villagerId = makeVillager(world);
    const validator = makeValidator(world);
    const result = validator(
      { builderId: villagerId, buildingType: 'house', position: { x: 0, y: 0 } },
      world,
    );
    expect(result).toBe(true);
  });

  it('accepts an empty additionalBuilderIds array', () => {
    const world = freshWorld();
    const villagerId = makeVillager(world);
    const validator = makeValidator(world);
    const result = validator(
      { builderId: villagerId, buildingType: 'house', position: { x: 0, y: 0 }, additionalBuilderIds: [] },
      world,
    );
    expect(result).toBe(true);
  });

  it('accepts when all additionalBuilderIds are integers', () => {
    const world = freshWorld();
    const villagerId = makeVillager(world);
    const helper1 = makeVillager(world);
    const helper2 = makeVillager(world);
    const validator = makeValidator(world);
    const result = validator(
      { builderId: villagerId, buildingType: 'house', position: { x: 0, y: 0 }, additionalBuilderIds: [helper1, helper2] },
      world,
    );
    expect(result).toBe(true);
  });

  it('rejects when an additional id is non-integer', () => {
    const world = freshWorld();
    const villagerId = makeVillager(world);
    const validator = makeValidator(world);
    const result = validator(
      { builderId: villagerId, buildingType: 'house', position: { x: 0, y: 0 }, additionalBuilderIds: [1.5] },
      world,
    );
    expect(result).toEqual({ code: 'invalid_builder_id', message: expect.any(String) });
  });

  it('does not reject if some additional ids are stale (best-effort filter at handler time)', () => {
    const world = freshWorld();
    const villagerId = makeVillager(world);
    const validator = makeValidator(world);
    const result = validator(
      { builderId: villagerId, buildingType: 'house', position: { x: 0, y: 0 }, additionalBuilderIds: [99999] },
      world,
    );
    expect(result).toBe(true);
  });
});

describe('buildingPlaceConfirmHandler', () => {
  it('delegates to startConstructionWithBuildersDirect with primary id only', () => {
    const calls: Array<{ builderIds: readonly number[]; buildingType: BuildableBuildingType; position: { x: number; y: number } }> = [];
    const handler = makeBuildingPlaceConfirmHandler({
      startConstructionWithBuildersDirect: (builderIds, buildingType, anchor) => {
        calls.push({ builderIds, buildingType, position: anchor });
        return true;
      },
    });
    handler(
      { builderId: 5, buildingType: 'house', position: { x: 3, y: 4 } },
      freshWorld(),
    );
    expect(calls).toEqual([
      { builderIds: [5], buildingType: 'house', position: { x: 3, y: 4 } },
    ]);
  });

  it('delegates with primary + additional ids', () => {
    const calls: Array<{ builderIds: readonly number[]; buildingType: BuildableBuildingType; position: { x: number; y: number } }> = [];
    const handler = makeBuildingPlaceConfirmHandler({
      startConstructionWithBuildersDirect: (builderIds, buildingType, anchor) => {
        calls.push({ builderIds, buildingType, position: anchor });
        return true;
      },
    });
    handler(
      { builderId: 5, buildingType: 'house', position: { x: 3, y: 4 }, additionalBuilderIds: [7, 9] },
      freshWorld(),
    );
    expect(calls).toEqual([
      { builderIds: [5, 7, 9], buildingType: 'house', position: { x: 3, y: 4 } },
    ]);
  });

  it('treats empty additionalBuilderIds the same as omitted', () => {
    const calls: Array<{ builderIds: readonly number[] }> = [];
    const handler = makeBuildingPlaceConfirmHandler({
      startConstructionWithBuildersDirect: (builderIds) => {
        calls.push({ builderIds });
        return true;
      },
    });
    handler(
      { builderId: 5, buildingType: 'house', position: { x: 3, y: 4 }, additionalBuilderIds: [] },
      freshWorld(),
    );
    expect(calls).toEqual([{ builderIds: [5] }]);
  });
});
