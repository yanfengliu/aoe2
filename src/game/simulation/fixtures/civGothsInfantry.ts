import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

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
      {
        kind: 'town-center',
        x: 4,
        y: 20,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'militia',
        x: 13,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'house',
        x: 14,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 24,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
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
