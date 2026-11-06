import { MAP_HEIGHT, MAP_WIDTH, type PrototypeScenario } from '../prototypeScenario';
import type { AgeType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Work 147 M2, DE's flush buffers (`aiFlushBuffers.ts`; the cases are
// `tests/simulation/aiFlushBufferTraining.test.ts`). Owner 2 is an AI seat with
// an idle Barracks, Archery Range and Stable, a Mill, food and gold to spare,
// the given wood and Houses enough, on a map with nothing to gather, so no
// villager is on food and nothing the build order wants is cheaper than its
// wood. Its farm target is a third of its villagers, at least 2. In the Castle
// Age it also has a Blacksmith and a Market, so the build order's next want is
// the Siege Workshop (200 wood). Farms and the Siege Workshop are complete, or
// unstarted foundations; soldiers are Spearmen. Owner 1 is a Town Center with
// its AI off, far away, in the given age.
interface FlushBufferFixture {
  age: AgeType;
  enemyAge?: AgeType;
  wood: number;
  farms?: number;
  farmFoundations?: number;
  villagers: number;
  soldiers?: number;
  siegeWorkshop?: 'complete' | 'foundation';
}

function createAiFlushBufferFixture(seed: string, options: FlushBufferFixture): PrototypeScenario {
  const castle = options.age === 'castle-age';
  const farms = [...Array.from({ length: options.farms ?? 0 }, () => false), ...Array.from({ length: options.farmFoundations ?? 0 }, () => true)];
  const houses = [[40, 16], [43, 16], [46, 16], [40, 29], [43, 29], [46, 29]].slice(0, options.villagers > 10 ? 6 : 2);
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: options.enemyAge ?? options.age, disableAi: true },
      {
        owner: 2,
        townCenter: { x: 34, y: 20 },
        startingAge: options.age,
        startingResources: { food: 3000, wood: options.wood, gold: 3000, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 34, 20, { vision: 7 }),
      ownedSpawn('barracks', 2, 28, 20, { vision: 5 }),
      ownedSpawn('archery-range', 2, 28, 24, { vision: 5 }),
      ownedSpawn('stable', 2, 28, 28, { vision: 5 }),
      ownedSpawn('mill', 2, 40, 11, { vision: 4 }),
      ...(castle ? [ownedSpawn('blacksmith', 2, 22, 20, { vision: 4 }), ownedSpawn('market', 2, 22, 14, { vision: 5 })] : []),
      ...(options.siegeWorkshop
        ? [ownedSpawn('siege-workshop', 2, 22, 26, { vision: 5, ...(options.siegeWorkshop === 'foundation' ? { unstartedFoundation: true } : {}) })]
        : []),
      ...houses.map(([x, y]) => ownedSpawn('house', 2, x, y, { vision: 3 })),
      ...farms.map((foundation, i) => ownedSpawn('farm', 2, 52, 2 + i * 4, { vision: 3, ...(foundation ? { unstartedFoundation: true } : {}) })),
      ...Array.from({ length: options.villagers }, (_unused, i) => ownedSpawn('villager', 2, 36 + (i % 8), 24 + Math.floor(i / 8), { vision: 4 })),
      ...Array.from({ length: options.soldiers ?? 0 }, (_unused, i) => ownedSpawn('spearman', 2, 40 + i, 33, { vision: 4 })),
    ],
  };
}

/** The flush buffers' cases, by seed. */
export const AI_FLUSH_BUFFER_SCENARIOS: ReadonlyArray<readonly [string, (seed: string) => PrototypeScenario]> = [
  ['ai-flush-farm-buffer-fixture', (seed) => createAiFlushBufferFixture(seed, { age: 'feudal-age', wood: 50, villagers: 4 })],
  ['ai-flush-farms-standing-fixture', (seed) => createAiFlushBufferFixture(seed, { age: 'feudal-age', wood: 50, farms: 2, villagers: 4 })],
  ['ai-flush-farm-foundations-fixture', (seed) => createAiFlushBufferFixture(seed, { age: 'feudal-age', wood: 50, farmFoundations: 2, villagers: 4 })],
  // Seven farms of a target of 8 (24 villagers) and five soldiers level with an empty enemy.
  ['ai-flush-level-army-fixture', (seed) => createAiFlushBufferFixture(seed, { age: 'feudal-age', wood: 50, farms: 7, villagers: 24, soldiers: 5 })],
  ['ai-flush-ahead-of-age-fixture', (seed) => createAiFlushBufferFixture(seed, {
    age: 'feudal-age', enemyAge: 'dark-age', wood: 50, farms: 7, villagers: 24, soldiers: 5,
  })],
  ['ai-flush-siege-workshop-fixture', (seed) => createAiFlushBufferFixture(seed, { age: 'castle-age', wood: 150, farms: 2, villagers: 4 })],
  ['ai-flush-siege-workshop-standing-fixture', (seed) => createAiFlushBufferFixture(seed, {
    age: 'castle-age', wood: 150, farms: 2, villagers: 4, siegeWorkshop: 'complete',
  })],
  ['ai-flush-siege-workshop-foundation-fixture', (seed) => createAiFlushBufferFixture(seed, {
    age: 'castle-age', wood: 150, farms: 2, villagers: 4, siegeWorkshop: 'foundation',
  })],
];
