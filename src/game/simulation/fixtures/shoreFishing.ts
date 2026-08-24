import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

/** The bay: water from x=20 rightwards, so the shoreline is the column x=19/20. */
const BAY = { minX: 20, maxX: 30, minY: 8, maxY: 24 } as const;
/** Against the shore — a villager can stand at (19,12) and fish it. */
export const SHORE_FISH = { x: 20, y: 12 } as const;
/** Open water, four cells out. No land touches it, so only a boat can work it. */
export const DEEP_FISH = { x: 25, y: 16 } as const;

function bayTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = BAY.minY; y <= BAY.maxY; y += 1) {
    for (let x = BAY.minX; x <= BAY.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

/**
 * A coast with one SHORE fish and one DEEP fish, and villagers with nothing
 * else to eat.
 *
 * Age of Empires II gathers shore fish with villagers standing on the land
 * beside them — no Dock, no Fishing Ship — and reserves boats for open water.
 * This build models fish as a single water resource, so the difference is
 * geometric: the shore fish has land next to it and the deep one does not.
 * That makes this fixture the discriminator for both halves of the rule.
 */
export function createShoreFishingFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: bayTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 12, y: 12 },
        startingAge: 'feudal-age',
        startingResources: { food: 0, wood: 200, gold: 0, stone: 0 },
      },
      { owner: 2, townCenter: { x: 6, y: 30 }, startingAge: 'feudal-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 12, 12, { vision: 10 }),
      // Three villagers beside the shore, clear of the Town Center footprint.
      ...[0, 1, 2].map((i) => ownedSpawn('villager', 1, 17, 11 + i, { vision: 4 })),
      gaiaSpawn('fish', SHORE_FISH.x, SHORE_FISH.y, { amount: 200 }),
      gaiaSpawn('fish', DEEP_FISH.x, DEEP_FISH.y, { amount: 200 }),
      ownedSpawn('town-center', 2, 6, 30, { vision: 7 }),
    ],
  };
}
