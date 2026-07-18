import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Civ-bonus Franks-knight fixture (v0.1.82). Owner 1 (AI disabled) owns a lone
// Knight; the only thing that varies between the two variants is owner 1's
// civilization — Franks (Knights +20% HP) vs a non-Franks control. A test reads
// the knight's maxHp via getEntityHealth and asserts the Franks knight is
// round(base × 1.2) while the control is the base (mirrors the Bloodlines
// baseline-vs-researched HP twins, but the civ bonus needs no research).
function createCivFranksKnightScenario(seed: string, civilization: string): PrototypeScenario {
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
      ownedSpawn('knight', 1, 12, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}

// Franks: the Knight-HP civ under test.
export function createCivFranksKnightFixture(seed: string): PrototypeScenario {
  return createCivFranksKnightScenario(seed, 'Franks');
}

// Control: a non-Franks civ (no knight bonus). Byte-identical geometry.
export function createCivFranksKnightControlFixture(seed: string): PrototypeScenario {
  return createCivFranksKnightScenario(seed, 'Byzantines');
}
