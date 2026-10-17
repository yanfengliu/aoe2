import { MAP_HEIGHT, MAP_WIDTH, type PrototypeScenario } from '../../prototypeScenario';
import { createTerrainCell } from '../../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from '../common';

// Work 131 review IR2: training through a real Town Center rally must name the
// requested node while keeping the ordinary ownership and gather-domain rules.
// A closer own Farm is a decoy for assignment that forgets the exact target.
export const RALLY_GATHER_TARGETS = {
  ownFarm: { x: 12, y: 6 },
  enemyFarm: { x: 17, y: 6 },
  alliedFarm: { x: 22, y: 6 },
  tree: { x: 12, y: 12 },
  shoreFish: { x: 14, y: 18 },
  deepFish: { x: 18, y: 19 },
} as const;

export function createRallyGatherEligibilityFixture(seed: string): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();
  for (let y = 16; y <= 22; y += 1) {
    for (let x = 14; x <= 21; x += 1) terrain[y]![x] = createTerrainCell(x, y, 'water');
  }
  const at = RALLY_GATHER_TARGETS;
  return {
    seed, width: MAP_WIDTH, height: MAP_HEIGHT, terrain,
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, team: 1 },
      { owner: 2, townCenter: { x: 50, y: 28 }, team: 2, disableAi: true },
      { owner: 3, townCenter: { x: 50, y: 4 }, team: 1, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 30 }),
      ownedSpawn('town-center', 2, 50, 28, { vision: 7 }),
      ownedSpawn('town-center', 3, 50, 4, { vision: 7 }),
      ownedSpawn('farm', 1, 8, 12, { farmFood: 100 }),
      ownedSpawn('farm', 1, at.ownFarm.x, at.ownFarm.y, { farmFood: 100 }),
      ownedSpawn('farm', 2, at.enemyFarm.x, at.enemyFarm.y, { farmFood: 100 }),
      ownedSpawn('farm', 3, at.alliedFarm.x, at.alliedFarm.y, { farmFood: 100 }),
      gaiaSpawn('tree', at.tree.x, at.tree.y, { amount: 100 }),
      gaiaSpawn('fish', at.shoreFish.x, at.shoreFish.y, { amount: 100 }),
      gaiaSpawn('fish', at.deepFish.x, at.deepFish.y, { amount: 100 }),
    ],
  };
}
