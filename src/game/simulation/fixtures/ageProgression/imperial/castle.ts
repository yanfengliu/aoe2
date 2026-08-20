import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../../common';

// Slice 7C fixture: Britons human with a completed Castle, a Blacksmith,
// a pre-existing Longbowman, and generous resources. Used to verify that
// the Elite Longbowman research option is exposed and that the upgrade
// mutates the existing Longbowman in place and swaps the train menu.
export function createImperialCastleBritonsFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
        startingResources: {
          food: 2000,
          wood: 500,
          gold: 2000,
          stone: 400,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'imperial-age',
        civilization: 'Franks',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      ownedSpawn('blacksmith', 1, 4, 6),
      ownedSpawn('longbowman', 1, 10, 12, { vision: 7 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}

// Slice 7C fixture: non-Britons (Franks) human in Imperial Age with a
// Castle. Used to verify that a non-Britons owner never sees the
// elite-longbowman-upgrade research option (the gate is civilization-
// specific, matching the Slice 6 Longbowman training gate).
export function createImperialCastleFranksFixture(seed: string): PrototypeScenario {
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
        civilization: 'Franks',
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 400,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'imperial-age',
        civilization: 'Britons',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}

// Slice 7D fixture: player-1 Castle in Imperial Age to test the Trebuchet
// train menu. Britons and non-Britons players each have a Castle so both
// trees can be asserted separately.
export function createImperialCastleFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
        // Enough to actually BUY an Imperial Castle technology; the elite
        // unique-unit upgrades run to 1600 food + 1200 gold.
        startingResources: {
          food: 3000,
          wood: 1500,
          gold: 2500,
          stone: 800,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'imperial-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 14, { vision: 11 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
      ownedSpawn('castle', 2, 34, 14, { vision: 11 }),
    ],
  };
}
