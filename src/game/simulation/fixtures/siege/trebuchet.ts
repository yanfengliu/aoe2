import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../common';

// FU7 fixture: player-1 Trebuchet sitting far from any enemy. Used to
// assert a freshly-placed Trebuchet is packed by default and can move
// without paying the pack transition cost.
export function createTrebuchetPackFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 50, y: 8 },
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
        kind: 'trebuchet',
        x: 12,
        y: 14,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 10 },
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

// FU7 fixture: player-1 Trebuchet already inside its 16-tile range of a
// low-HP enemy Town Center. Used to prove the Trebuchet auto-unpacks
// over the ~50-tick transition before firing, and that once unpacked a
// fresh move order resumes the pack transition before walking away.
// Player 2 keeps a second Town Center far off-map so destroying the
// near one does not trigger a conquest victory — we need the match
// still running for the post-unpack move-command observation.
export function createTrebuchetVsBuildingFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 50, y: 25 },
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
        kind: 'trebuchet',
        x: 15,
        y: 8,
        owner: 1,
        baseOwner: 1,
        // Wide vision so the enemy TC is already visible when the
        // attack command lands.
        vision: { playerId: 1, radius: 18 },
      },
      {
        kind: 'town-center',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        // Low HP so one Trebuchet shot (attack 7 + 200 anti-building
        // bonus = 207) is guaranteed to kill it.
        startHp: 200,
      },
      // Second player-2 Town Center far from the action so conquest
      // does not fire when the near TC is destroyed.
      {
        kind: 'town-center',
        x: 50,
        y: 25,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
