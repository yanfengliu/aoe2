import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

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
      { kind: 'town-center', x: 4, y: 4, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 20 } },
      {
        kind: 'monk',
        x: monk.x,
        y: monk.y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 12 },
      },
      // Trees boxing the monk so moveUnitOneSubgridStep can never advance it.
      ...ring.map(([dx, dy]) => ({
        kind: 'tree' as const,
        x: monk.x + dx,
        y: monk.y + dy,
        owner: null,
        baseOwner: null,
        amount: 100,
      })),
      // Enemy villager at Manhattan distance 5 (idle, no resource nearby so it
      // stays put; villagers don't auto-aggress). Convertible target.
      {
        kind: 'villager',
        x: 15,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      { kind: 'town-center', x: 40, y: 30, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
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
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 12 } },
      { kind: 'monk', x: 14, y: 14, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 9 } },
    ],
  };
}

export function createMonkSanctityBaselineFixture(seed: string): PrototypeScenario {
  return createSanctityScenario(seed, false);
}

export function createMonkSanctityFixture(seed: string): PrototypeScenario {
  return createSanctityScenario(seed, true);
}
