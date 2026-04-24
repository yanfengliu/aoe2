import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../../common';

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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: 4,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'longbowman',
        x: 10,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'imperial-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 14,
        y: 14,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 11 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'castle',
        x: 34,
        y: 14,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 11 },
      },
    ],
  };
}
