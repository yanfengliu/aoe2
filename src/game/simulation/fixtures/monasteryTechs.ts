import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from './common';

// Block Printing (v0.1.58): +2 monk CONVERSION range. Discriminator fixture —
// a player-1 Monk BOXED by trees at (10,10) so it cannot walk closer, with an
// enemy villager at (15,10), Manhattan distance 5. The base monk action range
// is 4, so the boxed monk can never reach convert range (5 > 4) and the villager
// is never converted. With Block Printing researched the range is 6 (5 ≤ 6), so
// the boxed monk converts it in place. The test seeds the convert task directly
// (initialMonkTasks) so no auto-search/vision is involved. `researched` seeds
// the owner's Block Printing so the same layout tests both sides.
function createBlockPrintingScenario(seed: string, researched: boolean): PrototypeScenario {
  const monk = { x: 10, y: 10 };
  const ring: ReadonlyArray<readonly [number, number]> = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
        ...(researched ? { startingResearchedTechnologies: ['block-printing' as const] } : {}),
      },
      { owner: 2, townCenter: { x: 40, y: 30 }, startingAge: 'castle-age', disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 20 }),
      ownedSpawn('monk', 1, monk.x, monk.y, { vision: 12 }),
      // Trees boxing the monk so moveUnitOneSubgridStep can never advance it.
      ...ring.map(([dx, dy]) => (gaiaSpawn('tree' as const, monk.x + dx, monk.y + dy, { amount: 100 }))),
      // Enemy villager at Manhattan distance 5 (idle, no resource nearby so it
      // stays put; villagers don't auto-aggress). Convertible target.
      ownedSpawn('villager', 2, 15, 10, { vision: 3 }),
      ownedSpawn('town-center', 2, 40, 30, { vision: 7 }),
    ],
  };
}

export function createMonkBlockPrintingBaselineFixture(seed: string): PrototypeScenario {
  return createBlockPrintingScenario(seed, false);
}

export function createMonkBlockPrintingFixture(seed: string): PrototypeScenario {
  return createBlockPrintingScenario(seed, true);
}

// Sanctity (+15 monk HP): a lone player-1 monk. `researched` pre-seeds Sanctity
// so the spawned monk is built through createCombatState WITH the tech (the
// create path), letting the test compare its max HP to the un-teched baseline.
function createSanctityScenario(seed: string, researched: boolean): PrototypeScenario {
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
        ...(researched ? { startingResearchedTechnologies: ['sanctity' as const] } : {}),
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 12 }),
      ownedSpawn('monk', 1, 14, 14, { vision: 9 }),
    ],
  };
}

export function createMonkSanctityBaselineFixture(seed: string): PrototypeScenario {
  return createSanctityScenario(seed, false);
}

export function createMonkSanctityFixture(seed: string): PrototypeScenario {
  return createSanctityScenario(seed, true);
}

// Faith (conversion RESISTANCE): a player-1 Monk adjacent to a player-2 enemy
// villager (Manhattan distance 1, well inside the base action range 4, so the
// Monk converts in place with no movement). `defenderHasFaith` pre-seeds Faith
// on PLAYER 2 (the TARGET's owner) — with Faith, the villager accrues
// conversion progress at half rate, so it does NOT flip within the window a
// baseline villager does. The test seeds the convert task (initialMonkTasks).
function createFaithScenario(seed: string, defenderHasFaith: boolean): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 6, y: 6 }, startingAge: 'imperial-age', disableAi: true },
      {
        owner: 2,
        townCenter: { x: 40, y: 30 },
        startingAge: 'imperial-age',
        disableAi: true,
        ...(defenderHasFaith ? { startingResearchedTechnologies: ['faith' as const] } : {}),
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 20 }),
      ownedSpawn('monk', 1, 14, 14, { vision: 10 }),
      ownedSpawn('villager', 2, 15, 14, { vision: 3 }),
      ownedSpawn('town-center', 2, 40, 30, { vision: 7 }),
    ],
  };
}

export function createMonkFaithBaselineFixture(seed: string): PrototypeScenario {
  return createFaithScenario(seed, false);
}

export function createMonkFaithDefendedFixture(seed: string): PrototypeScenario {
  return createFaithScenario(seed, true);
}
