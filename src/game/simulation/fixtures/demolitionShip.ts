import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

const BAY = { minX: 14, maxX: 30, minY: 4, maxY: 20 } as const;

function bayTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = BAY.minY; y <= BAY.maxY; y += 1) {
    for (let x = BAY.minX; x <= BAY.maxX; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

/**
 * One demolition ship and a small enemy fleet, close enough to reach.
 *
 * units.csv says the demolition line "self-destructs when used", which is the
 * whole shape of the unit: a floating bomb with the widest blast in the game,
 * spent in one use. A demolition ship that survives its own blast is a
 * repeating area weapon instead, so this fixture exists to tell the two apart —
 * order the detonation and count what is left afterwards.
 */
export function createDemolitionShipFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: bayTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 6, y: 8 }, startingAge: 'castle-age', disableAi: true },
      { owner: 2, townCenter: { x: 40, y: 24 }, startingAge: 'castle-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 8, { vision: 12 }),
      ownedSpawn('demolition-ship', 1, 16, 10, { vision: 8 }),
      // Two enemy galleys side by side: the blast radius is 2.5, so a
      // detonation on one should reach the other.
      ownedSpawn('galley', 2, 19, 10, { vision: 7 }),
      ownedSpawn('galley', 2, 20, 10, { vision: 7 }),
      // An enemy Dock on the bay's north shore, seven cells from the ship: a
      // demolition ship's other target, and inside its vision of 8, because an
      // order on a building nobody can see is refused — correctly.
      ownedSpawn('dock', 2, 17, 3, { vision: 6 }),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}
