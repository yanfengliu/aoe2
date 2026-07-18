import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from './common';

// Civ-bonus shepherd fixture (v0.1.81). Owner 1 (AI disabled) has a lone
// villager next to a neutral sheep it claims by proximity, with its Town
// Center drop-off nearby. The ONLY thing that varies between the two registered
// variants is owner 1's civilization — Britons (the +25% sheep-gather bonus)
// vs a non-Britons control — so a twin race isolates the civ bonus exactly
// (mirrors the Husbandry baseline-vs-researched movement twins). A test commands
// the villager onto the sheep and compares total sheep-food harvested.
function createCivShepherdScenario(seed: string, civilization: string): PrototypeScenario {
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
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
        disableAi: true,
      },
    ],
    spawns: [
      // Wide vision so the sheep is selectable/commandable from the test.
      ownedSpawn('town-center', 1, 4, 4, { vision: 50 }),
      // Villager + sheep sit right next to the Town Center drop-off so the
      // deposit walk is tiny and per-load time is gather-dominated — this
      // keeps the +25% gather bonus from being diluted by fixed walk time.
      ownedSpawn('villager', 1, 9, 6, { vision: 4 }),
      // Large stock so neither villager exhausts it inside the race window
      // (equal exhaustion would erase the rate difference). Just east of the
      // 4×4 Town Center footprint (x 4..7) so the deposit walk stays tiny.
      gaiaSpawn('sheep', 10, 6, { amount: 400 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}

// Britons: the shepherd (+25% sheep gather) civ under test.
export function createCivShepherdBritonsFixture(seed: string): PrototypeScenario {
  return createCivShepherdScenario(seed, 'Britons');
}

// Control: a non-Britons civ (no sheep bonus). Byte-identical geometry.
export function createCivShepherdControlFixture(seed: string): PrototypeScenario {
  return createCivShepherdScenario(seed, 'Franks');
}
