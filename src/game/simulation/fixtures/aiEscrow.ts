import { MAP_HEIGHT, MAP_WIDTH, type PrototypeScenario, type ScenarioSpawnSpec } from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// Work 141 M2a: what the computer holds back from its army so that a purchase
// DE's escrow flags can form (`aiEscrow.ts`). Owner 2 is the AI; owner 1 is a
// Town Center with its AI off, far away. The map has nothing to gather, four
// Houses leave room, so no House is wanted, and 1,000 wood means the build
// order (a Mill, say) cannot take the soldiers' wood and hide the race.

const houses = (): ScenarioSpawnSpec[] => [
  ownedSpawn('house', 2, 40, 18, { vision: 3 }),
  ownedSpawn('house', 2, 43, 18, { vision: 3 }),
  ownedSpawn('house', 2, 40, 27, { vision: 3 }),
  ownedSpawn('house', 2, 43, 27, { vision: 3 }),
];
const villagers = (): ScenarioSpawnSpec[] => [
  ownedSpawn('villager', 2, 40, 24, { vision: 4 }),
  ownedSpawn('villager', 2, 41, 24, { vision: 4 }),
  ownedSpawn('villager', 2, 42, 24, { vision: 4 }),
];

export interface MonkFixtureOptions {
  /** Relics lying on the map: DE flags the Monk from two (escrow.per 3075-3083). */
  relics: number;
  /** Owner 1 owns a Monastery: DE's other first Monk (units.per 4216-4224), first claim and nothing held. */
  enemyMonastery?: boolean;
  food?: number;
  gold?: number;
  /** A Siege Workshop beside the Monastery: two Castle Age buildings, so the Imperial Age is available. */
  siegeWorkshop?: boolean;
}

/**
 * The first Monk. Owner 2 is a Castle Age AI with an idle Monastery, Archery
 * Range and Barracks, three villagers (so a villager is due, and 50 food is
 * kept for it), 1,000 wood, and 200 food and 100 gold unless set. With 100 gold
 * it can pay for one Monk, or one Archer (25 wood, 45 gold; the Crossbowman the
 * Castle Age mix names, at the tier this owner has) with 55 left; its army loop
 * runs before its Monk loop, so without the escrow the Archer takes the gold.
 * The Barracks' Spearman (35 food, 25 wood) costs no gold, so a gold hold must
 * not stop it.
 */
export function createAiEscrowMonkFixture(seed: string, options: MonkFixtureOptions): PrototypeScenario {
  const relicSpawns: ScenarioSpawnSpec[] = [];
  for (let i = 0; i < options.relics; i += 1) relicSpawns.push(gaiaSpawn('relic', 12 + i * 3, 32));
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'castle-age', disableAi: true },
      {
        owner: 2,
        townCenter: { x: 34, y: 20 },
        startingAge: 'castle-age',
        startingResources: { food: options.food ?? 200, wood: 1000, gold: options.gold ?? 100, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ...(options.enemyMonastery ? [ownedSpawn('monastery', 1, 10, 4, { vision: 5 })] : []),
      ownedSpawn('town-center', 2, 34, 20, { vision: 7 }),
      ownedSpawn('monastery', 2, 22, 14, { vision: 5 }),
      ownedSpawn('archery-range', 2, 28, 24, { vision: 5 }),
      ownedSpawn('barracks', 2, 22, 24, { vision: 5 }),
      ...(options.siegeWorkshop ? [ownedSpawn('siege-workshop', 2, 28, 14, { vision: 5 })] : []),
      ...houses(),
      ...villagers(),
      ...relicSpawns,
    ],
  };
}

export interface ConscriptionFixtureOptions {
  food: number;
  gold: number;
  /** Owner 2 also has a Monastery, and owner 1 one too (a first-claim Monk is due). */
  monastery?: boolean;
  /** Owner 2 also has a Siege Workshop: a second gold-buying producer, its Ram 160 wood and 75 gold. */
  siegeWorkshop?: boolean;
  /** Owner 2 also has a Barracks: its Spearman costs food, which the next villager is owed. */
  barracks?: boolean;
  /** Owner 2 also has a Market: the Imperial Market trades toward what is held. */
  market?: boolean;
  /** Owner 2's wood, 1,000 unless set. */
  wood?: number;
  /** Owner 1 also has a Market, so owner 2 has a far end to trade with and trains Trade Carts. */
  enemyMarket?: boolean;
  /** Owner 3, with its AI off and an empty purse, is owner 2's ally, so owner 2 may send it tribute. */
  ally?: boolean;
  /** Owner 2 also has a Stable: its light cavalry and its technologies cost food. */
  stable?: boolean;
  /** Owner 1 has three villagers, so Spies (200 gold for each) is beyond owner 2's purse. */
  enemyVillagers?: boolean;
}

/**
 * Conscription. Owner 2 is an Imperial AI with a Castle and an idle Archery
 * Range and no upgrades, three villagers (a villager is due), 1,000 wood and the
 * given food and gold. DE flags Conscription (150 food, 150 gold) once the
 * Imperial Age has a Castle (escrow.per 3201-3214), and the army may not spend
 * what is held.
 */
