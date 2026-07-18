import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

export function createMilitiaCombatFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('militia', 1, 12, 8, { vision: 5 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('scout', 2, 15, 8, { vision: 6 }),
    ],
  };
}

export function createMovingEnemyAttackFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        // Player 2's AI is disabled so the wandering enemy scout
        // (driven by `prototypeScoutMovement` via `wanderBounds`) is
        // not pulled into auto-aggression on the human militia. The
        // tests on this fixture assert sub-grid wander rendering and
        // an explicit player-issued attack against the scout — both
        // depend on the scout staying on its wander path until the
        // human gives it an order.
        owner: 2,
        townCenter: { x: 24, y: 8 },
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('militia', 1, 12, 8, { vision: 5 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('scout', 2, 15, 8, {
        velocity: { dx: 1, dy: 0 },
        wanderBounds: { minX: 15, maxX: 17, minY: 8, maxY: 8 },
        vision: 6,
      }),
    ],
  };
}

// FU1 fixture: a Champion (player 1) standing next to an enemy Halberdier
// (player 2). Used to verify armor damage reduction: a Champion hitting
// an unarmored Halberdier lands base damage; with Plate Mail armor
// researched on player 2 the Halberdier takes exactly one less point
// per hit. Both players start in Imperial Age with a Blacksmith so tests
// can research Plate Mail on either side. Sides are isolated on a bare
// grass map so neither TC interferes with the melee exchange.
export function createChampionVsHalberdierFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 4000,
          wood: 500,
          gold: 4000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 54, y: 30 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 4000,
          wood: 500,
          gold: 4000,
          stone: 200,
        },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('champion', 1, 20, 18, { vision: 6 }),
      ownedSpawn('halberdier', 2, 22, 18, { vision: 3 }),
      ownedSpawn('town-center', 2, 54, 30, { vision: 7 }),
    ],
  };
}

// FU1 fixture: same as champion-vs-halberdier but with Plate Mail Armor
// pre-researched on the defending player-2 Halberdier's side. Lets the
// armor-reduces-damage test assert a one-point reduction in a single
// bridge-boot without waiting for Plate Mail to complete research.
export function createChampionVsArmoredHalberdierFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 4000,
          wood: 500,
          gold: 4000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 54, y: 30 },
        startingAge: 'imperial-age',
        // Pre-research Plate Mail so the Halberdier starts with +1 armor.
        startingResearchedTechnologies: ['plate-mail-armor'],
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('champion', 1, 20, 18, { vision: 6 }),
      ownedSpawn('halberdier', 2, 22, 18, { vision: 3 }),
      ownedSpawn('town-center', 2, 54, 30, { vision: 7 }),
    ],
  };
}

// FU2 fixture: two Imperial-Age players, one Barracks + one Militia each,
// with enough resources to research every militia-line upgrade (man-at-arms
// → long-swordsman → two-handed-swordsman → champion) back-to-back. Both
// sides sit far apart on a bare grass map so combat does not interfere
// with the research cadence.
export function createMilitiaLineFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 8000,
          wood: 500,
          gold: 8000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 28 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 8000,
          wood: 500,
          gold: 8000,
          stone: 200,
        },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('barracks', 1, 16, 6),
      ownedSpawn('militia', 1, 12, 13, { vision: 3 }),
      ownedSpawn('town-center', 2, 50, 28, { vision: 7 }),
      ownedSpawn('barracks', 2, 42, 26),
      ownedSpawn('militia', 2, 44, 33, { vision: 3 }),
    ],
  };
}
