import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../../common';
// Slice 7B combat fixture: player-1 Pikeman adjacent to a player-2 Knight.
// Used to compare damage-per-hit against the Halberdier-vs-Knight fixture
// so the Halberdier anti-cavalry bonus must exceed the Pikeman's.
export function createPikemanVsKnightFixture(seed: string): PrototypeScenario {
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
        // Bonus-free civ so anti-cavalry DAMAGE tests measure raw HP deltas,
        // not the Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Byzantines',
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
        kind: 'pikeman',
        x: 14,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'knight',
        x: 15,
        y: 17,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Slice 7C combat fixture: player-1 Camel adjacent to a player-2 Hussar.
// Verifies that the Camel anti-cavalry bonus fires against the Hussar
// (Imperial successor of the Light Cavalry line) via the `cavalry` armor class.
export function createCamelVsHussarFixture(seed: string): PrototypeScenario {
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
        // Bonus-free civ so anti-cavalry DAMAGE tests measure raw HP deltas,
        // not the Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Byzantines',
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
        kind: 'camel',
        x: 14,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'hussar',
        x: 15,
        y: 17,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 11 },
      },
    ],
  };
}

// Slice 7C combat fixture: player-1 Halberdier adjacent to a player-2
// Cavalier. Verifies the Halberdier +32 anti-cavalry bonus fires against
// the Cavalier (Imperial successor of the Knight line) via the `cavalry` class.
export function createHalberdierVsCavalierFixture(seed: string): PrototypeScenario {
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
        // Bonus-free civ so anti-cavalry DAMAGE tests measure raw HP deltas,
        // not the Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Byzantines',
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
        kind: 'halberdier',
        x: 14,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'cavalier',
        x: 15,
        y: 17,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Slice 7B combat fixture: mirror of pikeman-vs-knight-fixture with a
// Halberdier in place of the Pikeman.
export function createHalberdierVsKnightFixture(seed: string): PrototypeScenario {
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
        // Bonus-free civ so anti-cavalry DAMAGE tests measure raw HP deltas,
        // not the Franks knight-line +20% HP (owner 2 defaults to Franks).
        civilization: 'Byzantines',
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
        kind: 'halberdier',
        x: 14,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'knight',
        x: 15,
        y: 17,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Castle-Age combat fixture: a player-1 Camel stationed next to an enemy
// (player 2) Knight and Scout, used to assert the Camel's +10 anti-cavalry
// bonus without pursuit / pathing noise. All three units start in Castle
// Age and adjacent, so the Camel can hit on tick 1.
