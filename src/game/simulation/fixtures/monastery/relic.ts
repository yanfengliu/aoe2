import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';

// Slice 5 fixture: Castle-Age human start with a completed Monastery and a
// nearby neutral relic. Used for Monastery train-menu, Monk build placement,
// pickup, and deposit tests without waiting for placement. Player 2 starts
// with a standard TC for containment and owns a wounded Spearman (heal
// target) and a Militia (convert target) close by.
export function createMonasteryFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('monastery', 1, 14, 6),
      ownedSpawn('villager', 1, 6, 10, { vision: 4 }),
      gaiaSpawn('relic', 14, 12, { amount: 0 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

// Slice 5 fixture for relic drop on Monastery destruction: a player-2
// Monastery at (18, 8) pre-seeded with one deposited relic, its HP
// knocked down to 10 so a single-hit destroy is deterministic, and a
// player-1 Pikeman adjacent for the human test to command into an
// attack. When the Monastery dies, the relic should drop back onto
// the map near the footprint.
// Slice 6 review fix: a Monastery with 2 stored relics, completely
// surrounded by trees on every cell at manhattan distance 1 and 2 of
// the footprint. The existing radius-capped drop search (range 2)
// finds zero free approach cells in this scenario, so pre-fix the
// stored relics vanish on destruction. A Mangonel sits beyond the
// tree ring and shells the Monastery into the ground from range, so
// the destruction itself does not require an open approach.
export function createMonkRelicDropCrampedFixture(seed: string): PrototypeScenario {
  const monasteryAnchor = { x: 10, y: 10 };
  const footprintMinX = monasteryAnchor.x;
  const footprintMaxX = monasteryAnchor.x + 1;
  const footprintMinY = monasteryAnchor.y;
  const footprintMaxY = monasteryAnchor.y + 1;
  const blockerRange = 2;
  const blockerSpawns: ScenarioSpawnSpec[] = [];
  for (let y = footprintMinY - blockerRange; y <= footprintMaxY + blockerRange; y += 1) {
    for (let x = footprintMinX - blockerRange; x <= footprintMaxX + blockerRange; x += 1) {
      const insideFootprint = x >= footprintMinX && x <= footprintMaxX
        && y >= footprintMinY && y <= footprintMaxY;
      if (insideFootprint) {
        continue;
      }
      const dx =
        x < footprintMinX ? footprintMinX - x
        : x > footprintMaxX ? x - footprintMaxX
        : 0;
      const dy =
        y < footprintMinY ? footprintMinY - y
        : y > footprintMaxY ? y - footprintMaxY
        : 0;
      const distance = dx + dy;
      if (distance === 0 || distance > blockerRange) {
        continue;
      }
      blockerSpawns.push({
        kind: 'tree',
        x,
        y,
        owner: null,
        baseOwner: null,
        amount: 100,
      });
    }
  }

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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 20 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      // Wide vision so the Mangonel sees its target without having
      // to drive its own LOS forward through the tree ring.
      ownedSpawn('town-center', 1, 4, 4, { vision: 18 }),
      // Hostile Monastery — owns 2 relics deposited ahead of time;
      // extremely low HP so the Mangonel one-shots it.
      ownedSpawn('monastery', 2, monasteryAnchor.x, monasteryAnchor.y, {
        vision: 7,
        startingRelicsInMonastery: 2,
        startHp: 10,
      }),
      ...blockerSpawns,
      // Mangonel parked beyond the tree ring at manhattan distance 5
      // from the nearest Monastery cell (well within range 7 and
      // outside min range 3).
      ownedSpawn('mangonel', 1, 10, 16, { vision: 9 }),
      ownedSpawn('town-center', 2, 40, 20, { vision: 7 }),
    ],
  };
}

export function createMonkRelicDropFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('monastery', 2, 18, 8, {
        vision: 7,
        startingRelicsInMonastery: 1,
        startHp: 10,
      }),
      ownedSpawn('pikeman', 1, 17, 8, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}

// Slice 5 fixture for Monk relic pickup + deposit: player-1 Monk, a neutral
// relic adjacent, and a player-1 Monastery 4 cells away. Used for pickup,
// follow, deposit, and gold-income tests.
export function createMonkRelicFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('monastery', 1, 18, 8),
      ownedSpawn('monk', 1, 14, 8, { vision: 9 }),
      gaiaSpawn('relic', 15, 8, { amount: 0 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}
