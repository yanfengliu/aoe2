// Phase 1B queue.research tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { makeQueueResearchValidator } from '../../src/game/simulation/handlers/queue/queueResearchValidator';
import { makeQueueResearchHandler } from '../../src/game/simulation/handlers/queue/queueResearchHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type {
  BuildingType,
  PlayerResources,
  ResearchableTechnologyType,
} from '../../src/game/simulation/types';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import { constructionStatesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
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
    playerResources?: Map<number, PlayerResources>;
    getResearchOptions?: (owner: number, buildingType: BuildingType) => readonly ResearchableTechnologyType[];
    inFlightTechSetFor?: (owner: number) => Set<ResearchableTechnologyType>;
  } = {},
) {
  return makeQueueResearchValidator({
    accessor: freshAccessor(world, overrides.constructionStates),
    playerResources: overrides.playerResources ?? new Map([[1, { ...STARTING_RESOURCES }]]),
    getResearchOptions:
      overrides.getResearchOptions
      ?? (() => ['feudal-age'] as readonly ResearchableTechnologyType[]),
    inFlightTechSetFor:
      overrides.inFlightTechSetFor ?? (() => new Set<ResearchableTechnologyType>()),
  });
}

describe('queueResearchValidator', () => {
  it('rejects non-integer buildingId', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ buildingId: 1.5, technologyType: 'feudal-age' }, world);
    expect(result).toEqual({ code: 'invalid_building_id', message: expect.any(String) });
  });

  it('rejects when building is dead', () => {
    const world = freshWorld();
    const validator = makeValidator(world);
    const result = validator({ buildingId: 9999, technologyType: 'feudal-age' }, world);
    expect(result).toEqual({ code: 'building_not_found', message: expect.any(String) });
  });

  it('rejects when alive entity is not a building', () => {
    const world = freshWorld();
    world.registerComponent('terrain');
    const tileId = world.createEntity();
    world.addComponent(tileId, 'terrain', { kind: 'grass' });
    const validator = makeValidator(world);
    const result = validator({ buildingId: tileId, technologyType: 'feudal-age' }, world);
    expect(result).toEqual({ code: 'not_a_building', message: expect.any(String) });
  });

  it('rejects when building is under construction', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, {
      constructionStates: new Map([[tcId, { isComplete: false }]]),
    });
    const result = validator({ buildingId: tcId, technologyType: 'feudal-age' }, world);
    expect(result).toEqual({ code: 'under_construction', message: expect.any(String) });
  });

  it('rejects when research options does not include the technology type', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, {
      getResearchOptions: () => [] as readonly ResearchableTechnologyType[],
    });
    const result = validator({ buildingId: tcId, technologyType: 'feudal-age' }, world);
    expect(result).toEqual({ code: 'cannot_research', message: expect.any(String) });
  });

  it('rejects when the same tech is already in flight', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, {
      inFlightTechSetFor: () => new Set<ResearchableTechnologyType>(['feudal-age']),
    });
    const result = validator({ buildingId: tcId, technologyType: 'feudal-age' }, world);
    expect(result).toEqual({ code: 'in_flight_tech', message: expect.any(String) });
  });

  it('rejects when no stockpile exists for the owner', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, { playerResources: new Map() });
    const result = validator({ buildingId: tcId, technologyType: 'feudal-age' }, world);
    expect(result).toEqual({ code: 'no_stockpile', message: expect.any(String) });
  });

  it('rejects when owner cannot afford the technology', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world, {
      playerResources: new Map([[1, { food: 0, wood: 0, gold: 0, stone: 0 }]]),
    });
    const result = validator({ buildingId: tcId, technologyType: 'feudal-age' }, world);
    expect(result).toEqual({ code: 'insufficient_resources', message: expect.any(String) });
  });

  it('accepts a fully valid research request', () => {
    const world = freshWorld();
    const tcId = makeBuilding(world, 'town-center');
    const validator = makeValidator(world);
    const result = validator({ buildingId: tcId, technologyType: 'feudal-age' }, world);
    expect(result).toBe(true);
  });
});

describe('queueResearchHandler', () => {
  it('delegates to enqueueResearchDirect', () => {
    const calls: Array<{ buildingId: number; technologyType: ResearchableTechnologyType }> = [];
    const handler = makeQueueResearchHandler({
      enqueueResearchDirect: (buildingId, technologyType) => {
        calls.push({ buildingId, technologyType });
        return true;
      },
    });
    handler({ buildingId: 5, technologyType: 'feudal-age' }, freshWorld());
    expect(calls).toEqual([{ buildingId: 5, technologyType: 'feudal-age' }]);
  });
});
