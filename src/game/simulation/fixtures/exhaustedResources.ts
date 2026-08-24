import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

/**
 * A base whose WOOD and GOLD are gone and whose food is not.
 *
 * This is the late game measured on 2026-08-24: a 36000-tick AI-versus-AI match
 * froze with 83 idle villagers between the two players, wood at 5 and 12, gold
 * at 15 and 4 — and four boar still standing five cells from the town centres.
 * Every villager whose assigned resource had run out went idle and stayed idle,
 * because assignment treats "no node of the kind I want" as "nothing to do".
 *
 * The fixture is that state in miniature: no trees, no gold, no stone anywhere
 * on the map, and berries plus boar within a few cells of the Town Center. A
 * villager that keeps working here has fallen back to what is left; one that
 * idles has reproduced the freeze.
 */
export function createExhaustedResourcesFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 20, y: 20 },
        startingAge: 'castle-age',
        startingResources: { food: 500, wood: 0, gold: 0, stone: 0 },
      },
      { owner: 2, townCenter: { x: 50, y: 28 }, startingAge: 'castle-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 20, 20, { vision: 10 }),
      // Six villagers, clear of the 4x4 Town Center footprint at 20..23.
      ...[0, 1, 2, 3, 4, 5].map((i) =>
        ownedSpawn('villager', 1, 16 + (i % 3), 25 + Math.floor(i / 3), { vision: 4 })),
      // The only food on the map, in easy reach: berries and boar, exactly the
      // shape of what the frozen match had left.
      gaiaSpawn('berry-bush', 17, 19, { amount: 200 }),
      gaiaSpawn('berry-bush', 17, 20, { amount: 200 }),
      gaiaSpawn('boar', 25, 22, { amount: 340 }),
      ownedSpawn('town-center', 2, 50, 28, { vision: 7 }),
    ],
  };
}
