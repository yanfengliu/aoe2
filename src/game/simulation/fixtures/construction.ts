import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

// Five villagers clustered near a Town Center with full coffers, primed
// for placing a building together. The seed is shared between this and
// the single-villager variant so any speed comparisons are apples-to-
// apples.
export function createMultiVillagerConstructionFixture(seed: string): PrototypeScenario {
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
          food: 1000,
          wood: 1000,
          gold: 1000,
          stone: 1000,
        },
        // Disable the AI planner so the human player owns command
        // dispatch entirely; otherwise the AI may overwrite villager
        // commands mid-test.
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        disableAi: true,
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
      // Five villagers at adjacent free cells south of the Town Center.
      { kind: 'villager', x: 6, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 7, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 8, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 9, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'villager', x: 10, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
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

// Single-villager mirror of the above. Same seed and same terrain so the
// only behavioral difference is the villager count.
export function createSingleVillagerConstructionFixture(seed: string): PrototypeScenario {
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
          food: 1000,
          wood: 1000,
          gold: 1000,
          stone: 1000,
        },
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        disableAi: true,
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
      { kind: 'villager', x: 8, y: 13, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
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
