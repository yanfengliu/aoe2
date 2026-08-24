import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

/** Where the petard starts, and the enemy wall three cells in front of it. */
export const PETARD_START = { x: 10, y: 12 } as const;
export const TARGET_WALL = { x: 13, y: 12 } as const;

/**
 * One petard facing one enemy stone wall, close enough to see it.
 *
 * A petard is the answer to a wall: units.csv gives it +500 against buildings
 * and another +900 against walls and gates, and it is spent in the blast. The
 * fixture is that sentence — the wall in front of it, and nothing else to
 * confuse what killed what. The distance is inside the petard's line of sight
 * of 4, because an order on a building nobody can see is refused, which cost a
 * test run to rediscover.
 */
export function createPetardFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 20 }, startingAge: 'castle-age', disableAi: true },
      { owner: 2, townCenter: { x: 40, y: 30 }, startingAge: 'castle-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 20, { vision: 8 }),
      ownedSpawn('petard', 1, PETARD_START.x, PETARD_START.y, { vision: 6 }),
      ownedSpawn('stone-wall', 2, TARGET_WALL.x, TARGET_WALL.y),
      ownedSpawn('town-center', 2, 40, 30, { vision: 7 }),
    ],
  };
}
