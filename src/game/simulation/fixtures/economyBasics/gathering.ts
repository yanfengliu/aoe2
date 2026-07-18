import {
  MAP_HEIGHT,
  MAP_WIDTH,
  SHORE_FISH_AMOUNT,
  setTerrainKind,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';

export function createMiningCampFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: {
          food: 200,
          wood: 200,
          gold: 100,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      gaiaSpawn('gold-mine', 13, 7, { baseOwner: 1, amount: 800 }),
      gaiaSpawn('gold-mine', 14, 7, { baseOwner: 1, amount: 800 }),
      gaiaSpawn('gold-mine', 13, 8, { baseOwner: 1, amount: 800 }),
      gaiaSpawn('gold-mine', 14, 8, { baseOwner: 1, amount: 800 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

// Iter-2 H2-2 regression: player 1 has a villager + a tree, but the
// only owned building is a Mill (food drop-off only). The villager
// fills its carry from the tree and the to-dropoff branch finds no
// owned wood drop-off building. Without the fix, the gather-system
// silently zeroes the load every tick. With the fix, the load
// persists until a wood drop-off becomes reachable.
export function createVillagerNoWoodDropoffFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: {
          food: 200,
          wood: 200,
          gold: 100,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        // Disable the AI planner for player 2 so it doesn't train its
        // own villagers and steal-gather from player 1's lone tree
        // (which would corrupt this regression test's measurements).
        disableAi: true,
      },
    ],
    spawns: [
      // Player 1's only owned building is a Mill — accepts food only,
      // not wood. Intentionally NO Town Center and NO Lumber Camp.
      ownedSpawn('mill', 1, 8, 8, { vision: 4 }),
      ownedSpawn('villager', 1, 11, 8, { vision: 4 }),
      gaiaSpawn('tree', 13, 8, { baseOwner: 1, amount: 200 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createFishFixture(seed: string): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();
  for (let y = 7; y <= 9; y += 1) {
    for (let x = 11; x <= 13; x += 1) {
      setTerrainKind(terrain, x, y, 'water');
    }
  }

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 8 },
        startingResources: {
          food: 0,
          wood: 200,
          gold: 100,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 9, 8, { vision: 4 }),
      gaiaSpawn('fish', 11, 8, { amount: SHORE_FISH_AMOUNT }),
      ownedSpawn('house', 2, 24, 8, { vision: 4 }),
    ],
  };
}

// Iter-3 V3-1 + V3-2 regression: human scout positioned so its vision
// radius 4 reaches one non-anchor cell of an enemy 4x4 castle, while the
// castle's anchor sits outside vision. Used to lock the contract that
// fog-memory refresh and click-selection hit-test both treat the castle
// as visible (footprint visibility, matching createProjector and the
// iter-2 M2-1 fix in target finding).
