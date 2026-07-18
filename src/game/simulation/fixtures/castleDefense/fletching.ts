import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

// Slice 6 fixture: a player-1 Longbowman stationed exactly 6 tiles from a
// stationary enemy Spearman. Used to assert ranged combat at the Longbow's
// canonical Castle-Age attack range without pursuit.
export function createLongbowmanRangedFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('longbowman', 1, 14, 8, { vision: 7 }),
      // Spearman at (20, 8). Manhattan distance from (14, 8) = 6, exactly
      // at the Longbow's canonical Castle-Age range.
      ownedSpawn('spearman', 2, 20, 8),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}

// Slice 6 fixture: Britons human with a completed Castle AND Blacksmith
// so the test can research Fletching, train a Longbowman, and assert the
// +1/+1 buff lands on the Castle-Age Britons unique.
export function createCastleFletchingFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      ownedSpawn('blacksmith', 1, 20, 6),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}

// Slice 6 fixture: Britons human with a completed Castle and 20 villagers
// adjacent to it, used to assert that up to 20 villagers can garrison a
// Castle (canonical capacity) — well above the Town Center / Watch Tower
// 5-unit cap.
export function createCastleGarrisonFixture(seed: string): PrototypeScenario {
  const villagerSpawns: ScenarioSpawnSpec[] = [];
  // Place 20 villagers on a grid around (20, 10) — clear of the Castle
  // at (14, 6). Each villager gets a unique cell so no two share a slot.
  for (let i = 0; i < 20; i += 1) {
    const offsetX = i % 5;
    const offsetY = Math.floor(i / 5);
    villagerSpawns.push(ownedSpawn('villager', 1, 20 + offsetX, 10 + offsetY));
  }
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('castle', 1, 14, 6),
      ...villagerSpawns,
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}

// Garrison-heal fixture: a completed player-1 Town Center at (8, 8) plus two
// pre-wounded villagers (startHp 5) side by side well clear of the TC
// footprint — one at (12, 10) that the test garrisons (and must heal), one
// at (14, 10) left on the field as a control (must NOT heal). No enemy is in
// range, so the only HP change comes from the garrison-heal system. The enemy
// Town Center sits far away so the match keeps running.
export function createGarrisonHealFixture(seed: string): PrototypeScenario {
  const woundedVillagers: ScenarioSpawnSpec[] = [
    ownedSpawn('villager', 1, 12, 10, { startHp: 5 }),
    ownedSpawn('villager', 1, 14, 10, { startHp: 5 }),
  ];
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ...woundedVillagers,
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}

// Herbal Medicine variant (v0.1.70): the same garrison-heal scenario with
// player 1 having researched Herbal Medicine on boot, so its garrisoned units
// heal 4× faster. A test races the garrisoned-heal gain against the baseline
// fixture over a shared pre-cap window.
export function createGarrisonHealHerbalFixture(seed: string): PrototypeScenario {
  const base = createGarrisonHealFixture(seed);
  return {
    ...base,
    starts: base.starts.map((start) =>
      start.owner === 1
        ? { ...start, startingResearchedTechnologies: ['herbal-medicine'] }
        : start,
    ),
  };
}
