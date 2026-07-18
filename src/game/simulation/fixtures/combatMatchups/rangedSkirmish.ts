import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

// Castle-Age ranged combat fixture: a player-1 Cavalry Archer stationed
// exactly 4 tiles (its attack range) away from a stationary enemy Militia.
// Used to assert the Cavalry Archer fires at range without closing.
export function createCavalryArcherRangedFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('cavalry-archer', 1, 12, 17, { vision: 5 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('militia', 2, 16, 17, { vision: 3 }),
    ],
  };
}

// Castle-Age ranged combat fixture: a player-1 Skirmisher stationed adjacent to
// a stationary enemy Cavalry Archer. Used to assert the Skirmisher's +4
// anti-archer bonus extends to Cavalry Archer (Cavalry Archer is in the
// archer family).
export function createSkirmisherVsCavalryArcherFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('skirmisher', 1, 14, 17, { vision: 5 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('cavalry-archer', 2, 15, 17, { vision: 5 }),
    ],
  };
}
