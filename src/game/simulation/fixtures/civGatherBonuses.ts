import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// Civilization gathering bonuses (work 120 M4, spec §11.11): one villager of
// owner 1 beside one source of food, so a test can count what that one
// gatherer earns. Owner 1's civilization comes from the test
// (`civilizationsByOwner`) and its stockpile is pinned at zero, so every unit
// of food or wood in it was gathered here. Owner 2 sits in the far corner with
// its AI off.

const EMPTY = { food: 0, wood: 0, gold: 0, stone: 0 };

// A villager beside a berry bush, two cells from its Town Center: the
// Portuguese forager's wood.
export function createCivForagerFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingResources: EMPTY, disableAi: true },
      { owner: 2, townCenter: { x: 50, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 12 }),
      ownedSpawn('villager', 1, 9, 6, { vision: 4 }),
      // More food than the longest test takes, so the bush never runs out.
      gaiaSpawn('berry-bush', 10, 6, { amount: 400 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}

// A villager beside a finished Farm, and no building of owner 1's that takes
// food: no Town Center, no Mill. The Khmer farmer needs neither; anyone else's
// farmer fills its hands and has nowhere to put the food. `civ-farmer-fixture`
// has no wood, so the Farm is never reseeded; `civ-farmer-reseed-fixture`
// seeds it nearly empty with the 60 wood of one reseed.
export function createCivFarmerFixture(seed: string): PrototypeScenario {
  const reseed = seed === 'civ-farmer-reseed-fixture';
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 18, y: 10 },
        startingResources: reseed ? { ...EMPTY, wood: 60 } : EMPTY,
        disableAi: true,
      },
      { owner: 2, townCenter: { x: 50, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('farm', 1, 20, 12, reseed ? { vision: 4, farmFood: 6 } : { vision: 4 }),
      ownedSpawn('villager', 1, 19, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}
