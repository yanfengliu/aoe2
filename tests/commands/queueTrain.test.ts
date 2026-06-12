// Phase 1B queue.train tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { makeQueueTrainValidator } from '../../src/game/simulation/handlers/queue/queueTrainValidator';
import { makeQueueTrainHandler } from '../../src/game/simulation/handlers/queue/queueTrainHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type {
  BuildingType,
  PlayerResources,
  TrainableUnitType,
} from '../../src/game/simulation/types';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  constructionStatesCodec,
  playerResourcesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { ConstructionState } from '../../src/game/simulation/bridge/sharedTypes';

const STARTING_RESOURCES: PlayerResources = {
  food: 1000,
  wood: 1000,
  gold: 1000,
  stone: 1000,
};

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
  playerResources?: Map<number, PlayerResources>,
): BridgeStateAccessor {
  const accessor = new BridgeStateAccessor(() => world);
  if (constructionStates && constructionStates.size > 0) {
    accessor.mutate(constructionStatesCodec, (m) => {
      for (const [id, partial] of constructionStates) {
        m.set(id, partial as ConstructionState);
      }
    });
  }
  if (playerResources !== undefined) {
    accessor.mutate(playerResourcesCodec, (m) => {
      for (const [owner, res] of playerResources) {
        m.set(owner, { ...res });
      }
    });
  } else {
    // Default: owner 1 has STARTING_RESOURCES.
    accessor.mutate(playerResourcesCodec, (m) => {
      m.set(1, { ...STARTING_RESOURCES });
    });
  }
  return accessor;
}

function makeValidator(
  world: World<GameEvents, GameCommands, GameComponents>,
  overrides: {
    constructionStates?: Map<number, { isComplete: boolean }>;
    playerResources?: Map<number, PlayerResources>;
    getTrainOptions?: (owner: number, buildingType: BuildingType) => readonly TrainableUnitType[];
  } = {},
) {
  return makeQueueTrainValidator({
    accessor: freshAccessor(world, overrides.constructionStates, overrides.playerResources),
    getTrainOptions:
      overrides.getTrainOptions
      ?? (() => ['villager'] as readonly TrainableUnitType[]),
  });
}

describe('queueTrainValidator', () => {
  it('rejects non-integer buildingId', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ buildingId: 1.5, unitType: 'villager' }, world);
    expect(result).toEqual({ code: 'invalid_building_id', message: expect.any(String) });
  });

  it('rejects when building is dead', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ buildingId: 9999, unitType: 'villager' }, world);
    expect(result).toEqual({ code: 'building_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a building', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const validator = makeValidator(world);
    const result = validator({ buildingId: tileId, unitType: 'villager' }, world);
    expect(result).toEqual({ code: 'not_a_building', message: expect.any(String) });
  });

  it('rejects when building is under construction', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, {
      constructionStates: new Map([[tcId, { isComplete: false }]]),
    });
    const result = validator({ buildingId: tcId, unitType: 'villager' }, world);
    expect(result).toEqual({ code: 'under_construction', message: expect.any(String) });
  });

  it('rejects when train options does not include the unit type', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, {
      getTrainOptions: () => [] as readonly TrainableUnitType[],
    });
    const result = validator({ buildingId: tcId, unitType: 'villager' }, world);
    expect(result).toEqual({ code: 'cannot_train', message: expect.any(String) });
    // agent-affordances A1: names the unit + building and what IS trainable.
    expect((result as { message: string }).message).toContain(
      'Cannot train villager at this town-center',
    );
    expect((result as { message: string }).message).toContain('Nothing is currently trainable');
  });

  it('lists the currently trainable units in the cannot_train message (A1)', () => {
    const world = freshWorld();
    const barracksId = makeBuilding(world, 'barracks');
    const validator = makeValidator(world, {
      getTrainOptions: () => ['militia'] as readonly TrainableUnitType[],
    });
    const result = validator({ buildingId: barracksId, unitType: 'spearman' }, world);
    expect(result).toEqual({ code: 'cannot_train', message: expect.any(String) });
    expect((result as { message: string }).message).toContain('Currently trainable here: militia');
  });

  it('rejects when no stockpile exists for the owner', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, { playerResources: new Map() });
    const result = validator({ buildingId: tcId, unitType: 'villager' }, world);
    expect(result).toEqual({ code: 'no_stockpile', message: expect.any(String) });
  });

  it('rejects when owner cannot afford the unit', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, {
      playerResources: new Map([[1, { food: 0, wood: 0, gold: 0, stone: 0 }]]),
    });
    const result = validator({ buildingId: tcId, unitType: 'villager' }, world);
    expect(result).toEqual({ code: 'insufficient_resources', message: expect.any(String) });
    // agent-affordances A2: need-vs-have detail (villager costs 50 food).
    expect((result as { message: string }).message).toContain('need 50 food (have 0)');
  });

  it('accepts a fully valid train request', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world);
    const result = validator({ buildingId: tcId, unitType: 'villager' }, world);
    expect(result).toBe(true);
  });
});

describe('queueTrainHandler', () => {
  it('delegates to enqueueTrainingDirect', () => {
    const calls: Array<{ buildingId: number; unitType: TrainableUnitType }> = [];
    const handler = makeQueueTrainHandler({
      enqueueTrainingDirect: (buildingId, unitType) => {
        calls.push({ buildingId, unitType });
        return true;
      },
    });
    handler({ buildingId: 5, unitType: 'villager' }, freshWorld());
    expect(calls).toEqual([{ buildingId: 5, unitType: 'villager' }]);
  });
});
