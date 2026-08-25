import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Goth "+10 to population limit in Imperial Age" (civilizations.csv). The
// bonus raises the HARD cap, which is only observable when raw supply exceeds
// it — so this fixture banks 37 houses (185) plus the Town Center (5) and the
// Castle (20) for a raw supply of 210: a generic owner clamps to 200, an Imperial Goth reads
// 210. Castle Age start with the Imperial prerequisites (Monastery + Castle)
// and the advance banked, so one research shows the cap MOVE at the moment
// Imperial lands.
export function createCivGothsPopFixture(seed: string): PrototypeScenario {
  const houses: ScenarioSpawnSpec[] = [];
  // A 37-house grid clear of the TC footprint and each other (houses are 2x2).
  for (let index = 0; index < 37; index += 1) {
    const column = index % 8;
    const row = Math.floor(index / 8);
    houses.push(ownedSpawn('house', 1, 12 + column * 3, 4 + row * 3));
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
        startingResources: { food: 1200, wood: 100, gold: 900, stone: 100 },
      },
      { owner: 2, townCenter: { x: 52, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ...houses,
      // The two Castle-Age buildings the Imperial advance requires.
      ownedSpawn('monastery', 1, 4, 26),
      ownedSpawn('castle', 1, 12, 26),
      ownedSpawn('town-center', 2, 52, 30, { vision: 4 }),
    ],
  };
}