export function createAiEscrowConscriptionFixture(seed: string, options: ConscriptionFixtureOptions): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'imperial-age', disableAi: true, ...(options.ally ? { team: 1 } : {}) },
      {
        owner: 2,
        townCenter: { x: 34, y: 20 },
        startingAge: 'imperial-age',
        startingResources: { food: options.food, wood: options.wood ?? 1000, gold: options.gold, stone: 0 },
        ...(options.ally ? { team: 2 } : {}),
      },
      ...(options.ally ? [{
        owner: 3, townCenter: { x: 52, y: 6 }, startingAge: 'imperial-age' as const, disableAi: true, team: 2,
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      }] : []),
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ...(options.monastery ? [ownedSpawn('monastery', 1, 10, 4, { vision: 5 })] : []),
      ...(options.enemyMarket ? [ownedSpawn('market', 1, 4, 12, { vision: 5 })] : []),
      ...(options.ally ? [ownedSpawn('town-center', 3, 52, 6, { vision: 7 })] : []),
      ...(options.enemyVillagers ? [0, 1, 2].map((i) => ownedSpawn('villager', 1, 9 + i, 9, { vision: 3 })) : []),
      ...(options.stable ? [ownedSpawn('stable', 2, 46, 12, { vision: 5 })] : []),
      ownedSpawn('town-center', 2, 34, 20, { vision: 7 }),
      ownedSpawn('castle', 2, 22, 12, { vision: 11 }),
      ownedSpawn('archery-range', 2, 28, 24, { vision: 5 }),
      ...(options.monastery ? [ownedSpawn('monastery', 2, 22, 24, { vision: 5 })] : []),
      ...(options.siegeWorkshop ? [ownedSpawn('siege-workshop', 2, 16, 24, { vision: 5 })] : []),
      ...(options.barracks ? [ownedSpawn('barracks', 2, 16, 14, { vision: 5 })] : []),
      ...(options.market ? [ownedSpawn('market', 2, 48, 22, { vision: 5 })] : []),
      ...houses(),
      ...villagers(),
    ],
  };
}

/** Work 141's escrow cases, by seed (`tests/simulation/aiEscrow.test.ts`). */
export const AI_ESCROW_SCENARIOS: ReadonlyArray<readonly [string, (seed: string) => PrototypeScenario]> = [
  ['ai-escrow-monk-fixture', (seed) => createAiEscrowMonkFixture(seed, { relics: 2 })],
  ['ai-escrow-monk-one-relic-fixture', (seed) => createAiEscrowMonkFixture(seed, { relics: 1 })],
  ['ai-escrow-monk-enemy-monastery-fixture', (seed) => createAiEscrowMonkFixture(seed, { relics: 0, enemyMonastery: true })],
  ['ai-escrow-monk-short-gold-fixture', (seed) => createAiEscrowMonkFixture(seed, { relics: 2, gold: 50 })],
  ['ai-escrow-monk-age-up-fixture', (seed) => createAiEscrowMonkFixture(seed, { relics: 2, food: 1050, gold: 850, siegeWorkshop: true })],
  ['ai-escrow-monk-age-up-spend-fixture', (seed) => createAiEscrowMonkFixture(seed, { relics: 2, food: 1050, gold: 900, siegeWorkshop: true })],
  ['ai-escrow-monk-latch-fixture', (seed) => createAiEscrowMonkFixture(seed, { relics: 2, food: 700, gold: 600 })],
  ['ai-escrow-conscription-fixture', (seed) => createAiEscrowConscriptionFixture(seed, { food: 100, gold: 100 })],
  ['ai-escrow-conscription-queued-fixture', (seed) => createAiEscrowConscriptionFixture(seed, { food: 300, gold: 250 })],
  ['ai-escrow-held-monk-fixture', (seed) => createAiEscrowConscriptionFixture(seed, { food: 100, gold: 200, monastery: true })],
  ['ai-escrow-spend-fixture', (seed) => createAiEscrowConscriptionFixture(seed, { food: 100, gold: 260, siegeWorkshop: true })],
  ['ai-escrow-villager-fixture', (seed) => createAiEscrowConscriptionFixture(seed, { food: 200, gold: 150, barracks: true })],
  ['ai-escrow-market-fixture', (seed) => createAiEscrowConscriptionFixture(seed, { food: 100, wood: 0, gold: 400, monastery: true, market: true })],
  ['ai-escrow-market-guard-fixture', (seed) => createAiEscrowConscriptionFixture(seed, { food: 100, wood: 0, gold: 350, monastery: true, market: true })],
  ['ai-escrow-trade-cart-fixture', (seed) => createAiEscrowConscriptionFixture(seed, { food: 100, wood: 400, gold: 200, market: true, enemyMarket: true })],
  ['ai-escrow-income-fixture', (seed) => createAiEscrowConscriptionFixture(seed, {
    food: 0, wood: 0, gold: 350, market: true, enemyVillagers: true,
  })],
  ['ai-escrow-tribute-fixture', (seed) => createAiEscrowConscriptionFixture(seed, {
    food: 1000, wood: 3000, gold: 100, market: true, ally: true, barracks: true, stable: true,
  })],
];
