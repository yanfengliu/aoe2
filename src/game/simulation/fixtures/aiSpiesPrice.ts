import { MAP_HEIGHT, MAP_WIDTH, type PrototypeScenario } from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Work 141: the computer prices a technology at what it would really pay.
// Owner 2 is an Imperial-Age Frankish AI with a complete Castle and 300 gold,
// and nothing else in its stockpile, so of everything its Castle offers only
// Spies looks affordable on the base table (200 gold). Spies really costs 200
// gold per living enemy villager (spiesRules.ts), and owner 1 has ten, so it
// costs 2,000. Read off the base table the AI asked for Spies every decision
// and was refused every time; the Castle researched nothing behind it (the
// coverage lab's owner 1, work 141, and work 125's card). The map has no
// resources, so the stockpile cannot change and nothing else can be bought.
export function createAiSpiesPriceFixture(seed: string): PrototypeScenario {
  const humanVillagers = Array.from({ length: 10 }, (_unused, index) => (
    ownedSpawn('villager', 1, 4 + (index % 5), 12 + Math.floor(index / 5), { vision: 4 })
  ));
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 6, y: 6 }, disableAi: true },
      {
        owner: 2,
        townCenter: { x: 34, y: 20 },
        startingAge: 'imperial-age',
        civilization: 'Franks',
        startingResources: { food: 0, wood: 0, gold: 300, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 7 }),
      ...humanVillagers,
      ownedSpawn('town-center', 2, 34, 20, { vision: 7 }),
      ownedSpawn('castle', 2, 34, 12, { vision: 11 }),
      ownedSpawn('villager', 2, 40, 22, { vision: 4 }),
    ],
  };
}
