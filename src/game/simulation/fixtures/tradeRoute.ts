import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

/**
 * Two Markets a real walk apart, and a Trade Cart standing by the near one.
 *
 * Land trade (spec §6.7) is a CYCLE — out to the far Market, back to your own,
 * gold on every return — so the fixture holds everything constant except the
 * route: both players passive, no other units, the Markets ~30 tiles apart so
 * a round trip is long enough to measure and short enough to run twice.
 */
export function createTradeRouteFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
        disableAi: true,
        startingResources: { food: 1000, wood: 500, gold: 500, stone: 200 },
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 26 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('market', 1, 14, 8, { vision: 6 }),
      ownedSpawn('trade-cart', 1, 18, 10, { vision: 7 }),
      // The scout report: an Outpost by the far Market, so the human can SEE
      // the building the order needs a click on — orders at unseen entities
      // are refused, which is the fog contract working.
      ownedSpawn('outpost', 1, 40, 22, { vision: 8 }),
      ownedSpawn('town-center', 2, 48, 26, { vision: 7 }),
      ownedSpawn('market', 2, 44, 24, { vision: 6 }),
    ],
  };
}
