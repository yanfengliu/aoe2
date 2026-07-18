import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Civ-bonus Goths-infantry fixture (v0.1.83). Player 1 (AI disabled) owns a
// Militia at (13, 8) adjacent to an enemy (owner 2) House at (14, 8). The only
// thing that varies between the two variants is owner 1's civilization — Goths
// (infantry +1 vs buildings) vs a non-Goths control — so a twin race isolates
// the bonus (mirrors the Sappers baseline-vs-researched raze twins, but the civ
// bonus needs no research). A test drives the Militia onto the House and
// compares building HP after a fixed attack window.
function createCivGothsInfantryScenario(seed: string, civilization: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 20 },
        startingAge: 'imperial-age',
        civilization,
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 24 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 20, { vision: 7 }),
      ownedSpawn('militia', 1, 13, 8, { vision: 6 }),
      ownedSpawn('house', 2, 14, 8),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}

// Goths: the infantry +1-vs-buildings civ under test.
export function createCivGothsInfantryFixture(seed: string): PrototypeScenario {
  return createCivGothsInfantryScenario(seed, 'Goths');
}

// Control: a non-Goths civ (no infantry-vs-buildings bonus). Byte-identical.
export function createCivGothsInfantryControlFixture(seed: string): PrototypeScenario {
  return createCivGothsInfantryScenario(seed, 'Persians');
}
