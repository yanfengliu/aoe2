import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';

/**
 * A Feudal-Age AI that must MINE its stone.
 *
 * `ai-scouting-response-fixture` hands the AI 500 stone, so it proves the
 * stone-spending code paths run — not that the AI can ever reach them. On a
 * real map the Feudal villager split allocated ZERO villagers to stone, so
 * the stockpile stayed at 0 for the whole age: nothing Feudal stone buys was
 * ever affordable, and the AI arrived in Castle Age with nothing banked
 * toward the 650-stone Castle it wants immediately. This fixture starts the
 * stone at 0 and puts mines in the base, so the only way to stone is to have
 * decided to mine it.
 *
 * Everything else is deliberately generous — food, wood, gold, population
 * headroom, resources in the base — so a failure here means "did not mine
 * stone" and cannot mean "was too poor" or "was population-blocked".
 *
 * Layout note, learned the hard way: the AI places its own Mill, Barracks and
 * Farms in the open ground just west and north of its Town Center. Villagers
 * parked there end up INSIDE the footprints it chooses, and those foundations
 * then sit at zero progress — which makes the fixture measure something else
 * entirely. The starting villagers therefore sit SOUTH of the Town Center,
 * clear of the ground the AI builds on.
 */
export function createAiFeudalStoneFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'feudal-age',
        // The one number this fixture is about.
        startingResources: { food: 800, wood: 800, gold: 400, stone: 0 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('town-center', 2, 30, 20, { vision: 7 }),
      // Twelve villagers, a realistic Feudal economy: the stone share is then
      // a whole worker rather than a rounding decision about the only one.
      // The Town Center occupies (30..33, 20..23); these sit below it.
      ownedSpawn('villager', 2, 30, 26, { vision: 4 }),
      ownedSpawn('villager', 2, 31, 26, { vision: 4 }),
      ownedSpawn('villager', 2, 32, 26, { vision: 4 }),
      ownedSpawn('villager', 2, 33, 26, { vision: 4 }),
      ownedSpawn('villager', 2, 30, 27, { vision: 4 }),
      ownedSpawn('villager', 2, 31, 27, { vision: 4 }),
      ownedSpawn('villager', 2, 32, 27, { vision: 4 }),
      ownedSpawn('villager', 2, 33, 27, { vision: 4 }),
      ownedSpawn('villager', 2, 30, 28, { vision: 4 }),
      ownedSpawn('villager', 2, 31, 28, { vision: 4 }),
      ownedSpawn('villager', 2, 32, 28, { vision: 4 }),
      ownedSpawn('villager', 2, 33, 28, { vision: 4 }),
      // Population headroom for twelve: Town Center 5 + three houses 15.
      // Without it the AI starts over its cap of 5 and can train nothing.
      ownedSpawn('house', 2, 20, 18),
      ownedSpawn('house', 2, 20, 21),
      ownedSpawn('house', 2, 20, 24),
      // The Watch Tower's prerequisite, already standing.
      ownedSpawn('blacksmith', 2, 22, 27),
      // Everything the AI could want to gather, in its own base. Kept east and
      // north so the western approach to the stone stays open.
      gaiaSpawn('sheep', 36, 25, { baseOwner: 2, amount: 3000 }),
      gaiaSpawn('sheep', 37, 25, { baseOwner: 2, amount: 3000 }),
      gaiaSpawn('berry-bush', 36, 18, { baseOwner: 2, amount: 3000 }),
      gaiaSpawn('tree', 36, 15, { baseOwner: 2, amount: 3000 }),
      gaiaSpawn('tree', 37, 15, { baseOwner: 2, amount: 3000 }),
      gaiaSpawn('gold-mine', 37, 21, { baseOwner: 2, amount: 3000 }),
      gaiaSpawn('stone-mine', 26, 20, { baseOwner: 2, amount: 3000 }),
      gaiaSpawn('stone-mine', 26, 21, { baseOwner: 2, amount: 3000 }),
    ],
  };
}
