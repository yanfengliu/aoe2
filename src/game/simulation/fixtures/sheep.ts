import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from './common';

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
      ownedSpawn('scout', 1, 3, 8, { vision: 4 }),
      gaiaSpawn('sheep', 10, 8, { amount: 100 }),
      ownedSpawn('house', 2, 24, 8, { vision: 4 }),
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
      // Large vision so that unclaimed and enemy sheep elsewhere on the map
      // are selectable from the test (visibility-gated). TCs do not have a
      // `unit` component, so this does not affect proximity-based ownership.
      ownedSpawn('town-center', 1, 4, 4, { vision: 50 }),
      ownedSpawn('villager', 1, 20, 18, { vision: 4 }),
      gaiaSpawn('sheep', 20, 19, { amount: 100 }),
      ownedSpawn('scout', 2, 21, 19, { vision: 4 }),
      ownedSpawn('scout', 2, 36, 25, { vision: 4 }),
      ownedSpawn('sheep', 2, 35, 25, { amount: 100 }),
      gaiaSpawn('sheep', 45, 25, { amount: 100 }),
      // Two extra human-owned sheep adjacent to the human villager so the
      // group-selection test can drag-box several owned sheep at once.
      gaiaSpawn('sheep', 19, 18, { amount: 100 }),
      gaiaSpawn('sheep', 19, 19, { amount: 100 }),
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
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('villager', 1, 10, 10, { vision: 4 }),
      gaiaSpawn('sheep', 11, 10, { amount: 100 }),
      ownedSpawn('house', 2, 18, 10),
      // Stays unclaimed: outside both the human villager's herdable-claim
      // radius and the nearby enemy scout's vision radius. If neutral sheep
      // ever leaked HUMAN_PLAYER_ID vision, the sheep-vision tests would
      // reveal the enemy house before the player's sheep starts exploring.
      gaiaSpawn('sheep', 22, 10, { amount: 100 }),
      ownedSpawn('scout', 2, 19, 13, { vision: 4 }),
      // Claimed by the nearby enemy scout. If enemy-owned sheep ever leaked
      // human vision, this sheep would also reveal the hidden house before
      // the player's sheep starts exploring.
      ownedSpawn('sheep', 2, 20, 13, { amount: 100 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}
