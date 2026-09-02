import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';
import { gateWallLine } from './gates';

// A villager converted beside its own side's gate.
//
// Player 2 walls the map in two at x=20 with a Gate at (20,12); its villager
// stands INSIDE the wall at (19,12), one cell west of the gate, and its berries
// stand OUTSIDE at (23,12), so the villager's route to them runs through the
// gate. Player 1's monk waits outside at (22,12), within conversion range.
// Once the villager is player 1's, that gate is an enemy gate: a route through
// it that was remembered while the villager still belonged to player 2 must
// not be replayed (review C1 — the approach-plan cache keys on nothing that a
// monk conversion changes, so the bridge announces the flip as a passability
// change instead).
export function createConvertedUnitGateFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 50, y: 30 },
        startingAge: 'castle-age',
        disableAi: true,
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
      {
        owner: 2,
        townCenter: { x: 6, y: 12 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 50, 30, { vision: 7 }),
      ownedSpawn('town-center', 2, 6, 12, { vision: 8 }),
      // The villager, inside its own wall, one cell from its own gate.
      ownedSpawn('villager', 2, 19, 12, { vision: 4 }),
      // Its food, outside the wall: the only route is the gate.
      gaiaSpawn('berry-bush', 23, 12, { baseOwner: 2, amount: 400 }),
      // The converter, outside the wall and within conversion range (9) of
      // the villager; its vision is what lets its owner see the villager.
      ownedSpawn('monk', 1, 22, 12, { vision: 9 }),
      ...gateWallLine('seeded-gate', 2),
    ],
  };
}
