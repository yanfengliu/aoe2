import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Redemption's building half (spec section 12, v0.3.100): a monk with the
// technology converts an enemy HOUSE across the conversion range; the enemy
// TOWN CENTER beside it stays forever out of reach (the never-convertible
// list). The baseline variant researches nothing, so the same click walks.
function createScenario(seed: string, redeemed: boolean): PrototypeScenario {
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
        ...(redeemed ? { startingResearchedTechnologies: ['redemption' as const] } : {}),
      },
      { owner: 2, townCenter: { x: 40, y: 16 }, startingAge: 'castle-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('monk', 1, 14, 16, { vision: 12 }),
      // Enemy house at manhattan 8 from the monk - inside conversion range 9.
      ownedSpawn('house', 2, 22, 16),
      ownedSpawn('watch-tower', 2, 26, 12),
      ownedSpawn('town-center', 2, 40, 16, { vision: 7 }),
    ],
  };
}

export function createRedemptionBuildingsFixture(seed: string): PrototypeScenario {
  return createScenario(seed, true);
}

export function createRedemptionBuildingsBaselineFixture(seed: string): PrototypeScenario {
  return createScenario(seed, false);
}
