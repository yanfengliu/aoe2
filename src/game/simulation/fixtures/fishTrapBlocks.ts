import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { ScenarioSpawnSpec } from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';

// A Fish Trap is a BUILDING that stands on water (`shorePlacement`'s only
// water building), so a ship can no more sail through one than a knight can
// walk through a house. `isCellPassableForUnit` short-circuited every
// water-domain unit to passable on any water cell, justified by a comment
// asserting that "water cells hold no buildings" — true when it was written
// and false since the Fish Trap shipped.
//
// The channel is one cell tall so the question cannot be dodged: a ship at the
// west end ordered to the east end must either pass THROUGH the trap row or
// not arrive at all. The open lane below it is the control — the same ship on
// the same map with no trap in the way must cross freely, which is what stops
// a fix that simply makes ships refuse water.
export const CHANNEL_ROW = 10;
export const OPEN_ROW = 12;
export const CHANNEL = { minX: 6, maxX: 26 } as const;
/** The trap sits mid-channel, so both sides of it are open water. */
export const TRAP_CELL = { x: 16, y: CHANNEL_ROW } as const;
export const SHIP_START = { x: 8, y: CHANNEL_ROW } as const;
export const SHIP_GOAL = { x: 24, y: CHANNEL_ROW } as const;
export const OPEN_SHIP_START = { x: 8, y: OPEN_ROW } as const;
export const OPEN_SHIP_GOAL = { x: 24, y: OPEN_ROW } as const;

function channelTerrain() {
  const terrain = createGrassFixtureTerrain();
  // Two separate one-cell channels: the blocked one and the open control.
  for (const row of [CHANNEL_ROW, OPEN_ROW]) {
    for (let x = CHANNEL.minX; x <= CHANNEL.maxX; x += 1) {
      terrain[row]![x] = createTerrainCell(x, row, 'water');
    }
  }
  return terrain;
}

export function createFishTrapBlocksFixture(seed: string): PrototypeScenario {
  const spawns: ScenarioSpawnSpec[] = [
    ownedSpawn('town-center', 1, 5, 4, { vision: 7 }),
    ownedSpawn('town-center', 2, 40, 28, { vision: 7 }),
    // The blocker, mid-channel.
    ownedSpawn('fish-trap', 1, TRAP_CELL.x, TRAP_CELL.y, { vision: 3 }),
    // The ship that must go around it, and the control ship in the open lane.
    ownedSpawn('fishing-ship', 1, SHIP_START.x, SHIP_START.y, { vision: 4 }),
    ownedSpawn('fishing-ship', 1, OPEN_SHIP_START.x, OPEN_SHIP_START.y, { vision: 4 }),
  ];
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: channelTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 5, y: 4 }, disableAi: true },
      { owner: 2, townCenter: { x: 40, y: 28 }, disableAi: true },
    ],
    spawns,
  };
}
