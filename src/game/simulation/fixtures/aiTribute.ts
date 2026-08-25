import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// AI tribute (spec section 6.8): owner 2 is a RICH ALLIED AI (team 1 with the
// human, banked food, completed Market); the human is nearly dry. A distant
// owner-3 enemy keeps the conquest clock honest. The AI should notice the
// ally shortfall and send a tribute chunk through the recorded channel.
export function createAiTributeFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        team: 1,
        startingResources: { food: 50, wood: 0, gold: 0, stone: 0 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        team: 1,
        startingResources: { food: 1500, wood: 200, gold: 300, stone: 100 },
      },
      { owner: 3, townCenter: { x: 52, y: 30 }, team: 2, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('market', 2, 30, 8),
      ownedSpawn('villager', 2, 27, 12),
      ownedSpawn('town-center', 3, 52, 30, { vision: 4 }),
    ],
  };
}
