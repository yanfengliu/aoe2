// Fixture for SHIFT-QUEUED ENTITY ORDERS (spec §9.3, v0.3.141): a villager
// beside two nearly-empty berry bushes (so a gather chain's first leg
// exhausts inside a short test), a mill to bank into, an archer, and two
// PASSIVE enemy militia (disableAi) for an attack chain. Everything sits a
// few cells apart so walking never dominates the test budget.

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

export function createQueuedOrdersFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 6 },
        startingAge: 'feudal-age',
        startingResources: { food: 500, wood: 300, gold: 200, stone: 100 },
      },
      {
        owner: 2,
        townCenter: { x: 30, y: 6 },
        startingAge: 'feudal-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 7 }),
      ownedSpawn('mill', 1, 10, 10),
      ownedSpawn('villager', 1, 12, 12, { vision: 5 }),
      // A second villager for the co-gatherer race: whoever lands the last
      // swing, the other's queued chain must still fire.
      ownedSpawn('villager', 1, 14, 13, { vision: 5 }),
      // Two tiny bushes: the first exhausts after a handful of carries.
      gaiaSpawn('berry-bush', 13, 12, { amount: 20 }),
      gaiaSpawn('berry-bush', 15, 12, { amount: 200 }),
      // A TREE for the chain test: queueing it must beat the same-type
      // auto-rotate that would otherwise walk the villager to the second bush.
      gaiaSpawn('tree', 12, 14, { amount: 150 }),
      // A FAR tree for the co-gatherer regression: idle auto-assign is
      // nearest-first, so only a fired CHAIN ever walks out here.
      gaiaSpawn('tree', 20, 14, { amount: 150 }),
      ownedSpawn('archer', 1, 12, 18, { vision: 6 }),
      ownedSpawn('town-center', 2, 30, 6, { vision: 7 }),
      // Passive victims for the attack chain. The FIRST is in the archer's
      // reach; the SECOND is far outside its vision, so only a QUEUED order
      // marches there — auto-aggression alone can never produce that kill
      // (the first red-check of this suite passed exactly that way).
      ownedSpawn('militia', 2, 14, 19, { vision: 4 }),
      ownedSpawn('militia', 2, 26, 19, { vision: 4 }),
      // Friendly eyes over the far militia so the click is issuable at all.
      ownedSpawn('outpost', 1, 24, 17),
    ],
  };
}
