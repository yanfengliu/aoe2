import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../common';

// Slice 5 fixture for Monk heal: player-1 Monk adjacent to a friendly
// Spearman with a neutral wolf close enough to auto-aggro the Spearman when
// the test walks the wolf into aggro range. The wolf applies damage over a
// few ticks, letting the test observe a wounded Spearman before issuing the
// heal order.
export function createMonkHealFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 40, y: 8 },
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
        kind: 'monk',
        x: 14,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'spearman',
        x: 15,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        // Wolf auto-aggros on the nearest player unit within its aggro range;
        // placed at (17, 17) → range 2 from the Spearman at (15, 17). Wolf
        // attack 3 / reload 12, so HP accrues slowly and we can stop combat
        // by killing the wolf once it's done some damage.
        kind: 'wolf',
        x: 17,
        y: 17,
        owner: null,
        baseOwner: null,
        amount: 0,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fix: a healthy friendly Militia and an enemy Militia share one
// coarse cell. The Monk should fall through to convert the enemy because
// pass-1 heal targeting must skip a friendly with full HP. Pre-fix the
// Monk picked up the healthy friendly in pass-1, fell into the
// move-fallback inside issueMonkContextCommandAtEntity, and never
// converted anything.
export function createMonkHealthyFriendlyWithEnemyFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 40, y: 8 },
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
        kind: 'monk',
        x: 14,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      // Friendly Militia at full HP — the heal pass must skip it.
      {
        kind: 'militia',
        x: 16,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      // Enemy Militia stacked on the same cell — the convert pass should
      // pick this up.
      {
        kind: 'militia',
        x: 16,
        y: 17,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk heal-over-convert target preference: a friendly
// (damaged) Spearman and an enemy Militia share the same coarse cell. The
// test right-clicks that cell and expects the Monk to heal the Spearman,
// not convert the Militia.
export function createMonkHealOverConvertFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 40, y: 8 },
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
        kind: 'monk',
        x: 14,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'spearman',
        x: 16,
        y: 17,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'militia',
        x: 16,
        y: 17,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
