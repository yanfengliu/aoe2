import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from './common';

export function createSheepOwnershipFixture(seed: string): PrototypeScenario {
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
        kind: 'scout',
        x: 3,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'sheep',
        x: 10,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'house',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

export function createSheepMovementFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        // Large vision so that unclaimed and enemy sheep elsewhere on the map
        // are selectable from the test (visibility-gated). TCs do not have a
        // `unit` component, so this does not affect proximity-based ownership.
        vision: { playerId: 1, radius: 50 },
      },
      {
        kind: 'villager',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'sheep',
        x: 20,
        y: 19,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'scout',
        x: 21,
        y: 19,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'scout',
        x: 36,
        y: 25,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'sheep',
        x: 35,
        y: 25,
        owner: 2,
        baseOwner: 2,
        amount: 100,
      },
      {
        kind: 'sheep',
        x: 45,
        y: 25,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      // Two extra human-owned sheep adjacent to the human villager so the
      // group-selection test can drag-box several owned sheep at once.
      {
        kind: 'sheep',
        x: 19,
        y: 18,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'sheep',
        x: 19,
        y: 19,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
    ],
  };
}

export function createSheepVisionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'sheep',
        x: 11,
        y: 10,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'house',
        x: 18,
        y: 10,
        owner: 2,
        baseOwner: 2,
      },
      {
        // Stays unclaimed: outside both the human villager's herdable-claim
        // radius and the nearby enemy scout's vision radius. If neutral sheep
        // ever leaked HUMAN_PLAYER_ID vision, the sheep-vision tests would
        // reveal the enemy house before the player's sheep starts exploring.
        kind: 'sheep',
        x: 22,
        y: 10,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'scout',
        x: 19,
        y: 13,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        // Claimed by the nearby enemy scout. If enemy-owned sheep ever leaked
        // human vision, this sheep would also reveal the hidden house before
        // the player's sheep starts exploring.
        kind: 'sheep',
        x: 20,
        y: 13,
        owner: 2,
        baseOwner: 2,
        amount: 100,
      },
      {
        kind: 'town-center',
        x: 50,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
