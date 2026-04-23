import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from './common';

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
        y: 8,
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
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Slice 7C combat fixture: player-1 Camel adjacent to a player-2 Hussar.
// Verifies that the Camel anti-cavalry bonus fires against the Hussar
// (Imperial successor of the Light Cavalry line) via isCavalryTarget.
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
        y: 8,
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
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 11 },
      },
    ],
  };
}

// Slice 7C combat fixture: player-1 Halberdier adjacent to a player-2
// Cavalier. Verifies the Halberdier +28 anti-cavalry bonus fires against
// the Cavalier (Imperial successor of the Knight line) via isCavalryTarget.
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
        y: 8,
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
        y: 8,
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
        y: 8,
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
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Castle-Age combat fixture: a player-1 Camel stationed next to an enemy
// (player 2) Knight and Scout, used to assert the Camel's +9 anti-cavalry
// bonus without pursuit / pathing noise. All three units start in Castle
// Age and adjacent, so the Camel can hit on tick 1.
export function createCamelVsCavalryFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
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
        y: 8,
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
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'scout',
        x: 14,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Castle-Age combat fixture: a player-1 Spearman next to an enemy (player 2)
// Camel, used to assert the Spearman's anti-cavalry bonus does NOT fire
// against Camels (Camels are anti-cavalry, not cavalry targets).
export function createSpearmanVsCamelFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
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
        kind: 'spearman',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
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
        kind: 'camel',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Castle-Age ranged combat fixture: a player-1 Cavalry Archer stationed
// exactly 4 tiles (its attack range) away from a stationary enemy Militia.
// Used to assert the Cavalry Archer fires at range without closing.
export function createCavalryArcherRangedFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
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
        kind: 'cavalry-archer',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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
        kind: 'militia',
        x: 16,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Castle-Age ranged combat fixture: a player-1 Skirmisher stationed adjacent to
// a stationary enemy Cavalry Archer. Used to assert the Skirmisher's +4
// anti-archer bonus extends to Cavalry Archer (Cavalry Archer is in the
// archer family).
export function createSkirmisherVsCavalryArcherFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
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
        kind: 'skirmisher',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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
        kind: 'cavalry-archer',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 5 },
      },
    ],
  };
}

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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'militia',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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
        kind: 'scout',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
      },
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
        owner: 2,
        townCenter: { x: 24, y: 8 },
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
        kind: 'militia',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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
        kind: 'scout',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        velocity: { dx: 1, dy: 0 },
        wanderBounds: {
          minX: 15,
          maxX: 17,
          minY: 8,
          maxY: 8,
        },
        vision: { playerId: 2, radius: 6 },
      },
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
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'champion',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'halberdier',
        x: 22,
        y: 18,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 54,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
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
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'champion',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'halberdier',
        x: 22,
        y: 18,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 54,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'barracks',
        x: 16,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'militia',
        x: 12,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 50,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'barracks',
        x: 42,
        y: 26,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'militia',
        x: 44,
        y: 33,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// FU2 fixture: Imperial-Age player 1 with a Stable + Knight + Camel so both
// the Paladin upgrade (Knight → Cavalier → Paladin) and the Heavy Camel
// upgrade (Camel → Heavy Camel) can be exercised. The player-2 TC sits
// far from the action so no auto-combat fires during the research
// cadence; the Heavy Camel anti-cavalry bonus is exercised in the
// separate `heavy-camel-vs-knight-fixture` below.
export function createPaladinFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 50, y: 8 },
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'stable',
        x: 16,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'knight',
        x: 14,
        y: 14,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'camel',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 50,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU2 fixture: a pre-upgraded player-1 Heavy Camel placed adjacent to a
// player-2 Knight so the anti-cavalry +9 bonus fires on the first hit.
// Spawning Heavy Camel directly (rather than upgrading at runtime) keeps
// the test a single tick away from verifying bonus damage and sidesteps
// long-path-and-survive issues seen when the Heavy Camel had to close
// the gap across the map during research.
export function createHeavyCamelVsKnightFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 50, y: 28 },
        startingAge: 'imperial-age',
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
        kind: 'heavy-camel',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'knight',
        x: 22,
        y: 18,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 50,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
