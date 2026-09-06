import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { FIXTURE_MIXED_SELECTION_HOUSE_POSITION, FIXTURE_MIXED_SELECTION_UNITS, FIXTURE_STACK_POSITION, FIXTURE_VILLAGER_CLUSTER, createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from './common';

export function createTownCenterDefenseFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('scout', 2, 12, 8, { vision: 6 }),
    ],
  };
}

export function createVillagerSelectionFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[0].x, FIXTURE_VILLAGER_CLUSTER[0].y, {
        vision: 4,
      }),
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[1].x, FIXTURE_VILLAGER_CLUSTER[1].y, {
        vision: 4,
      }),
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[2].x, FIXTURE_VILLAGER_CLUSTER[2].y, {
        vision: 4,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createDoubleClickSelectionFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[0].x, FIXTURE_VILLAGER_CLUSTER[0].y, {
        vision: 4,
      }),
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[1].x, FIXTURE_VILLAGER_CLUSTER[1].y, {
        vision: 4,
      }),
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[2].x, FIXTURE_VILLAGER_CLUSTER[2].y, {
        vision: 4,
      }),
      ownedSpawn('scout', 1, 9, 12, { vision: 6 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createMixedSelectionFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('house', 1, FIXTURE_MIXED_SELECTION_HOUSE_POSITION.x, FIXTURE_MIXED_SELECTION_HOUSE_POSITION.y),
      ownedSpawn(FIXTURE_MIXED_SELECTION_UNITS[0].kind, 1, FIXTURE_MIXED_SELECTION_UNITS[0].x, FIXTURE_MIXED_SELECTION_UNITS[0].y, {
        vision: 4,
      }),
      ownedSpawn(FIXTURE_MIXED_SELECTION_UNITS[1].kind, 1, FIXTURE_MIXED_SELECTION_UNITS[1].x, FIXTURE_MIXED_SELECTION_UNITS[1].y, {
        vision: 5,
      }),
      ownedSpawn(FIXTURE_MIXED_SELECTION_UNITS[2].kind, 1, FIXTURE_MIXED_SELECTION_UNITS[2].x, FIXTURE_MIXED_SELECTION_UNITS[2].y, {
        vision: 6,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createTileSelectionCycleFixture(seed: string): PrototypeScenario {
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
    // Slice 12 Task B: deliberate overlap — the UX tests need a house +
    // militia + sheep stacked on one cell so tile-selection-cycle can
    // iterate through all three. Each opts out of the fixture validator
    // with `allowOverlappingSpawn`.
    //
    // THE ORDER OF THIS LIST IS LOAD-BEARING, and it is the militia-to-sheep
    // DISTANCE in it that matters: they are 1st and 5th, four apart.
    //
    // A unit is drawn at its cell plus one of four quarter-cell slots,
    // `UNIT_CELL_SLOT_OFFSETS[entityId % 4]` (bridge/pureHelpers.ts), so
    // several units on one cell never cover each other. A sheep carries a
    // `unitTransform` too (entityCreateOps.ts), so it takes a slot as well.
    // The slots are 0.5 cells apart while the militia's body is 0.25 across
    // and the sheep's 0.231, so two different slots leave a 0.019-cell gap:
    // the two bodies are either exactly coincident or they never touch.
    // Ids are handed out one per spawn in this list's order, so the two share
    // a slot exactly when their positions here differ by a multiple of four.
    //
    // Coincident is what the exact-click test needs. `tests/browser/game-
    // selection-click.spec.ts` looks for a screen point where all three
    // bodies answer one click, and cycles the selection there; with the
    // bodies apart, the only such points were where the two RENDERED voxel
    // silhouettes happened to graze each other — 4 of the 625 offsets the
    // old scan probed, in a ribbon one sample wide with a third of a screen
    // pixel of room, whose edge moves with the idle animation. That is what
    // made the test fail on a slow CI host.
    //
    // So: do not insert, remove or reorder a spawn here without keeping the
    // militia and the sheep four apart. The browser test measures the margin
    // it found and fails loudly if this degrades, but it is 14 minutes away.
    spawns: [
      ownedSpawn('militia', 1, FIXTURE_STACK_POSITION.x, FIXTURE_STACK_POSITION.y, {
        vision: 5,
        allowOverlappingSpawn: true,
      }),
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('house', 1, FIXTURE_STACK_POSITION.x, FIXTURE_STACK_POSITION.y, {
        allowOverlappingSpawn: true,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      gaiaSpawn('sheep', FIXTURE_STACK_POSITION.x, FIXTURE_STACK_POSITION.y, {
        baseOwner: 1,
        amount: 100,
        allowOverlappingSpawn: true,
      }),
    ],
  };
}
