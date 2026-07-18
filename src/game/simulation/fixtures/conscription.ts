import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Conscription (v0.1.85) fixture. Player 1 (AI disabled) is in the Imperial Age
// with a Town Center (4,4), a Barracks (4,16), and a Castle (18,4) — the Castle
// hosts Conscription — plus enough food/gold to research it (150/150) and train
// a Militia. A test researches Conscription at the Castle, then trains a Militia
// at the Barracks and confirms it appears in fewer ticks than the un-teched
// baseline (the derived ×0.75 train-time multiplier).
export function createConscriptionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'imperial-age',
        disableAi: true,
        startingResources: { food: 500, wood: 0, gold: 500, stone: 0 },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
        startingAge: 'imperial-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 8 }),
      ownedSpawn('barracks', 1, 4, 16, { vision: 6 }),
      ownedSpawn('castle', 1, 18, 4, { vision: 11 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}
