import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

/**
 * Every technology added since v0.3.48, standing behind the building that
 * researches it.
 *
 * The simulation tests prove these technologies cost what technologies.csv
 * says and do what their row describes. This fixture exists for the BROWSER
 * suite, which proves the other half: that a player can reach them with a
 * mouse. A technology with a cost, a research time and a passing effect test
 * is still unreachable if no building renders its button — the same shape as
 * the v0.3.20 finding, where nine warships had stats and combat tests and no
 * Dock menu ever offered one.
 *
 * Imperial Age, because every technology here is Imperial, and richly
 * resourced so each is one click away rather than a wait.
 */
export function createNewTechReachFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
        disableAi: true,
        startingResources: {
          food: 4000,
          wood: 4000,
          gold: 4000,
          stone: 1000,
        },
      },
      { owner: 2, townCenter: { x: 40, y: 8 }, startingAge: 'imperial-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('archery-range', 1, 14, 6),
      ownedSpawn('monastery', 1, 18, 6, { vision: 8 }),
      // A Barracks and a villager, because the Market needs the first to be
      // offered and the second to be built — and Cartography needs a Market.
      ownedSpawn('barracks', 1, 22, 6),
      ownedSpawn('villager', 1, 10, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}
