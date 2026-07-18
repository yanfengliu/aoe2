import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Civ-bonus Mongols-scout fixture (v0.1.99). Owner 1 (AI disabled) owns a lone
// Light Cavalry; the only thing that varies between the two variants is owner 1's
// civilization — Mongols (Light Cavalry + Hussars +30% HP) vs a non-Mongols
// control. A test reads the unit's maxHp via getEntityHealth and asserts the
// Mongols light cavalry is round(base × 1.3) while the control is the base
// (mirrors the Franks knight-HP twin; the civ bonus needs no research).
function createCivMongolsScoutScenario(seed: string, civilization: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        civilization,
        startingAge: 'castle-age',
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('light-cavalry', 1, 12, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}

// Mongols: the scout-line-HP civ under test.
export function createCivMongolsScoutFixture(seed: string): PrototypeScenario {
  return createCivMongolsScoutScenario(seed, 'Mongols');
}

// Control: a non-Mongols civ (no scout-line bonus). Byte-identical geometry.
export function createCivMongolsScoutControlFixture(seed: string): PrototypeScenario {
  return createCivMongolsScoutScenario(seed, 'Byzantines');
}
