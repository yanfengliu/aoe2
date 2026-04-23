import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import {
  FIXTURE_MIXED_SELECTION_HOUSE_POSITION,
  FIXTURE_MIXED_SELECTION_UNITS,
  FIXTURE_STACK_POSITION,
  FIXTURE_VILLAGER_CLUSTER,
  createGrassFixtureTerrain,
} from './common';

export function createTownCenterDefenseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: 6,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'scout',
        x: 12,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
      },
    ],
  };
}

export function createVillagerSelectionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[0].x,
        y: FIXTURE_VILLAGER_CLUSTER[0].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[1].x,
        y: FIXTURE_VILLAGER_CLUSTER[1].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[2].x,
        y: FIXTURE_VILLAGER_CLUSTER[2].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

export function createDoubleClickSelectionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[0].x,
        y: FIXTURE_VILLAGER_CLUSTER[0].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[1].x,
        y: FIXTURE_VILLAGER_CLUSTER[1].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[2].x,
        y: FIXTURE_VILLAGER_CLUSTER[2].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'scout',
        x: 9,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

export function createMixedSelectionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'house',
        x: FIXTURE_MIXED_SELECTION_HOUSE_POSITION.x,
        y: FIXTURE_MIXED_SELECTION_HOUSE_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: FIXTURE_MIXED_SELECTION_UNITS[0].kind,
        x: FIXTURE_MIXED_SELECTION_UNITS[0].x,
        y: FIXTURE_MIXED_SELECTION_UNITS[0].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: FIXTURE_MIXED_SELECTION_UNITS[1].kind,
        x: FIXTURE_MIXED_SELECTION_UNITS[1].x,
        y: FIXTURE_MIXED_SELECTION_UNITS[1].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: FIXTURE_MIXED_SELECTION_UNITS[2].kind,
        x: FIXTURE_MIXED_SELECTION_UNITS[2].x,
        y: FIXTURE_MIXED_SELECTION_UNITS[2].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

export function createTileSelectionCycleFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        // Slice 12 Task B: deliberate overlap — the UX test needs a
        // house + militia + sheep stacked on one cell so the tile-
        // selection-cycle can iterate through all three. Opt out of
        // the fixture validator via `allowOverlappingSpawn` on each.
        kind: 'house',
        x: FIXTURE_STACK_POSITION.x,
        y: FIXTURE_STACK_POSITION.y,
        owner: 1,
        baseOwner: 1,
        allowOverlappingSpawn: true,
      },
      {
        kind: 'militia',
        x: FIXTURE_STACK_POSITION.x,
        y: FIXTURE_STACK_POSITION.y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
        allowOverlappingSpawn: true,
      },
      {
        kind: 'sheep',
        x: FIXTURE_STACK_POSITION.x,
        y: FIXTURE_STACK_POSITION.y,
        owner: null,
        baseOwner: 1,
        amount: 100,
        allowOverlappingSpawn: true,
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
