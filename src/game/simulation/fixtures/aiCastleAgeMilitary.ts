import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// An AI (owner 2) in Castle Age with the military buildings already up and
// resources to spend, so its production decisions are observable within a few
// hundred ticks instead of after a whole economy has been grown.
//
// The AI is Frankish, so its Castle offers the Throwing Axeman — a unique unit
// with a distinctive name that no other production path could produce.
export function createAiCastleAgeMilitaryFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 6 },
        startingAge: 'castle-age',
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 34, y: 20 },
        startingAge: 'castle-age',
        civilization: 'Franks',
        startingResources: { food: 4000, wood: 4000, gold: 4000, stone: 2000 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 7 }),
      ownedSpawn('town-center', 2, 34, 20, { vision: 7 }),
      ownedSpawn('barracks', 2, 28, 20, { vision: 5 }),
      ownedSpawn('archery-range', 2, 28, 24, { vision: 5 }),
      ownedSpawn('stable', 2, 32, 26, { vision: 5 }),
      ownedSpawn('blacksmith', 2, 38, 26, { vision: 5 }),
      ownedSpawn('market', 2, 42, 20, { vision: 5 }),
      ownedSpawn('mill', 2, 42, 24, { vision: 5 }),
      ownedSpawn('siege-workshop', 2, 38, 16, { vision: 5 }),
      ownedSpawn('monastery', 2, 30, 16, { vision: 5 }),
      ownedSpawn('castle', 2, 34, 12, { vision: 11 }),
      // A few villagers so the AI's economy phase has something to do and does
      // not spend every decision tick trying to fix an empty base.
      ownedSpawn('villager', 2, 45, 30, { vision: 4 }),
      ownedSpawn('villager', 2, 46, 30, { vision: 4 }),
      ownedSpawn('villager', 2, 47, 30, { vision: 4 }),
    ],
  };
}
