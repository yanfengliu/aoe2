import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

// Slice 4 fixture: player-1 Battering Ram next to an enemy House. Used to
// assert the Ram razes the House: DE's Ram takes 151 a hit off a Castle Age
// House (150 against the Building class, and 2 melee past its 1 melee armor;
// work 140), so the 900-HP House falls in six.
export function createRamVsBuildingFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('battering-ram', 1, 13, 8, { vision: 3 }),
      ownedSpawn('house', 2, 14, 8),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

// Slice 4 fixture: player-1 Battering Ram next to an enemy villager. Used to
// assert the Ram's attack against buildings does not reach a unit.
export function createRamVsVillagerFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('battering-ram', 1, 14, 17, { vision: 3 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('villager', 2, 15, 17, { vision: 4 }),
    ],
  };
}

// Slice 4 fixture: player-1 Pikeman next to an enemy Battering Ram. Used to
// assert the Pikeman anti-cavalry bonus does NOT fire against siege units.
export function createPikemanVsRamFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('pikeman', 1, 14, 17, { vision: 3 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('battering-ram', 2, 15, 17, { vision: 3 }),
    ],
  };
}

// Slice 4 fixture: player-1 Camel next to an enemy Battering Ram. Used to
// assert the Camel anti-cavalry bonus does NOT fire against siege units.
export function createCamelVsRamFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('camel', 1, 14, 17, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('battering-ram', 2, 15, 17, { vision: 3 }),
    ],
  };
}

// Slice 7D fixture: player-1 Siege Ram next to an enemy Town Center. Used
// to assert the Siege Ram's attack against buildings: it takes 200 a hit off
// an Imperial Town Center (200 against the Building class; its 4 melee does
// nothing against 6 melee armor; work 140), so a Town Center with a low
// startHp (200) is destroyed in a single hit. Vision is widened
// from the Ram's canonical 3 so the enemy building is visible for the
// command to resolve.
export function createSiegeRamVsBuildingFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('siege-ram', 1, 22, 8, { vision: 10 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7, startHp: 200 }),
    ],
  };
}
