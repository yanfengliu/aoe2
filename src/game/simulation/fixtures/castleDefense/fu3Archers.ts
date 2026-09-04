import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

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
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      // Owner 1 keeps ONE unit on the map, well clear of the Castle and the
      // target. These fixtures measure the Castle's ARROWS, and an owner with
      // no unit at all is a different question: from v0.3.202 the AI's
      // attack-group threshold does not apply to an enemy that has none, so
      // owner 2 would commit its lone Champion immediately and march it out of
      // range before the first arrow landed. A player with a villager is the
      // ordinary case, and it holds the Champion where an arrow count means
      // something.
      ownedSpawn('villager', 1, 6, 9, { vision: 4 }),
      // Champion at (20, 8). Closest Castle footprint cell is (17, 8),
      // distance 3 — well within range 8. Champion HP 70, 0 armor, so
      // one 11-damage arrow drops it to 59.
      ownedSpawn('champion', 2, 20, 8),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      // Owner 1 keeps ONE unit on the map, well clear of the Castle and the
      // target. These fixtures measure the Castle's ARROWS, and an owner with
      // no unit at all is a different question: from v0.3.202 the AI's
      // attack-group threshold does not apply to an enemy that has none, so
      // owner 2 would commit its lone Champion immediately and march it out of
      // range before the first arrow landed. A player with a villager is the
      // ordinary case, and it holds the Champion where an arrow count means
      // something.
      ownedSpawn('villager', 1, 6, 9, { vision: 4 }),
      // 3 archers against the Castle's south edge — the footprint runs to
      // y=9, so y=10 is genuinely adjacent and the garrison order lands
      // immediately instead of spending ticks walking (v0.3.42 made
      // garrisoning a walk-there-then-enter order).
      ownedSpawn('archer', 1, 14, 10, { vision: 5 }),
      ownedSpawn('archer', 1, 15, 10, { vision: 5 }),
      ownedSpawn('archer', 1, 16, 10, { vision: 5 }),
      ownedSpawn('champion', 2, 20, 8),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      // Owner 1 keeps ONE unit on the map, well clear of the Castle and the
      // target. These fixtures measure the Castle's ARROWS, and an owner with
      // no unit at all is a different question: from v0.3.202 the AI's
      // attack-group threshold does not apply to an enemy that has none, so
      // owner 2 would commit its lone Champion immediately and march it out of
      // range before the first arrow landed. A player with a villager is the
      // ordinary case, and it holds the Champion where an arrow count means
      // something.
      ownedSpawn('villager', 1, 6, 9, { vision: 4 }),
      ownedSpawn('archer', 1, 14, 10, { vision: 5 }),
      ownedSpawn('archer', 1, 15, 10, { vision: 5 }),
      ownedSpawn('archer', 1, 16, 10, { vision: 5 }),
      ownedSpawn('archer', 1, 17, 10, { vision: 5 }),
      ownedSpawn('archer', 1, 18, 10, { vision: 5 }),
      ownedSpawn('champion', 2, 20, 8),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 2, 2, { vision: 7 }),
      ownedSpawn('castle', 1, 6, 6),
      ownedSpawn('spearman', 2, 14, 8),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}
