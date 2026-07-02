import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../common';

// Slice 5 fixture for Monk convert: player-1 Monk adjacent to an enemy
// Militia. After about 50 ticks the Militia flips to player 1.
export function createMonkConvertFixture(seed: string): PrototypeScenario {
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
        kind: 'militia',
        x: 15,
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

// Heresy (v0.1.71) fixture: same as the convert fixture, but the TARGET owner
// (player 2) has researched Heresy, so instead of flipping to player 1 the
// Militia DIES when the conversion completes.
export function createMonkConvertHeresyFixture(seed: string): PrototypeScenario {
  const base = createMonkConvertFixture(seed);
  return {
    ...base,
    starts: base.starts.map((start) =>
      start.owner === 2
        ? { ...start, startingResearchedTechnologies: ['heresy'], disableAi: true }
        : { ...start, disableAi: true },
    ),
  };
}

// Regression fixture for the Monk-conversion flip-flop bug (review C-1).
// Two enemy Monks (owners 1 and 2) sit within MONK_ACTION_RANGE of a
// neutral player-3 Militia. The test pre-seeds both Monk tasks via a
// save-blob mutation; the contract is that conversion progress must
// accumulate for the first-processed Monk's owner each tick instead of
// being wiped to zero by every later-processed enemy Monk.
export function createMonkFlipFlopFixture(seed: string): PrototypeScenario {
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
        disableAi: true,
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 4 },
        startingAge: 'castle-age',
        disableAi: true,
      },
      {
        owner: 3,
        townCenter: { x: 4, y: 28 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 50,
        y: 4,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 4,
        y: 28,
        owner: 3,
        baseOwner: 3,
        vision: { playerId: 3, radius: 3 },
      },
      {
        kind: 'monk',
        x: 28,
        y: 16,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'monk',
        x: 28,
        y: 18,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
      },
      {
        kind: 'militia',
        x: 29,
        y: 17,
        owner: 3,
        baseOwner: 3,
        vision: { playerId: 3, radius: 3 },
      },
    ],
  };
}

// Slice 5 fixture for two Monks converting the same enemy Militia. The
// per-tick progress rate must stay fixed — each convert target can only
// receive one progress tick per simulation tick, no matter how many Monks
// are in range.
export function createMonkDoubleConvertFixture(seed: string): PrototypeScenario {
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
        kind: 'monk',
        x: 14,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'militia',
        x: 15,
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

// Slice 5 fixture for post-conversion cleanup: player-1 Monk plus a
// player-1 Pikeman attacking an enemy Militia. When the Monk converts the
// Militia, the Pikeman's attack command must be cleared since the target
// is now a teammate.
export function createMonkConvertCleanupFixture(seed: string): PrototypeScenario {
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
        kind: 'pikeman',
        x: 14,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        // Militia has a ton of HP relative to default so the Pikeman does
        // not kill it before conversion completes (~50 ticks).
        kind: 'militia',
        x: 15,
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

// Slice 5 fixture for Monk convert + vision handoff: player-1 Monk with a
// small vision radius positioned far from the player's TC, adjacent to an
// enemy Scout whose own vision radius is large enough to cover cells the
// player cannot otherwise see. Used to verify that a successful conversion
// reassigns the target's visionSource.playerId to the Monk's owner.
export function createMonkConvertVisionFixture(seed: string): PrototypeScenario {
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
        // Keep TC vision short so it does not overlap the Monk/Scout area.
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'monk',
        x: 20,
        y: 20,
        owner: 1,
        baseOwner: 1,
        // Small vision so only the Monk's immediate cells are visible —
        // cells 3+ away around the Scout are fog-hidden until vision flips.
        vision: { playerId: 1, radius: 2 },
      },
      {
        kind: 'scout',
        x: 21,
        y: 20,
        owner: 2,
        baseOwner: 2,
        // Radius 6 so (scoutX + 3) is inside the Scout's vision but
        // outside the Monk's radius-2 vision. After conversion, player 1
        // should see that cell iff the Scout's visionSource playerId was
        // flipped.
        vision: { playerId: 2, radius: 6 },
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

// Slice 5 fixture for Monk-in-fog: player-1 Monk at home with short Town
// Center and Monk vision. Enemy Militia spawns just outside Monk vision but
// inside the Monk's conversion range. Used to verify the cell-based context
// resolver rejects fog-hidden enemy targets so the fallback is a plain move,
// not a convert.
export function createMonkFogFixture(seed: string): PrototypeScenario {
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
        vision: { playerId: 1, radius: 3 },
      },
      {
        // Slice 12 Task B: moved from (8, 10) (inside TC footprint at
        // 8..11, 8..11). (8, 12) keeps the Monk just south of the TC
        // and still within MONK_ACTION_RANGE = 4 of the enemy militia.
        kind: 'monk',
        x: 8,
        y: 12,
        owner: 1,
        baseOwner: 1,
        // Small vision so the adjacent enemy Militia is in fog.
        vision: { playerId: 1, radius: 1 },
      },
      {
        // Distance 3 from the Monk at (8, 12) (manhattan, to (11, 12))
        // → within MONK_ACTION_RANGE = 4 but outside Monk's radius-1
        // vision; the TC's radius-3 vision from (8, 8) also does not
        // reach. Fog hides the unit from the human.
        kind: 'militia',
        x: 11,
        y: 12,
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
