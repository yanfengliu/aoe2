import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../common';

// Slice 7D fixture: player-1 Bombard Cannon placed at distance 10 from an
// enemy Town Center (inside max-range 12, outside min-range 5). Used to
// assert Bombard Cannon carries a +80 anti-building bonus. A TC with a
// low startHp (200) dies in two hits of 40 base + 80 bonus = 120 each.
// Full-review M12: owner 2 holds TWO Town Centers — TC-A (survivor, spawned
// first) and TC-B (spawned LAST, so it is owner 2's referenced TC; low startHp
// so the human bombard razes it in one hit). After TC-B is destroyed the
// per-owner TC reference must RE-SELECT the surviving TC-A, not be deleted.
export function createTownCenterReselectFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 }, startingAge: 'imperial-age' },
      { owner: 2, townCenter: { x: 28, y: 8 }, startingAge: 'imperial-age' },
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
        kind: 'bombard-cannon',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 13 },
      },
      // Owner 2's SURVIVING TC (spawned first).
      {
        kind: 'town-center',
        x: 28,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Owner 2's REFERENCED TC (spawned last), placed in bombard range, low HP.
      {
        kind: 'town-center',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startHp: 200,
      },
    ],
  };
}

export function createBombardCannonVsBuildingFixture(seed: string): PrototypeScenario {
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
        kind: 'bombard-cannon',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 13 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startHp: 200,
      },
    ],
  };
}

// Slice 7D fixture: player-1 Bombard Cannon with an enemy Spearman inside
// its min-range 5 dead-zone. Used to assert the Bombard Cannon holds fire
// at close range.
export function createBombardCannonMinRangeBlockedFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 40, y: 8 },
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
        kind: 'bombard-cannon',
        x: 14,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 13 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Spearman at distance 3 — inside the Bombard Cannon's min range of 5.
      {
        kind: 'spearman',
        x: 17,
        y: 18,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}
