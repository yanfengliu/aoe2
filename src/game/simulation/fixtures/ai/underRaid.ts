import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from '../common';

// An AI base with raiders already inside it. The AI (owner 2) has a Town
// Center, four villagers on berries beside it, and no army at all; the human
// (owner 1, planner disabled so it does nothing on its own) has three militia
// standing in the middle of that economy.
//
// Without a raid response every one of those villagers keeps gathering while
// it is cut down — which is what an AI-vs-AI match measured: whole villager
// forces lost to raids neither side defended against.
export function createAiUnderRaidFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      // The raider's owner. No Town Center of its own inside the AI's vision,
      // so the AI has nothing to march off and attack.
      { owner: 1, townCenter: { x: 48, y: 28 }, disableAi: true },
      { owner: 2, townCenter: { x: 20, y: 12 }, difficulty: 'standard' },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 48, 28, { vision: 4 }),
      ownedSpawn('town-center', 2, 20, 12, { vision: 9 }),
      // The economy under threat: four villagers on berries just south of the
      // Town Center's 4x4 footprint (20..23, 12..15).
      ownedSpawn('villager', 2, 20, 17, { vision: 4 }),
      ownedSpawn('villager', 2, 21, 17, { vision: 4 }),
      ownedSpawn('villager', 2, 22, 17, { vision: 4 }),
      ownedSpawn('villager', 2, 23, 17, { vision: 4 }),
      gaiaSpawn('berry-bush', 20, 18, { baseOwner: 2, amount: 400 }),
      gaiaSpawn('berry-bush', 21, 18, { baseOwner: 2, amount: 400 }),
      gaiaSpawn('berry-bush', 22, 18, { baseOwner: 2, amount: 400 }),
      // The raid: three militia already among the villagers.
      ownedSpawn('militia', 1, 20, 19, { vision: 5 }),
      ownedSpawn('militia', 1, 22, 19, { vision: 5 }),
      ownedSpawn('militia', 1, 24, 17, { vision: 5 }),
    ],
  };
}
