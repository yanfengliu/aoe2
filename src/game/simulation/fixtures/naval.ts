import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';

// M5 naval fixture: a bay along the east side of the player's land, a Dock
// already standing on its shore, fish in the water, and enough wood to train
// ships. Used for naval behaviour that is not about PLACING a dock (which
// `fish-fixture` covers) — training, ship movement, and fishing.
export const NAVAL_BAY = { minX: 14, maxX: 22, minY: 4, maxY: 16 } as const;
export const NAVAL_DOCK = { x: 11, y: 8 } as const;

function navalTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = NAVAL_BAY.minY; y <= NAVAL_BAY.maxY; y += 1) {
    for (let x = NAVAL_BAY.minX; x <= NAVAL_BAY.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

export function createNavalFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: navalTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 5, y: 8 },
        startingResources: { food: 500, wood: 1000, gold: 300, stone: 200 },
      },
      {
        owner: 2,
        townCenter: { x: 30, y: 24 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 5, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 8, 12, { vision: 4 }),
      // The Dock's 3x3 footprint sits at x=11..13, so its right column is
      // against the bay's western edge at x=14.
      ownedSpawn('dock', 1, NAVAL_DOCK.x, NAVAL_DOCK.y, { vision: 6 }),
      // Fish within easy reach of the dock.
      gaiaSpawn('fish', 16, 8, { amount: 200 }),
      gaiaSpawn('fish', 17, 10, { amount: 200 }),
      ownedSpawn('town-center', 2, 30, 24, { vision: 4 }),
      // A player-1 Galley and an enemy Galley facing each other across the
      // bay, for naval combat tests.
      ownedSpawn('galley', 1, 16, 5, { vision: 7 }),
      ownedSpawn('galley', 2, 20, 5, { vision: 7 }),
    ],
  };
}
