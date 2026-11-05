import { MAP_HEIGHT, MAP_WIDTH, type PrototypeScenario } from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Work 141 review round 0, F0: soldiers asked for in one decision while a
// villager is due are priced together. Owner 2 is a Feudal AI with an idle
// Barracks and Stable, three villagers (under its Feudal count, so a villager is
// due), room in its Houses, 130 food, no gold, and wood to spare so the build
// order cannot take the Spearman's 25 first and hide the race, on a map with
// nothing to gather. A Spearman (35 food, 25 wood) and a Scout (80 food) each
// clear 130 with the villager's 50 left over, but not together: the old check
// let both through, the handlers charged them first, and the villager found 15.
// Owner 1 is a Town Center with its AI off, far away.
export function createAiSoldierBudgetFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, disableAi: true },
      {
        owner: 2,
        townCenter: { x: 34, y: 20 },
        startingAge: 'feudal-age',
        startingResources: { food: 130, wood: 1000, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 34, 20, { vision: 7 }),
      ownedSpawn('barracks', 2, 28, 20, { vision: 5 }),
      ownedSpawn('stable', 2, 28, 25, { vision: 5 }),
      ownedSpawn('house', 2, 40, 18, { vision: 3 }),
      ownedSpawn('house', 2, 43, 18, { vision: 3 }),
      ownedSpawn('villager', 2, 40, 24, { vision: 4 }),
      ownedSpawn('villager', 2, 41, 24, { vision: 4 }),
      ownedSpawn('villager', 2, 42, 24, { vision: 4 }),
    ],
  };
}

// Work 141 review round 1, Codex R1: a soldier refused for that shared budget
// reaches the Imperial Market as the budget, not its bare price. Owner 2 is an
// Imperial AI with a Market, an idle Barracks, Archery Range and Siege Workshop
// and no upgrades, three villagers (a villager is due), four Houses (22 free,
// so no House is wanted), and 90 food, 30 wood and 1,000 gold, on a map with
// nothing to gather. Every technology those buildings offer costs more than 90
// food or more than 30 wood, so nothing is researched first. The Spearman (35
// food, 25 wood) takes the wood the villager leaves, so the Archer (25 wood, 45
// gold) is refused; priced
// bare against the purse, the Archer looked affordable, the Market aimed at it
// and made no trade.
export function createAiMarketBudgetFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'imperial-age', disableAi: true },
      {
        owner: 2,
        townCenter: { x: 34, y: 20 },
        startingAge: 'imperial-age',
        startingResources: { food: 90, wood: 30, gold: 1000, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 34, 20, { vision: 7 }),
      ownedSpawn('market', 2, 22, 14, { vision: 5 }),
      ownedSpawn('barracks', 2, 28, 20, { vision: 5 }),
      ownedSpawn('archery-range', 2, 28, 24, { vision: 5 }),
      ownedSpawn('siege-workshop', 2, 22, 20, { vision: 5 }),
      ownedSpawn('house', 2, 40, 18, { vision: 3 }),
      ownedSpawn('house', 2, 43, 18, { vision: 3 }),
      ownedSpawn('house', 2, 40, 27, { vision: 3 }),
      ownedSpawn('house', 2, 43, 27, { vision: 3 }),
      ownedSpawn('villager', 2, 40, 24, { vision: 4 }),
      ownedSpawn('villager', 2, 41, 24, { vision: 4 }),
      ownedSpawn('villager', 2, 42, 24, { vision: 4 }),
    ],
  };
}
