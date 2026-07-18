import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Civ-bonus Goths-cost fixture (v0.1.86). Player 1 (AI disabled) is in the
// Feudal Age with a Barracks and EXACTLY enough resources to train a Militia at
// the Goths-discounted price (39 food / 13 gold) but NOT at the base price
// (60 food / 20 gold): 50 food / 15 gold. The only thing that varies between
// the two variants is owner 1's civilization — Goths (infantry −35% cost) vs a
// non-Goths control — so a twin test proves the discount is applied at BOTH the
// affordability gate (the Goths variant can queue the Militia; the control
// cannot) and the charge (the Goths variant is left with 11 food / 2 gold).
function createCivGothsCostScenario(seed: string, civilization: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'feudal-age',
        civilization,
        disableAi: true,
        startingResources: { food: 50, wood: 0, gold: 15, stone: 0 },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 24 },
        startingAge: 'feudal-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('barracks', 1, 4, 10, { vision: 6 }),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}

// Goths: the infantry-cost-discount civ under test.
export function createCivGothsCostFixture(seed: string): PrototypeScenario {
  return createCivGothsCostScenario(seed, 'Goths');
}

// Control: a non-Goths civ (no discount). Byte-identical geometry + resources.
export function createCivGothsCostControlFixture(seed: string): PrototypeScenario {
  return createCivGothsCostScenario(seed, 'Persians');
}
