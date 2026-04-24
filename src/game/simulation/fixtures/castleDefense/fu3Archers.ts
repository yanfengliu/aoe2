import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../common';

// FU3 fixture: player-1 Castle with a single enemy Champion at Castle
// anchor-to-target distance 8 (within range 8). Used as the no-archer
// baseline — the Castle fires 1 arrow per reload.
export function createFu3CastleNoArchersFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      // Champion at (20, 8). Closest Castle footprint cell is (17, 8),
      // distance 3 — well within range 8. Champion HP 70, 0 armor, so
      // one 11-damage arrow drops it to 59.
      {
        kind: 'champion',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: player-1 Castle + 3 adjacent archers waiting to garrison.
// The test drives them into the Castle via `issueContextCommandAtEntity`
// and verifies the 3-archer extra-arrows bonus brings the total to 4
// arrows per reload.
export function createFu3CastleThreeArchersFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      // 3 archers adjacent to the Castle's south edge — ready to garrison
      // via the issueContextCommandAtEntity(castle) flow.
      {
        kind: 'archer',
        x: 14,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 15,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 16,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'champion',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: same as three-archers but with 5 archers — verifies the
// 5-arrow cap holds (1 base + 4 archer bonus, not 1 + 5).
export function createFu3CastleFiveArchersFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'archer',
        x: 14,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 15,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 16,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 17,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 18,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'champion',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: Castle anchored at (6, 6), 4x4, with an enemy Spearman at
// (14, 8). Anchor-to-target Manhattan distance is |14-6| + |8-6| = 10.
// Closest footprint cell is (9, 8) at distance 5. Pre-FU3 the Castle
// ignored this target (distance 10 > range 8); post-FU3 it fires.
export function createFu3CastleEdgeRangeFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 2, y: 2 },
        startingAge: 'castle-age',
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 2,
        y: 2,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 6,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'spearman',
        x: 14,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
