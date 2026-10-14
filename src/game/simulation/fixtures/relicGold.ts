import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

/** Where each owner's relics stand in `relic-gold-fixture`, for the tests that
 *  count their gold. Owner 1 keeps three relics in two Monasteries. */
export const RELIC_GOLD_FIXTURE_MONASTERIES = [
  { owner: 1, x: 14, y: 4, relics: 2 },
  { owner: 1, x: 14, y: 10, relics: 1 },
  { owner: 2, x: 50, y: 10, relics: 1 },
] as const;

/**
 * Relic income (work 127): three sides and nothing that moves. Owner 1 keeps
 * two relics in one Monastery and one in another; owner 2 keeps one; owner 3
 * holds only a Town Center, so a test can make it the Aztec ally of owner 1
 * through `teamsByOwner` and `civilizationsByOwner`. Every seat is inert and
 * nobody has a villager, so the only gold anyone earns is relic gold. A fourth
 * relic stands loose on the map, so no side holds every relic and the relic
 * victory clock never starts.
 */
export function createRelicGoldFixture(seed: string): PrototypeScenario {
  const towns = [
    { owner: 1, x: 6, y: 6 },
    { owner: 2, x: 44, y: 4 },
    { owner: 3, x: 26, y: 26 },
  ] as const;
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: towns.map((town) => ({
      owner: town.owner,
      townCenter: { x: town.x, y: town.y },
      startingAge: 'castle-age' as const,
      startingResources: { food: 200, wood: 200, gold: 0, stone: 200 },
      disableAi: true,
    })),
    spawns: [
      ...towns.map((town) => ownedSpawn('town-center', town.owner, town.x, town.y, { vision: 7 })),
      ...RELIC_GOLD_FIXTURE_MONASTERIES.map((monastery) => ownedSpawn(
        'monastery',
        monastery.owner,
        monastery.x,
        monastery.y,
        { vision: 6, startingRelicsInMonastery: monastery.relics },
      )),
      gaiaSpawn('relic', 30, 16, { amount: 0 }),
    ],
  };
}
