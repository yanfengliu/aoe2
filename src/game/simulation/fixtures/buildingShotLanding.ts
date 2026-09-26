import type { Position } from 'civ-engine';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { BuildingType, UnitType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Where a shot at a building lands (tests/simulation/buildingShotLanding.test.ts,
// defect register "A blast landed where DE's does not", 2026-09-26): on the
// centre of the building, as in Definitive Edition, whatever its size.
//
// Owner 2 has one building of each footprint size, in a row, and a ring of
// Villagers standing on every cell around the House. Owner 1 has one of each
// kind of shooter: an Archer (an arrow), a Mangonel (a stone that blasts) and a
// Siege Onager (the widest mangonel-line blast). Every AI is off; owner 1 is
// the human, so the test sets its units to No Attack before it gives one order.

export const BUILDING_SHOT_TARGETS: ReadonlyArray<{ buildingType: BuildingType; at: Position }> = [
  { buildingType: 'outpost', at: { x: 16, y: 10 } },
  { buildingType: 'house', at: { x: 24, y: 10 } },
  { buildingType: 'barracks', at: { x: 32, y: 10 } },
  { buildingType: 'market', at: { x: 42, y: 10 } },
];

export const BUILDING_SHOT_ATTACKERS: ReadonlyArray<{ unitType: UnitType; at: Position }> = [
  { unitType: 'archer', at: { x: 30, y: 18 } },
  { unitType: 'mangonel', at: { x: 24, y: 17 } },
  { unitType: 'siege-onager', at: { x: 36, y: 18 } },
];

/** The House's own cells run east and south from its anchor; these are the
 *  twelve cells around it, every side alike. */
export function buildingShotRingAroundHouse(): Position[] {
  const house = BUILDING_SHOT_TARGETS.find((t) => t.buildingType === 'house')!.at;
  const ring: Position[] = [];
  for (let y = house.y - 1; y <= house.y + 2; y += 1) {
    for (let x = house.x - 1; x <= house.x + 2; x += 1) {
      const onHouse = x >= house.x && x <= house.x + 1 && y >= house.y && y <= house.y + 1;
      if (!onHouse) ring.push({ x, y });
    }
  }
  return ring;
}

export function createBuildingShotLandingFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'imperial-age', disableAi: true },
      { owner: 2, townCenter: { x: 4, y: 30 }, startingAge: 'imperial-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 4, 30, { vision: 7 }),
      // Vision enough to see every building: an order on a building its owner
      // cannot see is refused.
      ...BUILDING_SHOT_ATTACKERS.map((a) => ownedSpawn(a.unitType, 1, a.at.x, a.at.y, { vision: 30 })),
      ...BUILDING_SHOT_TARGETS.map((t) => ownedSpawn(t.buildingType, 2, t.at.x, t.at.y)),
      ...buildingShotRingAroundHouse().map((cell) => ownedSpawn('villager', 2, cell.x, cell.y)),
    ],
  };
}
