import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';

// Transport fixture: a strait of water splitting the map in two at x=14..17,
// with the player's militia and a Transport Ship on the west shore and nothing
// but land on the east. A militia cannot cross a strait, so any militia that
// ends up east of it got there aboard the ship — which is the whole feature.
export const STRAIT = { minX: 14, maxX: 17 } as const;
export const WEST_SHORE = { x: 13, y: 10 } as const;
export const EAST_SHORE = { x: 18, y: 10 } as const;

function straitTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = STRAIT.minX; x <= STRAIT.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

export function createTransportFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: straitTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 5, y: 10 },
        startingAge: 'feudal-age',
        disableAi: true,
        startingResources: { food: 0, wood: 500, gold: 0, stone: 0 },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
        startingAge: 'feudal-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 5, 10, { vision: 8 }),
      ownedSpawn('militia', 1, WEST_SHORE.x, WEST_SHORE.y, { vision: 4 }),
      // Afloat in the strait, against the west shore.
      ownedSpawn('transport-ship', 1, STRAIT.minX, WEST_SHORE.y, { vision: 5 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}
