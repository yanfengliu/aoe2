import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import type { BuildingType } from '../types';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';

// Every building gives its owner sight (2026-09-24, defect register "Only
// seven building types gave their owner any sight").
//
// `building-vision-fixture` holds ONE completed building of every type for the
// human, each WITHOUT an explicit vision radius, so each takes the game's own
// table, and no unit of the human's anywhere: the human's sight IS its
// buildings' sight, and a test can compare it cell for cell with the union of
// the buildings' circles. Spaced so no footprints touch; circles may overlap,
// which a union does not mind. The Dock and the Fish Trap sit on a pool.
export const BUILDING_VISION_ROSTER: ReadonlyArray<{ kind: BuildingType; x: number; y: number }> = [
  // The 4x4 landmarks.
  { kind: 'town-center', x: 2, y: 2 },
  { kind: 'castle', x: 8, y: 2 },
  { kind: 'wonder', x: 14, y: 2 },
  { kind: 'market', x: 20, y: 2 },
  // The 3x3 halls.
  { kind: 'barracks', x: 2, y: 8 },
  { kind: 'stable', x: 7, y: 8 },
  { kind: 'archery-range', x: 12, y: 8 },
  { kind: 'siege-workshop', x: 17, y: 8 },
  { kind: 'blacksmith', x: 22, y: 8 },
  // The 2x2 economy and research buildings.
  { kind: 'house', x: 2, y: 13 },
  { kind: 'mill', x: 6, y: 13 },
  { kind: 'lumber-camp', x: 10, y: 13 },
  { kind: 'mining-camp', x: 14, y: 13 },
  { kind: 'monastery', x: 18, y: 13 },
  { kind: 'university', x: 22, y: 13 },
  // The 1x1 structures.
  { kind: 'watch-tower', x: 2, y: 17 },
  { kind: 'bombard-tower', x: 5, y: 17 },
  { kind: 'outpost', x: 8, y: 17 },
  { kind: 'farm', x: 11, y: 17 },
  { kind: 'stone-wall', x: 14, y: 17 },
  { kind: 'palisade-wall', x: 17, y: 17 },
  { kind: 'stone-gate', x: 20, y: 17 },
  { kind: 'palisade-gate', x: 23, y: 17 },
  // On the pool's south shore, and in the pool.
  { kind: 'dock', x: 27, y: 13 },
  { kind: 'fish-trap', x: 29, y: 10 },
];

function poolTerrain() {
  const terrain = createGrassFixtureTerrain();
  for (let y = 8; y <= 12; y += 1) {
    for (let x = 27; x <= 31; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return terrain;
}

export function createBuildingVisionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: poolTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 2, y: 2 }, disableAi: true },
      { owner: 2, townCenter: { x: 50, y: 28 }, disableAi: true },
    ],
    spawns: [
      ...BUILDING_VISION_ROSTER.map(({ kind, x, y }) => ownedSpawn(kind, 1, x, y)),
      // Owner 2 is here only so the match is not over at boot; its sight is its own.
      ownedSpawn('town-center', 2, 50, 28, { vision: 1 }),
    ],
  };
}

// `building-vision-build-fixture`: the construction half. One human villager
// in open ground with wood to spare, a Town Center far away in the south-west
// corner whose sight is pinned to one cell so it lights nothing near the build
// sites, and owner 2 with its AI off. A test has the villager build a House and
// a Barracks, walks it away, and reads the fog around the two buildings.
export const BUILDING_VISION_BUILDER = { x: 30, y: 16 };
export const BUILDING_VISION_HOUSE_SITE = { x: 38, y: 10 };
export const BUILDING_VISION_BARRACKS_SITE = { x: 38, y: 20 };

export function createBuildingVisionBuildFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 1, y: 31 },
        startingResources: { food: 200, wood: 1000, gold: 100, stone: 200 },
      },
      { owner: 2, townCenter: { x: 54, y: 2 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 1, 31, { vision: 1 }),
      ownedSpawn('villager', 1, BUILDING_VISION_BUILDER.x, BUILDING_VISION_BUILDER.y, { vision: 4 }),
      ownedSpawn('town-center', 2, 54, 2, { vision: 1 }),
    ],
  };
}
