import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../../common';
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
        civilization: 'Saracens', // bonus-neutral for these stats (Byzantines gained free vision techs in v0.3.146)
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('pikeman', 1, 14, 17, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('knight', 2, 15, 17, { vision: 4 }),
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
        civilization: 'Saracens', // bonus-neutral for these stats (Byzantines gained free vision techs in v0.3.146)
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('camel', 1, 14, 17, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('hussar', 2, 15, 17, { vision: 11 }),
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
        civilization: 'Saracens', // bonus-neutral for these stats (Byzantines gained free vision techs in v0.3.146)
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('halberdier', 1, 14, 17, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('cavalier', 2, 15, 17, { vision: 4 }),
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
        civilization: 'Saracens', // bonus-neutral for these stats (Byzantines gained free vision techs in v0.3.146)
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('halberdier', 1, 14, 17, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('knight', 2, 15, 17, { vision: 4 }),
    ],
  };
}

// Castle-Age combat fixture: a player-1 Camel stationed next to an enemy
// (player 2) Knight and Scout, used to assert the Camel's +10 anti-cavalry
// bonus without pursuit / pathing noise. All three units start in Castle
// Age and adjacent, so the Camel can hit on tick 1.
