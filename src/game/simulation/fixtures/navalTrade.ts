import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// One long bay with a Dock at each end — the sea lane between two players'
// harbours that naval trade (spec §6.7) cycles along. The cog starts afloat
// by the near Dock, and an own Galley by the FAR Dock is the scout report
// that makes the order legal under the fog contract.
const BAY = { minX: 10, maxX: 50, minY: 6, maxY: 14 } as const;

function bayTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = BAY.minY; y <= BAY.maxY; y += 1) {
    for (let x = BAY.minX; x <= BAY.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

export function createNavalTradeFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: bayTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 20 },
        startingAge: 'castle-age',
        disableAi: true,
        startingResources: { food: 1000, wood: 500, gold: 500, stone: 200 },
      },
      {
        owner: 2,
        townCenter: { x: 54, y: 20 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 20, { vision: 7 }),
      // Each Dock's 3x3 footprint touches its end of the bay.
      ownedSpawn('dock', 1, 7, 8, { vision: 6 }),
      ownedSpawn('trade-cog', 1, 12, 10, { vision: 6 }),
      ownedSpawn('galley', 1, 46, 10, { vision: 7 }),
      ownedSpawn('town-center', 2, 54, 20, { vision: 7 }),
      ownedSpawn('dock', 2, 51, 8, { vision: 6 }),
    ],
  };
}
